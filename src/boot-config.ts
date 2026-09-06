/** Browser-safe bootstrap configuration for Breakpeek. */

/** Browser global carrying the Host-resolved Breakpeek configuration. */
export const BREAKPEEK_CONFIG_GLOBAL = '__DSH_BREAKPEEK_CONFIG__'

/** Host settings namespace and plugin-card key owned by Breakpeek. */
export const BREAKPEEK_SETTINGS_NAMESPACE = 'ui-breakpeek'

/** Smallest supported automatic rotation interval. */
export const MIN_ROTATION_INTERVAL_MS = 1000
/** Largest supported automatic rotation interval. */
export const MAX_ROTATION_INTERVAL_MS = 3_600_000

/** User-editable Breakpeek settings shared with the browser. */
export interface BreakpeekSettings {
  /** Whether the message panel is open. */
  visible?: boolean
  /** Whether the panel advances messages on a timer. */
  autoRotate?: boolean
  /** Milliseconds between automatic message changes. */
  rotationIntervalMs?: number
}

/** Resolved configuration consumed by the browser plugin. */
export interface ResolvedConfig {
  /** Whether the message panel is open. */
  visible: boolean
  /** Whether the panel advances messages on a timer. */
  autoRotate: boolean
  /** Milliseconds between automatic message changes. */
  rotationIntervalMs: number
}

/** Defaults used by Cordis, browser bootstrap, and visual settings. */
export const DEFAULT_BREAKPEEK_CONFIG: Readonly<ResolvedConfig> = Object.freeze({
  visible: true,
  autoRotate: true,
  rotationIntervalMs: 7000,
})

/** Resolve schema defaults for direct callers and Host bootstrap serialization. */
export function resolveConfig(config: BreakpeekSettings = {}): ResolvedConfig {
  return {
    visible: config.visible ?? DEFAULT_BREAKPEEK_CONFIG.visible,
    autoRotate: config.autoRotate ?? DEFAULT_BREAKPEEK_CONFIG.autoRotate,
    rotationIntervalMs: config.rotationIntervalMs ?? DEFAULT_BREAKPEEK_CONFIG.rotationIntervalMs,
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
  if (typeof config.visible !== 'boolean'
    || typeof config.autoRotate !== 'boolean'
    || !Number.isSafeInteger(config.rotationIntervalMs)
    || (config.rotationIntervalMs as number) < MIN_ROTATION_INTERVAL_MS
    || (config.rotationIntervalMs as number) > MAX_ROTATION_INTERVAL_MS) {
    throw new Error(`ui-breakpeek: globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`)
  }
  return resolveConfig(config as BreakpeekSettings)
}
