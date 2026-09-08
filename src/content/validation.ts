import { createPublicKey, verify } from 'node:crypto'
import type {
  BreakpeekContentItem, BreakpeekContentKind, BreakpeekContentSourceDefinition,
} from '../content-types.ts'

export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024
export const MAX_ITEMS_PER_SOURCE = 10_000

export interface PublishedSource extends BreakpeekContentSourceDefinition {
  path: string
  sha256: string
  bytes: number
  itemCount: number
}

export interface PublishedManifestPayload {
  schemaVersion: 1
  revision: string
  generatedAt: string
  keyId: string | null
  sources: PublishedSource[]
}

export interface PublishedManifest extends PublishedManifestPayload {
  signature: string | null
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA_256 = /^[a-f0-9]{64}$/
const REVISION = /^[0-9]{14}-[a-f0-9]{16}$/
const KINDS = new Set<BreakpeekContentKind>(['interview', 'news', 'tip', 'joke'])
const FORMATS = new Set(['plain', 'markdown'])

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${at} must be an object`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, at: string, maxCharacters: number): string {
  if (typeof value !== 'string' || value.length === 0 || [...value].length > maxCharacters) {
    throw new Error(`${at} must contain 1-${maxCharacters} characters`)
  }
  return value
}

function integer(value: unknown, at: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${at} must be an integer from ${minimum} to ${maximum}`)
  }
  return value as number
}

function isoDate(value: unknown, at: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`${at} must be ISO 8601 with timezone`)
  }
  return value
}

function noRawHtml(value: string, at: string): void {
  if (/<\/?[a-z][^>]*>/i.test(value)) throw new Error(`${at} contains raw HTML`)
}

export function parseManifest(value: unknown): PublishedManifest {
  const input = record(value, 'manifest')
  if (input.schemaVersion !== 1) throw new Error('manifest.schemaVersion must be 1')
  const revision = text(input.revision, 'manifest.revision', 80)
  if (!REVISION.test(revision)) throw new Error('manifest.revision is invalid')
  const generatedAt = isoDate(input.generatedAt, 'manifest.generatedAt')
  const keyId = input.keyId === null ? null : text(input.keyId, 'manifest.keyId', 80)
  const signature = input.signature === null ? null : text(input.signature, 'manifest.signature', 2048)
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > 100) {
    throw new Error('manifest.sources must contain 1-100 entries')
  }
  const ids = new Set<string>()
  const sources = input.sources.map((value, index): PublishedSource => {
    const source = record(value, `manifest.sources[${index}]`)
    const id = text(source.id, `manifest.sources[${index}].id`, 80)
    if (!SOURCE_ID.test(id) || ids.has(id)) throw new Error(`manifest source id ${id} is invalid or duplicated`)
    ids.add(id)
    const path = text(source.path, `manifest.sources[${index}].path`, 512)
    if (path.startsWith('/') || path.includes('..') || path.includes('\\')) throw new Error(`manifest source path ${path} is unsafe`)
    const hash = text(source.sha256, `manifest.sources[${index}].sha256`, 64)
    if (!SHA_256.test(hash)) throw new Error(`manifest source hash ${hash} is invalid`)
    if (typeof source.defaultEnabled !== 'boolean') throw new Error(`manifest.sources[${index}].defaultEnabled must be boolean`)
    return {
      id,
      label: text(source.label, `manifest.sources[${index}].label`, 40),
      description: text(source.description, `manifest.sources[${index}].description`, 120),
      defaultEnabled: source.defaultEnabled === true,
      order: integer(source.order, `manifest.sources[${index}].order`, 0, 1_000_000),
      path,
      sha256: hash,
      bytes: integer(source.bytes, `manifest.sources[${index}].bytes`, 1, MAX_SOURCE_BYTES),
      itemCount: integer(source.itemCount, `manifest.sources[${index}].itemCount`, 1, MAX_ITEMS_PER_SOURCE),
    }
  })
  return { schemaVersion: 1, revision, generatedAt, keyId, sources, signature }
}

