# @runnerzhang/dsh-client-ui-breakpeek

[English](README.md) | 中文

Breakpeek 是 Harness Web GUI 的常驻轻讯息浮窗插件。Host 可从签名的远程目录同步面试题、笑话和技术提示，并用 SQLite 保存最近有效版本；浏览器只读取同源 Host API，不持有发布凭据。[SPEC](SPEC.md) 定义原位阅读器、内容来源和迭代计划。

浏览器插件将 `breakpeek` 注册到 session scope 的 `conversation.input.overlay` slot，通过 Portal 将内容渲染到框架的 `[data-shell-overlay]` 层。它还向**设置 → 插件 → 插件配置**贡献一张 **Breakpeek** 卡片。Node 入口校验 Cordis 配置，注册 `ui-breakpeek` Host settings 命名空间，并将解析后的设置写入浏览器启动文档。

浮窗不检查会话活动，也不等待静默阈值。`visible` 是持久化的打开状态；关闭按钮写入 `visible: false`，用户可从可视化设置卡片重新打开。拖动操作区中间无标记的空白区域可调整浮窗位置，移动范围限制在当前可视页面内；该区域获得焦点后也可用方向键移动。含 `detail` 字段的讯息会显示展开箭头，并打开可独立滚动的详情。详情默认向上展开；如果顶部将超出可视范围，则自动改为向下展开。仅有预览的讯息保持普通文本。详情展开时暂停自动轮转，收起后从一个完整的 `rotationIntervalMs` 重新计时；前后按钮会先收起详情再立即切换。`contentSources` 决定手动与自动轮转使用哪些动态资料库。远端不可用时依次使用 SQLite 缓存和插件内置内容。

## 安装

正式包发布后，可将预构建的 npm 组合包安装到 DSH Web Profile：

```sh
dsh plugin --profile web add @runnerzhang/dsh-client-ui-breakpeek
dsh web
```

Breakpeek 声明了 `dsh.bundle` 配置层，因此 `dsh plugin` 会同时把 npm 依赖和 bundle 条目加入指定 Profile。删除时执行：

```sh
dsh plugin --profile web remove @runnerzhang/dsh-client-ui-breakpeek
```

## 配置

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
    contentCatalogUrl: https://content.example.com/production/manifest.json
    contentPublicKeys:
      production-2026: |-
        -----BEGIN PUBLIC KEY-----
        REPLACE_WITH_THE_TRUSTED_ED25519_PUBLIC_KEY
        -----END PUBLIC KEY-----
    allowUnsignedContent: false
    contentRefreshIntervalMs: 21600000
    contentRequestTimeoutMs: 10000
```

远程目录必须使用 HTTPS。Host 会验证 Manifest 的 Ed25519 签名和每个 NDJSON 文件的 SHA-256；私钥只应放在内容仓库的 GitHub Actions Secret 中。开发期可临时使用 `allowUnsignedContent: true`，正式发布必须关闭。缓存默认位于 `$DSH_HOME/storages/breakpeek-content.sqlite`。

Host 提供 `/breakpeek/api/v1/catalog`、`/breakpeek/api/v1/items` 和 `/breakpeek/api/v1/status` 三个只读同源接口。默认每 6 小时检查远端，浏览器每 15 分钟或窗口重新获得焦点时刷新 Host 内容状态。

可视化的**显示讯息框**、**自动轮转讯息**、**轮转讯息来源**和**轮转间隔**字段编辑同一组设置。讯息来源是至少保留一项的多选配置。Cordis 配置值是部署默认层；保存后的可视化选择成为 Host 设置文档中的用户覆盖层，在当前页面生效，并在刷新后保留。点击**恢复部署默认值**会删除四个字段的覆盖。

### 内容同步与降级链路

Host 获取 HTTPS Manifest 后先验证 Ed25519 签名，再下载清单列出的 NDJSON 来源文件，并逐个校验字节数和 SHA-256。危险路径、重复 ID、过期内容、原始 HTML、超限正文和字段格式错误都会被拒绝；同步失败不会覆盖最近一次有效修订。

通过验证的内容默认写入 `$DSH_HOME/storages/breakpeek-content.sqlite`。启动或网络异常时优先使用最近有效的 SQLite 快照；不存在有效快照时，浏览器才使用插件内置的小型兜底内容池。三个同源接口的职责分别是：

- `/breakpeek/api/v1/catalog`：资料库定义和当前修订。
- `/breakpeek/api/v1/items`：经过筛选和分页的讯息对象。
- `/breakpeek/api/v1/status`：同步、缓存与降级状态。

Host 默认每 6 小时检查新修订；浏览器每 15 分钟以及窗口重新获得焦点时向 Host 刷新。R2 发布凭据和内容签名私钥始终留在内容仓库的发布环境中，不会进入插件包或浏览器 bundle。

## 开发与验证流程

Breakpeek 自行维护 TypeScript、测试和 tsdown 配置，不引用 DeepSeek Harness 仓库内的构建文件。首次开发时在本项目目录安装依赖：

```sh
cd /Users/runner/coding/breakpeek
pnpm install
```

修改 `src/` 下的代码后，按以下顺序执行包级检查：

```sh
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` 会将 `src/` 编译到 `lib/types/`，生成 `lib/index.js` 和 `lib/invariant.js` 两个 Host 入口，并将 `lib/client.js` 包装为延迟执行的模块加载器 factory。Harness 实际执行 `lib/` 下的文件；生产验证仍需先重新构建，再依据 Web UI 判断行为。

单元测试将已发布的延迟 Client Runtime bundle 映射到项目内的 store fixture。该方式复现 Harness monorepo 的源码 alias，避免 Vitest 直接执行依赖浏览器 ModuleLoader 的包装产物。

### 将本地项目链接到 DSH Profile

先构建 Breakpeek，再从同级 DeepSeek Harness 项目目录执行 Profile 插件命令：

```sh
cd /Users/runner/coding/breakpeek
pnpm build

