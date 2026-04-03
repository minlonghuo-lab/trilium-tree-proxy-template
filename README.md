<div align="center">

# trilium-tree-proxy-template

一个面向 **Cloudflare Workers** 的 **Trilium ETAPI 树结构代理模板**。

它可以把你的 Trilium 笔记树安全地转换成适合前端消费的公开 API，
用于博客知识树、About 页面、知识图谱、懒加载目录等场景，
同时**不暴露 `TRILIUM_ETAPI_TOKEN`**。

</div>

---

## 项目简介

如果你正在使用 Trilium 作为知识库或内容源，但又希望把其中一部分树结构安全地提供给前端页面使用，这个模板就是为这种需求准备的。

它的核心目标是：

- 通过 Cloudflare Workers 暴露一个公开可访问的只读树结构接口
- 将 Trilium 的 ETAPI Token 保留在服务端
- 为前端提供适合直接使用的数据结构
- 同时兼顾“树组件懒加载”和“知识图谱可视化”两类常见需求

一句话来说：

> 这是一个把 **Trilium 笔记树 → 前端友好 API** 的轻量代理模板。

---

## 功能特性

- 基于 **Cloudflare Workers**，部署轻量、成本低
- 服务端保存 `TRILIUM_ETAPI_TOKEN`，避免前端泄露凭证
- 支持两类输出模式：
  - **懒加载树结构**：适合目录树、折叠树、侧边栏导航
  - **知识图谱结构**：适合 Note Map、知识地图、关系图可视化
- 支持 **CORS**
- 支持 **缓存头控制**
- 支持 **节点过滤规则**
- 支持 **调试模式**，便于排查树结构抓取问题
- 使用 **TypeScript** 编写，便于二次开发

---

## 适用场景

这个模板适合以下场景：

- 博客中的 **知识树 / 笔记树** 页面
- About 页面中的 **知识地图**
- 基于 Trilium 的公开导航目录
- 大体量笔记树的 **按需懒加载**
- 需要将 Trilium 内容接入前端图谱可视化系统

---

## 可用接口

### `GET /`
返回基础服务信息。

### `GET /healthz`
健康检查接口，可用于监控与探活。

### `GET /api/trilium-tree`
返回**一层懒加载树结构**。

适合：
- 前端树组件
- 展开式目录树
- 侧边栏知识导航

支持的查询参数：
- `rootNoteId`：指定根节点
- `debug=1`：返回调试信息

### `GET /api/note-map/tree`
返回更适合**知识图谱 / Note Map** 使用的结构。

适合：
- 知识地图页面
- 图谱可视化
- 节点关系展示系统

典型返回字段包括：
- `notes`
- `links`
- `noteIdToDescendantCountMap`
- `rootNoteId`
- `generatedAt`

---

## 当前过滤规则

模板默认会过滤掉一些不适合公开展示的节点：

- `noteId` 以 `_` 开头的系统隐藏节点
- 带有 `excludeFromNoteMap` label 的节点
- 在后代统计中对 `imageLink` relation 做特殊处理
- 图谱模式下支持读取 `color` label 作为可视化元数据

这使得你可以在 Trilium 中保留内部结构，同时更干净地输出公开树结构。

---

## 环境变量

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `TRILIUM_BASE_URL` | 是 | Trilium 服务地址，例如 `https://trilium.example.com` |
| `TRILIUM_ETAPI_TOKEN` | 是 | Trilium ETAPI Token |
| `ROOT_NOTE_ID` | 否 | 默认根节点 ID |
| `ALLOW_ORIGIN` | 否 | 允许的跨域来源，默认 `*` |
| `CACHE_MAX_AGE` | 否 | 缓存秒数，默认 `300` |
| `MAP_MAX_NODES` | 否 | 图谱模式最大节点数 |

> 注意：当前实现**没有使用** `MAX_DEPTH`。

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备本地环境变量

根据示例文件创建本地开发配置：

```bash
cp .dev.vars.example .dev.vars
```

然后填入真实值：

```dotenv
TRILIUM_BASE_URL=https://your-trilium.example.com
TRILIUM_ETAPI_TOKEN=replace_me
```

### 3. 启动本地开发

```bash
npm run dev
```

### 4. 类型检查

```bash
npm run check
```

---

## 部署

### 部署到 Cloudflare Workers

```bash
wrangler login
wrangler secret put TRILIUM_ETAPI_TOKEN
wrangler deploy
```

如需配置非敏感变量，可在 `wrangler.jsonc` 或 Cloudflare Dashboard 中设置。

---

## 示例请求

### 获取懒加载树结构

```bash
curl 'https://your-worker.example.com/api/trilium-tree?rootNoteId=xxxxxxxx'
```

### 获取知识图谱结构

```bash
curl 'https://your-worker.example.com/api/note-map/tree?rootNoteId=xxxxxxxx'
```

### 开启调试模式

```bash
curl 'https://your-worker.example.com/api/trilium-tree?debug=1'
```

---

## 项目结构

```text
.
├── index.ts           # Worker 入口与 API 实现
├── package.json       # npm 脚本与依赖
├── wrangler.jsonc     # Cloudflare Workers 配置
├── .dev.vars.example  # 本地环境变量示例
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

## 安全说明

- 不要把 `TRILIUM_ETAPI_TOKEN` 暴露给浏览器端。
- 生产环境建议将 `ALLOW_ORIGIN` 设置为明确域名，而不是 `*`。
- 在公开接口前，建议先检查 Trilium 中的隐藏节点与过滤标签是否配置正确。
- 敏感变量应通过 Cloudflare Secrets 管理。

---

## 适合哪些人使用

如果你符合下面这些情况，这个模板会很合适：

- 你把 **Trilium 作为内容源 / 知识源**
- 你希望公开一个 **只读树结构 API**
- 你使用 **Cloudflare Workers** 部署边缘服务
- 你希望从模板快速起步，而不是从零手写代理层

---

## License

本项目遵循仓库中的开源许可证。

如果这个模板对你有帮助，欢迎 fork 后按自己的前端结构和过滤规则继续扩展。