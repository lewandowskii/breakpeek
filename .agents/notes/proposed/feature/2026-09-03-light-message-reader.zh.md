# Agent Note: 插件内的轻讯息浮窗投递与阅读

Status: proposed

[English](2026-09-03-light-message-reader.md) | 中文

## Problem

讯息浮窗只有本地短文本，面试答案和新闻则需要持续阅读。会话活动与用户是否希望打开阅读器无关，组件局部偏好也无法支持持久化设置页。目标功能继续作为 Harness 插件提供。

## Proposal

[插件规范](../../../../SPEC.md) 定义产品行为、代码基线、设置和迭代计划。将宠物呈现替换为轻讯息阅读器，摘要在同一浮窗中展开。投递指为浮窗选择内容，不发送聊天消息，也不调用模型。

浮窗贡献到 root scope 的 `shell.overlay`，设置页贡献到 `settings.section`，两者共享同一个 root store。阅读器不观察会话活动。复用现有 settings namespace 与 scope 服务，包括其仅对 loopback 连接提供持久化的限制。

先完成完整本地内容、持久化打开状态、手动前后切换和可选定时轮转。当前原型同时通过 Cordis 插件配置和“设置 → 插件 → 插件配置”中的卡片提供 `visible`、`autoRotate` 和 `rotationIntervalMs`。Host 注册 `ui-breakpeek` 命名空间，以 Cordis 值作为组装默认层；保存后的可视化选择属于用户层，重置会删除这一层。由于 client Loader entry 不会自动收到宿主插件配置，Host 入口也将解析值注入浏览器启动文档。浏览器 settings scope 加载后取代该回退值，并将已保存的变化发布到当前页面。关闭按钮写入 `visible: false`，使浮窗和配置卡片共享同一个打开状态。自动轮转只改变当前讯息，不决定浮窗是否显示。等远程内容的生产者和消费者存在时再增加 provider。本提案遵循 Harness 的 slot 注册规则，不替代这些规则。

## Alternatives considered

**长期保留 DOM 查询 Portal 渲染。** 它让会话组件可以使用页面浮层，但渲染依赖没有公开约定的 DOM 查询和会话挂载。已声明的 root slot 提供直接的组合位置。

**根据会话静默状态控制可见性。** 这会把浮窗当成等待装饰，并使可用性依赖无关的 agent 活动。阅读器保持打开，直到用户主动关闭。

**开发独立应用或跳转详情页。** 两者都失去用户要求的原位插件体验，并增加导航或应用生命周期。

**本地阅读完成前先建立内容服务框架。** 当前只有一个生产者，先将本地职责放在功能包内，等独立 provider 确有需要时再建立完整的能力 seam。

## Acceptance criteria

需求文档的验收矩阵是实施检查清单。发布要求打开状态持久、手动与配置控制的自动轮转可靠、答案和文章原位展开、阅读稳定、设置反馈与连接所支持的持久化一致，以及完整的资源清理。验证可见交互、真实 Loader 组装和 keyless Web snapshot。GUI 行为 PR 包含真实服务 GIF；远程 provider 另外提供 provider 集成证据。

显示与轮转实现包含 Cordis schema、Host settings 命名空间、可视化配置卡片、Host 到浏览器的启动值、实时 client scope、组件行为、配置示例和聚焦测试用例。只有在用户授权执行相应检查后，才记录验证证据。

## Risks

当前原型仍从 session slot 进入，因此 root 和 session scope 不能共享同一个 store handle。浏览器对后台定时器的节流会推迟自动轮转，所以间隔表示最短延迟，不是实时调度。现有设置写入在内部恢复失败，仅 Promise fulfilled 不能证明偏好已保存。新闻可能没有全文；阅读器必须标明可取得的内容，不能用自动跳转代替原位详情。
