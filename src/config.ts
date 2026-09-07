/** Host Cordis configuration for Breakpeek. */

import Schema from '@deepseek-ai/schemastery'
import {
  BREAKPEEK_CONTENT_SOURCES, DEFAULT_BREAKPEEK_CONFIG,
  MAX_ROTATION_INTERVAL_MS, MIN_ROTATION_INTERVAL_MS,
  type BreakpeekSettings,
} from './boot-config.ts'

/** Cordis plugin configuration. */
export type Config = BreakpeekSettings

/** Cordis configuration schema. */
export const Config: Schema<Config> = Schema.object({
  visible: Schema.boolean().default(DEFAULT_BREAKPEEK_CONFIG.visible).description('Show the Breakpeek message panel.'),
  autoRotate: Schema.boolean().default(DEFAULT_BREAKPEEK_CONFIG.autoRotate).description('Advance messages automatically.'),
  rotationIntervalMs: Schema.number()
    .step(1000)
    .min(MIN_ROTATION_INTERVAL_MS)
    .max(MAX_ROTATION_INTERVAL_MS)
    .default(DEFAULT_BREAKPEEK_CONFIG.rotationIntervalMs)
    .description('Milliseconds between automatic message changes.'),
  contentSources: Schema.array(Schema.union(BREAKPEEK_CONTENT_SOURCES))
    .min(1)
    .default([...DEFAULT_BREAKPEEK_CONFIG.contentSources])
    .description('Local message libraries included in rotation.'),
})
