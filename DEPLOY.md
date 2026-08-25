# GitHub Pages 部署说明

ShowArchive 是纯前端 PWA（无后端），可以直接用 GitHub Pages 静态托管。

## 前置准备

1. 把 `showarchive-app` 目录推送到一个 GitHub 仓库（分支名 `main`）。
2. `戏剧台词列表.md` 可以不放进仓库：启动页台词来自已提交的 `src/lib/quotes.ts`，构建会正常通过。
   若以后要更新台词，请在本地跑一次 `pnpm build`（构建前会自动重新生成），
   把更新后的 `src/lib/quotes.ts` 一起提交。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**（只需设置一次）。

## 自动部署

推送 `main` 分支后，`.github/workflows/deploy.yml` 会自动：

1. 安装依赖并构建（自动把仓库名作为子路径 base，如 `/my-repo/`）；
2. 生成 `404.html` 作为 SPA 兜底（子路由如 `/my-repo/shows/xxx` 直接刷新不会 404）；
3. 上传并部署到 GitHub Pages。

访问地址：`https://<用户名>.github.io/<仓库名>/`

## 本地验证子路径构建

```bash
BASE_PATH=/你的仓库名 pnpm build
pnpm preview
```

然后打开 `http://localhost:4173/你的仓库名/` 检查资源路径和路由是否正常。

## 注意事项

- PWA 安装后 Service Worker 的作用域是子路径 `/仓库名/`，与站点一致；
- 首次发布后如有旧版本缓存，强刷新（Cmd+Shift+R）一次即可；
- 更新台词后需提交新的 `src/lib/quotes.ts`；已安装的 PWA 需要更新版本后才会生效。
