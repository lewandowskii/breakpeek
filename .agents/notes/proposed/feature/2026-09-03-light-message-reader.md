# Agent Note: Lightweight message delivery and reading in a floating plugin

Status: proposed

English | [中文](2026-09-03-light-message-reader.zh.md)

## Problem

The message widget has only short local copy, while interview answers and news require sustained reading. Conversation activity is unrelated to whether the user wants the reader open, and component-local preferences cannot support a durable settings page. The requested feature remains a Harness plugin.

## Proposal

The [plugin specification](../../../../SPEC.md) defines the product behavior, source baseline, settings, and iteration plan. Replace the pet presentation with a lightweight message reader whose summary expands in the same floating panel. Delivery means selecting content for that panel; it does not send a chat message or invoke a model.

Contribute the floating UI to root-scoped `shell.overlay` and its settings page to `settings.section`. Share one root store between those entries. The reader does not observe session activity. Reuse the existing settings namespace and scope services, including their loopback persistence limitation.

Start with complete local content, a persistent open state, manual previous and next actions, and optional timed rotation. The prototype exposes `visible`, `autoRotate`, and `rotationIntervalMs` through Cordis configuration and a card in Settings → Plugins → Plugin configuration. The Host registers `ui-breakpeek` with the Cordis values as its composition base; saved visual choices form the user layer, and reset removes that layer. Its Host entry also injects the resolved values into the browser boot document because client Loader entries do not receive Host plugin configuration automatically. The browser settings scope replaces that bootstrap fallback once loaded and publishes saved changes to the current page. The close button writes `visible: false`, so the floating panel and configuration card share one open state. Automatic rotation changes only the selected message and never determines visibility. Add remote providers only when their producers and consumers exist. This proposal follows the Harness slot registration rules and does not replace them.

## Alternatives considered

**Keep the DOM-query Portal as the permanent rendering path.** It gives a session component access to the page overlay, but couples rendering to an undocumented DOM lookup and to conversation mounting. The declared root slot provides a direct composition point.

**Tie visibility to conversation silence.** This uses the panel as waiting decoration and makes its availability depend on unrelated agent activity. The reader remains open until the user closes it.

**Build a standalone application or navigate to a detail page.** Both lose the requested in-context plugin experience and require another navigation or application lifecycle.

**Build a content service framework before local reading works.** There is only one current producer. Keep local responsibilities inside the feature package until independent providers justify a complete capability seam.

## Acceptance criteria

The requirement document's acceptance matrix is the implementation checklist. Release requires a durable open state, manual and configured automatic rotation, in-place answers and articles, reading stability, settings feedback and persistence appropriate to the connection, and complete teardown. Validate visible interactions, real Loader composition, and a keyless Web snapshot. A GUI behavior PR includes a real-server GIF; remote providers additionally require provider integration evidence.

The display and rotation implementation includes its Cordis schema, Host settings namespace, visual configuration card, Host-to-browser bootstrap value, live client scope, component behavior, configuration examples, and focused test cases. Validation evidence is recorded only after the user authorizes the requested checks.

## Risks

Root and session scopes cannot share one store handle while the prototype still enters through a session slot. Browser timer throttling can delay automatic rotation, so the interval is a minimum delay rather than a real-time schedule. Existing settings writes recover failures internally, so Promise fulfillment alone cannot certify a saved preference. News may lack full text; the reader must label the available content and never substitute automatic navigation for inline details.
