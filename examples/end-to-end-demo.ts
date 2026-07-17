/**
 * 端到端 Demo — 演示完整调度流程
 * 
 * 用法: npx tsx examples/end-to-end-demo.ts
 * 
 * 这个 demo 展示了：
 * 1. 用户输入解析
 * 2. catalog.json 扫描和评分
 * 3. 候选列表展示
 * 4. 用户选择后的 skill 加载
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { schedule, loadSelected } from "../src/index.js";
import { OpenClawAdapter } from "../adapters/openclaw.js";
import type { SchedulerConfig, SkillCatalog, CandidateItem } from "../src/types.js";

// ============================================================
// 模拟文件读取（demo 不需要真实文件系统）
// ============================================================
const mockReadFile: (path: string) => Promise<string> = async (path) => {
  // 返回一个通用的 SKILL.md 模板
  return `# ${path}
  
This is a simulated skill file for demo purposes.
In production, this would contain the full SKILL.md definition.`;
};

// ============================================================
// 测试用例定义
// ============================================================
interface TestCase {
  name: string;
  request: string;
  expectedSkillId?: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: "场景一：内容创作",
    request: "帮我翻译这篇英文文章",
    expectedSkillId: "translator",
    description: "用户想翻译文章 → 应匹配 translator",
  },
  {
    name: "场景二：图片生成",
    request: "生成一张赛博朋克风格的插画",
    expectedSkillId: "image-generator",
    description: "用户想生成图片 → 应匹配 image-generator",
  },
  {
    name: "场景三：网页提取",
    request: "把这个网页转成 markdown",
    expectedSkillId: "url-to-markdown",
    description: "用户想转换网页 → 应匹配 url-to-markdown",
  },
  {
    name: "场景四：文档处理",
    request: "编辑一个 PDF 文档",
    expectedSkillId: "pdf-processor",
    description: "用户想处理 PDF → 应匹配 pdf-processor",
  },
];

// ============================================================
// 执行调度并展示结果
// ============================================================
async function runDemo(
  testCase: TestCase,
  catalog: SkillCatalog,
  config: SchedulerConfig
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${testCase.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📝 用户请求: "${testCase.request}"`);
  console.log(`💡 ${testCase.description}\n`);

  // 1. 执行调度
  const result = await schedule(
    testCase.request,
    catalog,
    config,
    mockReadFile
  );

  // 2. 展示候选列表
  console.log("📋 候选 Skill 列表:");
  console.log(result.output);

  // 3. 验证预期
  if (result.candidates.length > 0) {
    const topCandidate = result.candidates[0];
    console.log(`\n🏆 最高匹配: ${topCandidate.name} (${topCandidate.score}%)`);

    if (testCase.expectedSkillId) {
      if (topCandidate.id === testCase.expectedSkillId) {
        console.log(`✅ 正确匹配到: ${testCase.expectedSkillId}`);
      } else {
        console.log(`⚠️  预期: ${testCase.expectedSkillId}, 实际: ${topCandidate.id}`);
      }
    }

    // 4. 模拟用户选择并加载
    console.log(`\n👤 用户选择: ${topCandidate.index}️⃣  ${topCandidate.name}`);
    
    const loadResult = await loadSelected(
      topCandidate.id,
      catalog,
      config,
      mockReadFile
    );

    if (loadResult.success && loadResult.content) {
      console.log(`\n✅ Skill "${loadResult.name}" 已成功加载`);
      console.log(`📄 加载内容预览: ${loadResult.content.substring(0, 80)}...`);
    } else {
      console.log(`\n❌ 加载失败: ${loadResult.error}`);
    }
  } else {
    console.log("\n⚠️  未找到匹配的 Skill");
  }
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  console.log("🚀 Skill Scheduler 端到端 Demo");
  console.log("================================\n");

  // 1. 加载 catalog
  const catalogPath = resolve(__dirname, "..", "catalog.json");
  const catalogRaw = readFileSync(catalogPath, "utf-8");
  const catalog: SkillCatalog = JSON.parse(catalogRaw);

  console.log(`📦 Catalog 加载成功: ${Object.keys(catalog.skills).length} 个 Skill\n`);

  // 2. 创建配置
  const config: SchedulerConfig = {
    catalog_path: catalogPath,
    skills_dir: resolve(__dirname, "..", "skills"),
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

  // 3. 运行所有测试用例
  for (const testCase of TEST_CASES) {
    await runDemo(testCase, catalog, config);
  }

  // 4. 总结
  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Demo 完成!");
  console.log(`${"=".repeat(60)}\n`);
  console.log("💡 下一步:");
  console.log("   1. 将你的实际 Skill 实现放入 skills/ 目录");
  console.log("   2. 在 catalog.json 中注册新的 Skill");
  console.log("   3. 运行 CLI: npx tsx src/cli.ts <用户请求> --adapter openclaw");
  console.log("");
}

main().catch((err) => {
  console.error("❌ Demo 出错:", err.message);
  process.exit(1);
});
