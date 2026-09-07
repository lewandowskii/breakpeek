/**
 * Breakpeek's floating local message panel. It registers into the
 * `conversation.input.overlay` slot and portals into the frame's
 * `[data-shell-overlay]` layer. Visibility and automatic rotation come from
 * the plugin settings namespace; expanded details pause timed rotation.
 * @module @deepseek-ai/dsh-client-ui-breakpeek/Breakpeek
 */
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react'
import type {
  CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent,
} from 'react'
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

interface PanelPosition {
  left: number
  top: number
}

type ExpansionDirection = 'up' | 'down'

const VIEWPORT_MARGIN = 8
const KEYBOARD_DRAG_STEP = 16
const KEYBOARD_DRAG_OFFSETS: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-KEYBOARD_DRAG_STEP, 0],
  ArrowRight: [KEYBOARD_DRAG_STEP, 0],
  ArrowUp: [0, -KEYBOARD_DRAG_STEP],
  ArrowDown: [0, KEYBOARD_DRAG_STEP],
}

/** Directional chevron matching Harness's compact disclosure controls. */
function ChevronIcon({
  className = '',
  direction,
}: {
  className?: string
  direction: 'up' | 'down'
}) {
  const directionClassName = direction === 'up' ? css.chevronUp : css.chevronDown
  return (
    <svg
      className={`${css.chevron} ${directionClassName} ${className}`}
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" />
    </svg>
  )
}

/** Selector to the frame's floating overlay layer. */
function overlayHost(): HTMLElement | null {
  return typeof document !== 'undefined'
    ? document.querySelector('[data-shell-overlay]')
    : null
}

/** Wrap a message index in the currently selected local content range. */
function wrapIndex(index: number, length: number): number {
  return (index + length) % length
}

