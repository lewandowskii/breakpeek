/**
 * Breakpeek's floating local message panel. It registers into the
 * `conversation.input.overlay` slot and portals into the frame's
 * `[data-shell-overlay]` layer. Visibility and automatic rotation come from
 * the plugin settings namespace; conversation activity does not affect them.
 * @module @deepseek-ai/dsh-client-ui-breakpeek/Breakpeek
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ObservableSnapshot, SettingsScopeSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  type BreakpeekSettings, type ResolvedConfig,
} from '../boot-config.ts'
import { BREAKPEEK_TIPS } from './breakpeek-tips.ts'
import css from './Breakpeek.module.css'

/** Registration-side settings and actions. */
interface BreakpeekInjected {
  /** Host-resolved fallback before the settings namespace becomes available. */
  bootConfig: ResolvedConfig
  hooks: {
    /** Live user settings for the message panel. */
    breakpeekSettings: ObservableSnapshot<SettingsScopeSnapshot<BreakpeekSettings>>
  }
  /**
   * Persist the panel's visibility.
   * @param visible - next open state.
   * @returns whether the settings scope accepted that state.
   */
  setVisible: (visible: boolean) => Promise<boolean>
}

/** Conversation overlay props plus Breakpeek settings. */
type BreakpeekProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<BreakpeekInjected>

/** Selector to the frame's floating overlay layer. */
function overlayHost(): HTMLElement | null {
  return typeof document !== 'undefined'
    ? document.querySelector('[data-shell-overlay]')
    : null
}

/** Wrap a message index in the available local content range. */
function wrapIndex(index: number): number {
  return (index + BREAKPEEK_TIPS.length) % BREAKPEEK_TIPS.length
}

/**
 * Render the persistent message panel with manual and optional timed rotation.
 * @param props - slot runtime, resolved settings, and the visibility writer.
 * @returns the floating message panel, or null while disabled.
 */
export function Breakpeek(props: BreakpeekProps) {
  const visible = props.useBreakpeekSettings(snapshot => snapshot.status === 'ready'
    ? snapshot.value?.visible ?? props.bootConfig.visible
    : props.bootConfig.visible)
  const autoRotate = props.useBreakpeekSettings(snapshot => snapshot.status === 'ready'
    ? snapshot.value?.autoRotate ?? props.bootConfig.autoRotate
    : props.bootConfig.autoRotate)
  const rotationIntervalMs = props.useBreakpeekSettings(snapshot => snapshot.status === 'ready'
    ? snapshot.value?.rotationIntervalMs ?? props.bootConfig.rotationIntervalMs
    : props.bootConfig.rotationIntervalMs)
  const [dismissed, setDismissed] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (visible) setDismissed(false)
  }, [visible])

  const shown = visible && !dismissed
  useEffect(() => {
    if (!shown || !autoRotate || BREAKPEEK_TIPS.length < 2) return
    const id = setTimeout(() => {
      setIndex(current => wrapIndex(current + 1))
    }, rotationIntervalMs)
    return () => {
      clearTimeout(id)
    }
  }, [autoRotate, index, rotationIntervalMs, shown])

  if (!shown) return null
  const host = overlayHost()
  if (host === null) return null

  const tip = BREAKPEEK_TIPS[wrapIndex(index)] ?? BREAKPEEK_TIPS[0]
  return createPortal(
    <div className={css.widget} role="status" aria-live="polite">
      <div className={css.header}>
        <div className={css.navigation}>
          <button
            className={css.navigationButton}
            type="button"
            aria-label="上一条讯息"
            onClick={() => { setIndex(current => wrapIndex(current - 1)) }}
          >
            ←
          </button>
          <button
            className={css.navigationButton}
            type="button"
            aria-label="下一条讯息"
            onClick={() => { setIndex(current => wrapIndex(current + 1)) }}
          >
            →
          </button>
        </div>
        <button
          className={css.close}
          type="button"
          aria-label="关闭 Breakpeek 轻讯息"
          onClick={() => {
            setDismissed(true)
            void props.setVisible(false).then((accepted) => {
              if (!accepted) setDismissed(false)
            })
          }}
        >
          ×
        </button>
      </div>
      <div className={css.content}>
        <span className={css.face}>{tip.face}</span>
        <span className={css.text}>{tip.text}</span>
      </div>
    </div>,
    host,
  )
}
