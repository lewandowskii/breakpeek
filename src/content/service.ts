import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {
  BreakpeekCatalogResponse, BreakpeekContentItem, BreakpeekContentSourceDefinition,
  BreakpeekItemsResponse,
} from '../content-types.ts'
import { FALLBACK_CONTENT_SOURCES } from '../content-types.ts'
import type { Config } from '../config.ts'
import {
  DEFAULT_CONTENT_REFRESH_INTERVAL_MS, DEFAULT_CONTENT_REQUEST_TIMEOUT_MS,
} from '../config.ts'
import { ContentCache, type CachedContentSnapshot } from './cache.ts'
import {
  MAX_MANIFEST_BYTES, MAX_SOURCE_BYTES, parseManifest, parseNdjson,
  verifyManifestSignature,
} from './validation.ts'

const MAX_API_ITEMS = 500

interface RuntimeSnapshot {
  catalog: BreakpeekCatalogResponse
  items: BreakpeekContentItem[]
  etag: string | null
}

function defaultCachePath(): string {
  const configuredHome = process.env.DSH_HOME?.trim()
  const dshHome = configuredHome ? resolve(configuredHome) : join(homedir(), '.dsh')
  return join(dshHome, 'storages', 'breakpeek-content.sqlite')
}

function fallbackSnapshot(status: BreakpeekCatalogResponse['status'] = 'fallback'): RuntimeSnapshot {
  return {
    catalog: {
      schemaVersion: 1,
      revision: null,
      generatedAt: null,
      checkedAt: null,
      status,
      source: 'fallback',
      sources: FALLBACK_CONTENT_SOURCES.map(source => ({ ...source, available: true })),
      itemCount: 0,
    },
    items: [],
    etag: null,
  }
}

