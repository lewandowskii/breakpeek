// @vitest-environment jsdom
/** Breakpeek visibility, manual navigation, and automatic rotation behavior. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import type {
  SessionId, SettingsScopeSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Breakpeek } from '../src/client/Breakpeek.tsx'
import { BREAKPEEK_TIPS } from '../src/client/breakpeek-tips.ts'
import {
  DEFAULT_BREAKPEEK_CONFIG, type BreakpeekSettings, type ResolvedConfig,
} from '../src/boot-config.ts'

const unusedStandardHook = (): never => { throw new Error('unexpected standard-kit access') }

function overlayHostNode() {
  const node = document.createElement('div')
  node.setAttribute('data-shell-overlay', '')
  document.body.appendChild(node)
  return node
}

function runtimeProps(settings: ResolvedConfig, setVisible = vi.fn(async () => true)) {
  const snapshot: SettingsScopeSnapshot<BreakpeekSettings> = {
    status: 'ready',
    value: settings,
    base: DEFAULT_BREAKPEEK_CONFIG,
    user: {},
    revision: 0,
    writable: true,
    mode: 'host',
  }
  return {
    useSession: unusedStandardHook,
    sessionId: 's1' as SessionId,
    useSessions: unusedStandardHook,
    useWorkspaces: unusedStandardHook,
    useInput: unusedStandardHook,
    inputActions: {
      setDraft: unusedStandardHook,
      addImages: unusedStandardHook,
      removeImage: unusedStandardHook,
      pruneImages: unusedStandardHook,
      submit: unusedStandardHook,
    },
    useProjection: () => undefined,
    useBreakpeekSettings: <T,>(selector: (value: SettingsScopeSnapshot<BreakpeekSettings>) => T) =>
      selector(snapshot),
    bootConfig: DEFAULT_BREAKPEEK_CONFIG,
    setVisible,
  } satisfies PropsRuntime<'conversation.input.overlay'> & Record<string, unknown>
}

describe('Breakpeek', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('uses the visible setting without reading session activity', () => {
    const host = overlayHostNode()
    const view = render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, visible: false })} />)
    expect(host.querySelector('[role="status"]')).toBeNull()

    view.rerender(<Breakpeek {...runtimeProps(DEFAULT_BREAKPEEK_CONFIG)} />)
    expect(host.querySelector('[role="status"]')).not.toBeNull()
  })

  it('moves backward and forward with the arrow buttons', () => {
    const host = overlayHostNode()
    render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.text)

    fireEvent.click(host.querySelector('button[aria-label="下一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.text)
    fireEvent.click(host.querySelector('button[aria-label="上一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.text)
    fireEvent.click(host.querySelector('button[aria-label="上一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS.at(-1)?.text)
  })

  it('rotates at the configured interval only when enabled', () => {
    const host = overlayHostNode()
    const view = render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, rotationIntervalMs: 3000 })} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.text)

    view.rerender(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)
    act(() => { vi.advanceTimersByTime(7000) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.text)
  })

  it('closes immediately and persists the hidden state', () => {
    const host = overlayHostNode()
    const setVisible = vi.fn(async () => true)
    render(<Breakpeek {...runtimeProps(DEFAULT_BREAKPEEK_CONFIG, setVisible)} />)

    fireEvent.click(host.querySelector('button[aria-label="关闭 Breakpeek 轻讯息"]')!)
    expect(host.querySelector('[role="status"]')).toBeNull()
    expect(setVisible).toHaveBeenCalledWith(false)
  })
})
