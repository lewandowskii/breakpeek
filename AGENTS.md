# AGENTS.md

Breakpeek is an out-of-tree DeepSeek Harness Web plugin. Keep it independently installable and buildable; do not move its source back into the Harness monorepo or import repository-private build files.

## DeepSeek Harness reference

The complete DeepSeek Harness checkout is available at `../deepseek-harness`. Read its current documentation before changing integration behavior instead of duplicating Harness contracts in this project.

Start with these sources as applicable:

- `../deepseek-harness/docs/architecture.md` for plugin composition, events, profiles, and bundles.
- `../deepseek-harness/docs/cookbook/adding-a-settings-card.md` for Host settings namespaces and browser settings cards.
- `../deepseek-harness/packages/boot/app-boot/README.md` for out-of-tree package installation and Profile patches.
- `../deepseek-harness/packages/client/AGENTS.md` and `../deepseek-harness/packages/AGENTS.md` for Client plugin and package conventions.
- `../deepseek-harness/docs/defensive-patterns.md` before lifecycle, concurrency, cancellation, or teardown changes.

Treat the Harness checkout as reference material. Breakpeek owns its build configuration in `build/client-bundle.ts`; when Harness changes its lazy-CJS client module format, update the local implementation deliberately and record the supported Harness version in `package.json`.

## Project checks

Use `pnpm typecheck`, `pnpm test`, and `pnpm build` as the focused project checks. Follow the authorization rules in `SPEC.md` before running validation commands during future development.
