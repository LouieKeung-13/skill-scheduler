import { describe, it, expect } from "vitest";
import { buildCandidateList, formatCandidateList } from "./candidate.js";
import type { MatchScore } from "./types.js";

// 辅助函数：创建测试用 MatchScore
function createScore(overrides: Partial<MatchScore> = {}): MatchScore {
  return {
    id: "test",
    name: "Test Skill",
    description: "A test skill",
    score: 80,
    breakdown: { trigger_exact: 0.5, trigger_fuzzy: 0.2, description_match: 0.3, category_priority: 0.8, total: 0.6 },
    passed_threshold: true,
    ...overrides,
  };
}

describe("buildCandidateList", () => {
  it("应该按分数降序排列候选列表", () => {
    const scores: MatchScore[] = [
      createScore({ id: "low", score: 45 }),
      createScore({ id: "high", score: 95 }),
      createScore({ id: "mid", score: 70 }),
    ];

    const candidates = buildCandidateList(scores);

    expect(candidates[0].id).toBe("high");
    expect(candidates[1].id).toBe("mid");
    expect(candidates[2].id).toBe("low");
  });

  it("应该限制最大数量", () => {
    const scores: MatchScore[] = Array.from({ length: 10 }, (_, i) =>
      createScore({ id: `skill-${i}`, score: 90 - i * 5 })
    );

    const candidates = buildCandidateList(scores, 2, 3);

    expect(candidates.length).toBeLessThanOrEqual(3);
    expect(candidates[0].score).toBe(90);
    expect(candidates[2].score).toBe(80);
  });

  it("应该标记低置信度候选", () => {
    const scores: MatchScore[] = [
      createScore({ score: 95 }),
      createScore({ score: 40 }),
    ];

    const candidates = buildCandidateList(scores);

    expect(candidates[0].is_low_confidence).toBe(false);
    expect(candidates[1].is_low_confidence).toBe(true);
  });

  it("空输入返回空数组", () => {
    const candidates = buildCandidateList([]);
    expect(candidates).toEqual([]);
  });
});

describe("formatCandidateList", () => {
  it("应该格式化正常候选列表", () => {
    const candidates = [
      { id: "s1", index: 1, name: "Skill A", description: "描述 A", score: 95, notes: undefined, is_low_confidence: false },
      { id: "s2", index: 2, name: "Skill B", description: "描述 B", score: 40, notes: "可能不是你要的", is_low_confidence: true },
    ];

    const output = formatCandidateList(candidates);

    expect(output).toContain("📋 检测到以下 skill 可处理你的请求");
    expect(output).toContain("1️⃣  Skill A");
    expect(output).toContain("匹配度: 95%");
    expect(output).toContain("2️⃣  Skill B");
    expect(output).toContain("匹配度: 40%");
    expect(output).toContain("可能不是你要的");
    expect(output).toContain("请选择编号");
  });

  it("空候选列表应返回未匹配提示", () => {
    const output = formatCandidateList([]);
    expect(output).toContain("未检测到匹配的 skill");
  });
});
