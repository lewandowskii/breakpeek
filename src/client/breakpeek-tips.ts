/**
 * Deterministic built-in fallback pool used while Host content is unavailable.
 * @module @runnerzhang/dsh-client-ui-breakpeek/breakpeek-tips
 */

import type { BreakpeekContentSource } from '../boot-config.ts'

/** One ambient message shown while the agent is at work. */
export interface BreakpeekTip {
  /** Stable content identity across catalog revisions. */
  id: string
  /** Stable display order in the built-in message pool. */
  index: number
  /** Decorative glyph displayed beside the message. */
  face: string
  /** Short copy shown in the collapsed panel. */
  preview: string
  /** Optional long-form copy shown in the expanded panel. */
  detail?: string
  /** Library used by presentation filtering. */
  type: BreakpeekContentSource
}

/** Built-in rotating pool; wrap around via `index % TIPS.length`. */
export const BREAKPEEK_TIPS: [BreakpeekTip, ...BreakpeekTip[]] = [
  {
    id: '413e667e-f968-42ff-9d1d-9661539bc6ab',
    index: 0,
    face: '🐠',
    preview: '面试题：解释 async/await 在事件循环里的行为。',
    detail: 'async 函数会立即返回 Promise。执行到 await 时，函数会先求值右侧表达式，然后暂停当前函数，把后续逻辑放入 Promise 反应作业。\n\n当当前同步调用栈清空后，事件循环会先清空微任务队列，await 后的代码才继续执行。因此 await 不会阻塞线程，但会切分 async 函数内部的执行顺序。',
    type: 'interview-frontend',
  },
  {
    id: '052e5878-604a-48ab-a84e-425e3d61feaf',
    index: 1,
    face: '🐸',
    preview: '生活常识：蜂蜜应密封放在阴凉处，通常不需要放进冰箱。',
    type: 'life-knowledge',
  },
  {
    id: '15a2aa7c-d1c1-4a2d-99c6-0f49ac023c0b',
    index: 2,
    face: '🦉',
    preview: '小贴士：把长函数拆成命名清晰的小函数，比注释更可靠。',
    detail: '好的拆分单元会用名称说明“为什么做”，而不只是重复“代码做了什么”。优先拆出可独立命名、可单独测试，或处于不同抽象层级的逻辑。',
    type: 'coding-tips',
  },
  {
    id: 'e61dc501-9109-463e-9971-92fdf953e855',
    index: 3,
    face: '🐙',
    preview: '面试题：进程、线程与协程的区别？一句话各答。',
    detail: '进程是资源分配和隔离的单位；线程是操作系统调度的执行单位，同进程线程共享内存；协程则是用户态调度的轻量执行单元，通常依附在线程上运行。',
    type: 'interview-general',
  },
  {
    id: 'f298132c-7108-4248-91f2-7a10885d83aa',
    index: 4,
    face: '🐻',
    preview: '笑话：程序员最讨厌的三件事——写注释、看注释、别人不写注释。',
    type: 'light-jokes',
  },
  {
    id: '9ad9c3ba-5589-4b07-bbf9-c200dbad8273',
    index: 5,
    face: '🐨',
    preview: '技术风向：RAG 之外，Agentic 工作流正在把“检索”变成“编排”。',
    detail: '传统 RAG 的核心是召回与生成；Agentic 工作流还会把查询改写、工具选择、多步执行、结果验证和失败恢复纳入同一个编排过程。这不代表每个场景都需要 Agent；步骤稳定、输入输出明确时，固定工作流往往更便宜、可预测。',
    type: 'tech-trends',
  },
  {
    id: '386375e5-8f1d-48c9-aa0c-9d31201007b3',
    index: 6,
    face: '🐧',
    preview: '冷知识：diff 里的 “a/” 与 “b/” 前缀来自 `git` 的对树对比。',
    type: 'coding-tips',
  },
  {
    id: '4bbb58c9-45b5-4cb4-915e-6758d765db18',
    index: 7,
    face: '🦊',
    preview: '面试题：跨域请求为什么浏览器要先发一个 OPTIONS 预检？',
    detail: '预检是浏览器在发出某些非简单跨域请求前的权限确认。它通过 OPTIONS 告知服务器实际请求的方法和额外请求头，只有响应的 CORS 头允许这些条件，浏览器才继续。\n\n它的主要价值是防止旧式服务器在不知情时被跨站页面发起具有副作用的请求。预检不是身份认证，也不能替代服务器的鉴权与 CSRF 防护。预检是浏览器在发出某些非简单跨域请求前的权限确认。它通过 OPTIONS 告知服务器实际请求的方法和额外请求头，只有响应的 CORS 头允许这些条件，浏览器才继续。\n\n它的主要价值是防止旧式服务器在不知情时被跨站页面发起具有副作用的请求。预检不是身份认证，也不能替代服务器的鉴权与 CSRF 防护。预检是浏览器在发出某些非简单跨域请求前的权限确认。它通过 OPTIONS 告知服务器实际请求的方法和额外请求头，只有响应的 CORS 头允许这些条件，浏览器才继续。\n\n它的主要价值是防止旧式服务器在不知情时被跨站页面发起具有副作用的请求。预检不是身份认证，也不能替代服务器的鉴权与 CSRF 防护。',
    type: 'interview-frontend',
  },
  {
    id: '84c79b30-5318-4cdb-a448-f57bf48cad2a',
    index: 8,
    face: '🐬',
    preview: '后端面试题：数据库索引为什么能加速查询，却可能拖慢写入？',
    detail: '索引用额外的数据结构维护列值到数据位置的映射，使查询减少全表扫描；但插入、更新和删除时，数据库还要同步维护索引页，并可能产生页分裂、日志和更多随机 I/O。\n\n因此索引不是越多越好，应围绕真实查询模式、选择性、排序和联合索引前缀设计，并用执行计划验证收益。',
    type: 'interview-backend',
  },
  {
    id: 'f750025e-3176-4ea6-a506-fc5fb0e0240c',
    index: 9,
    face: '🦄',
    preview: 'AI 面试题：大模型里的 temperature 控制了什么？',
    detail: 'temperature 会缩放模型生成时的 logits，再计算候选 token 的概率分布。较低值让高概率候选更集中，输出通常更稳定；较高值让分布更平坦，输出更多样，但也更容易偏离约束。\n\n它不会提升模型知识量，也不是事实正确率开关。结构化输出、代码修改或可复现实验通常适合较低温度，创意发散可以适当提高。',
    type: 'interview-ai',
  },
]
