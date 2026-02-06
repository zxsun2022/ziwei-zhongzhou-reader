# 紫微斗数深度解读助手（王亭之版）

和 AI 聊天，就能获得融合中州派理论的紫微斗数命盘深度解读。

本项目是 [ziwei-iztro-skill](https://github.com/zxsun2022/ziwei-iztro-skill) 的衍生版，在原版排盘能力基础上，新增《王亭之谈紫微斗数》的系统解读知识，提供更具深度的命理分析。

---

## 与原版的区别

| 对比项 | 原版 (ziwei-iztro-skill) | 本版 (ziwei-zhongzhou-reader) |
|--------|---------------------------|------------------------------|
| 排盘能力 | iztro 完整排盘 | 相同（共享脚本） |
| 解读知识 | SKILL.md 约 2K token 简表 | 简表 + 王亭之中州派理论按需加载 |
| 解读深度 | 基于关键词和通用原则 | 星系组合论 + 格局论 + 具体推断方法 |
| 理论来源 | 通用紫微斗数知识 | 王亭之《王亭之谈紫微斗数》中州派传承 |

---

## 功能亮点

- **本命盘深度解读** — 输入出生信息，自动排盘并以中州派星系组合论逐宫解读
- **星系组合分析** — 不只看单星，更重视星曜组合（如紫府/紫贪/紫破等六种结构）
- **格局论** — 识别并解读 44 种古典格局，结合现代重新诠释
- **运势分析** — 查看流年、流月、流日运势
- **未来预测** — 分析未来某个日期的运势趋势

---

## 适用平台

| 平台 | 说明 |
|------|------|
| **Claude Code** | 作为 Skill 安装，直接在终端对话使用 |
| **Claude.ai Web** | 将 Skill 打包为 ZIP 上传 |
| **其他 AI 工具** | Cursor、Windsurf 等支持 Skill 的工具均可使用 |

---

## 快速开始

### Claude Code

```bash
# 1. 克隆项目到本地
git clone <仓库地址>

# 2. 安装依赖（只需一次）
cd ziwei-zhongzhou-reader/scripts
npm install

# 3. 重启 Claude Code，开始对话
```

### Claude.ai Web

1. 将项目打包为 ZIP
2. 上传到 Settings > Capabilities

---

## 项目结构

```
ziwei-zhongzhou-reader/
├── SKILL.md                     # Skill 定义（含中州派核心原则 + 按需读取指引）
├── scripts/                     # 排盘脚本（iztro_runner.mjs + 依赖）
├── references/
│   ├── input-schema.md          # 输入 JSON 结构说明
│   ├── time-index.md            # 时辰索引对照表
│   └── interpretation-template.md # 分层解读模板
├── wang-references/             # 王亭之理论参考（按主题拆分）
│   ├── general-principles.md    # 总论 + 推断杂谈
│   ├── star-ziwei.md            # 紫微星系
│   ├── star-tianji.md           # 天机星系
│   ├── star-taiyang.md          # 太阳星系
│   ├── star-wuqu.md             # 武曲星系
│   ├── star-tiantong.md         # 天同星系
│   ├── star-lianzhen.md         # 廉贞星系
│   ├── star-tianfu.md           # 天府 + 天相星系
│   ├── star-taiyin.md           # 太阴星系
│   ├── star-tanlang.md          # 贪狼星系
│   ├── star-jumen.md            # 巨门星系
│   ├── star-tianliang.md        # 天梁星系
│   ├── star-qisha.md            # 七杀星系
│   ├── star-pojun.md            # 破军星系
│   ├── auxiliary-stars.md       # 辅佐煞曜
│   ├── patterns-part1.md        # 格局论（上）
│   └── patterns-part2.md        # 格局论（下）+ 后记
├── agents/
│   └── openai.yaml
└── README.md
```

---

## 致谢

- **排盘引擎**：[iztro](https://github.com/SylarLong/iztro)，由 [SylarLong](https://github.com/SylarLong) 开发
- **解读理论**：《王亭之谈紫微斗数》，王亭之著，中州派紫微斗数传承

---

## 免责声明

本项目输出仅用于**文化研究与娱乐参考**，不构成医疗、法律、投资等任何专业建议。排盘采用民用出生时间，默认不做真太阳时修正。解读理论来源于公开出版物，仅代表中州派一家之言。
