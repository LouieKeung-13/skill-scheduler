# Skill Scheduler — 智能 Skill 调度引擎

> **English:** Generic intelligent skill scheduler with multi-factor weighted scoring and user-confirmed dynamic loading.

通用型智能调度框架。根据用户请求自动匹配最合适的技能，展示候选列表供用户选择，确认后动态加载执行。

---

## 核心特性 / Core Features

| 特性 | Description |
|------|-------------|
| **零硬编码** | No hardcoded skills — all registered via `catalog.json` |
| **多因子评分** | Multi-factor weighted scoring: triggers(40%) + fuzzy(20%) + description(25%) + category(10%) + base(5%) |
| **透明候选列表** | Shows candidates with name, description, and match score for user confirmation before loading |
| **可配置权重** | Configurable weight ratios via `WeightConfig` |
| **低置信度标注** | Auto-labels low-confidence matches (<50%) as "可能不是你要的" / "might not be what you want" |
| **跨平台支持** | Built-in adapters for OpenClaw, Claude Code, and Codex |
| **中文长句优化** | Substring overlap matching handles Chinese sentences without natural word boundaries |

---

## 调度流程 / Workflow

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

**详细流程 / Detailed Flow:**

```
用户输入: {user_request}
    │
    ▼
1. Parser — 清洗停用词、提取 token、分类意图、识别实体
    │   Clean stop words, extract tokens, classify intent, identify entities
    │
    ▼
2. Scorer — 对 catalog.json 中每个 skill 计算多因子加权分数
    │   Compute multi-factor weighted scores for each skill in catalog.json
    │   ├── trigger_exact (40%) — Exact trigger word match
    │   ├── trigger_fuzzy (20%) — Edit distance ≤ 1 or substring match
    │   ├── description_match (25%) — Keyword co-occurrence rate
    │   ├── category_priority (10%) — Intent category alignment bonus
    │   └── threshold_factor (5%) — Base score
    │
    ▼
3. Candidate — 按分数降序排列，过滤低于 confidence_threshold 的
    │   Sort descending by score, filter below confidence_threshold
    │   Format output to user:
    │   ┌─────────────────────────────────────┐
    │   │ 📋 检测到以下 skill 可处理你的请求:  │
    │   │ 📋 Detected skills for your request:│
    │   │                                     │
    │   │ 1️⃣  {skill_name}                    │
    │   │     📝 {技能功能描述}                │
    │   │     📝 {skill description}           │
    │   │     ⚡ 匹配度: {score}%             │
    │   │     ⚡ Match: {score}%              │
    │   │                                     │
    │   │ 请选择编号 (1-N)，或直接说 skill 名称: │
    │   │ Select number (1-N) or type skill name:│
    │   └─────────────────────────────────────┘
    │
    ▼
4. Loader — 用户选择后，读取对应 skill 的 SKILL.md 注入上下文执行
    │   After user selection, load SKILL.md and inject into context
```

---

## 快速开始 / Quick Start

### 1. 克隆项目 / Clone

```bash
git clone <repo-url>
cd skill-scheduler
npm install
```

### 2. 注册一个 skill / Register a Skill

```bash
# 方式一：使用注册脚本 / Using the registration script
chmod +x examples/register.sh
./examples/register.sh "my-skill-id" "My Skill" "技能功能描述" "content-gen" "触发词 1" "触发词 2"

# 方式二：直接编辑 catalog.json / Or edit catalog.json directly
```

### 3. 创建 skill 目录 / Create Skill Directory

```
skills/
└── my-skill-id/
    ├── SKILL.md          # skill 定义文件 / skill definition file
    └── scripts/          # 执行脚本 / execution scripts
        └── main.ts
```

参考 `examples/skill-template.md` 编写 SKILL.md.

### 4. 调用调度器 / Use the Scheduler

```typescript
import { schedule, loadSelected } from "./src/index.js";
import { readFileSync } from "fs/promises";

// 加载 catalog / Load catalog
const catalog = JSON.parse(await readFileSync("catalog.json", "utf-8"));

// 解析用户请求 / Parse user request
const result = await schedule(
  userRequest,
  catalog,
  config,
  readFile
);

// 展示候选列表给用户 / Show candidates to user
console.log(result.output);

// 用户选择后加载 / Load after user selection
if (result.candidates.length > 0) {
  const selected = result.candidates[0]; // 假设用户选了第一个 / Assume user picked first
  const loadResult = await loadSelected(selected.id, catalog, {
    catalog_path: "catalog.json",
    skills_dir: "skills",
    weights: {},
    min_candidates: 0,
    max_candidates: 0,
  }, readFile);

  if (loadResult.success && loadResult.content) {
    // 将 loadResult.content 注入 agent 上下文执行 / Inject into agent context
    console.log("Skill loaded:", loadResult.name);
  }
}
```

---

## Demo 运行结果 / Demo Results

