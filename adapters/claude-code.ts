import { SkillAdapter, CandidateItem } from "./base.js";
import { readFileSync } from "fs";

// ============================================================
// Claude Code 平台适配器
// ============================================================

/**
 * Claude Code 适配器 — 使用 fs + process.stdin
 */
export class ClaudeCodeAdapter implements SkillAdapter {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  async readFile(path: string): Promise<string> {
    const fullPath = path.startsWith("/")
      ? path
      : `${this.baseDir}/${path}`;
    return readFileSync(fullPath, "utf-8");
  }

  async promptSelection(candidates: CandidateItem[]): Promise<string | null> {
    if (candidates.length === 0) {
      console.log("⚠️ 未检测到匹配的 skill。");
      return null;
    }

    const lines: string[] = [
      "📋 检测到以下 skill 可处理你的请求:",
      "",
    ];

    for (const c of candidates) {
      lines.push(`${c.index}️⃣  ${c.name}`);
      lines.push(`    📝 ${c.description}`);
      lines.push(`    ⚡ 匹配度: ${c.score}%`);

      if (c.is_low_confidence) {
        lines.push(`    💡 可能不是你要的`);
      } else if (c.notes) {
        lines.push(`    💡 ${c.notes}`);
      }

      lines.push("");
    }

    lines.push(`请选择编号 (1-${candidates.length})，或直接说 skill 名称:`);
    console.log(lines.join("\n"));

    return await this.readUserInput();
  }

  /**
   * Claude Code 注入方式：通过标准输出传递，agent 捕获后使用
   */
  injectContext(skillName: string, content: string): void {
    // Claude Code 中通过 <anthropic_thinking> 标签或标准输出传递
    // 上层 agent 会读取这部分内容并作为上下文使用
    console.log(`[SKILL_LOADED:${skillName}]`);
    console.log(content);
    console.log(`[END_SKILL_LOADED]`);
  }

  showError(message: string): void {
    console.error(`❌ 错误: ${message}`);
  }

  private readUserInput(): Promise<string | null> {
    return new Promise((resolve) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("", (answer: string) => {
        rl.close();
        resolve(answer.trim() || null);
      });
    });
  }
}
