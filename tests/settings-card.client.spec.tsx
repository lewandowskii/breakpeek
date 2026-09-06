// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  BreakpeekSettingsCard, type BreakpeekSettingsCardProps,
} from '../src/client/BreakpeekSettingsCard.tsx'
import { BreakpeekSettingsController } from '../src/client/settings-controller.ts'
import { zh, type BreakpeekSettingsLocaleKey } from '../src/client/settings-locales.ts'
import {
  DEFAULT_BREAKPEEK_CONFIG, type BreakpeekSettings,
} from '../src/boot-config.ts'

/** Mutable settings scope with synchronous publication for controller tests. */
function scopeStub(initial: BreakpeekSettings = DEFAULT_BREAKPEEK_CONFIG) {
  let snapshot: SettingsScopeSnapshot<BreakpeekSettings> = {
    status: 'ready',
    value: { ...DEFAULT_BREAKPEEK_CONFIG, ...initial },
    base: DEFAULT_BREAKPEEK_CONFIG,
    user: {},
    revision: 0,
    writable: true,
    mode: 'host',
  }
  const listeners = new Set<() => void>()
  const publish = (): void => { for (const listener of listeners) listener() }
  const scope: SettingsScope<BreakpeekSettings> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: async (field, value) => {
      snapshot = {
        ...snapshot,
        value: { ...snapshot.value, [field]: value },
        user: { ...(snapshot.user as object | undefined), [field]: value },
        revision: (snapshot.revision ?? 0) + 1,
      }
      publish()
    },
    unset: async (field) => {
      const user = { ...(snapshot.user as Record<string, unknown> | undefined) }
      delete user[field]
      snapshot = {
        ...snapshot,
        value: { ...DEFAULT_BREAKPEEK_CONFIG, ...user },
        user,
        revision: (snapshot.revision ?? 0) + 1,
      }
      publish()
    },
  }
  return scope
}

describe('Breakpeek visual settings', () => {
  it('stages and persists visibility, rotation, and interval', async () => {
    const controller = new BreakpeekSettingsController(scopeStub())
    const face = controller.inject()
    face.editVisible(false)
    face.editAutoRotate(false)
    face.editRotationIntervalMs(12_000)
    expect(face.hooks.breakpeekSettingsCard.getSnapshot()).toMatchObject({
      visible: false,
      autoRotate: false,
      rotationIntervalMs: 12_000,
      dirty: true,
    })

    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.breakpeekSettingsCard.getSnapshot()).toMatchObject({
        visible: false,
        autoRotate: false,
        rotationIntervalMs: 12_000,
        dirty: false,
        failed: false,
      })
    })
  })

  it('renders all controls in the shared plugin configuration card', () => {
    const controller = new BreakpeekSettingsController(scopeStub())
    const face = controller.inject()
    const useBreakpeekSettingsCard = <Value,>(
      selector: (state: ReturnType<typeof face.hooks.breakpeekSettingsCard.getSnapshot>) => Value,
    ): Value => useSyncExternalStore(
      face.hooks.breakpeekSettingsCard.subscribe,
      () => selector(face.hooks.breakpeekSettingsCard.getSnapshot()),
    )
    const props = {
      ...face,
      useBreakpeekSettingsCard,
      t: (key: BreakpeekSettingsLocaleKey) => zh[key],
    } as unknown as BreakpeekSettingsCardProps
    render(<BreakpeekSettingsCard {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '展开设置: Breakpeek' }))
    const visibility = screen.getByRole('switch', { name: '显示讯息框' })
    const rotation = screen.getByRole('switch', { name: '自动轮转讯息' })
    const interval = screen.getByRole('spinbutton', { name: '轮转间隔' })
    expect(visibility.getAttribute('aria-checked')).toBe('true')
    expect(rotation.getAttribute('aria-checked')).toBe('true')
    expect(interval.getAttribute('value')).toBe('7')

    fireEvent.click(visibility)
    fireEvent.click(rotation)
    expect(face.hooks.breakpeekSettingsCard.getSnapshot()).toMatchObject({
      visible: false,
      autoRotate: false,
    })
    expect((interval as HTMLInputElement).disabled).toBe(true)
  })
})
