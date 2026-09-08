// @vitest-environment jsdom
/** Breakpeek visibility, details, navigation, and automatic rotation behavior. */
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
import { FALLBACK_CONTENT_SOURCES } from '../src/content-types.ts'
import type { BreakpeekContentClientState } from '../src/client/content-controller.ts'

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
  const contentSnapshot: BreakpeekContentClientState = {
    status: 'fallback',
    revision: null,
    generatedAt: null,
    checkedAt: null,
    source: 'fallback',
    sources: FALLBACK_CONTENT_SOURCES.map(source => ({ ...source, available: true })),
    items: [],
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
    useBreakpeekContent: <T,>(selector: (value: BreakpeekContentClientState) => T) =>
      selector(contentSnapshot),
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('stores local messages as ordered typed objects', () => {
    expect(BREAKPEEK_TIPS.map(tip => tip.index)).toEqual(
      BREAKPEEK_TIPS.map((_, index) => index),
    )
    expect(BREAKPEEK_TIPS.every(tip => tip.preview.length > 0 && tip.type.length > 0)).toBe(true)
    expect(BREAKPEEK_TIPS.some(tip => 'detail' in tip)).toBe(true)
    expect(BREAKPEEK_TIPS.some(tip => !('detail' in tip))).toBe(true)
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
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.preview)

    fireEvent.click(host.querySelector('button[aria-label="下一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.preview)
    fireEvent.click(host.querySelector('button[aria-label="上一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.preview)
    fireEvent.click(host.querySelector('button[aria-label="上一条讯息"]')!)
    expect(host.textContent).toContain(BREAKPEEK_TIPS.at(-1)?.preview)
  })

  it('drags with pointer capture while clamping the panel to the viewport', () => {
    vi.stubGlobal('innerWidth', 800)
    vi.stubGlobal('innerHeight', 600)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const host = overlayHostNode()
    render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)
    const widget = host.querySelector<HTMLElement>('[data-message-index]')!
    const handle = host.querySelector<HTMLButtonElement>('button[aria-label^="拖动 Breakpeek"]')!
    vi.spyOn(widget, 'getBoundingClientRect').mockReturnValue({
      width: 280,
      height: 80,
      left: 496,
      top: 496,
      right: 776,
      bottom: 576,
      x: 496,
      y: 496,
      toJSON: () => ({}),
    })
    Object.defineProperties(handle, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      return event
    }

    act(() => { handle.dispatchEvent(pointer('pointerdown', 500, 500)) })
    act(() => {
      handle.dispatchEvent(pointer('pointermove', 2000, 2000))
      handle.dispatchEvent(pointer('pointerup', 2000, 2000))
    })

    expect(widget.style.left).toBe('512px')
    expect(widget.style.top).toBe('512px')
  })

  it('opens details downward when upward expansion would leave the viewport', () => {
    vi.stubGlobal('innerWidth', 800)
    vi.stubGlobal('innerHeight', 600)
    const host = overlayHostNode()
    render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)
    const widget = host.querySelector<HTMLElement>('[data-message-index]')!
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if ((this as Element).getAttribute('aria-label') === '讯息详情') {
        return {
          width: 280, height: 200, left: 100, top: -196, right: 380, bottom: 4,
          x: 100, y: -196, toJSON: () => ({}),
        }
      }
      if (this === widget) {
        return {
          width: 280, height: 80, left: 100, top: 4, right: 380, bottom: 84,
          x: 100, y: 4, toJSON: () => ({}),
        }
      }
      return {
        width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0,
        x: 0, y: 0, toJSON: () => ({}),
      }
    })

    fireEvent.click(host.querySelector('button[aria-expanded]')!)

    expect(widget.getAttribute('data-expand-direction')).toBe('down')
    expect(host.querySelector('[aria-label="讯息详情"]')).not.toBeNull()
  })

  it('rotates only through the selected message libraries', () => {
    const host = overlayHostNode()
    const selected = BREAKPEEK_TIPS.filter(tip => (
      tip.type === 'interview-backend' || tip.type === 'interview-ai'
    ))
    render(<Breakpeek {...runtimeProps({
      ...DEFAULT_BREAKPEEK_CONFIG,
      autoRotate: false,
      contentSources: ['interview-backend', 'interview-ai'],
    })} />)

    expect(host.textContent).toContain(selected[0]?.preview)
    fireEvent.click(host.querySelector('button[aria-label="下一条讯息"]')!)
    expect(host.textContent).toContain(selected[1]?.preview)
    fireEvent.click(host.querySelector('button[aria-label="下一条讯息"]')!)
    expect(host.textContent).toContain(selected[0]?.preview)
  })

  it('rotates at the configured interval only when enabled', () => {
    const host = overlayHostNode()
    const view = render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, rotationIntervalMs: 3000 })} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.preview)

    view.rerender(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)
    act(() => { vi.advanceTimersByTime(7000) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.preview)
  })

  it('expands only messages with details and exposes disclosure semantics', () => {
    const host = overlayHostNode()
    render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, autoRotate: false })} />)

    const expand = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(expand)
    expect(expand.getAttribute('aria-expanded')).toBe('true')
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.detail)

    fireEvent.click(host.querySelector('button[aria-label="下一条讯息"]')!)
    expect(host.querySelector('[aria-label="讯息详情"]')).toBeNull()
    expect(host.querySelector('button[aria-expanded]')).toBeNull()
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.preview)
  })

  it('pauses rotation while expanded and restarts after collapsing', () => {
    const host = overlayHostNode()
    render(<Breakpeek {...runtimeProps({ ...DEFAULT_BREAKPEEK_CONFIG, rotationIntervalMs: 3000 })} />)

    fireEvent.click(host.querySelector('button[aria-expanded]')!)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.preview)

    fireEvent.click(host.querySelector('button[aria-label="收起讯息详情"]')!)
    act(() => { vi.advanceTimersByTime(2999) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[0]?.preview)
    act(() => { vi.advanceTimersByTime(1) })
    expect(host.textContent).toContain(BREAKPEEK_TIPS[1]?.preview)
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
