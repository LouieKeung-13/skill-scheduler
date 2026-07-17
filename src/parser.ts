import { ParsedRequest } from "./types.js";

// ============================================================
// 意图解析器 — 从用户请求中提取关键词、意图、类别和实体
// ============================================================

/**
 * 常见停用词列表（中英文）
 */
const STOP_WORDS = new Set([
  // 中文停用词
  "帮我", "帮", "我", "请", "一下", "这个", "那个", "这些", "那些",
  "这篇", "那篇", "这个", "一个", "什么", "怎么", "如何",
  "了", "的", "地", "得", "在", "是", "有", "和", "与", "或",
  "吗", "呢", "吧", "啊", "哦", "嗯", "哈",
  // 英文停用词
  "help", "me", "my", "the", "a", "an", "this", "that", "these", "those",
  "please", "can", "could", "would", "want", "need", "like", "to", "for",
]);

/**
 * 预定义类别映射（用于意图分类）
 */
const CATEGORY_MAP: Record<string, string[]> = {
  "content-gen": ["翻译", "translate", "write", "写作", "生成文本", "创作", "写文章", "创作内容", "写文章"],
  "media-tools": ["图片", "image", "photo", "画图", "生成图", "压缩图片", "封面", "视频", "生成视频", "文生视频", "视频生成", "compress", "image gen"],
  "productivity": ["文档", "doc", "pdf", "excel", "表格", "飞书", "notion", "发布", "编辑", "整理", "处理"],
  "dev-tools": ["浏览器", "browser", "网页", "url", "markdown", "代码", "debug", "网页转", "extract", "convert"],
};

/**
 * 清洗输入：去除停用词，提取有效 token
 */
function cleanTokens(input: string): string[] {
  const raw = input.trim().toLowerCase();
  if (!raw) return [];

  // 分离中英文停用词
  const cnStopWords = [...STOP_WORDS].filter(w => /[\u4e00-\u9fff]/.test(w)).sort((a, b) => b.length - a.length);
  const enStopWords = [...STOP_WORDS].filter(w => /^[a-z]+$/.test(w));

  let cutInput = raw;

  // 中文停用词：直接替换（中文无天然单词边界）
  for (const sw of cnStopWords) {
    cutInput = cutInput.replaceAll(sw, ' ');
  }

  // 英文停用词：用单词边界保护，不切割词内字母
  for (const sw of enStopWords) {
    const escaped = sw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'g');
    cutInput = cutInput.replace(boundaryRegex, ' ');
  }

  // 分词：中文连续块 + 英文单词块
  const segments: string[] = [];
  const matches = cutInput.match(/[\u4e00-\u9fff]+|[a-zA-Z0-9]+/g) || [];
  for (const m of matches) {
    if (m.length > 0 && !STOP_WORDS.has(m)) {
      segments.push(m);
    }
  }

  return segments;
}

/**
 * 模糊匹配：检查两个字符串是否接近（编辑距离 ≤ 1 或包含关系）
 */
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
  // 长度差 1，短的是长的子串
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return long.includes(short);
}

/**
 * 解析用户请求
 */
export function parseRequest(
  input: string,
  catalogCategories: Set<string>
): ParsedRequest {
  const tokens = cleanTokens(input);

  // 1. 意图分类：匹配预定义类别
  let matchedCategory: string | null = null;
  let maxCategoryScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    let score = 0;
    for (const token of tokens) {
      for (const keyword of keywords) {
        if (isFuzzyMatch(token, keyword)) {
          score += 1;
        }
      }
    }
    if (score > maxCategoryScore) {
      maxCategoryScore = score;
      matchedCategory = category;
    }
  }

  // 如果预定义类别没命中，尝试 catalog 中已有的类别
  if (!matchedCategory) {
    for (const token of tokens) {
      for (const cat of catalogCategories) {
        if (cat.includes(token) || token.includes(cat)) {
          matchedCategory = cat;
          break;
        }
      }
      if (matchedCategory) break;
    }
  }

  // 2. 实体提取：识别常见参数模式
  const entities: Record<string, string> = {};

  // 语言检测：简单规则匹配
  const lowerInput = input.toLowerCase();

  // 源语言："从X" / "X翻译" / "from X" / "X to"（X 出现在翻译动作之前）
  const sourceMatch = lowerInput.match(/(?:从|from|origin|source)\s*(英文|英语|en|english)/);
  if (sourceMatch) entities.source_lang = "en";
  const sourceZhMatch = lowerInput.match(/(?:从|from|origin|source)\s*(中文|简体|zh|chinese)/);
  if (sourceZhMatch) entities.source_lang = "zh";
  // "英文翻译" / "English translate" / "把英文翻译成..." — X 在翻译词前
  const sourcePreMatch = lowerInput.match(/(英文|英语|en|english)\s*(翻译|translate)/);
  if (sourcePreMatch) entities.source_lang = "en";
  const sourceZhPreMatch = lowerInput.match(/(中文|简体|zh|chinese)\s*(翻译|translate)/);
  if (sourceZhPreMatch) entities.source_lang = "zh";

  // 目标语言："翻译成X" / "转成X" / "to X"（X 出现在翻译动作之后）
  const targetMatch = lowerInput.match(/(?:翻译成|转成|to\s+)\s*(英文|英语|en|english)/);
  if (targetMatch) entities.target_lang = "en";
  const targetZhMatch = lowerInput.match(/(?:翻译成|转成|to\s+)\s*(中文|简体|zh|chinese)/);
  if (targetZhMatch) entities.target_lang = "zh";

  // 文件路径检测
  const pathPattern = /(?:\/|\\|\.)([a-zA-Z0-9._-]+\.(md|html|json|txt|pdf|xlsx|docx|pptx|png|jpg|jpeg|webp|gif|mp4|webm))/i;
  const pathMatch = input.match(pathPattern);
  if (pathMatch) {
    entities["file_path"] = pathMatch[1];
  }

  return {
    tokens,
    intent: matchedCategory || "general",
    category: matchedCategory,
    entities,
  };
}

/**
 * 获取 catalog 中所有已注册的 category 集合
 */
export function getCatalogCategories(catalog: Record<string, any>): Set<string> {
  const categories = new Set<string>();
  for (const skill of Object.values(catalog)) {
    if (skill.category) {
      categories.add(skill.category);
    }
  }
  return categories;
}
