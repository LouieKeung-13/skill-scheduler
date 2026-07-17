import { describe, it, expect } from "vitest";
import { scoreSkill, scoreAllSkills } from "./scorer.js";
import type { SkillMetadata, WeightConfig } from "./types.js";

// 辅助函数
function createSkill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    id: "test",
    name: "Test",
    description: "A test skill",
    category: "general",
    triggers: [],
    confidence_threshold: 0.3,
    requires_setup: false,
    ...overrides,
  };
}

describe("Scorer Integration Tests — 真实场景覆盖", () => {
  const defaultWeights: WeightConfig = {
    trigger_exact: 0.40,
    trigger_fuzzy: 0.20,
    description_match: 0.25,
    category_priority: 0.10,
    threshold_factor: 0.05,
  };

  // ==================== media-tools 类别覆盖 ====================
  describe("media-tools 类别", () => {
    it("video-generator: 中文长句应通过子串重叠匹配", () => {
      const skill = createSkill({
        id: "video-gen",
        name: "Video Generator",
        description: "根据文字描述生成短视频片段",
        category: "media-tools",
        triggers: ["视频生成", "文生视频", "动画"],
        confidence_threshold: 0.1,
      });
      // 用户输入"帮我生成一段视频" → 中文整句是一个 token
      // 子串重叠: "生成"(2字符) 在 token 中 → 命中 1/3 triggers
      // 但分数可能较低，只验证有分数即可
      const result = scoreSkill(skill, ["帮我生成一段视频"], null, defaultWeights);
      
      // 子串重叠会给 trigger_fuzzy 加分
      expect(result.breakdown.trigger_fuzzy).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(5);
    });

    it("music-composer: 中英混合触发词", () => {
      const skill = createSkill({
        id: "music-comp",
        name: "Music Composer",
        description: "根据文字描述生成音乐作品",
        category: "media-tools",
        triggers: ["生成音乐", "作曲", "compose music", "ai音乐"],
        confidence_threshold: 0.3,
      });
      const result = scoreSkill(skill, ["生成音乐"], null, defaultWeights);
      expect(result.passed_threshold).toBe(true);
      expect(result.breakdown.trigger_exact).toBeGreaterThan(0);
    });
  });

  // ==================== 多 skill 竞争排序 ====================
  describe("多 skill 竞争排序", () => {
    it("翻译 vs 文档编辑 — 只有翻译命中", () => {
      const catalog: Record<string, SkillMetadata> = {
        "translator": createSkill({
          id: "translator",
          name: "Translator",
          description: "多模式翻译工具",
          category: "content-gen",
          triggers: ["翻译", "精翻", "快翻"],
          confidence_threshold: 0.1,
        }),
        "docx-editor": createSkill({
          id: "docx-editor",
          name: "Doc Editor",
          description: "文档编辑工具",
          category: "productivity",
          triggers: ["文档", "编辑文档"],
          confidence_threshold: 0.1,
        }),
      };
      const results = scoreAllSkills(catalog, ["翻译"], null, defaultWeights);
      
      // 只有 translator 命中（docx-editor 的 triggers 不含"翻译"）
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("translator");
    });

    it("图片 vs 视频 — 图片应排第一", () => {
      const catalog: Record<string, SkillMetadata> = {
        "image-gen": createSkill({
          id: "image-gen",
          name: "Image Generator",
          description: "AI 图片生成",
          category: "media-tools",
          triggers: ["生成图片", "画图", "插画"],
          confidence_threshold: 0.1,
        }),
        "video-gen": createSkill({
          id: "video-gen",
          name: "Video Generator",
          description: "AI 视频生成",
          category: "media-tools",
          triggers: ["视频生成", "文生视频"],
          confidence_threshold: 0.1,
        }),
      };
      const results = scoreAllSkills(catalog, ["生成图片"], null, defaultWeights);
      
      expect(results[0].id).toBe("image-gen");
    });

    it("多个 skill 都命中时按分数排序", () => {
      const catalog: Record<string, SkillMetadata> = {
        "exact-match": createSkill({
          id: "exact-match", name: "Exact",
          description: "翻译工具",
          category: "content-gen", triggers: ["翻译"],
          confidence_threshold: 0.1,
        }),
        "partial-match": createSkill({
          id: "partial-match", name: "Partial",
          description: "翻译和绘图工具",
          category: "content-gen", triggers: ["翻译", "画图"],
          confidence_threshold: 0.1,
        }),
      };
      const results = scoreAllSkills(catalog, ["翻译"], null, defaultWeights);
      
      // exact-match: trigger_exact = 1/1 = 1.0
      // partial-match: trigger_exact = 1/2 = 0.5
      // exact-match 应该更高
      expect(results[0].id).toBe("exact-match");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  // ==================== 自定义权重 ====================
  describe("自定义权重配置", () => {
    it("提高 description 权重时，描述匹配的 skill 应排第一", () => {
      const highDescWeight: WeightConfig = {
        trigger_exact: 0.10,
        trigger_fuzzy: 0.10,
        description_match: 0.60,
        category_priority: 0.10,
        threshold_factor: 0.10,
      };

      const catalog: Record<string, SkillMetadata> = {
        "desc-match": createSkill({
          id: "desc-match", name: "Desc Match",
          description: "这是一个翻译工具，支持多种语言",
          category: "content-gen", triggers: ["xyz"],
          confidence_threshold: 0.01,
        }),
        "trigger-match": createSkill({
          id: "trigger-match", name: "Trigger Match",
          description: "不相关的功能",
          category: "unrelated", triggers: ["翻译"],
          confidence_threshold: 0.01,
        }),
      };
      const results = scoreAllSkills(catalog, ["翻译"], null, highDescWeight);
      
      // desc-match 的 description 包含"翻译"，description_match = 1.0
      // trigger-match 的 trigger_exact = 1.0
      // 提高 description 权重后，desc-match 应该超过 trigger-match
      expect(results[0].id).toBe("desc-match");
    });

    it("提高 category 权重时，类别一致的 skill 应占优", () => {
      const highCatWeight: WeightConfig = {
        trigger_exact: 0.10,
        trigger_fuzzy: 0.10,
        description_match: 0.10,
        category_priority: 0.60,
        threshold_factor: 0.10,
      };

      const catalog: Record<string, SkillMetadata> = {
        "cat-match": createSkill({
          id: "cat-match", name: "Cat Match",
          description: "不相关",
          category: "content-gen", triggers: ["xyz"],
          confidence_threshold: 0.01,
        }),
        "no-cat": createSkill({
          id: "no-cat", name: "No Cat",
          description: "翻译工具",
          category: "media-tools", triggers: ["翻译"],
          confidence_threshold: 0.01,
        }),
      };
      const results = scoreAllSkills(catalog, ["翻译"], "content-gen", highCatWeight);
      
      expect(results[0].id).toBe("cat-match");
    });
  });

  // ==================== 不同阈值的影响 ====================
  describe("confidence_threshold 影响", () => {
    it("高阈值会过滤掉低分 skill", () => {
      const catalog: Record<string, SkillMetadata> = {
        "high-threshold": createSkill({
          id: "high-threshold", name: "High Threshold",
          description: "翻译工具",
          category: "unrelated", triggers: ["xyz"], // triggers 不匹配
          confidence_threshold: 0.9,
        }),
        "low-threshold": createSkill({
          id: "low-threshold", name: "Low Threshold",
          description: "翻译工具",
          category: "content-gen", triggers: ["翻译"],
          confidence_threshold: 0.1,
        }),
      };
      const results = scoreAllSkills(catalog, ["翻译"], "content-gen", defaultWeights);
      
      // high-threshold 分数很低（只有基础分 ~5%），且要求 >= 90%，被过滤
      // low-threshold 分数高（~55%），通过
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("low-threshold");
    });

    it("零阈值展示所有 skill", () => {
      const catalog: Record<string, SkillMetadata> = {
        "a": createSkill({ id: "a", name: "A", description: "描述A", category: "cat", triggers: ["a"], confidence_threshold: 0 }),
        "b": createSkill({ id: "b", name: "B", description: "描述B", category: "cat", triggers: ["b"], confidence_threshold: 0 }),
        "c": createSkill({ id: "c", name: "C", description: "描述C", category: "cat", triggers: ["c"], confidence_threshold: 0 }),
      };
      const results = scoreAllSkills(catalog, ["a"], "cat", defaultWeights);
      expect(results.length).toBe(3);
    });
  });

  // ==================== 中英混合输入 ====================
  describe("中英混合输入", () => {
    it("中英混合请求应同时匹配中英文触发词", () => {
      const skill = createSkill({
        id: "mixed",
        name: "Mixed Skill",
        description: "翻译和图片生成工具",
        category: "content-gen",
        triggers: ["翻译", "translate", "画图", "image"],
        confidence_threshold: 0.2,
      });
      const result = scoreSkill(skill, ["翻译", "image"], "content-gen", defaultWeights);
      
      expect(result.passed_threshold).toBe(true);
      // 两个触发词都精确命中 → trigger_exact = 2/4 = 0.5
      expect(result.breakdown.trigger_exact).toBeGreaterThanOrEqual(0.4);
    });

    it("纯英文请求应匹配英文触发词", () => {
      const skill = createSkill({
        id: "en-skill",
        name: "English Skill",
        description: "Web scraping tool",
        category: "dev-tools",
        triggers: ["scrape", "crawl", "网页抓取"],
        confidence_threshold: 0.2,
      });
      const result = scoreSkill(skill, ["scrape", "data"], "dev-tools", defaultWeights);
      
      expect(result.passed_threshold).toBe(true);
      expect(result.breakdown.trigger_exact).toBeGreaterThan(0);
    });
  });

  // ==================== 边界和异常 ====================
  describe("边界和异常处理", () => {
    it("空 catalog 返回空数组", () => {
      const results = scoreAllSkills({}, [], null);
      expect(results).toEqual([]);
    });

    it("skill 无 triggers 时仍能通过 description 匹配", () => {
      const skill = createSkill({
        id: "no-triggers",
        name: "No Triggers",
        description: "这是一个翻译工具，支持快速翻译",
        category: "content-gen",
        triggers: [],
      });
      const result = scoreSkill(skill, ["翻译"], null, defaultWeights);
      
      expect(result.breakdown.trigger_exact).toBe(0);
      expect(result.breakdown.description_match).toBeGreaterThan(0);
    });

    it("超长输入不应崩溃", () => {
      const skill = createSkill({
        id: "long-input",
        name: "Long Input",
        description: "通用工具",
        category: "general",
        triggers: ["工具"],
      });
      const longInput = "这是一个非常非常非常非常非常非常非常非常长的输入字符串，包含了大量重复的词汇和无意义的字符。".repeat(10);
      const result = scoreSkill(skill, [longInput], null, defaultWeights);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("重复触发词不应导致重复计数", () => {
      const skill = createSkill({
        id: "dup-trigger",
        name: "Dup Trigger",
        description: "翻译工具",
        category: "content-gen",
        triggers: ["翻译", "翻译", "翻译"], // 故意重复
        confidence_threshold: 0.1,
      });
      const result = scoreSkill(skill, ["翻译"], null, defaultWeights);
      
      // 即使 triggers 有重复，精确命中只计一次 per token
      expect(result.breakdown.trigger_exact).toBeLessThan(1);
    });

    it("emoji 输入应只给基础分", () => {
      const skill = createSkill({
        id: "emoji-test",
        name: "Emoji Test",
        description: "翻译工具",
        category: "content-gen",
        triggers: ["翻译"],
      });
      const result = scoreSkill(skill, ["🎉🎊🎈"], null, defaultWeights);
      
      expect(result.score).toBeLessThan(10); // 只有基础分
    });
  });
});
