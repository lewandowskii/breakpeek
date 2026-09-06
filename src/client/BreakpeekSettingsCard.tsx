/** Breakpeek's card in the shared Plugins settings section. */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  MAX_ROTATION_INTERVAL_MS, MIN_ROTATION_INTERVAL_MS,
} from '../boot-config.ts'
import type { BreakpeekSettingsCardFace } from './settings-controller.ts'
import type { BREAKPEEK_SETTINGS_LOCALE } from './settings-locales.ts'
import css from './BreakpeekSettingsCard.module.css'

/** Props assembled for the Breakpeek settings card. */
export type BreakpeekSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<typeof BREAKPEEK_SETTINGS_LOCALE>
  & InjectFace<BreakpeekSettingsCardFace>

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
        <span className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} aria-hidden="true">⌄</span>
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
