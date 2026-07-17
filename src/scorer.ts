import { SkillMetadata, MatchScore, ScoreBreakdown, WeightConfig } from "./types.js";

/** 模糊匹配：编辑距离 ≤ 1 / 包含关系 / 子串重叠 */
function isFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // 编辑距离 ≤ 1
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
      if (diff > 1) return false;
    }
    return true;
  }
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return long.includes(short);
}

/**
 * 子串重叠匹配 — 处理中文长句场景
 * 例如：token="生成一张赛博朋克风格的插画"，trigger="生成图片"
 * 检查 token 是否包含 trigger 中的连续子串（至少 n 个连续字符）
 */
function hasSubstringOverlap(token: string, trigger: string, minOverlap: number = 2): boolean {
  if (token.length < minOverlap || trigger.length < minOverlap) return false;
  for (let i = 0; i <= trigger.length - minOverlap; i++) {
    const sub = trigger.substring(i, i + minOverlap);
    if (token.includes(sub)) return true;
  }
  return false;
}

// ============================================================
// 评分引擎 — 多因子加权匹配算法
// ============================================================

/**
 * 默认权重配置
 */
const DEFAULT_WEIGHTS: WeightConfig = {
  trigger_exact: 0.40,
  trigger_fuzzy: 0.20,
  description_match: 0.25,
  category_priority: 0.10,
  threshold_factor: 0.05,
};

/**
 * 计算单个 skill 的匹配分数
 */
export function scoreSkill(
  skill: SkillMetadata,
  tokens: string[],
  parsedCategory: string | null,
  weights: WeightConfig = DEFAULT_WEIGHTS
): MatchScore {
  const breakdown: ScoreBreakdown = {
    trigger_exact: 0,
    trigger_fuzzy: 0,
    description_match: 0,
    category_priority: 0,
    total: 0,
  };

  // --- 因子 1: triggers 精确命中 (0-1) ---
  let exactHits = 0;
  for (const token of tokens) {
    for (const trigger of skill.triggers) {
      if (token === trigger.toLowerCase()) {
        exactHits++;
        break;
      }
    }
  }
  const triggerExactScore = skill.triggers.length > 0
    ? Math.min(exactHits / Math.max(skill.triggers.length, 1), 1)
    : 0;
  breakdown.trigger_exact = triggerExactScore;

  // --- 因子 2: triggers 模糊匹配 (0-1) ---
  let fuzzyHits = 0;
  for (const token of tokens) {
    for (const trigger of skill.triggers) {
      if (isFuzzyMatch(token, trigger.toLowerCase())) {
        fuzzyHits++;
        break;
      }
    }
  }
  const triggerFuzzyScore = skill.triggers.length > 0
    ? Math.min(fuzzyHits / Math.max(skill.triggers.length, 1), 1)
    : 0;
  breakdown.trigger_fuzzy = triggerFuzzyScore;

  // --- 因子 2.5: triggers 子串重叠 (0-1) — 中文长句场景 ---
  let subOverlapHits = 0;
  for (const token of tokens) {
    for (const trigger of skill.triggers) {
      if (hasSubstringOverlap(token, trigger.toLowerCase())) {
        subOverlapHits++;
        break;
      }
    }
  }
  const triggerSubOverlapScore = skill.triggers.length > 0
    ? Math.min(subOverlapHits / Math.max(skill.triggers.length, 1), 1)
    : 0;
  // 将子串重叠分数的一半加到模糊匹配上（降低权重）
  breakdown.trigger_fuzzy = Math.min(triggerFuzzyScore + triggerSubOverlapScore * 0.5, 1);

  // --- 因子 3: description 语义匹配 (0-1) ---
  const descLower = skill.description.toLowerCase();
  let descHits = 0;
  for (const token of tokens) {
    if (descLower.includes(token)) {
      descHits++;
    }
  }
  const descriptionMatchScore = tokens.length > 0
    ? Math.min(descHits / tokens.length, 1)
    : 0;
  breakdown.description_match = descriptionMatchScore;

  // --- 因子 4: category 优先级 (0-1) ---
  // 如果解析出的类别与 skill 的类别一致，给满分
  const categoryPriorityScore = parsedCategory && skill.category === parsedCategory
    ? 1.0
    : 0.0;
  breakdown.category_priority = categoryPriorityScore;

  // --- 加权总分 (0-1) ---
  const totalScore =
    breakdown.trigger_exact * weights.trigger_exact +
    breakdown.trigger_fuzzy * weights.trigger_fuzzy +
    breakdown.description_match * weights.description_match +
    breakdown.category_priority * weights.category_priority +
    weights.threshold_factor; // 基础分

  breakdown.total = Math.min(totalScore, 1);

  // 转换为百分比
  const scorePercent = Math.round(breakdown.total * 100);
  const passedThreshold = scorePercent >= (skill.confidence_threshold * 100);

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    score: scorePercent,
    breakdown,
    passed_threshold: passedThreshold,
  };
}

/**
 * 批量评分所有 catalog 中的 skills
 */
export function scoreAllSkills(
  catalog: Record<string, SkillMetadata>,
  tokens: string[],
  parsedCategory: string | null,
  weights: WeightConfig = DEFAULT_WEIGHTS
): MatchScore[] {
  const results: MatchScore[] = [];

  for (const [id, skill] of Object.entries(catalog)) {
    const result = scoreSkill(skill, tokens, parsedCategory, weights);
    // 只保留通过阈值的
    if (result.passed_threshold) {
      results.push(result);
    }
  }

  // 按分数降序排列
  results.sort((a, b) => b.score - a.score);

  return results;
}