cd /Users/runner/coding/deepseek-harness
pnpm dsh plugin --profile web add link:../breakpeek
```

该命令把文件系统链接写入 `web` Profile，不会把 Breakpeek 重新加入 Harness workspace。Profile 位于 `$DSH_HOME/profiles/web`；没有设置 `DSH_HOME` 时，默认位置是 `~/.dsh/profiles/web`。Breakpeek 声明了 `dsh.bundle`，因此命令还会把本包加入 Profile 的 bundle 列表，并应用 `cordis.patch.yml`。

启动 UI 前先检查最终组合配置：

```sh
cd /Users/runner/coding/deepseek-harness
pnpm dsh web --dump-config | rg -n "ui-breakpeek|dsh-client-ui-breakpeek"
pnpm dsh web
```

后续修改源码时不需要重新建立链接。Harness Web bundle 已经挂载 `@deepseek-ai/dsh-client-hmr`；开发时在另一个终端启动 Breakpeek 自己的 bundle watcher：

```sh
cd /Users/runner/coding/breakpeek
pnpm dev
```

`pnpm dev` 会先生成本包所需的 TypeScript 产物，再由 `tsdown --watch` 持续监听 `src/client/`、CSS Modules 及其导入依赖，并重写 `lib/client.js`。运行中的 Harness 会轮询该 bundle，通过 `/plugins/events` SSE 通知浏览器依次卸载旧 Fiber、移除旧样式并挂载新版本，无需刷新页面。热替换会重建组件，组件本地 React 状态不会保留。

这个开发链路只热替换浏览器插件。修改 `src/index.ts`、`src/invariant.ts`、`cordis.patch.yml`、`package.json` 或其他 Host／Profile 内容后，先停止 watcher，运行 `pnpm build`，再重启 `pnpm dsh web`。不要让 `pnpm dev` 与 `pnpm build` 并发写入同一个 `lib/` 目录。若保存浏览器源码后没有更新，应同时确认 Breakpeek watcher 仍在输出重建日志，并确认当前页面由同一个启用了 `dsh-client-hmr` 的 Web Profile 进程提供。

如需从 Profile 移除本地插件，执行：

```sh
cd /Users/runner/coding/deepseek-harness
pnpm dsh plugin --profile web remove @runnerzhang/dsh-client-ui-breakpeek
```

包级检查证明编译和组件行为，配置 dump 证明 Profile 已完成组合。最终集成验证仍需打开真实 Harness Web UI，检查浮窗以及**设置 → 插件 → 插件配置**中的 Breakpeek 卡片。

按照 [SPEC.md](SPEC.md) 的项目约束，可以直接进行 UI 人工检查。构建、自动化测试、Client 测试、文档检查和 GUI 测试需要先取得用户同意，除非当前任务已经明确授权。修改运行时代码后，必须提醒用户先执行 `pnpm build`，否则 UI 结果不能代表最新源码。

## Model Experience

### 仅界面展示

#### What the model sees

无。远程、缓存或内置讯息都只用于界面展示，不向模型请求添加消息、工具或提示词段落。

#### Token effect

零。展示和轮换远程、缓存或内置内容都不会发送模型请求。

#### KV Cache effect

无。插件不改变模型请求内容，不会使可复用的请求前缀失效。

## 已知限制与后续工作

- **生产内容入口：** 当前 bundle 默认使用已签名的 R2 staging 目录；稳定版发布前需切换到生产自定义域名和 production 签名公钥。
- **更新时效：** 远程内容采用定时轮询，不是实时推送。
- **SQLite 运行时：** 最近有效缓存依赖 Node 内置的 `node:sqlite`，受支持的 Node 版本仍会提示该 API 处于 experimental 状态。
- **发布配置：** R2 Bucket、公开读取地址、私钥和 GitHub Environment 由部署者维护，不随 npm 包分发。
- **浮层依赖：** 组件通过 DOM 属性寻找容器；容器缺失时不渲染。
