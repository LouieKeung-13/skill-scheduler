import { parseRequest, getCatalogCategories } from "./parser.js";
import { scoreAllSkills } from "./scorer.js";
import { buildCandidateList, formatCandidateList } from "./candidate.js";
import { loadSkill, LoadResult } from "./loader.js";
import {
  SkillCatalog,
  SchedulerConfig,
  WeightConfig,
  ParsedRequest,
  MatchScore,
  CandidateItem,
} from "./types.js";

// ============================================================
// 智能调度器 — 主入口
// ============================================================

/**
 * 执行一次完整的调度流程
 * 
 * @param userRequest - 用户原始请求
 * @param catalog - skill 目录数据
 * @param config - 调度器配置
 * @param readFile - 文件读取函数（运行时注入）
 */
export async function schedule(
  userRequest: string,
  catalog: SkillCatalog,
  config: SchedulerConfig,
  readFile: (path: string) => Promise<string>
): Promise<ScheduleResult> {
  // --- Phase 1: 意图解析 ---
  const catalogCategories = getCatalogCategories(catalog.skills);
  const parsed: ParsedRequest = parseRequest(userRequest, catalogCategories);

  // --- Phase 2: 评分 ---
  const scores: MatchScore[] = scoreAllSkills(
    catalog.skills,
    parsed.tokens,
    parsed.category,
    config.weights
  );

  // --- Phase 3: 生成候选列表 ---
  const candidates: CandidateItem[] = buildCandidateList(
    scores,
    config.min_candidates,
    config.max_candidates
  );

  // --- Phase 4: 格式化输出 ---
  const formattedOutput = formatCandidateList(candidates);

  return {
    success: true,
    parsed,
    scores,
    candidates,
    output: formattedOutput,
    // 不自动加载，等待用户选择后调用 loadSelected()
    needs_user_selection: candidates.length > 0,
  };
}

/**
 * 加载用户选择的 skill
 */
export async function loadSelected(
  skillId: string,
  catalog: SkillCatalog,
  config: SchedulerConfig,
  readFile: (path: string) => Promise<string>
): Promise<LoadResult> {
  const skillMetadata = catalog.skills[skillId];
  if (!skillMetadata) {
    return {
      success: false,
      id: skillId,
      name: skillId,
      content: null,
      error: `未找到 skill: ${skillId}`,
    };
  }

  return loadSkill(skillId, skillMetadata, config.skills_dir, readFile);
}

/** 调度结果 */
export interface ScheduleResult {
  success: boolean;
  parsed: ParsedRequest;
  scores: MatchScore[];
  candidates: CandidateItem[];
  output: string; // 展示给用户的内容
  needs_user_selection: boolean;
}
