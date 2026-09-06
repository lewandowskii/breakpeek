# @deepseek-ai/dsh-client-ui-breakpeek

English | [中文](README.zh.md)

Breakpeek is a persistent floating message widget for the Harness Web GUI. It displays local interview questions, jokes, and technical tips without network requests or credentials. The [SPEC](SPEC.md) defines the proposed inline reader, content sources, and iteration plan.

The browser plugin registers `breakpeek` into the session-scoped `conversation.input.overlay` slot and portals its content into the frame's `[data-shell-overlay]` layer. It also contributes a **Breakpeek** card to **Settings → Plugins → Plugin configuration**. The Node entry validates Cordis configuration, registers the `ui-breakpeek` Host settings namespace, and publishes the resolved settings in the browser boot document.

The panel does not inspect conversation activity or wait for a silence threshold. `visible` is its persisted open state. The close button writes `visible: false`, and the visual settings card can open it again. The previous and next buttons always change the current local message. `autoRotate` optionally advances messages every `rotationIntervalMs`; the default interval is 7000ms.

```yaml
- name: '@deepseek-ai/dsh-client-ui-breakpeek'
  config:
    visible: true
    autoRotate: true
    rotationIntervalMs: 7000
```

The visual **Show message panel**, **Rotate messages automatically**, and **Rotation interval** fields edit the same settings. Cordis values are the deployment base; saved visual choices become user overrides in the Host settings document, take effect on the current page, and survive reloads. **Reset to deployment default** removes all three overrides.

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

`pnpm build` compiles `src/` into `lib/types/`, emits the Host entries at `lib/index.js` and `lib/invariant.js`, and wraps `lib/client.js` as a lazy module-loader factory. Harness executes files under `lib/`; editing `src/` alone does not update the running plugin. Rebuild before judging behavior in the Web UI.

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

After later source changes, the existing link remains valid. Run `pnpm build` again in Breakpeek, restart `pnpm dsh web` when Host code or configuration changed, and refresh the browser. A browser-only change also requires a rebuilt `lib/client.js`; restarting the server is the reliable default because it reloads both halves.

Remove the local plugin from the profile with:

```sh
cd /Users/runner/coding/deepseek-harness
pnpm dsh plugin --profile web remove @deepseek-ai/dsh-client-ui-breakpeek
```

Package checks prove compilation and component behavior. The config dump proves Profile composition. Final integration validation still requires opening the actual Harness Web UI and checking the floating panel and **Settings → Plugins → Plugin configuration** card.

Per the project rule in [SPEC.md](SPEC.md), UI inspection may run directly. Builds, automated tests, Client tests, documentation checks, and GUI tests require the user's permission unless the current request explicitly authorizes them. After changing runtime code, always tell the user that `pnpm build` is required before UI results can represent the new source.

## Model Experience

### Local display

#### What the model sees

Nothing. The plugin renders local text from `BREAKPEEK_TIPS`; it does not add messages, tools, or prompt sections to model requests.

#### Token effect

Zero. Displaying and rotating local content sends no model request.

#### KV Cache effect

None. The plugin does not change model request content or invalidate a reusable request prefix.

## Known Limitations and Deferred Work

- **Summary-only content:** inline details and remote sources are proposed in the SPEC and are not implemented.
- **Overlay dependency:** the component finds its host by DOM attribute; an absent host renders nothing.
