# @runnerzhang/dsh-client-ui-breakpeek

English | [中文](README.zh.md)

Breakpeek is a persistent floating message widget for the Harness Web GUI. Its Host can synchronize a signed remote catalog, retain the last-known-good revision in SQLite, and expose validated content through a same-origin read-only API; the browser never receives publishing credentials. The [SPEC](SPEC.md) defines the inline reader, content sources, and iteration plan.

The browser plugin registers `breakpeek` into the session-scoped `conversation.input.overlay` slot and portals its content into the frame's `[data-shell-overlay]` layer. It also contributes a **Breakpeek** card to **Settings → Plugins → Plugin configuration**. The Node entry validates Cordis configuration, registers the `ui-breakpeek` Host settings namespace, and publishes the resolved settings in the browser boot document.

The panel does not inspect conversation activity or wait for a silence threshold. `visible` is its persisted open state. The close button writes `visible: false`, and the visual settings card can open it again. Drag the unmarked space in the header to reposition the panel; pointer movement is clamped to the visible viewport, and the focused drag area also accepts arrow keys. Messages with a `detail` field show an expand arrow and open an independently scrollable detail area. Details normally open above the panel, but switch below it when the upper edge would leave the viewport. Preview-only messages remain plain text. Expanded details pause automatic rotation. Collapsing restarts a complete `rotationIntervalMs`, while the previous and next buttons collapse any open detail and switch immediately. `contentSources` selects which dynamic libraries participate in both manual and automatic rotation. Remote failure falls back to the SQLite cache and then the built-in pool.

```yaml
- name: '@runnerzhang/dsh-client-ui-breakpeek'
  config:
    visible: true
    autoRotate: true
    rotationIntervalMs: 7000
    contentSources:
      - light-jokes
      - interview-general
      - interview-frontend
      - interview-backend
      - tech-trends
      - interview-ai
      - life-knowledge
      - coding-tips
```

The visual **Show message panel**, **Rotate messages automatically**, **Message sources**, and **Rotation interval** fields edit the same settings. Message sources are a multi-select with at least one library retained. Cordis values are the deployment base; saved visual choices become user overrides in the Host settings document, take effect on the current page, and survive reloads. **Reset to deployment default** removes all four overrides.

## Development and validation

Breakpeek owns its TypeScript, test, and tsdown configuration. It does not import build files from the DeepSeek Harness repository. Install dependencies once from this project directory:

```sh
cd /Users/runner/coding/breakpeek
pnpm install
```

After changing code under `src/`, run the focused checks in this order:

```sh
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` compiles `src/` into `lib/types/`, emits the Host entries at `lib/index.js` and `lib/invariant.js`, and wraps `lib/client.js` as a lazy module-loader factory. Harness executes files under `lib/`; production validation still requires a rebuild before judging behavior in the Web UI.

Unit tests alias the published lazy Client Runtime bundle to a package-local store fixture. This mirrors the source alias used by the Harness monorepo without loading the browser ModuleLoader wrapper in Vitest.

### Link this checkout into a local DSH profile

Build Breakpeek first, then run the profile command from the sibling DeepSeek Harness checkout:

```sh
cd /Users/runner/coding/breakpeek
pnpm build

cd /Users/runner/coding/deepseek-harness
pnpm dsh plugin --profile web add link:../breakpeek
```

The command writes a filesystem link into the `web` profile rather than adding Breakpeek back to the Harness workspace. The profile lives under `$DSH_HOME/profiles/web`, or `~/.dsh/profiles/web` when `DSH_HOME` is unset. Breakpeek declares `dsh.bundle`, so the command also adds this package to the profile's bundle list and applies `cordis.patch.yml`.

Inspect the composed configuration before starting the UI:

```sh
cd /Users/runner/coding/deepseek-harness
pnpm dsh web --dump-config | rg -n "ui-breakpeek|dsh-client-ui-breakpeek"
pnpm dsh web
```

After later source changes, the existing link remains valid. The Harness Web bundle already mounts `@deepseek-ai/dsh-client-hmr`; during development, start Breakpeek's own bundle watcher in another terminal:

```sh
cd /Users/runner/coding/breakpeek
pnpm dev
```

`pnpm dev` first emits the TypeScript artifacts needed by this package, then `tsdown --watch` watches `src/client/`, CSS Modules, and their imported dependencies and rewrites `lib/client.js`. The running Harness process polls that bundle and uses `/plugins/events` SSE to tell the browser to unload the old fiber, remove its owned styles, and mount the rebuilt plugin without a page refresh. A hot swap creates a fresh component, so component-local React state is not preserved.

This development path hot-swaps only the browser plugin. After changing `src/index.ts`, `src/invariant.ts`, `cordis.patch.yml`, `package.json`, or other Host/Profile inputs, stop the watcher, run `pnpm build`, and restart `pnpm dsh web`. Do not run `pnpm dev` and `pnpm build` concurrently because both write the same `lib/` directory. If a browser source edit does not appear, confirm both that the Breakpeek watcher is still reporting rebuilds and that the current page is served by the same Web Profile process with `dsh-client-hmr` enabled.

Remove the local plugin from the profile with:

```sh
cd /Users/runner/coding/deepseek-harness
pnpm dsh plugin --profile web remove @runnerzhang/dsh-client-ui-breakpeek
```

Package checks prove compilation and component behavior. The config dump proves Profile composition. Final integration validation still requires opening the actual Harness Web UI and checking the floating panel and **Settings → Plugins → Plugin configuration** card.

Per the project rule in [SPEC.md](SPEC.md), UI inspection may run directly. Builds, automated tests, Client tests, documentation checks, and GUI tests require the user's permission unless the current request explicitly authorizes them. After changing runtime code, always tell the user that `pnpm build` is required before UI results can represent the new source.

## Model Experience

### Local display

#### What the model sees

Nothing. Remote or fallback text is presentation-only; the plugin does not add messages, tools, or prompt sections to model requests.

#### Token effect

Zero. Displaying and rotating local content sends no model request.

#### KV Cache effect

None. The plugin does not change model request content or invalidate a reusable request prefix.

## Known Limitations and Deferred Work

- **Local content only:** message objects support previews and optional inline details, but remote content sources are still deferred in the SPEC.
- **Overlay dependency:** the component finds its host by DOM attribute; an absent host renders nothing.
