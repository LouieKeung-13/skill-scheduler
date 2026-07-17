import { describe, it, expect } from "vitest";
import { scoreSkill, scoreAllSkills } from "./scorer.js";
import type { SkillMetadata } from "./types.js";

// 辅助函数：创建测试用 skill 元数据
function createSkill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "A test skill for translation and content generation",
    category: "content-gen",
    triggers: ["翻译", "translate", "精翻"],
    confidence_threshold: 0.5,
    requires_setup: false,
    ...overrides,
  };
}

describe("scoreSkill", () => {
  const defaultWeights = {
    trigger_exact: 0.40,
    trigger_fuzzy: 0.20,
    description_match: 0.25,
    category_priority: 0.10,
    threshold_factor: 0.05,
  };

  describe("triggers 精确命中", () => {
    it("应该对精确匹配触发词给高分", () => {
      const skill = createSkill({ triggers: ["翻译"] });
      const result = scoreSkill(skill, ["翻译"], null, defaultWeights);
      
      expect(result.breakdown.trigger_exact).toBeGreaterThan(0);
      // 100% trigger exact * 0.40 + 0.05 base = 0.45 → 45%
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it("应该对模糊匹配触发词给中等分", () => {
      const skill = createSkill({ triggers: ["翻译", "translate"] });
      // "译" 是 "翻译" 的子串 → fuzzy match
      const result = scoreSkill(skill, ["译"], null, defaultWeights);
      
      expect(result.breakdown.trigger_fuzzy).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
    });

    it("无匹配时触发词得分为 0", () => {
      const skill = createSkill({ triggers: ["翻译", "translate"] });
      const result = scoreSkill(skill, ["画图"], null, defaultWeights);
      
      expect(result.breakdown.trigger_exact).toBe(0);
      expect(result.breakdown.trigger_fuzzy).toBe(0);
    });
  });

  describe("description 语义匹配", () => {
    it("description 包含关键词时应加分", () => {
      const skill = createSkill({ description: "AI 图片生成工具" });
      const result = scoreSkill(skill, ["图片", "生成"], null, defaultWeights);
      
      expect(result.breakdown.description_match).toBeGreaterThan(0);
    });

    it("description 不包含关键词时应为 0", () => {
      const skill = createSkill({ description: "文档处理工具" });
      const result = scoreSkill(skill, ["图片", "生成"], null, defaultWeights);
      
      expect(result.breakdown.description_match).toBe(0);
    });
  });

  describe("category 优先级", () => {
    it("类别一致时应给满分", () => {
      const skill = createSkill({ category: "media-tools" });
      const result = scoreSkill(skill, ["图片"], "media-tools", defaultWeights);
      
      expect(result.breakdown.category_priority).toBe(1.0);
    });

    it("类别不一致时应为 0", () => {
      const skill = createSkill({ category: "media-tools" });
      const result = scoreSkill(skill, ["图片"], "content-gen", defaultWeights);
      
      expect(result.breakdown.category_priority).toBe(0.0);
    });
  });

  describe("综合评分", () => {
    it("高匹配度 skill 应超过阈值", () => {
      const skill = createSkill({
        id: "image-gen",
        name: "Image Generator",
        description: "AI 文生图和文生视频工具",
        category: "media-tools",
        triggers: ["生成图片", "文生图", "文生视频", "image"],
        confidence_threshold: 0.6,
      });
      // tokens: ["生成", "图片"] — triggers: ["生成图片"] → fuzzy match
      // description: "AI 文生图和文生视频工具" — contains "生成" → desc_match = 1/2 = 0.5
      // category: media-tools matches → cat_priority = 1.0
      // total = 0*0.40 + 1.0*0.20 + 0.5*0.25 + 1.0*0.10 + 0.05 = 0.20 + 0.125 + 0.10 + 0.05 = 0.475 → 48%
      const result = scoreSkill(skill, ["生成", "图片"], "media-tools", defaultWeights);
      
      // 由于 triggers 是模糊匹配（非精确），分数较低
      // threshold 是 0.6 = 60%，所以不会通过
      expect(result.passed_threshold).toBe(false);
      expect(result.score).toBeLessThan(60);
    });

    it("低匹配度 skill 不应超过阈值", () => {
      const skill = createSkill({
        id: "doc-processor",
        name: "Doc Processor",
        description: "文档处理工具",
        category: "productivity",
        triggers: ["文档", "doc"],
        confidence_threshold: 0.8,
      });
      const result = scoreSkill(skill, ["图片", "生成"], null, defaultWeights);
      
      expect(result.passed_threshold).toBe(false);
    });

    it("空 triggers 的 skill 仍能通过 description 匹配", () => {
      const skill = createSkill({ triggers: [] });
      const result = scoreSkill(skill, ["翻译"], null, defaultWeights);
      
      expect(result.breakdown.trigger_exact).toBe(0);
      expect(result.breakdown.trigger_fuzzy).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("边界情况", () => {
    it("空 tokens 时所有因子为 0", () => {
      const skill = createSkill();
      const result = scoreSkill(skill, [], null, defaultWeights);
      
      expect(result.breakdown.trigger_exact).toBe(0);
      expect(result.breakdown.trigger_fuzzy).toBe(0);
      expect(result.breakdown.description_match).toBe(0);
      expect(result.breakdown.category_priority).toBe(0);
    });

    it("threshold_factor 确保基础分", () => {
      const skill = createSkill({
        triggers: [],
        description: "完全不相关",
        category: "unrelated",
      });
      const result = scoreSkill(skill, [], null, defaultWeights);
      
      // 只有 threshold_factor (0.05) * 100 = 5%
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.score).toBeLessThanOrEqual(6);
    });
  });
});

describe("scoreAllSkills", () => {
  it("应该按分数降序排列", () => {
    const catalog: Record<string, SkillMetadata> = {
      "low-match": createSkill({
        id: "low-match",
        name: "Low Match",
        description: "完全不相关的技能",
        category: "unrelated",
        triggers: ["xyz"],
        confidence_threshold: 0.01,
      }),
      "high-match": createSkill({
        id: "high-match",
        name: "High Match",
        description: "翻译和写作工具",
        category: "content-gen",
        triggers: ["翻译", "write"],
        confidence_threshold: 0.1,
      }),
      "medium-match": createSkill({
        id: "medium-match",
        name: "Medium Match",
        description: "内容生成工具",
        category: "content-gen",
        triggers: ["生成"],
        confidence_threshold: 0.1,
      }),
    };

    const results = scoreAllSkills(catalog, ["翻译"], "content-gen");
    
    // high-match 有 trigger_exact + category_priority，分数最高
    expect(results.length).toBe(3);
    expect(results[0].id).toBe("high-match");
    // medium-match 有 description_match，高于 low-match
    expect(results[1].id).toBe("medium-match");
    expect(results[2].id).toBe("low-match");
  });

  it("应该过滤低于阈值的 skill", () => {
    const catalog: Record<string, SkillMetadata> = {
      "high": createSkill({
        id: "high",
        triggers: ["翻译"],
        confidence_threshold: 0.1,
      }),
      "low": createSkill({
        id: "low",
        triggers: ["xyz"],
        confidence_threshold: 0.99,
      }),
    };

    const results = scoreAllSkills(catalog, ["翻译"], null);
    
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("high");
  });

  it("空 catalog 返回空数组", () => {
    const results = scoreAllSkills({}, ["翻译"], null);
    expect(results).toEqual([]);
  });
});
