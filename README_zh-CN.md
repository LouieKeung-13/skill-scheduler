# Skill Scheduler — 智能 Skill 调度引擎

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9D18.svg)](https://vitest.dev/)

<p align="center">
  <a href="README.md">
    🇺🇸 English Version
  </a>
</p>

通用型智能调度框架。根据用户请求自动匹配最合适的技能，展示候选列表供用户选择，确认后动态加载执行。

---

## 核心特性

| 特性 | 说明 |
|------|------|
| **零硬编码** | 不预装任何具体技能，所有技能通过 `catalog.json` 注册 |
| **多因子评分** | triggers(40%) + 模糊匹配(20%) + description 语义(25%) + category 优先级(10%) + 基础分(5%) |
| **透明候选列表** | 匹配后向用户展示所有候选 skill（含名称、描述、匹配度），用户确认后才加载 |
| **可配置权重** | 通过 `WeightConfig` 调整各因子占比 |
| **低置信度标注** | 匹配度 < 50% 的 skill 自动标注"可能不是你要的" |
| **跨平台支持** | 提供 OpenClaw / Claude Code / Codex 三套适配器 |
| **中文长句优化** | 子串重叠匹配算法处理中文无天然分隔符的场景 |

---

## 调度流程

```
┌─────────────────────────────────────────────────────┐
│                   用户请求层                          │
│              {user_request}                           │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│               调度器 (skiller)                        │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Parser  │→ │ Scorer   │→ │ Candidate List   │   │
│  │ 意图解析 │  │ 评分引擎  │  │ 候选展示 + 选择  │   │
│  └─────────┘  └──────────┘  └────────┬─────────┘   │
│                                      ▼              │
│  ┌──────────────────────────────────────────────┐   │
│  │  Loader — 动态加载选中 skill → 执行 → 返回    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**详细流程：**

1. **Parser** — 清洗停用词、提取 token、分类意图、识别实体
2. **Scorer** — 对 catalog.json 中每个 skill 计算多因子加权分数
   - `trigger_exact` (40%) — 精确匹配触发词
   - `trigger_fuzzy` (20%) — 编辑距离 ≤ 1 或包含关系
   - `description_match` (25%) — 关键词共现率
   - `category_priority` (10%) — 意图类别一致加分
   - `threshold_factor` (5%) — 基础分
3. **Candidate** — 按分数降序排列，过滤低于 confidence_threshold 的
4. **Loader** — 用户选择后，读取对应 skill 的 SKILL.md 注入上下文执行

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd skill-scheduler
npm install
```

### 2. 注册一个 skill

```bash
# 方式一：使用注册脚本
chmod +x examples/register.sh
./examples/register.sh "my-skill-id" "My Skill" "技能功能描述" "content-gen" "触发词 1" "触发词 2"

# 方式二：直接编辑 catalog.json
```

### 3. 创建 skill 目录结构

```
skills/
└── my-skill-id/
    ├── SKILL.md          # skill 定义文件
    └── scripts/          # 执行脚本
        └── main.ts
```

参考 `examples/skill-template.md` 编写 SKILL.md。

### 4. 调用调度器

```typescript
import { schedule, loadSelected } from "./src/index.js";

// 加载 catalog
const catalog = JSON.parse(await readFileSync("catalog.json", "utf-8"));

// 解析用户请求
const result = await schedule(userRequest, catalog, config, readFile);

// 展示候选列表给用户
console.log(result.output);

// 用户选择后加载
if (result.candidates.length > 0) {
  const loadResult = await loadSelected(
    result.candidates[0].id, catalog, config, readFile
  );
  if (loadResult.success && loadResult.content) {
    console.log("Skill loaded:", loadResult.name);
  }
}
```

---

## Demo 运行结果

```
📋 检测到以下 skill 可处理你的请求:

1️⃣  Translator
    📝 多模式翻译（快翻/精翻/润色），支持术语表和风格预设
    ⚡ 匹配度: 42%
    💡 可能不是你要的

✅ 正确匹配到: translator
```

完整 demo 见 `examples/end-to-end-demo.ts`。

---

## API 参考

### `schedule(request, catalog, config, readFile)`

执行完整调度流程，返回候选列表。

| 参数 | 类型 | 说明 |
|------|------|------|
| `request` | `string` | 用户原始请求 |
| `catalog` | `SkillCatalog` | catalog.json 解析后的数据 |
| `config` | `SchedulerConfig` | 调度器配置 |
| `readFile` | `FileReader` | 文件读取函数（运行时注入） |

**返回值:** `ScheduleResult`

### `loadSelected(skillId, catalog, config, readFile)`

加载用户选择的 skill。

| 参数 | 类型 | 说明 |
|------|------|------|
| `skillId` | `string` | 用户选择的 skill id |
| `catalog` | `SkillCatalog` | catalog.json 解析后的数据 |
| `config` | `SchedulerConfig` | 调度器配置 |
| `readFile` | `FileReader` | 文件读取函数 |

**返回值:** `LoadResult`

### `ScoreBreakdown`

评分因子明细：

| 字段 | 类型 | 范围 | 说明 |
|------|------|------|------|
| `trigger_exact` | `number` | 0-1 | triggers 精确命中比例 |
| `trigger_fuzzy` | `number` | 0-1 | triggers 模糊匹配比例 |
| `description_match` | `number` | 0-1 | description 关键词共现率 |
| `category_priority` | `number` | 0-1 | 类别是否一致 |
| `total` | `number` | 0-1 | 加权总分 |

---

## 扩展开发

### 自定义评分权重

```typescript
const config: SchedulerConfig = {
  weights: {
    trigger_exact: 0.50,      // 提高触发词权重
    description_match: 0.20,  // 降低 description 权重
  },
};
```

### 添加新类别

在 `src/parser.ts` 的 `CATEGORY_MAP` 中添加映射：

```typescript
CATEGORY_MAP["new-category"] = ["关键词 1", "关键词 2"];
```

### Web API 模式

将 `readFile` 替换为 fetch 调用：

```typescript
const webReadFile: FileReader = async (path) => {
  const response = await fetch(`/api/skills/${encodeURIComponent(path)}`);
  return response.text();
};
```

---

## 文件结构

```
skill-scheduler/
├── README.md               # 英文版（默认展示）
├── README_zh-CN.md         # 中文版
├── SKILL.md                # 调度器自身定义
├── catalog.json            # 空壳，使用者自行填充
├── src/
│   ├── index.ts            # 调度器主入口
│   ├── parser.ts           # 意图解析器
│   ├── scorer.ts           # 评分引擎
│   ├── candidate.ts        # 候选列表生成
│   ├── loader.ts           # 动态加载器
│   └── types.ts            # 类型定义
├── adapters/
│   ├── base.ts             # 适配器接口
│   ├── openclaw.ts         # OpenClaw 适配
│   ├── claude-code.ts      # Claude Code 适配
│   └── codex.ts            # Codex 适配
├── examples/
│   ├── skill-template.md   # 新 skill 接入模板
│   ├── register.sh         # Bash 一键注册脚本
│   ├── register.ps1        # PowerShell 一键注册脚本
│   └── end-to-end-demo.ts  # 端到端演示
└── skills/                 # 实际 skill 实现（按需放入）
    └── .gitkeep
```

---

## License

MIT

---


*Compiled by LouieKeung · 2026*

For more detailed information, please send an email to: markdlouis1995@gmail.com