/** Keep the collapsed panel and any open details inside the viewport. */
function clampPosition(
  position: PanelPosition,
  panel: Pick<DOMRect, 'width' | 'height'>,
  detailHeight: number,
  direction: ExpansionDirection,
): PanelPosition {
  const minLeft = VIEWPORT_MARGIN
  const maxLeft = Math.max(minLeft, window.innerWidth - panel.width - VIEWPORT_MARGIN)
  const minTop = direction === 'up' ? VIEWPORT_MARGIN + detailHeight : VIEWPORT_MARGIN
  const maxTop = Math.max(
    minTop,
    window.innerHeight - panel.height - VIEWPORT_MARGIN
      - (direction === 'down' ? detailHeight : 0),
  )
  return {
    left: Math.min(maxLeft, Math.max(minLeft, position.left)),
    top: Math.min(maxTop, Math.max(minTop, position.top)),
  }
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
  const contentSources = props.useBreakpeekSettings(snapshot => snapshot.status === 'ready'
    ? snapshot.value?.contentSources ?? props.bootConfig.contentSources
    : props.bootConfig.contentSources)
  const [dismissed, setDismissed] = useState(false)
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [expansionDirection, setExpansionDirection] = useState<ExpansionDirection>('up')
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const [dragging, setDragging] = useState(false)
  const [viewportRevision, setViewportRevision] = useState(0)
  const widgetRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLElement>(null)
  const dragOrigin = useRef({ pointerX: 0, pointerY: 0, panelLeft: 0, panelTop: 0 })
  const latestPointer = useRef({ x: 0, y: 0 })
  const dragFrame = useRef<number | null>(null)
  const contentSourcesKey = contentSources.join('\u0000')
  const selectedTips = BREAKPEEK_TIPS.filter(tip => contentSources.includes(tip.type))
  const tips = selectedTips.length > 0 ? selectedTips : BREAKPEEK_TIPS

  const currentGeometry = useCallback(() => {
    const panel = widgetRef.current?.getBoundingClientRect()
    if (panel === undefined) return null
    const detailHeight = expanded
      ? detailsRef.current?.getBoundingClientRect().height ?? 0
      : 0
    return { panel, detailHeight }
  }, [expanded])

  const commitDrag = useCallback((pointerX: number, pointerY: number) => {
    const geometry = currentGeometry()
    if (geometry === null) return
    const next = {
      left: dragOrigin.current.panelLeft + pointerX - dragOrigin.current.pointerX,
      top: dragOrigin.current.panelTop + pointerY - dragOrigin.current.pointerY,
    }
    const nextDirection = expanded
      && expansionDirection === 'up'
      && next.top - geometry.detailHeight < VIEWPORT_MARGIN
      ? 'down'
      : expansionDirection
    if (nextDirection !== expansionDirection) setExpansionDirection(nextDirection)
    setPosition(clampPosition(
      next,
      geometry.panel,
      geometry.detailHeight,
      nextDirection,
    ))
  }, [currentGeometry, expanded, expansionDirection])

  const finishDrag = useCallback((target: HTMLButtonElement, pointerId: number) => {
    if (!target.hasPointerCapture(pointerId)) return
    target.releasePointerCapture(pointerId)
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
    }
    commitDrag(latestPointer.current.x, latestPointer.current.y)
    setDragging(false)
  }, [commitDrag])

  const onDragPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const panel = widgetRef.current?.getBoundingClientRect()
    if (panel === undefined) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panelLeft: panel.left,
      panelTop: panel.top,
    }
    latestPointer.current = { x: event.clientX, y: event.clientY }
    setPosition({ left: panel.left, top: panel.top })
    setDragging(true)
  }, [])

  const onDragPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    latestPointer.current = { x: event.clientX, y: event.clientY }
    dragFrame.current ??= requestAnimationFrame(() => {
      dragFrame.current = null
      commitDrag(latestPointer.current.x, latestPointer.current.y)
    })
  }, [commitDrag])

  const onDragPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    finishDrag(event.currentTarget, event.pointerId)
  }, [finishDrag])

  const onLostPointerCapture = useCallback(() => {
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
    }
    setDragging(false)
  }, [])

  const onDragKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const offset = KEYBOARD_DRAG_OFFSETS[event.key]
    if (offset === undefined) return
    const geometry = currentGeometry()
    if (geometry === null) return
    event.preventDefault()
    const next = {
      left: (position?.left ?? geometry.panel.left) + offset[0],
      top: (position?.top ?? geometry.panel.top) + offset[1],
    }
    const nextDirection = expanded
      && expansionDirection === 'up'
      && next.top - geometry.detailHeight < VIEWPORT_MARGIN
      ? 'down'
      : expansionDirection
    if (nextDirection !== expansionDirection) setExpansionDirection(nextDirection)
    setPosition(clampPosition(next, geometry.panel, geometry.detailHeight, nextDirection))
  }, [currentGeometry, expanded, expansionDirection, position])

  useEffect(() => {
    if (visible) {
      setDismissed(false)
    } else {
      setExpanded(false)
    }
  }, [visible])

  useEffect(() => {
    setExpanded(false)
    setIndex(0)
  }, [contentSourcesKey])

  const shown = visible && !dismissed
  useEffect(() => {
    if (!shown || expanded || dragging || !autoRotate || tips.length < 2) return
    const id = setTimeout(() => {
      setExpanded(false)
      setIndex(current => wrapIndex(current + 1, tips.length))
    }, rotationIntervalMs)
    return () => {
      clearTimeout(id)
    }
  }, [autoRotate, contentSourcesKey, dragging, expanded, index, rotationIntervalMs, shown, tips.length])

  useEffect(() => {
    if (!shown || !expanded) return
    const collapseOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', collapseOnEscape)
    return () => {
      document.removeEventListener('keydown', collapseOnEscape)
    }
  }, [expanded, shown])

  useEffect(() => {
    const updateViewport = () => { setViewportRevision(revision => revision + 1) }
    window.addEventListener('resize', updateViewport)
    return () => {
      window.removeEventListener('resize', updateViewport)
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!expanded || position === null) return
    const panel = widgetRef.current?.getBoundingClientRect()
    const details = detailsRef.current?.getBoundingClientRect()
    if (panel === undefined || details === undefined) return
    if (expansionDirection === 'up' && panel.top - details.height < VIEWPORT_MARGIN) {
      setExpansionDirection('down')
      return
    }
    setPosition(current => current === null
      ? current
      : clampPosition(current, panel, details.height, expansionDirection))
  }, [expanded, expansionDirection, position?.left, position?.top, viewportRevision])

  useLayoutEffect(() => {
    if (position === null || expanded) return
    const panel = widgetRef.current?.getBoundingClientRect()
    if (panel === undefined) return
    setPosition(current => current === null
      ? current
      : clampPosition(current, panel, 0, expansionDirection))
  }, [expanded, expansionDirection, position?.left, position?.top, viewportRevision])

  if (!shown) return null
  const host = overlayHost()
  if (host === null) return null

  const tip = tips[wrapIndex(index, tips.length)] ?? BREAKPEEK_TIPS[0]
  const detailId = `breakpeek-detail-${tip.index}`
  const panelStyle = position === null
    ? undefined
    : {
        left: `${position.left}px`,
        top: `${position.top}px`,
        right: 'auto',
        bottom: 'auto',
      } satisfies CSSProperties
  const move = (offset: number) => {
    setExpanded(false)
    setIndex(current => wrapIndex(current + offset, tips.length))
  }
  const toggleExpanded = () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    const panel = widgetRef.current?.getBoundingClientRect()
    if (panel !== undefined) setPosition({ left: panel.left, top: panel.top })
    setExpansionDirection('up')
    setExpanded(true)
  }
  const details = expanded && tip.detail !== undefined
    ? (
        <section
          ref={detailsRef}
          className={`${css.details} ${expansionDirection === 'up' ? css.detailsUp : css.detailsDown}`}
          id={detailId}
          aria-label="讯息详情"
        >
          <button
            className={css.collapseButton}
            type="button"
            aria-label="收起讯息详情"
            onClick={() => { setExpanded(false) }}
          >
            <span>收起</span>
            <ChevronIcon
              className={css.collapseIcon}
              direction={expansionDirection === 'up' ? 'down' : 'up'}
            />
          </button>
          <div className={css.detailViewport}>
            <div className={css.detailScroll} tabIndex={0} aria-label="讯息详情正文">
              {tip.detail}
            </div>
          </div>
        </section>
      )
    : null
  return createPortal(
    <div
      ref={widgetRef}
      className={css.widget}
      style={panelStyle}
      data-message-index={tip.index}
      data-message-type={tip.type}
      data-expanded={expanded || undefined}
      data-expand-direction={expanded ? expansionDirection : undefined}
      data-dragging={dragging || undefined}
    >
      {details}
      <div className={css.header}>
        <div className={css.navigation}>
          <button
            className={css.navigationButton}
            type="button"
            aria-label="上一条讯息"
            onClick={() => { move(-1) }}
          >
            ←
          </button>
          <button
            className={css.navigationButton}
            type="button"
            aria-label="下一条讯息"
            onClick={() => { move(1) }}
          >
            →
          </button>
        </div>
        <button
          className={css.dragHandle}
          type="button"
          aria-label="拖动 Breakpeek 轻讯息；也可使用方向键移动"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
          onLostPointerCapture={onLostPointerCapture}
          onKeyDown={onDragKeyDown}
        />
        <button
          className={css.close}
          type="button"
          aria-label="关闭 Breakpeek 轻讯息"
          onClick={() => {
            setExpanded(false)
            setDismissed(true)
            void props.setVisible(false).then((accepted) => {
              if (!accepted) setDismissed(false)
            })
          }}
        >
          ×
        </button>
      </div>
      {tip.detail !== undefined
        ? (
            <button
              className={`${css.content} ${css.expandableContent}`}
              type="button"
              aria-label={`${expanded ? '收起' : '展开'}讯息详情：${tip.preview}`}
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={toggleExpanded}
            >
              <span className={css.face} aria-hidden="true">{tip.face}</span>
              <span className={css.text} role="status" aria-live="polite">
                {tip.preview}
              </span>
              <ChevronIcon
                className={css.expandIcon}
                direction={expanded
                  ? expansionDirection === 'up' ? 'down' : 'up'
                  : expansionDirection}
              />
            </button>
          )
        : (
            <div className={css.content}>
              <span className={css.face} aria-hidden="true">{tip.face}</span>
              <span className={css.text} role="status" aria-live="polite">{tip.preview}</span>
            </div>
          )}
    </div>,
    host,
  )
}
