# 第三方库

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
