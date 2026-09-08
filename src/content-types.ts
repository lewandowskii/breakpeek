/** Shared, wire-safe content types used by the Host and browser bundle. */

export type BreakpeekContentKind = 'interview' | 'news' | 'tip' | 'joke'
export type BreakpeekContentStatus = 'loading' | 'ready' | 'cached' | 'fallback' | 'error'

/** One selectable remote or built-in message library. */
export interface BreakpeekContentSourceDefinition {
  id: string
  label: string
  description: string
  defaultEnabled: boolean
  order: number
  available?: boolean
  itemCount?: number
}

/** Canonical message shape exposed to the browser. */
export interface BreakpeekContentItem {
  id: string
  sourceId: string
  sourceLabel: string
  kind: BreakpeekContentKind
  title: string
  summary: string
  body?: string
  bodyFormat: 'plain' | 'markdown'
  publishedAt?: string
  expiresAt?: string
  tags: string[]
  sourceUrl?: string
}

/** Current content catalog and synchronization state. */
export interface BreakpeekCatalogResponse {
  schemaVersion: 1
  revision: string | null
  generatedAt: string | null
  checkedAt: string | null
  status: BreakpeekContentStatus
  source: 'remote' | 'cache' | 'fallback'
  sources: BreakpeekContentSourceDefinition[]
  itemCount: number
  error?: string
}

/** Paged message response. */
export interface BreakpeekItemsResponse {
  schemaVersion: 1
  revision: string | null
  items: BreakpeekContentItem[]
  nextCursor: string | null
}

export const FALLBACK_CONTENT_SOURCES: readonly BreakpeekContentSourceDefinition[] = [
  { id: 'light-jokes', label: '轻笑话', description: '轻量、友好的程序员幽默。', defaultEnabled: true, order: 10 },
  { id: 'interview-general', label: '面试题（通用）', description: '计算机基础与工程通用面试题。', defaultEnabled: true, order: 20 },
  { id: 'interview-frontend', label: '前端面试题', description: '浏览器、JavaScript 与前端工程题。', defaultEnabled: true, order: 30 },
  { id: 'interview-backend', label: '后端面试题', description: '数据库、网络与服务端工程题。', defaultEnabled: true, order: 40 },
  { id: 'interview-ai', label: 'AI 面试题', description: '大模型、检索与推理相关题目。', defaultEnabled: true, order: 50 },
  { id: 'tech-trends', label: '技术风向', description: '值得关注但不过度追逐热点的技术趋势。', defaultEnabled: true, order: 60 },
  { id: 'life-knowledge', label: '生活常识', description: '工作间隙可读的实用生活常识。', defaultEnabled: true, order: 70 },
  { id: 'coding-tips', label: '编程技巧', description: '可立即应用的小型工程实践。', defaultEnabled: true, order: 80 },
]
