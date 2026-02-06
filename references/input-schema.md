# 输入 JSON 结构

`iztro_runner.mjs` 接收一个 JSON 文件路径参数。

## 示例

```json
{
  "birth": {
    "confirmed": true,
    "calendar": "solar",
    "date": "1994-8-15",
    "timeIndex": 7,
    "gender": "female",
    "birthplace": "China/Shanghai",
    "isLeapMonth": false,
    "fixLeap": true,
    "language": "zh-CN"
  },
  "query": {
    "timezone": "Asia/Shanghai",
    "baseDate": "today",
    "futureDates": ["2026-03-01", "2026-06-18"]
  }
}
```

## 字段说明

- `birth.calendar`：`solar` 或 `lunar`
- `birth.confirmed`：必须为 `true`，表示出生信息已被用户确认
- `birth.date`：`YYYY-M-D`
- `birth.timeIndex`：`0..12`
- `birth.gender`：`male` 或 `female`
- `birth.birthplace`：必填，非空字符串
- `birth.isLeapMonth`：农历闰月标记，仅 `lunar` 模式生效
- `birth.fixLeap`：农历闰月修正策略，仅 `lunar` 模式生效
- `birth.language`：可选，默认 `zh-CN`
- `query.timezone`：当前所在地 IANA 时区，用于解析 today
- `query.baseDate`：`today` 或 `YYYY-MM-DD`
- `query.futureDates`：未来日期数组，用于辅助趋势判断
- `query.debug.includeIndexMapping`：可选，默认 `false`；仅开发调试时设为 `true`

## 输出核心字段

- `normalizedInput`：标准化输入与日期解析结果
- `outputPolicy`：输出策略与免责声明（固定 `full`）
- `natalSummary`：命盘元数据（命主、身主、五行局、干支、星座、生肖等，不含逐宫数据）
- `currentDetailed`：当前日期的详细分层快照，含逐宫合并明细
- `futureDetailed[]`：未来日期的详细分层快照，含逐宫合并明细

## `currentDetailed.palaces[]` 关键字段

- `palaceIndex`：固定宫位索引（0..11）
- `palaceName` / `palaceAlias` / `palaceDisplayName`
- `heavenlyStem` / `earthlyBranch`
- `natal.majorStars[]` / `natal.minorStars[]` / `natal.adjectiveStars[]`
- `flowStarsByRole.*`：按"宫位角色名称"映射后的流星（默认用于解读）
- `flowStarsByIndex.*`：按"固定宫位索引"映射后的流星（仅调试模式输出）
- `flowRoleAtIndex.*`：该索引宫位在对应层级下扮演的角色名（仅调试模式输出）
- `yearlyDecStar.suiqian12` / `yearlyDecStar.jiangqian12`
- `yearlyDecStarByIndex.suiqian12` / `yearlyDecStarByIndex.jiangqian12`（仅调试模式输出）
- `changsheng12` / `boshi12` / `jiangqian12` / `suiqian12`

星曜对象会附带：
- `tags`：例如 `本命禄`、`大限权`、`流年科`、`流月忌` 等

## 默认输出约束

- 仅提供 `full` 档位，不提供 `brief/standard`。
- 当 `birth.confirmed !== true` 时，脚本直接报错并停止输出。
- 默认只输出 `byRole` 口径；除非显式开启 `query.debug.includeIndexMapping`。
