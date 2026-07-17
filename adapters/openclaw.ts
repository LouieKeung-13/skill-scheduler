import { SkillAdapter, CandidateItem } from "./base.js";
import { readFileSync } from "fs";

// ============================================================
// OpenClaw 平台适配器
// ============================================================

/**
 * OpenClaw 适配器 — 使用 Node.js fs + stdin/stdout 交互
 */
export class OpenClawAdapter implements SkillAdapter {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * 从文件系统读取文件
   */
  async readFile(path: string): Promise<string> {
    const fullPath = path.startsWith("/")
      ? path
      : `${this.baseDir}/${path}`;
    return readFileSync(fullPath, "utf-8");
  }

  /**
   * 展示候选列表并等待用户选择
   */
  async promptSelection(candidates: CandidateItem[]): Promise<string | null> {
    if (candidates.length === 0) {
      console.log("⚠️ 未检测到匹配的 skill。");
      return null;
    }

    // 格式化输出（复用 candidate.ts 的逻辑）
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

    // CLI 模式：从 stdin 读取用户输入
    return await this.readUserInput();
  }

  /**
   * 注入 skill 到 agent 上下文
   * OpenClaw 中通过日志输出，由上层 agent 捕获并注入
   */
  injectContext(skillName: string, content: string): void {
    // 输出标记，供 OpenClaw 上层捕获
    console.log(`[SKILL_LOADED:${skillName}]`);
    console.log(content);
    console.log(`[END_SKILL_LOADED]`);
  }

  /**
   * 显示错误信息
   */
  showError(message: string): void {
    console.error(`❌ 错误: ${message}`);
  }

  /**
   * 读取用户输入（CLI 模式）
   */
  private readUserInput(): Promise<string | null> {
    return new Promise((resolve) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("", (answer: string) => {
        rl.close();
        const trimmed = answer.trim();
        if (!trimmed) {
          resolve(null);
          return;
        }

        // 判断是数字编号还是 skill 名称
        const numMatch = trimmed.match(/^(\d+)$/);
        if (numMatch) {
          resolve(trimmed); // 返回编号字符串，调用方解析
        } else {
          resolve(trimmed); // 返回名称，调用方匹配
        }
      });
    });
  }
}
