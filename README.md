# Skill Scheduler

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9D18.svg)](https://vitest.dev/)

<p align="center">
  <a href="README_zh-CN.md">
    🇨🇳 中文版 / Chinese Version
  </a>
</p>

A generic intelligent skill scheduler with multi-factor weighted scoring and user-confirmed dynamic loading.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Zero Hardcoding** | No skills are bundled — all registered via `catalog.json` |
| **Multi-Factor Scoring** | triggers(40%) + fuzzy(20%) + description(25%) + category(10%) + base(5%) |
| **Transparent Candidates** | Shows candidates with name, description, and match score for user confirmation before loading |
| **Configurable Weights** | Adjust scoring ratios via `WeightConfig` |
| **Low Confidence Labels** | Auto-labels matches below 50% as "might not be what you want" |
| **Cross-Platform** | Built-in adapters for OpenClaw, Claude Code, and Codex |
| **Chinese Sentence Optimization** | Substring overlap matching handles Chinese without natural word boundaries |

---

## Workflow

```
┌─────────────────────────────────────────────────────┐
│                   User Request                       │
│              {user_request}                           │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│               Skill Scheduler                        │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Parser  │→ │ Scorer   │→ │ Candidate List   │   │
│  │ Parse   │  │ Score    │  │ Show & Select    │   │
│  └─────────┘  └──────────┘  └────────┬─────────┘   │
│                                      ▼              │
│  ┌──────────────────────────────────────────────┐   │
│  │  Loader — Load selected skill → Execute      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Detailed Flow:**

1. **Parser** — Cleans stop words, extracts tokens, classifies intent, identifies entities
2. **Scorer** — Computes weighted scores for each skill in `catalog.json`
   - `trigger_exact` (40%) — Exact trigger word match
   - `trigger_fuzzy` (20%) — Edit distance ≤ 1 or substring match
   - `description_match` (25%) — Keyword co-occurrence rate
   - `category_priority` (10%) — Intent category alignment bonus
   - `threshold_factor` (5%) — Base score
3. **Candidate** — Sorts descending, filters below `confidence_threshold`, shows to user
4. **Loader** — After user selection, loads the SKILL.md and injects into context

---

## Quick Start

### 1. Clone

```bash
git clone <repo-url>
cd skill-scheduler
npm install
```

### 2. Register a Skill

```bash
# Using the registration script
chmod +x examples/register.sh
./examples/register.sh "my-skill-id" "My Skill" "Skill description" "content-gen" "trigger1" "trigger2"

# Or edit catalog.json directly
```

### 3. Create Skill Directory

```
skills/
└── my-skill-id/
    ├── SKILL.md          # skill definition
    └── scripts/
        └── main.ts       # execution script
```

See `examples/skill-template.md` for the template.

### 4. Use the Scheduler

```typescript
import { schedule, loadSelected } from "./src/index.js";

// Load catalog
const catalog = JSON.parse(await readFileSync("catalog.json", "utf-8"));

// Schedule
const result = await schedule(userRequest, catalog, config, readFile);

// Show candidates
console.log(result.output);

// Load after user selection
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

## Demo Results

```
📋 Detected skills for your request:

1️⃣  Translator
    📝 Multi-mode translation (quick/normal/refined) with glossary support
    ⚡ Match: 42%
    💡 Might not be what you want

✅ Correctly matched: translator
```

Full demo: `examples/end-to-end-demo.ts`

---

## API Reference

### `schedule(request, catalog, config, readFile)`

Execute full scheduling flow, return candidate list.

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `string` | Raw user input |
| `catalog` | `SkillCatalog` | Parsed catalog data |
| `config` | `SchedulerConfig` | Scheduler configuration |
| `readFile` | `FileReader` | File reader (injected at runtime) |

**Returns:** `ScheduleResult`

### `loadSelected(skillId, catalog, config, readFile)`

Load user-selected skill.

| Parameter | Type | Description |
|-----------|------|-------------|
| `skillId` | `string` | Selected skill ID |
| `catalog` | `SkillCatalog` | Parsed catalog data |
| `config` | `SchedulerConfig` | Scheduler configuration |
| `readFile` | `FileReader` | File reader function |

**Returns:** `LoadResult`

### `ScoreBreakdown`

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `trigger_exact` | `number` | 0-1 | Exact trigger hit ratio |
| `trigger_fuzzy` | `number` | 0-1 | Fuzzy match ratio |
| `description_match` | `number` | 0-1 | Keyword co-occurrence rate |
| `category_priority` | `number` | 0-1 | Category alignment |
| `total` | `number` | 0-1 | Weighted total score |

---

## Extension

### Custom Weights

```typescript
const config: SchedulerConfig = {
  weights: {
    trigger_exact: 0.50,      // Increase trigger weight
    description_match: 0.20,  // Decrease description weight
  },
};
```

### Add New Category

Add mapping in `CATEGORY_MAP` of `src/parser.ts`:

```typescript
CATEGORY_MAP["new-category"] = ["keyword1", "keyword2"];
```

### Web API Mode

Replace `readFile` with fetch:

```typescript
const webReadFile: FileReader = async (path) => {
  const response = await fetch(`/api/skills/${encodeURIComponent(path)}`);
  return response.text();
};
```

---

## File Structure

```
skill-scheduler/
├── README.md               # This file (English)
├── README_zh-CN.md         # Chinese version
├── SKILL.md                # Scheduler self-definition
├── catalog.json            # Empty shell, fill with your skills
├── src/
│   ├── index.ts            # Main entry
│   ├── parser.ts           # Intent parser
│   ├── scorer.ts           # Scoring engine
│   ├── candidate.ts        # Candidate generator
│   ├── loader.ts           # Dynamic loader
│   └── types.ts            # Type definitions
├── adapters/
│   ├── base.ts             # Adapter interface
│   ├── openclaw.ts         # OpenClaw adapter
│   ├── claude-code.ts      # Claude Code adapter
│   └── codex.ts            # Codex adapter
├── examples/
│   ├── skill-template.md   # New skill template
│   ├── register.sh         # Bash registration script
│   ├── register.ps1        # PowerShell registration script
│   └── end-to-end-demo.ts  # End-to-end demo
└── skills/                 # Actual skill implementations
    └── .gitkeep
```

---

## License

MIT

---


*Compiled by LouieKeung · 2026 · Dynamic Token Compression Project*

For more detailed information, please send an email to: markdlouis1995@gmail.com
