/**
 * Local rotating content pool for the Breakpeek. Deterministic, local-only
 * (jokes / interview snippets / quick tips) so the widget needs no network and
 * no credentials.
 * @module @deepseek-ai/dsh-client-ui-breakpeek/breakpeek-tips
 */

/** One ambient tidbit shown while the agent is at work. */
export interface BreakpeekTip {
  /** Decorative glyph displayed beside the message. */
  face: string
  /** Short Chinese copy. */
  text: string
}

/** Local rotating pool; wrap around via `index % TIPS.length`. */
export const BREAKPEEK_TIPS = [
  { face: '🐠', text: '面试题：解释 async/await 在事件循环里的行为。' },
  { face: '🐸', text: '冷知识：HTTP 418 “I’m a teapot” 是个正经的状态码。' },
  { face: '🦉', text: '小贴士：把长函数拆成命名清晰的小函数，比注释更可靠。' },
  { face: '🐙', text: '面试题：进程、线程与协程的区别？一句话各答。' },
  { face: '🐻', text: '笑话：程序员最讨厌的三件事——写注释、看注释、别人不写注释。' },
  { face: '🐨', text: '技术风向：RAG 之外，Agentic 工作流正在把“检索”变成“编排”。' },
  { face: '🐧', text: '冷知识：diff 里的 “a/” 与 “b/” 前缀来自 `git` 的对树对比。' },
  { face: '🦊', text: '面试题：跨域请求为什么浏览器要先发一个 OPTIONS 预检？' },
] satisfies [BreakpeekTip, ...BreakpeekTip[]]