async function responseText(response: Response, maxBytes: number, label: string): Promise<string> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`)
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function trustedSourceUrl(manifestUrl: URL, path: string): URL {
  const base = new URL('.', manifestUrl)
  const url = new URL(path, base)
  if (url.protocol !== 'https:' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error(`manifest source path ${path} escapes its trusted HTTPS base`)
  }
  return url
}

/** Host-owned remote synchronization and last-known-good content state. */
export class BreakpeekContentService {
  private snapshot = fallbackSnapshot('loading')
  private cache: ContentCache | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private abort: AbortController | null = null
  private disposed = false

  constructor(private readonly ctx: Context, private readonly config: Config) { }

  async start(): Promise<void> {
    try {
      this.cache = await ContentCache.open(this.config.contentCachePath ?? defaultCachePath())
      const cached = this.cache.load()
      if (cached !== null) this.useCached(cached)
    } catch (error) {
      this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      this.cache = null
    }
    if (!this.config.contentCatalogUrl) {
      if (this.snapshot.catalog.source === 'fallback') this.snapshot = fallbackSnapshot()
      return
    }
    await this.refresh()
    this.schedule()
  }

  private useCached(cached: CachedContentSnapshot): void {
    this.snapshot = {
      catalog: {
        schemaVersion: 1,
        revision: cached.revision,
        generatedAt: cached.generatedAt,
        checkedAt: cached.checkedAt,
        status: 'cached',
        source: 'cache',
        sources: cached.sources,
        itemCount: cached.items.length,
      },
      items: cached.items,
      etag: cached.etag,
    }
  }

  private schedule(): void {
    if (this.disposed || !this.config.contentCatalogUrl) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.refresh().finally(() => { this.schedule() })
    }, this.config.contentRefreshIntervalMs ?? DEFAULT_CONTENT_REFRESH_INTERVAL_MS)
  }

  refresh(): Promise<void> {
    if (this.inFlight !== null) return this.inFlight
    this.inFlight = this.performRefresh().finally(() => { this.inFlight = null })
    return this.inFlight
  }

  private async performRefresh(): Promise<void> {
    const catalogUrlValue = this.config.contentCatalogUrl
    if (!catalogUrlValue || this.disposed) return
    const manifestUrl = new URL(catalogUrlValue)
    if (manifestUrl.protocol !== 'https:') throw new Error('Breakpeek content catalog must use HTTPS')
    const controller = new AbortController()
    this.abort = controller
    const timeout = setTimeout(() => { controller.abort() }, this.config.contentRequestTimeoutMs ?? DEFAULT_CONTENT_REQUEST_TIMEOUT_MS)
    const checkedAt = new Date().toISOString()
    try {
      const headers = this.snapshot.etag === null ? {} : { 'if-none-match': this.snapshot.etag }
      const response = await fetch(manifestUrl, { headers, redirect: 'error', signal: controller.signal })
      if (response.status === 304) {
        this.snapshot = {
          ...this.snapshot,
          catalog: { ...this.snapshot.catalog, checkedAt, status: this.snapshot.catalog.revision ? 'ready' : 'fallback' },
        }
        return
      }
      const manifest = parseManifest(JSON.parse(await responseText(response, MAX_MANIFEST_BYTES, 'content manifest')) as unknown)
      verifyManifestSignature(manifest, this.config.contentPublicKeys ?? {}, this.config.allowUnsignedContent ?? false)
      const documents = await Promise.all(manifest.sources.map(async (source) => {
        const sourceResponse = await fetch(trustedSourceUrl(manifestUrl, source.path), { redirect: 'error', signal: controller.signal })
        const ndjson = await responseText(sourceResponse, Math.min(source.bytes, MAX_SOURCE_BYTES), source.id)
        if (Buffer.byteLength(ndjson) !== source.bytes) throw new Error(`${source.id} byte size does not match manifest`)
        const hash = createHash('sha256').update(ndjson).digest('hex')
        if (hash !== source.sha256) throw new Error(`${source.id} hash does not match manifest`)
        return parseNdjson(ndjson, source)
      }))
      const items = documents.flat()
      const ids = new Set<string>()
      for (const item of items) {
        if (ids.has(item.id)) throw new Error(`content item id ${item.id} is duplicated across sources`)
        ids.add(item.id)
      }
      const sources: BreakpeekContentSourceDefinition[] = manifest.sources
        .map(source => ({
          id: source.id,
          label: source.label,
          description: source.description,
          defaultEnabled: source.defaultEnabled,
          order: source.order,
          available: true,
          itemCount: items.filter(item => item.sourceId === source.id).length,
        }))
        .sort((left, right) => left.order - right.order)
      const etag = response.headers.get('etag')
      const cached: CachedContentSnapshot = {
        revision: manifest.revision,
        generatedAt: manifest.generatedAt,
        checkedAt,
        etag,
        sources,
        items,
      }
      this.cache?.replace(cached)
      if (!this.disposed) {
        this.snapshot = {
          catalog: {
            schemaVersion: 1,
            revision: manifest.revision,
            generatedAt: manifest.generatedAt,
            checkedAt,
            status: 'ready',
            source: 'remote',
            sources,
            itemCount: items.length,
          },
          items,
          etag,
        }
      }
    } catch (error) {
      if (this.disposed && controller.signal.aborted) return
      this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      const hasContent = this.snapshot.catalog.revision !== null
      this.snapshot = {
        ...this.snapshot,
        catalog: {
          ...this.snapshot.catalog,
          checkedAt,
          status: hasContent ? 'cached' : 'error',
          source: hasContent ? 'cache' : 'fallback',
          error: '内容更新失败，已继续使用最近可用内容。',
        },
      }
    } finally {
      clearTimeout(timeout)
      if (this.abort === controller) this.abort = null
    }
  }

  catalog(): BreakpeekCatalogResponse {
    return this.snapshot.catalog
  }

  items(sourceIds: readonly string[], cursor: number, limit: number): BreakpeekItemsResponse {
    const selected = sourceIds.length === 0
      ? this.snapshot.items
      : this.snapshot.items.filter(item => sourceIds.includes(item.sourceId))
    const boundedCursor = Math.min(Math.max(0, cursor), selected.length)
    const boundedLimit = Math.min(Math.max(1, limit), MAX_API_ITEMS)
    const items = selected.slice(boundedCursor, boundedCursor + boundedLimit)
    const next = boundedCursor + items.length
    return {
      schemaVersion: 1,
      revision: this.snapshot.catalog.revision,
      items,
      nextCursor: next < selected.length ? String(next) : null,
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.abort?.abort()
    try {
      await this.inFlight
    } finally {
      this.cache?.close()
      this.cache = null
    }
  }
}