```
🚀 Skill Scheduler 端到端 Demo
================================

📦 Catalog 加载成功: 12 个 Skill


============================================================
场景一：内容创作 / Scenario 1: Content Creation
============================================================
📝 用户请求: "帮我翻译这篇英文文章"
💡 用户想翻译文章 → 应匹配 translator

📋 候选 Skill 列表:
📋 检测到以下 skill 可处理你的请求:

1️⃣  Translator
    📝 多模式翻译（快翻/精翻/润色），支持术语表和风格预设
    ⚡ 匹配度: 42%
    💡 可能不是你要的

🏆 最高匹配: Translator (42%)
✅ 正确匹配到: translator
```

完整 demo 见 `examples/end-to-end-demo.ts`. / See `examples/end-to-end-demo.ts` for full demo.

---

## API 参考 / API Reference

### `schedule(request, catalog, config, readFile)`

执行完整调度流程，返回候选列表。 / Execute full scheduling flow, return candidate list.

| 参数 | Type | 说明 / Description |
|------|------|------|
| `request` | `string` | 用户原始请求 / Raw user input |
| `catalog` | `SkillCatalog` | catalog.json 解析后的数据 / Parsed catalog data |
| `config` | `SchedulerConfig` | 调度器配置 / Scheduler configuration |
| `readFile` | `FileReader` | 文件读取函数（运行时注入）/ File reader (injected at runtime) |

**返回值 / Returns:** `ScheduleResult`

### `loadSelected(skillId, catalog, config, readFile)`

加载用户选择的 skill。 / Load user-selected skill.

| 参数 | Type | 说明 / Description |
|------|------|------|
| `skillId` | `string` | 用户选择的 skill id / Selected skill ID |
| `catalog` | `SkillCatalog` | catalog.json 解析后的数据 / Parsed catalog data |
| `config` | `SchedulerConfig` | 调度器配置 / Scheduler configuration |
| `readFile` | `FileReader` | 文件读取函数 / File reader function |

**返回值 / Returns:** `LoadResult`

### `ScoreBreakdown`

评分因子明细。 / Score breakdown details.

| 字段 | Type | Range | 说明 / Description |
|------|------|-------|------|
| `trigger_exact` | `number` | 0-1 | triggers 精确命中比例 / Exact trigger hit ratio |
| `trigger_fuzzy` | `number` | 0-1 | triggers 模糊匹配比例 / Fuzzy match ratio |
| `description_match` | `number` | 0-1 | description 关键词共现率 / Keyword co-occurrence rate |
| `category_priority` | `number` | 0-1 | 类别是否一致 / Category alignment |
| `total` | `number` | 0-1 | 加权总分 / Weighted total score |

---

## 扩展开发 / Extension

### 自定义评分权重 / Custom Weights

```typescript
const config: SchedulerConfig = {
  // ...
  weights: {
    trigger_exact: 0.50,      // 提高触发词权重 / Increase trigger weight
    description_match: 0.20,  // 降低 description 权重 / Decrease description weight
    // ...
  },
};
```

### 添加新类别 / Add New Category

在 `src/parser.ts` 的 `CATEGORY_MAP` 中添加映射： / Add mapping in `CATEGORY_MAP` of `src/parser.ts`:

```typescript
CATEGORY_MAP["new-category"] = ["关键词 1", "关键词 2"];
```

### Web API 模式 / Web API Mode

将 `readFile` 替换为 fetch 调用： / Replace `readFile` with fetch:

```typescript
const webReadFile: FileReader = async (path) => {
  const response = await fetch(`/api/skills/${encodeURIComponent(path)}`);
  return response.text();
};
```

---

## 文件结构 / File Structure

```
skill-scheduler/
├── SKILL.md              # 调度器自身定义 / Scheduler self-definition
├── catalog.json          # 空壳，使用者自行填充 / Empty shell, fill in your own skills
├── src/
│   ├── index.ts          # 调度器主入口 / Main entry point
│   ├── parser.ts         # 意图解析器 / Intent parser
│   ├── scorer.ts         # 评分引擎 / Scoring engine
│   ├── candidate.ts      # 候选列表生成 / Candidate list generator
│   ├── loader.ts         # 动态加载器 / Dynamic loader
│   └── types.ts          # 类型定义 / Type definitions
├── adapters/
│   ├── base.ts           # 适配器接口 / Adapter interface
│   ├── openclaw.ts       # OpenClaw adapter
│   ├── claude-code.ts    # Claude Code adapter
│   ├── codex.ts          # Codex adapter
│   └── index.ts          # Exports
├── examples/
│   ├── skill-template.md # 新 skill 接入模板 / New skill template
│   ├── register.sh       # Bash 一键注册脚本 / Bash one-click registration
│   ├── register.ps1      # PowerShell 一键注册脚本 / PowerShell registration
│   └── end-to-end-demo.ts # 端到端演示 / End-to-end demo
└── skills/               # 实际 skill 实现（按需放入）/ Actual skill implementations
    └── .gitkeep
```

---

## License

MIT
