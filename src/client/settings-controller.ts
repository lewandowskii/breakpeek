/** Staged form state for the Breakpeek card in the shared plugin settings page. */

import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  type BreakpeekContentSource, type BreakpeekSettings, type ResolvedConfig, resolveConfig,
} from '../boot-config.ts'

const SETTINGS_FIELDS = ['visible', 'autoRotate', 'rotationIntervalMs', 'contentSources'] as const
type SettingsField = typeof SETTINGS_FIELDS[number]

/** Compare scalar settings and ordered source selections by value. */
function settingEquals(
  left: ResolvedConfig[SettingsField] | undefined,
  right: ResolvedConfig[SettingsField] | undefined,
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return left === right
}

/** State rendered by the Breakpeek settings card. */
export interface BreakpeekSettingsCardState extends ResolvedConfig {
  /** Whether the Host serves this settings namespace. */
  available: boolean
  /** Whether the current settings document accepts writes. */
  writable: boolean
  /** Whether at least one shown field would remain a user override after saving. */
  overridden: boolean
  /** Whether the card contains an unsaved edit or reset. */
  dirty: boolean
  /** Whether a settings write is in progress. */
  saving: boolean
  /** Whether the last requested values were not accepted. */
  failed: boolean
}

/** Business face injected into the Breakpeek settings card. */
export interface BreakpeekSettingsCardFace {
  hooks: {
    /** Card state bound by the renderer as `useBreakpeekSettingsCard`. */
    breakpeekSettingsCard: SnapshotStore<BreakpeekSettingsCardState>
  }
  /** Stage the panel's open state. */
  editVisible: (value: boolean) => void
  /** Stage automatic message rotation. */
  editAutoRotate: (value: boolean) => void
  /** Stage the automatic rotation interval in milliseconds. */
  editRotationIntervalMs: (value: number) => void
  /** Stage the local message libraries included in rotation. */
  editContentSources: (value: BreakpeekContentSource[]) => void
  /** Stage removal of all Breakpeek user overrides. */
  reset: () => void
  /** Persist the staged values. */
  save: () => void
  /** Drop the staged values. */
  discard: () => void
}

/** Controller for one Breakpeek settings scope. */
export class BreakpeekSettingsController {
  private readonly store: SnapshotStore<BreakpeekSettingsCardState>
  private readonly unsubscribe: () => void
  private draft: Partial<ResolvedConfig> = {}
  private resetPending = false
  private saving = false
  private failed = false

  /** @param scope - settings scope bound to the `ui-breakpeek` namespace. */
  constructor(private readonly scope: SettingsScope<BreakpeekSettings>) {
    this.store = createSnapshotStore(this.project())
    this.unsubscribe = scope.subscribe(() => { this.publish() })
  }

  private current(): ResolvedConfig {
    return resolveConfig(this.scope.getSnapshot().value)
  }

  private base(): ResolvedConfig {
    return resolveConfig(this.scope.getSnapshot().base as BreakpeekSettings | undefined)
  }

  private stored(field: SettingsField): boolean {
    const user = this.scope.getSnapshot().user as Record<string, unknown> | undefined
    return user !== undefined && Object.hasOwn(user, field)
  }

  private shown(): ResolvedConfig {
    return this.resetPending
      ? this.base()
      : { ...this.current(), ...this.draft }
  }

  private project(): BreakpeekSettingsCardState {
    const snapshot = this.scope.getSnapshot()
    const current = this.current()
    const shown = this.shown()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      ...shown,
      overridden: this.resetPending
        ? false
        : SETTINGS_FIELDS.some(field => Object.hasOwn(this.draft, field) || this.stored(field)),
      dirty: this.resetPending
        ? SETTINGS_FIELDS.some(field => this.stored(field))
        : SETTINGS_FIELDS.some(field => Object.hasOwn(this.draft, field)
          && !settingEquals(this.draft[field], current[field])),
      saving: this.saving,
      failed: this.failed,
    }
  }

  private publish(): void {
    this.store.set(this.project())
  }

  private edit<Field extends SettingsField>(field: Field, value: ResolvedConfig[Field]): void {
    const current = this.current()
    if (settingEquals(value, current[field])) {
      const next = { ...this.draft }
      delete next[field]
      this.draft = next
    } else {
      this.draft = { ...this.draft, [field]: value }
    }
    this.resetPending = false
    this.failed = false
    this.publish()
  }

  /** @returns the hook source and actions injected into the card. */
  inject(): BreakpeekSettingsCardFace {
    return {
      hooks: { breakpeekSettingsCard: this.store },
      editVisible: value => { this.edit('visible', value) },
      editAutoRotate: value => { this.edit('autoRotate', value) },
      editRotationIntervalMs: value => { this.edit('rotationIntervalMs', value) },
      editContentSources: value => { this.edit('contentSources', value) },
      reset: () => {
        this.draft = {}
        this.resetPending = true
        this.failed = false
        this.publish()
      },
      save: () => { void this.save() },
      discard: () => {
        this.draft = {}
        this.resetPending = false
        this.failed = false
        this.publish()
      },
    }
  }

  private async save(): Promise<void> {
    if (this.saving || !this.project().dirty) return
    const reset = this.resetPending
    const draft = { ...this.draft }
    this.saving = true
    this.failed = false
    this.publish()
    if (reset) {
      for (const field of SETTINGS_FIELDS) await this.scope.unset(field)
    } else {
      for (const field of SETTINGS_FIELDS) {
        if (Object.hasOwn(draft, field)) await this.scope.set(field, draft[field])
      }
    }
    const current = this.current()
    const landed = reset
      ? SETTINGS_FIELDS.every(field => !this.stored(field))
      : SETTINGS_FIELDS.every(field => !Object.hasOwn(draft, field)
        || (this.stored(field) && settingEquals(current[field], draft[field])))
    if (landed) {
      this.draft = {}
      this.resetPending = false
    }
    this.saving = false
    this.failed = !landed
    this.publish()
  }

  /** Stop observing the settings scope. */
  dispose(): void {
    this.unsubscribe()
  }
}
