import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import {
  SettingsProvider, settingsNamespace, type SettingsNamespace,
} from '@deepseek-ai/dsh-settings'
import * as BreakpeekPlugin from '../src/index.ts'
import {
  BREAKPEEK_CONFIG_GLOBAL, BREAKPEEK_CONTENT_SOURCES,
  BREAKPEEK_SETTINGS_NAMESPACE, parseBootConfig,
} from '../src/boot-config.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** Collect the current Host index injections. */
function collect(ctx: Context): IndexInjection[] {
  const table: IndexInjection[] = []
  ctx.emit('webserver/index-inject', table)
  return table
}

describe('ui-breakpeek configuration', () => {
  it('publishes the schema-resolved display settings to the browser boot', async () => {
    const ctx = new Context()
    await ctx.plugin(BreakpeekPlugin, {
      visible: false,
      autoRotate: false,
      rotationIntervalMs: 12_000,
    }).await()

    expect(collect(ctx)).toContainEqual({
      kind: 'global',
      name: BREAKPEEK_CONFIG_GLOBAL,
      value: {
        visible: false,
        autoRotate: false,
        rotationIntervalMs: 12_000,
        contentSources: [...BREAKPEEK_CONTENT_SOURCES],
      },
    })
  })

  it('defaults an absent browser bootstrap and rejects malformed values', () => {
    expect(parseBootConfig(undefined)).toEqual({
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 7000,
      contentSources: [...BREAKPEEK_CONTENT_SOURCES],
    })
    expect(() => parseBootConfig({
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 0,
    })).toThrow(
      `globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`,
    )
  })

  it('accepts old bootstrap data and validates configured message sources', () => {
    expect(parseBootConfig({
      visible: true,
      autoRotate: false,
      rotationIntervalMs: 7000,
    })).toEqual({
      visible: true,
      autoRotate: false,
      rotationIntervalMs: 7000,
      contentSources: [...BREAKPEEK_CONTENT_SOURCES],
    })
    expect(() => parseBootConfig({
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 7000,
      contentSources: [],
    })).toThrow(`globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`)
    expect(() => parseBootConfig({
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 7000,
      contentSources: ['not-a-library'],
    })).toThrow(`globalThis.${BREAKPEEK_CONFIG_GLOBAL} must contain valid display settings`)
  })

  it('registers a visual setting whose user value overrides the Cordis default', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    await ctx.plugin(BreakpeekPlugin, {
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 7000,
      contentSources: [...BREAKPEEK_CONTENT_SOURCES],
    }).await()
    const ns = settingsNamespace(BREAKPEEK_SETTINGS_NAMESPACE)

    expect(ctx.settings.get(ns)).toEqual({
      visible: true,
      autoRotate: true,
      rotationIntervalMs: 7000,
      contentSources: [...BREAKPEEK_CONTENT_SOURCES],
    })
    await ctx.settings.update(ns, {
      visible: false,
      autoRotate: false,
      rotationIntervalMs: 12_000,
      contentSources: ['interview-ai'],
    })
    expect(collect(ctx)).toContainEqual({
      kind: 'global',
      name: BREAKPEEK_CONFIG_GLOBAL,
      value: {
        visible: false,
        autoRotate: false,
        rotationIntervalMs: 12_000,
        contentSources: ['interview-ai'],
      },
    })
  })
})
