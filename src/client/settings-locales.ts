/** Copy owned by the Breakpeek plugin configuration card. */

/** Locale namespace for the card. */
export const BREAKPEEK_SETTINGS_LOCALE = 'settings.breakpeek'

/** English card copy. */
export const en = {
  title: 'Breakpeek',
  description: 'Controls the lightweight message panel and its rotation.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  visible: 'Show message panel',
  visibleHint: 'Open or close the floating message panel.',
  autoRotate: 'Rotate messages automatically',
  autoRotateHint: 'Advance to the next message on a timer.',
  rotationInterval: 'Rotation interval',
  rotationIntervalHint: 'Choose how often the next message appears.',
  seconds: 'seconds',
  enabled: 'On',
  disabled: 'Off',
  overridden: 'Overridden',
  reset: 'Reset to deployment default',
  readOnly: 'This deployment stores settings read-only.',
  unsaved: 'Unsaved',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept this value.',
} as const

/** Card locale keys. */
export type BreakpeekSettingsLocaleKey = keyof typeof en

/** Simplified Chinese card copy. */
export const zh: Record<BreakpeekSettingsLocaleKey, string> = {
  title: 'Breakpeek',
  description: '设置轻讯息浮窗的显示和轮转。',
  expand: '展开设置',
  collapse: '收起设置',
  visible: '显示讯息框',
  visibleHint: '打开或关闭悬浮讯息框。',
  autoRotate: '自动轮转讯息',
  autoRotateHint: '按设定时间自动切换到下一条讯息。',
  rotationInterval: '轮转间隔',
  rotationIntervalHint: '设置自动显示下一条讯息的时间频率。',
  seconds: '秒',
  enabled: '已开启',
  disabled: '已关闭',
  overridden: '已覆盖',
  reset: '恢复部署默认值',
  readOnly: '本部署的设置为只读。',
  unsaved: '未保存',
  discard: '放弃修改',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这个值。',
}
