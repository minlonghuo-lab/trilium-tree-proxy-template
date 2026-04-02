# trilium-tree-proxy Template

一个部署在 **Cloudflare Workers** 的 Trilium ETAPI 树结构代理模板。

适用于：
- 前端懒加载树结构
- `/about` 页面知识地图
- 前端图谱可视化前的数据中间层

## 能力概览

- `/api/trilium-tree`：返回懒加载一层树结构
- `/api/note-map/tree`：返回适合图谱渲染的树图兼容结构
- 健康检查：`/` 与 `/healthz`
- 支持 `rootNoteId` 覆盖根节点
- 支持 `debug=1` 返回调试信息
- 支持 CORS 和缓存头

## 环境变量

| 变量名 | 说明 |
|---|---|
| `TRILIUM_BASE_URL` | Trilium 服务地址 |
| `TRILIUM_ETAPI_TOKEN` | Trilium ETAPI Token |
| `ROOT_NOTE_ID` | 默认根节点 ID |
| `ALLOW_ORIGIN` | 允许跨域来源 |
| `CACHE_MAX_AGE` | 缓存秒数 |
| `MAP_MAX_NODES` | 图谱模式最大节点数 |

## 本地开发
```bash
npm install
npm run dev
npm run check
```

## 部署
```bash
wrangler login
wrangler secret put TRILIUM_ETAPI_TOKEN
wrangler deploy
```

## 说明

这个仓库是模板版，不包含真实 token，也不绑定任何具体 Trilium 实例地址。
