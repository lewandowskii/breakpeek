/**
 * Breakpeek plugin, browser half: the floating local message widget. It
 * registers one entry into the session-scoped `conversation.input.overlay`
 * seat (declared by ui-conversation) and owns no store, no event listener and
 * no Remote calls — the live session arrives through the standard hooks.
 * @module @deepseek-ai/dsh-client-ui-breakpeek/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (conversation.input.overlay).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the settings scope and plugin-card slot declarations.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { Breakpeek } from './Breakpeek.tsx'
import { BreakpeekSettingsCard } from './BreakpeekSettingsCard.tsx'
import { BreakpeekSettingsController } from './settings-controller.ts'
import {
  BREAKPEEK_SETTINGS_LOCALE, en, type BreakpeekSettingsLocaleKey, zh,
} from './settings-locales.ts'
import {
  BREAKPEEK_CONFIG_GLOBAL, BREAKPEEK_SETTINGS_NAMESPACE, parseBootConfig,
  type BreakpeekSettings,
} from '../boot-config.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy for the Breakpeek plugin configuration card. */
    'settings.breakpeek': BreakpeekSettingsLocaleKey
  }
}

/** Required services for the widget, its durable settings scope, and its configuration card. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body: register Breakpeek into the
 * conversation overlay seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const bootConfig = parseBootConfig(
    (globalThis as Record<string, unknown>)[BREAKPEEK_CONFIG_GLOBAL],
  )
  const widgetSettings = ctx.settingsScope.bind<BreakpeekSettings>({
    namespace: BREAKPEEK_SETTINGS_NAMESPACE,
  })
  const card = new BreakpeekSettingsController(
    ctx.settingsScope.bind<BreakpeekSettings>({ namespace: BREAKPEEK_SETTINGS_NAMESPACE }),
  )
  ctx.effect(() => () => { card.dispose() }, 'ui-breakpeek: settings card')
  ctx.effect(
    () => ctx.locale.register(BREAKPEEK_SETTINGS_LOCALE, { zh, en }),
    'ui-breakpeek: settings card dictionaries',
  )
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'breakpeek',
    order: 60,
    label: () => 'Breakpeek',
    inject: () => ({
      bootConfig,
      hooks: { breakpeekSettings: widgetSettings },
      setVisible: async (visible: boolean) => {
        await widgetSettings.set('visible', visible)
        return widgetSettings.getSnapshot().value?.visible === visible
      },
    }),
  }, Breakpeek))
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: BREAKPEEK_SETTINGS_NAMESPACE,
    locale: BREAKPEEK_SETTINGS_LOCALE,
    inject: () => card.inject(),
  }, BreakpeekSettingsCard))
}
