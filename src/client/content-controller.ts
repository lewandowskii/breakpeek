import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  BreakpeekCatalogResponse, BreakpeekContentItem, BreakpeekContentSourceDefinition,
  BreakpeekItemsResponse,
} from '../content-types.ts'
import { FALLBACK_CONTENT_SOURCES } from '../content-types.ts'

const API_PATH = '/breakpeek/api/v1'
const BROWSER_REFRESH_INTERVAL_MS = 15 * 60 * 1000
const MAX_BROWSER_ITEMS = 10_000

export interface BreakpeekContentClientState {
  status: BreakpeekCatalogResponse['status']
  revision: string | null
  generatedAt: string | null
  checkedAt: string | null
  source: BreakpeekCatalogResponse['source']
  sources: BreakpeekContentSourceDefinition[]
  items: BreakpeekContentItem[]
  error?: string
}

function fallbackState(status: BreakpeekContentClientState['status'] = 'loading'): BreakpeekContentClientState {
  return {
    status,
    revision: null,
    generatedAt: null,
    checkedAt: null,
    source: 'fallback',
    sources: FALLBACK_CONTENT_SOURCES.map(source => ({ ...source, available: true })),
    items: [],
  }
}

function isCatalog(value: unknown): value is BreakpeekCatalogResponse {
  if (typeof value !== 'object' || value === null) return false
  const catalog = value as Partial<BreakpeekCatalogResponse>
  return catalog.schemaVersion === 1
    && Array.isArray(catalog.sources)
    && typeof catalog.itemCount === 'number'
    && (catalog.revision === null || typeof catalog.revision === 'string')
}

function isItems(value: unknown): value is BreakpeekItemsResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Partial<BreakpeekItemsResponse>
  return response.schemaVersion === 1
    && Array.isArray(response.items)
    && (response.nextCursor === null || typeof response.nextCursor === 'string')
}

/** Browser-side reader for the Host's same-origin content API. */
export class BreakpeekContentController {
  readonly store: SnapshotStore<BreakpeekContentClientState>
  private timer: ReturnType<typeof setInterval> | null = null
  private abort: AbortController | null = null
  private generation = 0

  constructor() {
    this.store = createSnapshotStore(fallbackState())
  }

  start(): void {
    void this.refresh()
    this.timer = setInterval(() => { void this.refresh() }, BROWSER_REFRESH_INTERVAL_MS)
    window.addEventListener('focus', this.onFocus)
  }

  private readonly onFocus = (): void => { void this.refresh() }

  async refresh(): Promise<void> {
    const generation = ++this.generation
    this.abort?.abort()
    const controller = new AbortController()
    this.abort = controller
    try {
      const catalogResponse = await fetch(`${API_PATH}/catalog`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })
      if (!catalogResponse.ok) throw new Error(`catalog returned HTTP ${catalogResponse.status}`)
      const catalogValue = await catalogResponse.json() as unknown
      if (!isCatalog(catalogValue)) throw new Error('catalog response is malformed')
      if (catalogValue.revision === null) {
        if (generation === this.generation) {
          this.store.set({
            ...fallbackState(catalogValue.status),
            checkedAt: catalogValue.checkedAt,
            sources: catalogValue.sources.length > 0 ? catalogValue.sources : fallbackState().sources,
            ...(catalogValue.error === undefined ? {} : { error: catalogValue.error }),
          })
        }
        return
      }
      const items: BreakpeekContentItem[] = []
      let cursor: string | null = '0'
      while (cursor !== null) {
        const response = await fetch(`${API_PATH}/items?limit=500&cursor=${encodeURIComponent(cursor)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`items returned HTTP ${response.status}`)
        const value = await response.json() as unknown
        if (!isItems(value) || value.revision !== catalogValue.revision) throw new Error('items response is malformed or stale')
        items.push(...value.items)
        if (items.length > MAX_BROWSER_ITEMS) throw new Error('items response exceeds browser limit')
        cursor = value.nextCursor
      }
      if (generation !== this.generation) return
      this.store.set({
        status: catalogValue.status,
        revision: catalogValue.revision,
        generatedAt: catalogValue.generatedAt,
        checkedAt: catalogValue.checkedAt,
        source: catalogValue.source,
        sources: catalogValue.sources,
        items,
        ...(catalogValue.error === undefined ? {} : { error: catalogValue.error }),
      })
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return
      const current = this.store.getSnapshot()
      this.store.set({
        ...current,
        status: current.revision === null ? 'error' : 'cached',
        error: '无法读取更新内容，已继续使用最近可用内容。',
      })
    } finally {
      if (this.abort === controller) this.abort = null
    }
  }

  dispose(): void {
    this.generation += 1
    this.abort?.abort()
    if (this.timer !== null) clearInterval(this.timer)
    window.removeEventListener('focus', this.onFocus)
  }
}
