#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`[ziwei-iztro-runner] ${message}`);
  process.exit(1);
}

function parseInputFile(filePath) {
  if (!filePath) {
    fail('Missing input JSON path. Usage: node iztro_runner.mjs <input.json>');
  }

  const resolved = resolve(process.cwd(), filePath);

  let content;
  try {
    content = readFileSync(resolved, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail(`Input file not found: ${resolved}`);
    }
    fail(`Cannot read input file: ${error.message}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    fail(`Invalid JSON in input file: ${error.message}`);
  }
}

/**
 * Normalize a YYYY-M-D date string. When isLunar is true, skip the Gregorian
 * round-trip check (lunar months can have 30 days that don't exist in the
 * corresponding Gregorian month).
 */
function normalizeYmd(dateText, fieldName, { isLunar = false } = {}) {
  if (typeof dateText !== 'string') {
    fail(`${fieldName} must be a string in YYYY-M-D or YYYY-MM-DD.`);
  }

  const match = dateText.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    fail(`${fieldName} must match YYYY-M-D or YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    fail(`${fieldName} month must be 1..12.`);
  }

  // Lunar months have at most 30 days; solar months at most 31.
  const maxDay = isLunar ? 30 : 31;
  if (day < 1 || day > maxDay) {
    fail(`${fieldName} day must be 1..${maxDay}.`);
  }

  // For solar dates, verify the date actually exists in the Gregorian calendar.
  if (!isLunar) {
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
      utc.getUTCFullYear() !== year ||
      utc.getUTCMonth() + 1 !== month ||
      utc.getUTCDate() !== day
    ) {
      fail(`${fieldName} is not a valid calendar date.`);
    }
  }

  return `${year}-${month}-${day}`;
}

function dateInTimeZone(timeZone, instant = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    fail(`Cannot resolve date parts for timezone ${timeZone}.`);
  }

  return `${Number(year)}-${Number(month)}-${Number(day)}`;
}

/**
 * Create a Date at noon on the given calendar date. Uses the numeric Date
 * constructor so that getFullYear/getMonth/getDate always return the intended
 * values — no dependency on process.env.TZ.
 */
