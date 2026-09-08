/**
 * Package-owned invariant companion for `@runnerzhang/dsh-client-ui-breakpeek`.
 * @module @runnerzhang/dsh-client-ui-breakpeek/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@runnerzhang/dsh-client-ui-breakpeek'

/** Cordis companion plugin name. */
export const name = 'client-ui-breakpeek-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No additional runtime invariant: HTTP route, timers, requests, SQLite and
 * browser stores are all owned by labelled Cordis effects and are exercised
 * through lifecycle tests rather than a cross-plugin mutable-state assertion.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
