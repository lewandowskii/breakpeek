/** Browser-safe bootstrap configuration for Breakpeek. */

/** Browser global carrying the Host-resolved Breakpeek configuration. */
export const BREAKPEEK_CONFIG_GLOBAL = '__DSH_BREAKPEEK_CONFIG__'

/** Host settings namespace and plugin-card key owned by Breakpeek. */
export const BREAKPEEK_SETTINGS_NAMESPACE = 'ui-breakpeek'

/** Smallest supported automatic rotation interval. */
export const MIN_ROTATION_INTERVAL_MS = 1000
/** Largest supported automatic rotation interval. */
export const MAX_ROTATION_INTERVAL_MS = 3_600_000

import { FALLBACK_CONTENT_SOURCES } from './content-types.ts'

/** Built-in source identifiers used before the remote catalog is available. */
export const BREAKPEEK_CONTENT_SOURCES = FALLBACK_CONTENT_SOURCES.map(source => source.id)

/** Identifier for one selectable dynamic or built-in message library. */
export type BreakpeekContentSource = string

/** Whether a raw value is a safe message-library identifier. */
export function isBreakpeekContentSource(value: unknown): value is BreakpeekContentSource {
  return typeof value === 'string'
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

/** User-editable Breakpeek settings shared with the browser. */
export interface BreakpeekSettings {
  /** Whether the message panel is open. */
  visible?: boolean
  /** Whether the panel advances messages on a timer. */
  autoRotate?: boolean
  /** Milliseconds between automatic message changes. */
  rotationIntervalMs?: number
  /** Message libraries included in manual and automatic rotation. */
  contentSources?: BreakpeekContentSource[]
}

/** Resolved configuration consumed by the browser plugin. */
export interface ResolvedConfig {
  /** Whether the message panel is open. */
  visible: boolean
  /** Whether the panel advances messages on a timer. */
  autoRotate: boolean
  /** Milliseconds between automatic message changes. */
  rotationIntervalMs: number
  /** Message libraries included in manual and automatic rotation. */
  contentSources: BreakpeekContentSource[]
}

/** Defaults used by Cordis, browser bootstrap, and visual settings. */
export const DEFAULT_BREAKPEEK_CONFIG: Readonly<ResolvedConfig> = Object.freeze({
  visible: true,
  autoRotate: true,
  rotationIntervalMs: 7000,
  contentSources: [...BREAKPEEK_CONTENT_SOURCES],
})

/** Resolve schema defaults for direct callers and Host bootstrap serialization. */
export function resolveConfig(config: BreakpeekSettings = {}): ResolvedConfig {
  const configuredSources = config.contentSources?.filter(isBreakpeekContentSource)
  const contentSources = configuredSources !== undefined && configuredSources.length > 0
    ? [...new Set(configuredSources)]
    : [...BREAKPEEK_CONTENT_SOURCES]
  return {
    visible: config.visible ?? DEFAULT_BREAKPEEK_CONFIG.visible,
    autoRotate: config.autoRotate ?? DEFAULT_BREAKPEEK_CONFIG.autoRotate,
    rotationIntervalMs: config.rotationIntervalMs ?? DEFAULT_BREAKPEEK_CONFIG.rotationIntervalMs,
    contentSources,
  }
}

/**
 * Parse the optional Host bootstrap value at the browser wire boundary.
 * @param value - raw page global; absent in non-HTTP client compositions.
 * @returns the validated configuration or the default when no global exists.
 */
export function parseBootConfig(value: unknown): ResolvedConfig {
  if (value === undefined) return resolveConfig()
  if (typeof value !== 'object' || value === null) {
    throw new Error(`ui-breakpeek: globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`)
  }
  const config = value as Record<string, unknown>
  const contentSourcesValid = config.contentSources === undefined
    || (Array.isArray(config.contentSources)
      && config.contentSources.length > 0
      && config.contentSources.every(isBreakpeekContentSource)
      && new Set(config.contentSources).size === config.contentSources.length)
  if (typeof config.visible !== 'boolean'
    || typeof config.autoRotate !== 'boolean'
    || !Number.isSafeInteger(config.rotationIntervalMs)
    || (config.rotationIntervalMs as number) < MIN_ROTATION_INTERVAL_MS
    || (config.rotationIntervalMs as number) > MAX_ROTATION_INTERVAL_MS
    || !contentSourcesValid) {
    throw new Error(`ui-breakpeek: globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`)
  }
  return resolveConfig(config as BreakpeekSettings)
}
