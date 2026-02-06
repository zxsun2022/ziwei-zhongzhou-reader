#!/usr/bin/env node

/**
 * Simple regression test runner.
 * Runs iztro_runner.mjs against fixture inputs and validates key structural
 * invariants in the output. No external test framework required.
 *
 * Usage:  node test.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function runRunner(inputFile) {
  const inputPath = resolve(__dirname, inputFile);
  const runner = resolve(__dirname, 'iztro_runner.mjs');
  return JSON.parse(
    execSync(`node "${runner}" "${inputPath}"`, {
      encoding: 'utf-8',
      cwd: __dirname,
      timeout: 30000,
    }),
  );
}

function runRunnerExpectFail(inputJson) {
  const tmpPath = resolve(__dirname, '_test_tmp.json');
  const runner = resolve(__dirname, 'iztro_runner.mjs');
  writeFileSync(tmpPath, JSON.stringify(inputJson));
  try {
    execSync(`node "${runner}" "${tmpPath}"`, {
      encoding: 'utf-8',
      cwd: __dirname,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0 };
  } catch (error) {
    return { exitCode: error.status, stderr: error.stderr };
  }
}

// -------------------------------------------------------------------------
// Test 1: Basic output structure (example.input.json)
// -------------------------------------------------------------------------
console.log('Test 1: Basic output structure');
{
  const out = runRunner('example.input.json');

  assert(out.generatedAt, 'has generatedAt');
  assert(out.normalizedInput, 'has normalizedInput');
  assert(out.outputPolicy, 'has outputPolicy');
  assert(out.natalSummary, 'has natalSummary');
  assert(out.currentDetailed, 'has currentDetailed');
  assert(Array.isArray(out.futureDetailed), 'futureDetailed is array');

  // Removed fields should NOT be present
  assert(!('natal' in out), 'no raw natal field');
  assert(!('current' in out), 'no raw current field');
  assert(!('future' in out), 'no raw future field');

  // natalSummary checks
  const ns = out.natalSummary;
  assert(ns.soul, 'natalSummary has soul (命主)');
  assert(ns.body, 'natalSummary has body (身主)');
  assert(ns.fiveElementsClass, 'natalSummary has fiveElementsClass');
  assert(ns.chineseDate, 'natalSummary has chineseDate');

  // currentDetailed palace checks
  const palaces = out.currentDetailed.palaces;
  assert(palaces.length === 12, 'currentDetailed has 12 palaces');

  const p0 = palaces[0];
  assert('flowStarsByRole' in p0, 'palace has flowStarsByRole');
  assert(!('flowStars' in p0), 'palace has no duplicate flowStars');
  assert(p0.natal.majorStars, 'palace has natal.majorStars');
  assert(p0.natal.minorStars, 'palace has natal.minorStars');
  assert(p0.natal.adjectiveStars, 'palace has natal.adjectiveStars');

  // Tags should exist on stars
  const allStars = palaces.flatMap((p) => p.natal.majorStars);
  const starWithTag = allStars.find((s) => s.tags && s.tags.length > 0);
  assert(starWithTag, 'at least one star has tags');

  // Future dates
  assert(out.futureDetailed.length === 2, 'futureDetailed has 2 entries');
  assert(out.futureDetailed[0].palaces.length === 12, 'future[0] has 12 palaces');
}

// -------------------------------------------------------------------------
// Test 2: Debug mode (includeIndexMapping)
// -------------------------------------------------------------------------
console.log('Test 2: Debug mode (includeIndexMapping)');
{
  const out = runRunner('example.debug.input.json');
  const p0 = out.currentDetailed.palaces[0];

  assert(out.outputPolicy.includeIndexMapping === true, 'includeIndexMapping is true');
  assert(p0.flowStarsByIndex !== null, 'flowStarsByIndex present in debug mode');
  assert(p0.flowRoleAtIndex !== null, 'flowRoleAtIndex present in debug mode');
  assert(p0.yearlyDecStarByIndex !== null, 'yearlyDecStarByIndex present in debug mode');
}

// -------------------------------------------------------------------------
// Test 3: Validation — confirmed=false should fail
// -------------------------------------------------------------------------
console.log('Test 3: Validation rejects confirmed=false');
{
  const result = runRunnerExpectFail({
    birth: {
      confirmed: false,
      calendar: 'solar',
      date: '1994-8-15',
      timeIndex: 7,
      gender: 'female',
      birthplace: 'Shanghai',
    },
  });
  assert(result.exitCode !== 0, 'exits with non-zero for confirmed=false');
}

// -------------------------------------------------------------------------
// Test 4: Validation — invalid solar date (Feb 30) should fail
// -------------------------------------------------------------------------
console.log('Test 4: Invalid solar date (Feb 30) rejected');
{
  const result = runRunnerExpectFail({
    birth: {
      confirmed: true,
      calendar: 'solar',
      date: '1994-2-30',
      timeIndex: 7,
      gender: 'female',
      birthplace: 'Shanghai',
    },
  });
  assert(result.exitCode !== 0, 'exits with non-zero for solar Feb 30');
}

// -------------------------------------------------------------------------
// Test 5: Lunar date with day=30 should NOT be rejected
// -------------------------------------------------------------------------
console.log('Test 5: Lunar date day=30 accepted');
{
  const tmpPath = resolve(__dirname, '_test_lunar.json');
  writeFileSync(
    tmpPath,
    JSON.stringify({
      birth: {
        confirmed: true,
        calendar: 'lunar',
        date: '1994-7-30',
        timeIndex: 7,
        gender: 'female',
        birthplace: 'Shanghai',
        isLeapMonth: false,
      },
      query: { baseDate: '2026-3-1', futureDates: [] },
    }),
  );

  try {
    const lunarOut = runRunner('_test_lunar.json');
    assert(lunarOut.currentDetailed.palaces.length === 12, 'lunar day=30 produces valid output');
  } catch (error) {
    // If iztro itself rejects the date, that's fine — our validator should not
    assert(false, `lunar day=30 was rejected: ${error.message}`);
  }
}

// -------------------------------------------------------------------------
// Test 6: normalizedInput fields
// -------------------------------------------------------------------------
console.log('Test 6: normalizedInput correctness');
{
  const out = runRunner('example.input.json');
  const ni = out.normalizedInput;

  assert(ni.calendar === 'solar', 'calendar is solar');
  assert(ni.birthDate === '1994-8-15', 'birthDate normalized');
  assert(ni.timeIndex === 7, 'timeIndex is 7');
  assert(ni.gender === 'female', 'gender is female');
  assert(ni.birthplace === 'Shanghai, China', 'birthplace preserved');
  assert(ni.birthConfirmed === true, 'birthConfirmed is true');
  assert(ni.timezone === 'Asia/Shanghai', 'timezone is Asia/Shanghai');
  assert(ni.baseDateSolar, 'baseDateSolar present');
  assert(ni.baseDateLunar, 'baseDateLunar present');
}

// -------------------------------------------------------------------------
// Cleanup & summary
// -------------------------------------------------------------------------
try {
  const { unlinkSync } = await import('node:fs');
  unlinkSync(resolve(__dirname, '_test_tmp.json'));
  unlinkSync(resolve(__dirname, '_test_lunar.json'));
} catch {
  // ignore cleanup errors
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
