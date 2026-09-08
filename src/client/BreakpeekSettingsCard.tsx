/** Breakpeek's card in the shared Plugins settings section. */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  MAX_ROTATION_INTERVAL_MS, MIN_ROTATION_INTERVAL_MS, type BreakpeekContentSource,
} from '../boot-config.ts'
import type { BreakpeekSettingsCardFace } from './settings-controller.ts'
import type {
  BREAKPEEK_SETTINGS_LOCALE,
} from './settings-locales.ts'
import css from './BreakpeekSettingsCard.module.css'

/** Props assembled for the Breakpeek settings card. */
export type BreakpeekSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<typeof BREAKPEEK_SETTINGS_LOCALE>
  & InjectFace<BreakpeekSettingsCardFace>

/** The same 14px disclosure chevron used by Harness plugin settings cards. */
function SettingsChevron({ className }: { className?: string | undefined }) {
  return (
    <svg
      width="14"
      height="14"
      className={className}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Render the panel, rotation, and interval controls in an expandable card.
 * @param props - localized copy, settings state, and write actions.
 * @returns the card, or null when the Host does not expose its namespace.
 */
export function BreakpeekSettingsCard(props: BreakpeekSettingsCardProps) {
  const [open, setOpen] = useState(false)
  const state = props.useBreakpeekSettingsCard(snapshot => snapshot)
  if (!state.available) return null
  const disabled = !state.writable || state.saving
  const intervalSeconds = state.rotationIntervalMs / 1000
  const availableSources = [...state.availableSources].sort((left, right) => left.order - right.order)
  const knownIds = new Set(availableSources.map(source => source.id))
  const sourceOptions = [
    ...availableSources,
    ...state.contentSources.filter(source => !knownIds.has(source)).map((source, order) => ({
      id: source,
      label: source,
      description: props.t('sourceUnavailable'),
      defaultEnabled: false,
      order: Number.MAX_SAFE_INTEGER - state.contentSources.length + order,
      available: false,
    })),
  ]
  const toggleContentSource = (source: BreakpeekContentSource) => {
    const selected = state.contentSources.includes(source)
    const next = selected
      ? state.contentSources.filter(candidate => candidate !== source)
      : [...state.contentSources, source]
    if (next.length > 0) props.editContentSources([...next])
  }
  const contentStatus = state.contentStatus === 'loading'
    ? props.t('contentLoading')
    : state.contentStatus === 'ready'
      ? props.t('contentReady').replace('{count}', String(state.contentItemCount))
      : state.contentStatus === 'cached'
        ? props.t('contentCached').replace('{count}', String(state.contentItemCount))
        : state.contentStatus === 'error'
          ? props.t('contentError')
          : props.t('contentFallback')
  return (
    <li className={open ? `${css.card} ${css.cardOpen}` : css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${props.t(open ? 'collapse' : 'expand')}: ${props.t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{props.t('title')}</span>
          <span className={css.description}>{props.t('description')}</span>
        </span>
        {state.dirty ? <span className={css.pending}>{props.t('unsaved')}</span> : null}
        <SettingsChevron className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} />
      </button>
      {open
        ? (
          <div className={css.body}>
            {!state.writable ? <p className={css.readOnly} role="status">{props.t('readOnly')}</p> : null}
            <div className={css.field}>
              <div className={css.fieldHead}>
                <div>
                  <p className={css.label}>{props.t('visible')}</p>
                  <p className={css.hint}>{props.t('visibleHint')}</p>
                </div>
                <Switch
                  label={props.t('visible')}
                  checked={state.visible}
                  disabled={disabled}
                  onChange={props.editVisible}
                  onText={props.t('enabled')}
                  offText={props.t('disabled')}
                />
              </div>
            </div>
            <div className={css.field}>
              <fieldset className={css.sourceField} aria-describedby="breakpeek-content-sources-hint">
                <legend className={css.label}>{props.t('contentSources')}</legend>
                <p className={css.hint} id="breakpeek-content-sources-hint">
                  {props.t('contentSourcesHint')}
                </p>
                <p className={css.contentStatus} role="status">{contentStatus}</p>
                <div className={css.sourceOptions}>
                  {sourceOptions.map((option) => {
                    const checked = state.contentSources.includes(option.id)
                    const locked = disabled || (checked && state.contentSources.length === 1)
                    return (
                      <label
                        className={checked
                          ? `${css.sourceOption} ${css.sourceOptionSelected}`
                          : css.sourceOption}
                        key={option.id}
                        title={option.description}
                      >
                        <input
                          className={css.sourceCheckbox}
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => { toggleContentSource(option.id) }}
                        />
                        <span>{option.label}</span>
                        {option.available === false
                          ? <span className={css.unavailable}>{props.t('unavailable')}</span>
                          : null}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </div>
            <div className={css.field}>
              <div className={css.fieldHead}>
                <div>
                  <p className={css.label}>{props.t('autoRotate')}</p>
                  <p className={css.hint}>{props.t('autoRotateHint')}</p>
                </div>
                <Switch
                  label={props.t('autoRotate')}
                  checked={state.autoRotate}
                  disabled={disabled}
                  onChange={props.editAutoRotate}
                  onText={props.t('enabled')}
                  offText={props.t('disabled')}
                />
              </div>
            </div>
            <div className={css.field}>
              <div className={css.fieldHead}>
                <div>
                  <label className={css.label} htmlFor="breakpeek-rotation-interval">
                    {props.t('rotationInterval')}
                  </label>
                  <p className={css.hint}>{props.t('rotationIntervalHint')}</p>
                </div>
                <span className={css.numberField}>
                  <input
                    id="breakpeek-rotation-interval"
                    className={css.numberInput}
                    type="number"
                    min={MIN_ROTATION_INTERVAL_MS / 1000}
                    max={MAX_ROTATION_INTERVAL_MS / 1000}
                    step={1}
                    value={intervalSeconds}
                    disabled={disabled || !state.autoRotate}
                    onChange={(event) => {
                      const seconds = Number(event.currentTarget.value)
                      if (!Number.isFinite(seconds)) return
                      const milliseconds = Math.min(
                        MAX_ROTATION_INTERVAL_MS,
                        Math.max(MIN_ROTATION_INTERVAL_MS, Math.round(seconds * 1000)),
                      )
                      props.editRotationIntervalMs(milliseconds)
                    }}
                  />
                  <span>{props.t('seconds')}</span>
                </span>
              </div>
            </div>
            <div className={css.footer}>
              {state.failed ? <p className={css.failed} role="status">{props.t('saveFailed')}</p> : null}
              {state.overridden
                ? (
                  <>
                    <span className={css.badge}>{props.t('overridden')}</span>
                    <button type="button" className={css.reset} disabled={disabled} onClick={props.reset}>
                      {props.t('reset')}
                    </button>
                  </>
                )
                : null}
              <button type="button" className={css.discard} disabled={!state.dirty || state.saving} onClick={props.discard}>
                {props.t('discard')}
              </button>
              <button type="button" className={css.save} disabled={!state.dirty || state.saving} onClick={props.save}>
                {props.t(state.saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
    </li>
  )
}

interface SwitchProps {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
  onText: string
  offText: string
}

/** Render one accessible boolean setting. */
function Switch(props: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      className={props.checked ? `${css.switch} ${css.switchOn}` : css.switch}
      disabled={props.disabled}
      onClick={() => { props.onChange(!props.checked) }}
    >
      <span className={css.switchThumb} />
      <span className={css.switchText}>{props.checked ? props.onText : props.offText}</span>
    </button>
  )
}
