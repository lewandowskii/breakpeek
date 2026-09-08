/** Host Cordis configuration for Breakpeek. */

import Schema from '@deepseek-ai/schemastery'
import {
  DEFAULT_BREAKPEEK_CONFIG,
  MAX_ROTATION_INTERVAL_MS, MIN_ROTATION_INTERVAL_MS,
  type BreakpeekSettings,
} from './boot-config.ts'

function settingsShape() {
  return {
    visible: Schema.boolean().default(DEFAULT_BREAKPEEK_CONFIG.visible).description('Show the Breakpeek message panel.'),
    autoRotate: Schema.boolean().default(DEFAULT_BREAKPEEK_CONFIG.autoRotate).description('Advance messages automatically.'),
    rotationIntervalMs: Schema.number()
      .step(1000)
      .min(MIN_ROTATION_INTERVAL_MS)
      .max(MAX_ROTATION_INTERVAL_MS)
      .default(DEFAULT_BREAKPEEK_CONFIG.rotationIntervalMs)
      .description('Milliseconds between automatic message changes.'),
    contentSources: Schema.array(Schema.string().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .min(1)
      .default([...DEFAULT_BREAKPEEK_CONFIG.contentSources])
      .description('Message libraries included in rotation.'),
  }
}

/** Cordis plugin configuration. */
export interface Config extends BreakpeekSettings {
  /** Stable HTTPS manifest URL, for example an R2 staging manifest. */
  contentCatalogUrl?: string
  /** SQLite cache path; defaults under `$DSH_HOME/storages`. */
  contentCachePath?: string
  /** Trusted Ed25519 public keys keyed by manifest `keyId`. */
  contentPublicKeys?: Record<string, string>
  /** Development-only escape hatch for unsigned staging manifests. */
  allowUnsignedContent?: boolean
  /** Interval between Host-side remote checks. */
  contentRefreshIntervalMs?: number
  /** Timeout for each manifest or source request. */
  contentRequestTimeoutMs?: number
}

export const DEFAULT_CONTENT_REFRESH_INTERVAL_MS = 21_600_000
export const DEFAULT_CONTENT_REQUEST_TIMEOUT_MS = 10_000

/** User-editable settings only; deployment and trust fields stay off the browser settings wire. */
export const SettingsConfig: Schema<BreakpeekSettings> = Schema.object({
  ...settingsShape(),
})

/** Cordis configuration schema. */
export const Config: Schema<Config> = Schema.object({
  ...settingsShape(),
  contentCatalogUrl: Schema.string().pattern(/^https:\/\//).description('HTTPS URL of the signed Breakpeek content manifest.'),
  contentCachePath: Schema.string().description('SQLite path for the last-known-good content cache.'),
  contentPublicKeys: Schema.dict(Schema.string()).default({}).description('Ed25519 public keys keyed by manifest keyId.'),
  allowUnsignedContent: Schema.boolean().default(false).description('Allow unsigned content; development only.'),
  contentRefreshIntervalMs: Schema.number().step(60_000).min(60_000)
    .default(DEFAULT_CONTENT_REFRESH_INTERVAL_MS).description('Milliseconds between content checks.'),
  contentRequestTimeoutMs: Schema.number().step(1000).min(1000).max(60_000)
    .default(DEFAULT_CONTENT_REQUEST_TIMEOUT_MS).description('Remote content request timeout in milliseconds.'),
})
