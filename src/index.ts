/** Breakpeek Host plugin: validates configuration and publishes browser bootstrap state. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  BREAKPEEK_CONFIG_GLOBAL, BREAKPEEK_SETTINGS_NAMESPACE, resolveConfig,
} from './boot-config.ts'
import { Config, type Config as BreakpeekConfig } from './config.ts'

export { Config }
export type { ResolvedConfig } from './boot-config.ts'
export type { Config as BreakpeekConfig } from './config.ts'

/**
 * Publish the resolved configuration whenever the Host assembles a browser boot document.
 * @param ctx - Host context that may compose an HTTP Web surface.
 * @param config - schema-validated Cordis plugin configuration.
 */
export function apply(ctx: Context, config: BreakpeekConfig = {}): void {
  let current = resolveConfig(config)
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(
      settingsNamespace(BREAKPEEK_SETTINGS_NAMESPACE),
      Config,
      { base: config },
    )
    const refresh = (): void => {
      current = resolveConfig(scope.get())
    }
    refresh()
    settingsCtx.effect(() => scope.watch(refresh), 'ui-breakpeek: settings updates')
    settingsCtx.effect(() => () => {
      current = resolveConfig(config)
    }, 'ui-breakpeek: settings fallback')
  })
  ctx.on('webserver/index-inject', (table: IndexInjection[]) => {
    table.push({
      kind: 'global',
      name: BREAKPEEK_CONFIG_GLOBAL,
      value: current,
    })
  })
}
