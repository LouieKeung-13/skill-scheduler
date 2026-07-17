---
name: skiller
description: "智能 Skill 调度引擎。根据用户请求自动扫描 catalog.json，通过多因子加权评分匹配最合适的技能，展示候选列表供用户选择，确认后动态加载执行。支持自定义权重、类别分组、首次配置提示。当用户发出任务指令且系统中存在多个可用技能时调用本调度器。"
version: "1.0.0"
category: dev-tools
triggers: ["调度", "skill", "技能", "匹配", "选择工具", "自动选择", "catalog"]
---

# Skiller — 智能 Skill 调度引擎

通用型智能调度框架，让 Agent 能够根据用户请求自动匹配并加载最合适的技能。

## 核心特性

- **零硬编码** — 不预装任何具体技能实现，所有技能通过 catalog.json 注册
- **多因子评分** — triggers 精确命中(40%) + 模糊匹配(20%) + description 语义匹配(25%) + category 优先级(10%) + 基础分(5%)
- **透明候选列表** — 匹配后向用户展示所有候选 skill（含名称、描述、匹配度），用户确认后才加载
- **可配置权重** — 通过 WeightConfig 调整各因子占比
- **低置信度标注** — 匹配度 < 50% 的 skill 自动标注"可能不是你要的"
- **首次配置提示** — requires_setup 为 true 的 skill 在候选列表中显示注意事项

## 快速开始

### 1. 注册一个新 skill

```bash
# 使用 register.sh 脚本
./examples/register.sh "my-translate" "My Translator" "多语言翻译工具" "content-gen" "翻译" "translate" "精翻"

# 或直接编辑 catalog.json
```

### 2. 创建 skill 目录结构

```
skills/
└── my-translate/
    ├── SKILL.md          # skill 定义文件
    └── scripts/          # 执行脚本
        └── main.ts
```

### 3. 调用调度器

```typescript
import { schedule, loadSelected } from "./src/index.js";
import { readFileSync } from "fs/promises";

// 加载 catalog
const catalog = JSON.parse(await readFileSync("catalog.json", "utf-8"));

// 解析用户请求
const result = await schedule(
  "帮我翻译这篇英文文章",
  catalog,
  {
    catalog_path: "catalog.json",
    skills_dir: "skills",
    weights: { trigger_exact: 0.40, trigger_fuzzy: 0.20, description_match: 0.25, category_priority: 0.10, threshold_factor: 0.05 },
    min_candidates: 2,
    max_candidates: 5,
  },
  readFileSync
);

// 展示候选列表给用户
console.log(result.output);

// 用户选择后加载
if (result.candidates.length > 0) {
  const selected = result.candidates[0]; // 假设用户选了第一个
  const loadResult = await loadSelected(selected.id, catalog, {
    catalog_path: "catalog.json",
    skills_dir: "skills",
    weights: {},
    min_candidates: 0,
    max_candidates: 0,
  }, readFileSync);

  if (loadResult.success && loadResult.content) {
    // 将 loadResult.content 注入 agent 上下文执行
    console.log("Skill loaded:", loadResult.name);
  }
}
```

## 架构概览

```
用户请求 → Parser(意图解析) → Scorer(多因子评分) → Candidate(候选列表) → Loader(动态加载)
```

详细流程图见 `README.md`。

## 评分算法

| 因子 | 权重 | 说明 |
|------|------|------|
| trigger_exact | 40% | 用户 token 与 triggers 精确匹配 |
| trigger_fuzzy | 20% | 编辑距离 ≤ 1 或包含关系 |
| description_match | 25% | 用户 token 与 description 共现率 |
| category_priority | 10% | 解析出的意图类别与 skill category 一致 |
| threshold_factor | 5% | 基础分，确保即使无匹配也有最低分 |

## 扩展开发

- **自定义评分权重** — 修改 WeightConfig 中的权重值
- **添加新类别** — 在 parser.ts 的 CATEGORY_MAP 中添加映射
- **运行时适配** — 在 loader.ts 中注入具体的文件读取函数
- **Web API 模式** — 将 readFile 替换为 fetch() 调用远程 catalog

## 文件结构

```
skill-scheduler/
├── SKILL.md              # 本文件（调度器自身定义）
├── catalog.json          # 空壳，使用者自行填充
├── src/
│   ├── index.ts          # 调度器主入口
│   ├── parser.ts         # 意图解析器
│   ├── scorer.ts         # 评分引擎
│   ├── candidate.ts      # 候选列表生成
│   ├── loader.ts         # 动态加载器
│   └── types.ts          # 类型定义
├── examples/
│   ├── skill-template.md # 新 skill 接入模板
│   └── register.sh       # 一键注册脚本
└── skills/               # 实际 skill 实现（按需放入）
    └── .gitkeep
```

## License

MIT
