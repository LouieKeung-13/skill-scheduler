import { describe, it, expect } from "vitest";
import { parseRequest, getCatalogCategories } from "./parser.js";

describe("parseRequest", () => {
  const emptyCategories = new Set<string>();

  // ==================== 停用词过滤 ====================
  describe("停用词过滤", () => {
    it("应该过滤中文停用词并保留有效关键词", () => {
      const result = parseRequest("帮我翻译这篇英文文章", emptyCategories);
      expect(result.tokens).not.toContain("帮我");
      expect(result.tokens).not.toContain("这篇");
      expect(result.tokens).toContain("翻译");
      // 中文连续块作为一个 token："英文文章" 是一个整体（中文无天然分隔符）
      expect(result.tokens).toContain("英文文章");
    });

    it("应该过滤英文停用词并保留有效单词", () => {
      const result = parseRequest("help me translate this article", emptyCategories);
      expect(result.tokens).not.toContain("help");
      expect(result.tokens).not.toContain("me");
      expect(result.tokens).not.toContain("this");
      expect(result.tokens).toContain("translate");
      expect(result.tokens).toContain("article");
    });

    it("中文连续字符串作为一个 token", () => {
      const result = parseRequest("生成文生视频", emptyCategories);
      expect(result.tokens).toContain("生成文生视频");
    });

    it("空输入返回空数组", () => {
      const result = parseRequest("", emptyCategories);
      expect(result.tokens).toEqual([]);
    });
  });

  // ==================== 意图分类 ====================
  describe("意图分类", () => {
    it("content-gen: 翻译", () => {
      const result = parseRequest("帮我翻译这篇文章", emptyCategories);
      expect(result.category).toBe("content-gen");
    });

    it("media-tools: 图片生成", () => {
      const result = parseRequest("生成一张图片", emptyCategories);
      expect(result.category).toBe("media-tools");
    });

    it("media-tools: 视频相关", () => {
      const result = parseRequest("生成一段视频", emptyCategories);
      expect(result.category).toBe("media-tools");
    });

    it("media-tools: 图片压缩", () => {
      const result = parseRequest("压缩这张图片", emptyCategories);
      expect(result.category).toBe("media-tools");
    });

    it("productivity: 文档编辑", () => {
      const result = parseRequest("编辑一个 PDF 文档", emptyCategories);
      expect(result.category).toBe("productivity");
    });

    it("productivity: 表格处理", () => {
      const result = parseRequest("整理 Excel 表格", emptyCategories);
      expect(result.category).toBe("productivity");
    });

    it("dev-tools: 网页转 markdown", () => {
      const result = parseRequest("把这个网页转成 markdown", emptyCategories);
      expect(result.category).toBe("dev-tools");
    });

    it("dev-tools: 代码相关", () => {
      const result = parseRequest("调试这段代码", emptyCategories);
      expect(result.category).toBe("dev-tools");
    });

    it("无法匹配时返回 general", () => {
      const result = parseRequest("今天天气不错", emptyCategories);
      expect(result.intent).toBe("general");
    });
  });

  // ==================== 实体提取 ====================
  describe("实体提取", () => {
    it("应该提取源语言", () => {
      const result = parseRequest("把英文翻译成中文", emptyCategories);
      expect(result.entities.source_lang).toBe("en");
    });

    it("应该提取目标语言", () => {
      const result = parseRequest("翻译成中文", emptyCategories);
      expect(result.entities.target_lang).toBe("zh");
    });

    it("应该同时提取源语言和目标语言", () => {
      const result = parseRequest("从英文翻译成中文", emptyCategories);
      expect(result.entities.source_lang).toBe("en");
      // target_lang 也匹配到"中文"
      expect(result.entities.target_lang).toBe("zh");
    });

    it("不应该提取不存在的语言", () => {
      const result = parseRequest("帮我翻译", emptyCategories);
      expect(result.entities.source_lang).toBeUndefined();
      expect(result.entities.target_lang).toBeUndefined();
    });

    it("应该识别文件路径", () => {
      const result = parseRequest("打开 /path/to/file.md", emptyCategories);
      expect(result.entities.file_path).toBe("file.md");
    });

    it("应该识别 Windows 路径", () => {
      const result = parseRequest("打开 C:\\Users\\test.docx", emptyCategories);
      expect(result.entities.file_path).toBe("test.docx");
    });
  });

  // ==================== catalog 类别感知 ====================
  describe("catalog 类别感知", () => {
    it("预定义类别优先于 catalog 自定义类别", () => {
      const catalogCategories = new Set(["custom-category"]);
      const result = parseRequest("翻译文章", catalogCategories);
      // "翻译" 命中 content-gen（预定义），应优先于 catalog 匹配
      expect(result.category).toBe("content-gen");
    });
  });

  // ==================== 边界情况 ====================
  describe("边界情况", () => {
    it("纯数字输入", () => {
      const result = parseRequest("123", emptyCategories);
      expect(result.tokens).toContain("123");
    });

    it("特殊字符输入", () => {
      const result = parseRequest("!@#$%", emptyCategories);
      expect(result.tokens).toEqual([]);
    });

    it("多语言混合", () => {
      const result = parseRequest("translate 翻译成 english", emptyCategories);
      expect(result.tokens).toContain("translate");
      expect(result.tokens).toContain("翻译成");
      expect(result.tokens).toContain("english");
    });
  });
});

describe("getCatalogCategories", () => {
  it("应该从 catalog 中提取所有 category", () => {
    const catalog = {
      skillA: { id: "a", name: "A", description: "desc A", category: "content-gen", triggers: [], confidence_threshold: 0.7, requires_setup: false },
      skillB: { id: "b", name: "B", description: "desc B", category: "media-tools", triggers: [], confidence_threshold: 0.7, requires_setup: false },
      skillC: { id: "c", name: "C", description: "desc C", category: "content-gen", triggers: [], confidence_threshold: 0.7, requires_setup: false },
    };
    const categories = getCatalogCategories(catalog);
    expect(categories.size).toBe(2);
    expect(categories.has("content-gen")).toBe(true);
    expect(categories.has("media-tools")).toBe(true);
  });

  it("空 catalog 返回空集合", () => {
    const categories = getCatalogCategories({});
    expect(categories.size).toBe(0);
  });

  it("重复 category 只保留唯一值", () => {
    const catalog = {
      skillA: { category: "content-gen" },
      skillB: { category: "content-gen" },
    };
    const categories = getCatalogCategories(catalog as any);
    expect(categories.size).toBe(1);
  });
});
