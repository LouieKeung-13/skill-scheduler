import { SkillMetadata } from "./types.js";

// ============================================================
// Skill 加载器 — 动态加载已选中的 skill
// ============================================================

export interface LoadResult {
  /** 是否成功加载 */
  success: boolean;
  /** skill id */
  id: string;
  /** skill 名称 */
  name: string;
  /** 加载后的 SKILL.md 内容 */
  content: string | null;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 文件读取函数类型（运行时注入）
 */
export type FileReader = (path: string) => Promise<string>;

/**
 * 从文件系统加载 skill
 * 
 * @param skillId - skill 的唯一标识符
 * @param skillMetadata - skill 的元数据
 * @param skillsDir - skills 根目录路径
 * @param readFile - 文件读取函数（由运行时注入）
 */
export async function loadSkill(
  skillId: string,
  skillMetadata: SkillMetadata,
  skillsDir: string,
  readFile: FileReader
): Promise<LoadResult> {
  // 1. 确定 skill 文件路径
  const skillPath = skillMetadata.path || skillId;
  const skillFile = `${skillsDir}/${skillPath}/SKILL.md`;

  try {
    // 2. 读取 SKILL.md 内容
    const content = await readFile(skillFile);

    return {
      success: true,
      id: skillId,
      name: skillMetadata.name,
      content,
    };
  } catch (err) {
    return {
      success: false,
      id: skillId,
      name: skillMetadata.name,
      content: null,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
