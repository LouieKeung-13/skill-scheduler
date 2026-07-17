import { MatchScore, CandidateItem } from "./types.js";

// ============================================================
// 候选列表生成器 — 格式化展示给用户
// ============================================================

/**
 * 将评分结果转换为候选列表
 */
export function buildCandidateList(
  scores: MatchScore[],
  minCandidates: number = 2,
  maxCandidates: number = 5
): CandidateItem[] {
  // 按分数降序排列（确保排序）
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  
  // 如果通过阈值的太少，补充低分 skill
  let candidates: MatchScore[] = sorted;

  if (candidates.length < minCandidates && scores.length > 0) {
    // 从所有 skills 中找最高分的未入选项补齐
    const selectedIds = new Set(candidates.map((c) => c.id));
    // 这里假设调用方传入了完整评分列表，实际使用时需调整
    candidates = scores.slice(0, Math.max(minCandidates, scores.length));
  }

  // 限制最大数量
  candidates = candidates.slice(0, maxCandidates);

  return candidates.map((s, index) => ({
    id: s.id,
    index: index + 1,
    name: s.name,
    description: s.description,
    score: s.score,
    notes: s.score >= 80 ? undefined : "可能不是你要的",
    is_low_confidence: s.score < 50,
  }));
}

/**
 * 将候选列表格式化为人类可读文本
 */
export function formatCandidateList(candidates: CandidateItem[]): string {
  if (candidates.length === 0) {
    return "⚠️ 未检测到匹配的 skill，请检查请求描述或联系管理员注册新 skill。";
  }

  const lines = [
    "📋 检测到以下 skill 可处理你的请求:",
    "",
  ];

  for (const c of candidates) {
    lines.push(`${c.index}️⃣  ${c.name}`);
    lines.push(`    📝 ${c.description}`);
    lines.push(`    ⚡ 匹配度: ${c.score}%`);

    if (c.is_low_confidence) {
      lines.push(`    💡 ${c.notes || "可能不是你要的"}`);
    } else if (c.notes) {
      lines.push(`    💡 ${c.notes}`);
    }

    lines.push("");
  }

  lines.push("请选择编号 (1-" + candidates.length + ")，或直接说 skill 名称:");

  return lines.join("\n");
}
