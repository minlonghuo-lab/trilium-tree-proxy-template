<div align="center">

# trilium-tree-proxy Template

一个部署在 **Cloudflare Workers** 的 Trilium ETAPI 树结构代理模板。

适用于：
- 前端懒加载树结构
- `/about` 页面知识地图
- 图谱可视化前的数据代理层

</div>

---

## 项目简介

这个模板仓库用于快速搭建一个 Trilium 树结构代理服务。

根据当前实现，它支持两种主要输出模式：

1. **懒加载一层树结构**：用于前端逐层展开节点
2. **树图兼容结构**：用于知识地图 / 图谱可视化

它的核心目标是：

> 在不暴露 `TRILIUM_ETAPI_TOKEN` 的前提下，把 Trilium 的笔记树结构提供给前端项目使用。

---

## 当前实现能力

### 支持的接口
- `GET /`
- `GET /healthz`
- `GET /api/trilium-tree`
- `GET /api/note-map/tree`

### 支持的查询参数
- `rootNoteId`
- `debug=1`

### 支持的特性
- CORS
- 缓存头
- 节点过滤
- 图谱兼容输出
- 调试信息输出

---

## 模式说明

### 1. `/api/trilium-tree`
返回懒加载一层树结构，适合：
- 前端树组件
- About 页面展开式知识树
- 大规模笔记树的按需加载

### 2. `/api/note-map/tree`
返回更适合图谱可视化的结构，适合：
- Note Map 风格页面
- 节点关系图
- 前端图谱布局系统

返回核心字段包括：
- `notes`
- `links`
- `noteIdToDescendantCountMap`
- `rootNoteId`
- `generatedAt`

---

## 过滤规则

当前模板代码包含以下规则：

- 忽略 `_` 前缀系统隐藏节点
- 忽略带 `excludeFromNoteMap` label 的节点
- 在后代统计中对 `imageLink` 关系做特殊处理
- 树图模式下支持读取 `color` label

---

## 环境变量

| 变量名 | 说明 |
|---|---|
| `TRILIUM_BASE_URL` | Trilium 服务地址 |
| `TRILIUM_ETAPI_TOKEN` | Trilium ETAPI Token |
| `ROOT_NOTE_ID` | 默认根节点 ID |
| `ALLOW_ORIGIN` | 允许跨域来源 |
| `CACHE_MAX_AGE` | 缓存秒数 |
| `MAP_MAX_NODES` | 图谱模式最大节点数 |

> 注意：当前模板代码不使用 `MAX_DEPTH`。

---

## 本地开发

```bash
npm install
npm run dev
npm run check
```

本地变量示例见：
- `.dev.vars.example`

---

## 部署

```bash
wrangler login
wrangler secret put TRILIUM_ETAPI_TOKEN
wrangler deploy
```

---

## 适用场景

- 个人博客 About 页面知识地图
- Trilium 笔记树前端组件
- 与 `longblog-template` 等前端模板联动
- 与独立自动化服务仓库配合使用

---

## 一句话总结

`trilium-tree-proxy Template` 是一个基于 Cloudflare Workers 的 Trilium 树结构代理模板，可同时服务于前端树组件和知识图谱场景。
