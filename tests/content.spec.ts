import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentCache } from '../src/content/cache.ts'
import { BreakpeekContentService } from '../src/content/service.ts'
import type { BreakpeekContentItem } from '../src/content-types.ts'
import {
  canonicalJson, parseManifest, verifyManifestSignature, type PublishedManifestPayload,
} from '../src/content/validation.ts'

const revision = '20260907090927-eb829ef7a4fdd1c8'
const generatedAt = '2026-09-07T09:09:27.670Z'
const item: BreakpeekContentItem = {
  id: '0b9b0a89-64da-41d4-9b9c-3f93beed2965',
  sourceId: 'interview-frontend',
  sourceLabel: '前端面试题',
  kind: 'interview',
  title: '事件循环',
  summary: '宏任务与微任务如何调度？',
  body: '当前宏任务结束后清空微任务队列，再进入下一个宏任务。',
  bodyFormat: 'plain',
  tags: ['JavaScript'],
}

function signedFixture() {
  const ndjson = `${JSON.stringify(item)}\n`
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const payload: PublishedManifestPayload = {
    schemaVersion: 1,
    revision,
    generatedAt,
    keyId: 'test-key',
    sources: [{
      id: item.sourceId,
      label: item.sourceLabel,
      description: '浏览器与 JavaScript 面试题。',
      defaultEnabled: true,
      order: 10,
      path: `${revision}/sources/${item.sourceId}.ndjson`,
      sha256: createHash('sha256').update(ndjson).digest('hex'),
      bytes: Buffer.byteLength(ndjson),
      itemCount: 1,
    }],
  }
  return {
    ndjson,
    manifest: {
      ...payload,
      signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64'),
    },
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('remote content pipeline', () => {
  it('verifies a signed manifest and rejects a changed payload', () => {
    const fixture = signedFixture()
    const manifest = parseManifest(fixture.manifest)
    expect(() => verifyManifestSignature(manifest, { 'test-key': fixture.publicKey }, false)).not.toThrow()
    expect(() => verifyManifestSignature({ ...manifest, revision: '20260907090928-eb829ef7a4fdd1c8' }, {
      'test-key': fixture.publicKey,
    }, false)).toThrow('manifest signature is invalid')
  })

  it('round-trips the last-known-good snapshot through SQLite', async () => {
    const cache = await ContentCache.open(':memory:')
    const snapshot = {
      revision,
      generatedAt,
      checkedAt: generatedAt,
      etag: '"revision-1"',
      sources: [{
        id: item.sourceId,
        label: item.sourceLabel,
        description: '浏览器与 JavaScript 面试题。',
        defaultEnabled: true,
        order: 10,
        available: true,
        itemCount: 1,
      }],
      items: [{ ...item }],
    }
    cache.replace(snapshot)
    expect(cache.load()).toEqual(snapshot)
    cache.close()
  })

  it('downloads, verifies and exposes one immutable revision', async () => {
    const fixture = signedFixture()
    const source = fixture.manifest.sources[0]!
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/staging/manifest.json')) {
        return new Response(JSON.stringify(fixture.manifest), {
          headers: { etag: '"revision-1"' },
        })
      }
      if (url.endsWith(`/${source.path}`)) return new Response(fixture.ndjson)
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const service = new BreakpeekContentService(new Context(), {
      contentCatalogUrl: 'https://content.example/staging/manifest.json',
      contentCachePath: ':memory:',
      contentPublicKeys: { 'test-key': fixture.publicKey },
    })

    await service.start()
    expect(service.catalog()).toMatchObject({
      revision,
      status: 'ready',
      source: 'remote',
      itemCount: 1,
    })
    expect(service.items([], 0, 500).items).toEqual([{ ...item }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await service.dispose()
  })
})
