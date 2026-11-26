# 第三方库

## Wappalyzer

站点信息使用 Wappalyzer 6.10.20 的 MIT 版本。目录中的 `wappalyzer/core.js` 来自发布包的 `wappalyzer.js`，只增加了 ES 模块导出。`generators.js` 摘取了 144 项公开的生成器声明规则，省略版本提取。原始版权声明见 [LICENSE](wappalyzer/LICENSE)。[上游发布包](https://www.npmjs.com/package/wappalyzer/v/6.10.20)

Phantom 补充的 DOM、脚本、样式和 WordPress 主题规则在 [SiteFingerprints.js](../src/ui/SiteFingerprints.js)。主题的父子关系采用 WordPress 公开的页面标记。[WordPress 文档](https://developer.wordpress.org/reference/functions/get_body_class/)

## acorn.min.js

AST 解析器需要 acorn 库。请按以下步骤下载：

### 下载方式

1. **直接下载**（推荐）：
   - 访问 https://cdn.jsdelivr.net/npm/acorn@8.11.3/dist/acorn.min.js
   - 保存为 `libs/acorn.min.js`

2. **使用 npm**：
   ```bash
   npm pack acorn
   tar -xf acorn-*.tgz
   cp package/dist/acorn.min.js libs/
   rm -rf package acorn-*.tgz
   ```

3. **使用 curl**：
   ```bash
   curl -o libs/acorn.min.js https://cdn.jsdelivr.net/npm/acorn@8.11.3/dist/acorn.min.js
   ```

### 版本要求

- 推荐版本：8.11.3 或更高
- 最低版本：8.0.0

### 验证安装

下载后，在浏览器控制台中运行：
```javascript
console.log(acorn.version); // 应显示版本号
```
