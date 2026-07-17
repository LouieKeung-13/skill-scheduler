// ============================================================
// 类型定义 — Skill 调度器核心数据结构
// ============================================================

/** 单个 skill 的元数据 */
export interface SkillMetadata {
  /** 唯一标识符（小写字母+数字+连字符） */
  id: string;
  /** 技能名称（显示用） */
  name: string;
  /** 功能描述（一句话概括） */
  description: string;
  /** 技能类别（用于分组） */
  category: string;
  /** 触发词列表（用户输入命中时加分） */
  triggers: string[];
  /** 最低匹配阈值（低于此值不展示） */
  confidence_threshold: number;
  /** 是否需要首次配置 */
  requires_setup: boolean;
  /** 首次使用注意事项 */
  setup_notes?: string;
  /** 可选：技能版本 */
  version?: string;
  /** 可选：技能路径（相对于 skills/ 目录） */
  path?: string;
}

/** catalog.json 根结构 */
export interface SkillCatalog {
  version: string;
  skills: Record<string, SkillMetadata>;
}

/** 评分结果 */
export interface MatchScore {
  /** skill id */
  id: string;
  /** skill 名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 总匹配度 (0-100) */
  score: number;
  /** 各因子得分明细 */
  breakdown: ScoreBreakdown;
  /** 是否通过阈值 */
  passed_threshold: boolean;
}

/** 评分因子明细 */
export interface ScoreBreakdown {
  trigger_exact: number;       // triggers 精确命中
  trigger_fuzzy: number;       // triggers 模糊匹配
  description_match: number;   // description 语义匹配
  category_priority: number;   // category 优先级
  total: number;               // 加权总分
}

/** 用户请求解析结果 */
export interface ParsedRequest {
  /** 清洗后的关键词列表 */
  tokens: string[];
  /** 解析出的意图类别 */
  intent: string;
  /** 匹配的 skill 类别 */
  category: string | null;
  /** 提取的任务参数 */
  entities: Record<string, string>;
}

/** 候选列表项 */
export interface CandidateItem {
  /** skill id */
  id: string;
  /** 序号（从 1 开始） */
  index: number;
  /** 技能名称 */
  name: string;
  /** 功能描述 */
  description: string;
  /** 匹配度百分比 */
  score: number;
  /** 附加说明（如首次配置提示） */
  notes?: string;
  /** 是否低匹配度（用于标注"可能不是你要的"） */
  is_low_confidence: boolean;
}

/** 调度器配置 */
export interface SchedulerConfig {
  /** catalog.json 文件路径 */
  catalog_path: string;
  /** skills 目录路径 */
  skills_dir: string;
  /** 评分权重 */
  weights: WeightConfig;
  /** 默认最小展示数 */
  min_candidates: number;
  /** 默认最大展示数 */
  max_candidates: number;
}

/** 评分权重配置 */
export interface WeightConfig {
  trigger_exact: number;       // 默认 0.40
  trigger_fuzzy: number;       // 默认 0.20
  description_match: number;   // 默认 0.25
  category_priority: number;   // 默认 0.10
  threshold_factor: number;    // 默认 0.05
}
