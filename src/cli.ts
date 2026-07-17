#!/usr/bin/env node
/**
 * 通用 CLI 入口 — 三个平台共用
 * 
 * 用法:
 *   npx tsx src/cli.ts <user-request> --catalog <path> --adapter <openclaw|claude-code|codex>
 * 
 * 示例:
 *   npx tsx src/cli.ts "帮我翻译这篇英文文章" --catalog ./catalog.json --adapter openclaw
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { schedule, loadSelected, ScheduleResult } from "./index.js";
import { OpenClawAdapter } from "../adapters/openclaw.js";
import { ClaudeCodeAdapter } from "../adapters/claude-code.js";
import { CodexAdapter } from "../adapters/codex.js";
import type { SkillAdapter } from "../adapters/base.js";
import type { SchedulerConfig, WeightConfig } from "./types.js";

// ============================================================
// 参数解析
// ============================================================

function parseArgs(): { request: string; catalogPath: string; adapter: string; weights?: Partial<WeightConfig> } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("用法: npx tsx src/cli.ts <请求> --catalog <catalog.json 路径> --adapter <openclaw|claude-code|codex>");
    console.log("");
    console.log("可选参数:");
    console.log("  --weights.trigger-exact <0-1>   triggers 精确命中权重 (默认 0.40)");
    console.log("  --weights.trigger-fuzzy <0-1>   triggers 模糊匹配权重 (默认 0.20)");
    console.log("  --weights.description-match <0-1> description 语义匹配权重 (默认 0.25)");
    console.log("  --weights.category-priority <0-1> category 优先级权重 (默认 0.10)");
    process.exit(1);
  }

  // 第一个非-flag 参数是用户请求
  let requestIndex = -1;
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      requestIndex = i;
      break;
    }
  }

  if (requestIndex === -1) {
    console.error("错误: 缺少用户请求参数");
    process.exit(1);
  }

  const request = args.slice(0, requestIndex).join(" ");
  const flags: Record<string, string> = {};
  
  for (let i = requestIndex + 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace(/^--/, "");
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "";
      }
    }
  }

  const catalogPath = flags.catalog || "./catalog.json";
  const adapterName = flags.adapter || "openclaw";

  return { request, catalogPath, adapter: adapterName };
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const { request, catalogPath, adapter: adapterName } = parseArgs();

  // 1. 加载 catalog
  const resolvedCatalogPath = resolve(catalogPath);
  const catalogRaw = readFileSync(resolvedCatalogPath, "utf-8");
  const catalog = JSON.parse(catalogRaw);

  // 2. 创建适配器
  const baseDir = dirname(resolvedCatalogPath);
  let adapter: SkillAdapter;

  switch (adapterName) {
    case "claude-code":
      adapter = new ClaudeCodeAdapter(baseDir);
      break;
    case "codex":
      adapter = new CodexAdapter(baseDir);
      break;
    case "openclaw":
    default:
      adapter = new OpenClawAdapter(baseDir);
      break;
  }

  // 3. 执行调度
  const config: SchedulerConfig = {
    catalog_path: resolvedCatalogPath,
    skills_dir: `${baseDir}/skills`,
    weights: {
      trigger_exact: 0.40,
      trigger_fuzzy: 0.20,
      description_match: 0.25,
      category_priority: 0.10,
      threshold_factor: 0.05,
    },
    min_candidates: 2,
    max_candidates: 5,
  };

  const result: ScheduleResult = await schedule(request, catalog, config, adapter.readFile.bind(adapter));

  // 4. 展示候选列表
  console.log(result.output);

  // 5. 等待用户选择（如果不需要用户选择就直接执行）
  if (!result.needs_user_selection || result.candidates.length === 0) {
    if (result.candidates.length === 0) {
      console.log("\n⚠️ 未找到匹配的 skill。");
    }
    return;
  }

  // 通过适配器 prompt 获取用户选择
  const selectedId = await adapter.promptSelection(result.candidates);
  
  if (!selectedId) {
    console.log("\n未选择任何 skill，取消操作。");
    return;
  }

  // 6. 解析选择（编号或名称）
  let targetId: string | null = null;
  const numMatch = selectedId.match(/^(\d+)$/);
  
  if (numMatch) {
    // 用户输入的是编号
    const idx = parseInt(numMatch[1], 10);
    const candidate = result.candidates.find((c) => c.index === idx);
    targetId = candidate?.id || null;
  } else {
    // 用户输入的是名称
    const candidate = result.candidates.find((c) => c.name.toLowerCase() === selectedId.toLowerCase());
    targetId = candidate?.id || null;
  }

  if (!targetId) {
    adapter.showError(`未找到匹配的 skill: ${selectedId}`);
    return;
  }

  // 7. 加载并注入
  const loadResult = await loadSelected(targetId, catalog, config, adapter.readFile.bind(adapter));

  if (!loadResult.success) {
    adapter.showError(loadResult.error || "加载失败");
    return;
  }

  if (loadResult.content) {
    adapter.injectContext(loadResult.name, loadResult.content);
    console.log(`\n✅ Skill "${loadResult.name}" 已加载`);
  }
}

main().catch((err) => {
  console.error("❌ 调度器出错:", err.message);
  process.exit(1);
});