export function verifyManifestSignature(
  manifest: PublishedManifest,
  publicKeys: Readonly<Record<string, string>>,
  allowUnsigned: boolean,
): void {
  if (manifest.signature === null || manifest.keyId === null) {
    if (allowUnsigned && manifest.signature === null && manifest.keyId === null) return
    throw new Error('manifest is unsigned')
  }
  const publicKey = publicKeys[manifest.keyId]
  if (publicKey === undefined) throw new Error(`manifest keyId ${manifest.keyId} is not trusted`)
  const { signature: _signature, ...payload } = manifest
  const valid = verify(
    null,
    Buffer.from(canonicalJson(payload)),
    createPublicKey(publicKey),
    Buffer.from(manifest.signature, 'base64'),
  )
  if (!valid) throw new Error('manifest signature is invalid')
}

export function parseNdjson(
  value: string,
  source: PublishedSource,
  now = Date.now(),
): BreakpeekContentItem[] {
  const lines = value.split('\n').filter(line => line.trim().length > 0)
  if (lines.length !== source.itemCount || lines.length > MAX_ITEMS_PER_SOURCE) {
    throw new Error(`${source.id} contains ${lines.length} items; expected ${source.itemCount}`)
  }
  const ids = new Set<string>()
  return lines.flatMap((line, index): BreakpeekContentItem[] => {
    const input = record(JSON.parse(line) as unknown, `${source.id}[${index}]`)
    const id = text(input.id, `${source.id}[${index}].id`, 36)
    if (!UUID_V4.test(id) || ids.has(id)) throw new Error(`${source.id} item id ${id} is invalid or duplicated`)
    ids.add(id)
    if (input.sourceId !== source.id || input.sourceLabel !== source.label) {
      throw new Error(`${source.id}[${index}] source identity does not match manifest`)
    }
    if (!KINDS.has(input.kind as BreakpeekContentKind)) throw new Error(`${source.id}[${index}].kind is invalid`)
    if (!FORMATS.has(input.bodyFormat as string)) throw new Error(`${source.id}[${index}].bodyFormat is invalid`)
    const title = text(input.title, `${source.id}[${index}].title`, 80)
    const summary = text(input.summary, `${source.id}[${index}].summary`, 200)
    const body = input.body === undefined ? undefined : text(input.body, `${source.id}[${index}].body`, 8192)
    if (body !== undefined && Buffer.byteLength(body) > 8192) throw new Error(`${source.id}[${index}].body is too large`)
    noRawHtml(`${title}\n${summary}\n${body ?? ''}`, `${source.id}[${index}]`)
    const publishedAt = input.publishedAt === undefined ? undefined : isoDate(input.publishedAt, `${source.id}[${index}].publishedAt`)
    const expiresAt = input.expiresAt === undefined ? undefined : isoDate(input.expiresAt, `${source.id}[${index}].expiresAt`)
    if (expiresAt !== undefined && Date.parse(expiresAt) <= now) return []
    if (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some(tag => typeof tag !== 'string' || tag.length === 0 || [...tag].length > 32)) {
      throw new Error(`${source.id}[${index}].tags is invalid`)
    }
    const sourceUrl = input.sourceUrl === undefined ? undefined : text(input.sourceUrl, `${source.id}[${index}].sourceUrl`, 2048)
    if (sourceUrl !== undefined && !sourceUrl.startsWith('https://')) throw new Error(`${source.id}[${index}].sourceUrl must use HTTPS`)
    return [{
      id,
      sourceId: source.id,
      sourceLabel: source.label,
      kind: input.kind as BreakpeekContentKind,
      title,
      summary,
      ...(body === undefined ? {} : { body }),
      bodyFormat: input.bodyFormat as 'plain' | 'markdown',
      ...(publishedAt === undefined ? {} : { publishedAt }),
      ...(expiresAt === undefined ? {} : { expiresAt }),
      tags: [...new Set(input.tags as string[])],
      ...(sourceUrl === undefined ? {} : { sourceUrl }),
    }]
  })
}