function localNoonDate(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

// ---------------------------------------------------------------------------
// JSON sanitisation
// ---------------------------------------------------------------------------

function buildSafeReplacer() {
  const seen = new WeakSet();

  return (_, value) => {
    if (typeof value === 'function') {
      return undefined;
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }

    return value;
  };
}

function sanitizeForJson(data) {
  return JSON.parse(JSON.stringify(data, buildSafeReplacer()));
}

// ---------------------------------------------------------------------------
// Mutagen (四化) tag maps
// ---------------------------------------------------------------------------

const MUTAGEN_LABELS = ['禄', '权', '科', '忌'];

function buildMutagenMap(stars = [], scopeName) {
  const map = new Map();

  stars.forEach((starName, index) => {
    if (!starName) return;
    const label = MUTAGEN_LABELS[index] || String(index);
    const existing = map.get(starName) || [];
    existing.push(`${scopeName}${label}`);
    map.set(starName, existing);
  });

  return map;
}

function collectNatalMutagenTags(palaces = []) {
  const map = new Map();

  palaces.forEach((palace) => {
    const stars = [...(palace.majorStars || []), ...(palace.minorStars || [])];
    stars.forEach((star) => {
      if (!star?.name || !star?.mutagen) return;
      const existing = map.get(star.name) || [];
      existing.push(`本命${star.mutagen}`);
      map.set(star.name, existing);
    });
  });

  return map;
}

function buildAllMutagenMaps(astrolabe, snapshot) {
  return [
    collectNatalMutagenTags(astrolabe.palaces || []),
    buildMutagenMap(snapshot?.decadal?.mutagen, '大限'),
    buildMutagenMap(snapshot?.yearly?.mutagen, '流年'),
    buildMutagenMap(snapshot?.monthly?.mutagen, '流月'),
    buildMutagenMap(snapshot?.daily?.mutagen, '流日'),
    buildMutagenMap(snapshot?.hourly?.mutagen, '流时'),
  ];
}

// ---------------------------------------------------------------------------
// Scope star maps (流星按宫位名/索引映射)
// ---------------------------------------------------------------------------

function buildScopePalaceMap(scope) {
  const palaceNameList = Array.isArray(scope?.palaceNames) ? scope.palaceNames : [];
  const starsList = Array.isArray(scope?.stars) ? scope.stars : [];

  const map = new Map();
  palaceNameList.forEach((palaceName, index) => {
    map.set(palaceName, starsList[index] || []);
  });

  return map;
}

function buildAllScopePalaceMaps(snapshot) {
  return {
    decadal: buildScopePalaceMap(snapshot?.decadal),
    age: buildScopePalaceMap(snapshot?.age),
    yearly: buildScopePalaceMap(snapshot?.yearly),
    monthly: buildScopePalaceMap(snapshot?.monthly),
    daily: buildScopePalaceMap(snapshot?.daily),
    hourly: buildScopePalaceMap(snapshot?.hourly),
  };
}

function scopeStarsAtIndex(scope, index) {
  const starsList = Array.isArray(scope?.stars) ? scope.stars : [];
  return starsList[index] || [];
}

function scopeRoleAtIndex(scope, index) {
  const palaceNames = Array.isArray(scope?.palaceNames) ? scope.palaceNames : [];
  return palaceNames[index] || null;
}

// ---------------------------------------------------------------------------
// Star entry helpers
// ---------------------------------------------------------------------------

function starEntryWithTags(star, tagMaps) {
  const tags = [];
  tagMaps.forEach((map) => {
    const matched = map.get(star.name);
    if (matched) tags.push(...matched);
  });

  return {
    name: star.name,
    type: star.type || null,
    scope: star.scope || null,
    brightness: star.brightness || null,
    mutagen: star.mutagen || null,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Yearly dec star context (岁前/将前十二神)
// ---------------------------------------------------------------------------

function buildYearlyDecStarContext(snapshot) {
  const suiqian = snapshot?.yearly?.yearlyDecStar?.suiqian12 || [];
  const jiangqian = snapshot?.yearly?.yearlyDecStar?.jiangqian12 || [];
  const palaceNames = snapshot?.yearly?.palaceNames || [];

  const indexByPalace = new Map();
  palaceNames.forEach((name, index) => {
    indexByPalace.set(name, index);
  });

  return { suiqian, jiangqian, indexByPalace };
}

// ---------------------------------------------------------------------------
// Single palace entry builder
// ---------------------------------------------------------------------------

const PALACE_ALIASES = {
  官禄: '事业',
  仆役: '交友',
};

const SCOPE_KEYS = ['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'];

function buildFlowStarsByRole(palace, scopeMaps, tagMaps) {
  const result = {};
  for (const key of SCOPE_KEYS) {
    result[key] = (scopeMaps[key].get(palace.name) || []).map((s) => starEntryWithTags(s, tagMaps));
  }
  return result;
}

function buildFlowStarsByIndex(palace, snapshot, tagMaps) {
  const result = {};
  for (const key of SCOPE_KEYS) {
    result[key] = scopeStarsAtIndex(snapshot?.[key], palace.index).map((s) =>
      starEntryWithTags(s, tagMaps),
    );
  }
  return result;
}

function buildFlowRoleAtIndex(palace, snapshot) {
  const result = {};
  for (const key of SCOPE_KEYS) {
    result[key] = scopeRoleAtIndex(snapshot?.[key], palace.index);
  }
  return result;
}

function buildPalaceEntry(palace, ctx) {
  const { tagMaps, scopeMaps, yearlyDec, snapshot, includeIndexMapping } = ctx;

  const yearlyIndex = yearlyDec.indexByPalace.get(palace.name);

  const flowStarsByRole = buildFlowStarsByRole(palace, scopeMaps, tagMaps);

  return {
    palaceIndex: palace.index,
    palaceName: palace.name,
    palaceAlias: PALACE_ALIASES[palace.name] || null,
    palaceDisplayName: `${PALACE_ALIASES[palace.name] || palace.name}宫${palace.isBodyPalace ? '-身宫' : ''}`,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: Boolean(palace.isBodyPalace),
    isOriginalPalace: Boolean(palace.isOriginalPalace),
    changsheng12: palace.changsheng12 || null,
    boshi12: palace.boshi12 || null,
    jiangqian12: palace.jiangqian12 || null,
    suiqian12: palace.suiqian12 || null,
    yearlyDecStar:
      yearlyIndex === undefined
        ? { suiqian12: null, jiangqian12: null }
        : {
            suiqian12: yearlyDec.suiqian[yearlyIndex] || null,
            jiangqian12: yearlyDec.jiangqian[yearlyIndex] || null,
          },
    yearlyDecStarByIndex: includeIndexMapping
      ? {
          suiqian12: yearlyDec.suiqian[palace.index] || null,
          jiangqian12: yearlyDec.jiangqian[palace.index] || null,
        }
      : null,
    natal: {
      majorStars: (palace.majorStars || []).map((s) => starEntryWithTags(s, tagMaps)),
      minorStars: (palace.minorStars || []).map((s) => starEntryWithTags(s, tagMaps)),
      adjectiveStars: (palace.adjectiveStars || []).map((s) => starEntryWithTags(s, tagMaps)),
    },
    flowStarsByRole,
    flowStarsByIndex: includeIndexMapping
      ? buildFlowStarsByIndex(palace, snapshot, tagMaps)
      : null,
    flowRoleAtIndex: includeIndexMapping ? buildFlowRoleAtIndex(palace, snapshot) : null,
    decadalRange: Array.isArray(palace?.decadal?.range) ? [...palace.decadal.range] : null,
    decadalGanZhi: palace?.decadal
      ? `${palace.decadal.heavenlyStem}${palace.decadal.earthlyBranch}`
      : null,
    ages: Array.isArray(palace?.ages) ? [...palace.ages] : [],
  };
}

// ---------------------------------------------------------------------------
// Detailed report builders
// ---------------------------------------------------------------------------

function buildDetailedPalaceReport(astrolabe, snapshot, options = {}) {
  const includeIndexMapping = options.includeIndexMapping === true;

  const tagMaps = buildAllMutagenMaps(astrolabe, snapshot);
  const scopeMaps = buildAllScopePalaceMaps(snapshot);
  const yearlyDec = buildYearlyDecStarContext(snapshot);

  const ctx = { tagMaps, scopeMaps, yearlyDec, snapshot, includeIndexMapping };

  return (astrolabe.palaces || []).map((palace) => buildPalaceEntry(palace, ctx));
}

function buildDetailedSnapshot(astrolabe, snapshot, targetSolarDate, options = {}) {
  return {
    targetSolarDate,
    targetLunarDate: snapshot?.lunarDate || null,
    age: sanitizeForJson(snapshot?.age || null),
    decadal: sanitizeForJson(snapshot?.decadal || null),
    yearly: sanitizeForJson(snapshot?.yearly || null),
    monthly: sanitizeForJson(snapshot?.monthly || null),
    daily: sanitizeForJson(snapshot?.daily || null),
    hourly: sanitizeForJson(snapshot?.hourly || null),
    palaces: buildDetailedPalaceReport(astrolabe, snapshot, options),
  };
}

/**
 * Extract key chart-level metadata from the raw astrolabe, without dumping
 * the full (and large) palaces array.
 */
function buildNatalSummary(astrolabe) {
  return {
    gender: astrolabe.gender || null,
    solarDate: astrolabe.solarDate || null,
    lunarDate: astrolabe.lunarDate || null,
    chineseDate: astrolabe.chineseDate || null,
    rawDates: astrolabe.rawDates || null,
    time: astrolabe.time || null,
    timeRange: astrolabe.timeRange || null,
    sign: astrolabe.sign || null,
    zodiac: astrolabe.zodiac || null,
    earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace || null,
    earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace || null,
    soul: astrolabe.soul || null,
    body: astrolabe.body || null,
    fiveElementsClass: astrolabe.fiveElementsClass || null,
  };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const input = parseInputFile(process.argv[2]);

const birth = input.birth ?? {};
const query = input.query ?? {};

const calendar = birth.calendar;
if (calendar !== 'solar' && calendar !== 'lunar') {
  fail('birth.calendar must be either solar or lunar.');
}

if (birth.confirmed !== true) {
  fail('birth.confirmed must be true before generating chart output.');
}

const birthDate = normalizeYmd(birth.date, 'birth.date', { isLunar: calendar === 'lunar' });
const timeIndex = Number(birth.timeIndex);
if (!Number.isInteger(timeIndex) || timeIndex < 0 || timeIndex > 12) {
  fail('birth.timeIndex must be an integer from 0 to 12.');
}

const gender = typeof birth.gender === 'string' ? birth.gender.toLowerCase() : '';
if (gender !== 'male' && gender !== 'female') {
  fail('birth.gender must be male or female.');
}

const birthplace = typeof birth.birthplace === 'string' ? birth.birthplace.trim() : '';
if (!birthplace) {
  fail('birth.birthplace must be a non-empty string.');
}

const timezone = query.timezone || 'Asia/Shanghai';
const includeIndexMapping = query?.debug?.includeIndexMapping === true;

let baseDateText;
if (!query.baseDate || query.baseDate === 'today') {
  baseDateText = dateInTimeZone(timezone, new Date());
} else {
  baseDateText = normalizeYmd(query.baseDate, 'query.baseDate');
}

// ---------------------------------------------------------------------------
// Import iztro (with differentiated error messages)
// ---------------------------------------------------------------------------

let astro;
try {
  ({ astro } = await import('iztro'));
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
    fail(
      'iztro is not installed. Run: cd scripts && npm install\n' +
        `  Original error: ${error.message}`,
    );
  }
  fail(
    `Failed to import iztro (possibly version or Node.js compatibility issue).\n` +
      `  Node version: ${process.version}\n` +
      `  Original error: ${error.message}`,
  );
}

if (!astro?.bySolar || !astro?.byLunar) {
  const available = astro ? Object.keys(astro).join(', ') : '(null)';
  fail(
    `iztro API incompatible: astro.bySolar/byLunar not found.\n` +
      `  Available exports: ${available}`,
  );
}

// ---------------------------------------------------------------------------
// Generate chart
// ---------------------------------------------------------------------------

const language = birth.language || 'zh-CN';
const fixLeap = birth.fixLeap ?? true;
const isLeapMonth = birth.isLeapMonth ?? false;

let astrolabe;
if (calendar === 'solar') {
  astrolabe = astro.bySolar(birthDate, timeIndex, gender, fixLeap, language);
} else {
  astrolabe = astro.byLunar(birthDate, timeIndex, gender, isLeapMonth, fixLeap, language);
}

if (!astrolabe?.horoscope) {
  fail('astrolabe.horoscope is not available from iztro result.');
}

// ---------------------------------------------------------------------------
// Compute horoscope snapshots
// ---------------------------------------------------------------------------

const currentDate = localNoonDate(baseDateText);
const currentRaw = astrolabe.horoscope(currentDate);
const currentDetailed = buildDetailedSnapshot(astrolabe, currentRaw, baseDateText, {
  includeIndexMapping,
});

const futureDates = Array.isArray(query.futureDates) ? query.futureDates : [];
const futureDetailed = [];

futureDates.forEach((rawDate, index) => {
  const normalized = normalizeYmd(rawDate, `query.futureDates[${index}]`);
  const targetDate = localNoonDate(normalized);
  const snapshotRaw = astrolabe.horoscope(targetDate);

  futureDetailed.push(
    buildDetailedSnapshot(astrolabe, snapshotRaw, normalized, {
      includeIndexMapping,
    }),
  );
});

// ---------------------------------------------------------------------------
// Assemble & output
// ---------------------------------------------------------------------------

const output = {
  generatedAt: new Date().toISOString(),
  normalizedInput: {
    calendar,
    birthDate,
    timeIndex,
    gender,
    birthplace,
    birthConfirmed: true,
    timezone,
    baseDateSolar: baseDateText,
    baseDateLunar: currentRaw?.lunarDate ?? null,
  },
  outputPolicy: {
    detailLevel: 'full',
    mappingModes: includeIndexMapping ? ['by_role', 'by_index'] : ['by_role'],
    includeIndexMapping,
    requiredConfirmation: true,
    disclaimer:
      'For cultural study and entertainment reference only. No true-solar-time correction is applied by default.',
  },
  natalSummary: buildNatalSummary(astrolabe),
  currentDetailed,
  futureDetailed,
};

console.log(JSON.stringify(sanitizeForJson(output), null, 2));
