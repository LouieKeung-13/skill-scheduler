import { CandidateItem } from "../src/types.js";

// ============================================================
// 适配器基类接口 — 所有平台适配器的契约
// ============================================================

/**
 * 平台适配器接口
 * 核心逻辑与运行时解耦，每个平台只需实现这 4 个方法
 */
export interface SkillAdapter {
  /**
   * 读取文件内容
   * @param path 文件路径
   * @returns 文件内容字符串
   */
  readFile(path: string): Promise<string>;

  /**
   * 展示候选列表并等待用户选择
   * @param candidates 候选 skill 列表
   * @returns 用户选择的 skill id（null 表示未选择）
   */
  promptSelection(candidates: CandidateItem[]): Promise<string | null>;

  /**
   * 将 skill 内容注入 agent 上下文
   * @param skillName skill 名称
   * @param content SKILL.md 内容
   */
  injectContext(skillName: string, content: string): void;

  /**
   * 显示错误信息
   * @param message 错误描述
   */
  showError(message: string): void;
}

/**
 * 适配器工厂 — 根据平台类型创建对应实例
 */
export type AdapterType = "openclaw" | "claude-code" | "codex";

export interface AdapterFactory {
  create(type: AdapterType): SkillAdapter;
}
