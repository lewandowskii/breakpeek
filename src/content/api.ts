import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { BreakpeekContentService } from './service.ts'

export const BREAKPEEK_CONTENT_API_PATH = '/breakpeek/api/v1'

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

/** Read-only same-origin API route for the browser plugin. */
export function createContentRoute(service: BreakpeekContentService): WebRoute {
  return {
    kind: 'prefix',
    path: BREAKPEEK_CONTENT_API_PATH,
    handler(req: IncomingMessage, res: ServerResponse) {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' })
        res.end()
        return
      }
      const url = new URL(req.url ?? '/', 'http://breakpeek.local')
      const method = url.pathname.slice(BREAKPEEK_CONTENT_API_PATH.length).replace(/^\//, '')
      if (method === 'catalog' || method === 'status') {
        json(res, 200, service.catalog())
        return
      }
      if (method === 'items') {
        const cursor = Number(url.searchParams.get('cursor') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 500)
        if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1) {
          json(res, 400, { error: 'invalid pagination' })
          return
        }
        json(res, 200, service.items(url.searchParams.getAll('sourceId'), cursor, limit))
        return
      }
      json(res, 404, { error: 'not found' })
    },
  }
}
