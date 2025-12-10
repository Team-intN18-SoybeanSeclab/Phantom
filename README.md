<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom">
    <img src="icons/icon128.png" alt="Logo" width="80" height="80">
  </a>

  <h1 align="center">幻影 (Phantom)</h1>

  <p align="center">
    🚀 新一代SRC漏洞挖掘浏览器扩展
    <br />
    <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom"><strong>📖 探索文档 »</strong></a>
    <br />
    <br />
    <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom/issues">🐛 报告Bug</a>
    ·
    <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom/issues">✨ 请求功能</a>
  </p>
</div>

<!-- ABOUT THE PROJECT -->
## 🎯 关于幻影

幻影是一款专为SRC漏洞挖掘场景设计的**浏览器扩展工具**，采用现代化的技术架构，为安全研究人员提供高效、智能的页面信息收集解决方案。

### ✨ 核心优势

- **🔍 智能识别**: 自动提取页面中的API、域名、敏感信息等关键数据
- **🚀 深度挖掘**: 支持多层级递归扫描，不放过任何潜在漏洞点
- **⚡ 高效处理**: 并发扫描架构，大幅提升扫描效率
- **🎨 现代化UI**: 深色主题设计，提供优秀的用户体验
- **🔧 高度定制**: 支持自定义正则表达式和扫描规则

<!-- FEATURES -->
## 🌟 核心功能

### 🔍 一键基础扫描
<details>
<summary>📸 点击查看基础扫描演示图</summary>
<div align="center">
  <img src="https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856171098-216b0f27-45f5-4234-ab67-d47d36097764.png" alt="基础扫描" width="600"/>
</div>
</details>

自动提取页面内的各类敏感信息：
- **API接口**: 绝对路径、相对路径、RESTful接口
- **网络资源**: URL、域名、子域名、端口、路径参数
- **文件资源**: JS文件、CSS文件、图片、音视频
- **敏感数据**: 邮箱、手机号、IP地址、JWT令牌、认证信息
- **安全凭证**: AWS密钥、GitHub令牌、API密钥等

### 🚀 深度递归扫描
<details>
<summary>📸 点击查看深度扫描演示图</summary>
<div align="center">
  <img src="https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856217086-7079d830-9736-4ca6-9f8c-1c0472aa8be0.png" alt="深度扫描" width="600"/>
</div>
</details>

- **多层挖掘**: 支持1-5层深度递归扫描
- **并发控制**: 可配置2-32个并发请求
- **智能过滤**: 自动过滤静态文件和无效链接
- **实时更新**: 扫描过程中实时显示结果

### ⚡ 批量API测试
<details>
<summary>📸 点击查看API测试演示图</summary>
<div align="center">
  <img src="https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856263728-39e2f9a1-c900-4db8-a9c7-1c3c221904b6.png" alt="API测试" width="600"/>
</div>
</details>

- **多种请求方式**: 支持GET、POST等多种HTTP方法
- **批量处理**: 对扫描结果进行批量API测试
- **结果预览**: 支持响应内容预览和状态码检查
- **灵活配置**: 可自定义请求头和超时时间

### 📊 数据导出与分析
<details>
<summary>📸 点击查看数据导出演示图</summary>
<div align="center">
  <img src="https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856359165-db64aed3-d145-4154-ac77-85e3d0320c6c.png" alt="数据导出" width="600"/>
</div>
</details>

- **多格式支持**: 支持JSON和Excel格式导出
- **智能命名**: 自动生成包含域名的文件名
- **数据完整**: 保留所有扫描到的敏感信息

### 🔧 自定义配置
<details>
<summary>📸 点击查看自定义配置演示图</summary>
<div align="center">
  <img src="https://raw.githubusercontent.com/Team-intN18-SoybeanSeclab/Phantom/refs/heads/master/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202025-09-18%20193536.png" alt="自定义配置" width="600"/>
</div>
</details>

- **正则表达式**: 支持自定义正则规则
- **请求头配置**: 灵活配置Cookie和认证信息
- **过滤规则**: 自定义域名黑名单和过滤条件
- **JS脚本注入**: 支持自定义JavaScript脚本

<!-- TECHNOLOGY -->
## 🛠️ 技术架构

### 前端技术
- **HTML5 + CSS3**: 现代化的界面设计
- **JavaScript ES6+**: 采用最新的JavaScript特性
- **Chrome Extension API**: 深度集成浏览器扩展功能

### 核心模块
- **PatternExtractor**: 正则表达式引擎，支持自定义规则
- **ContentExtractor**: 内容提取器，智能识别敏感信息
- **DeepScanner**: 深度扫描器，支持递归挖掘
- **ApiTester**: API测试引擎，批量接口验证

### 数据存储
- **IndexedDB**: 本地数据存储，保护用户隐私
- **Chrome Storage**: 配置信息持久化
- **内存缓存**: 提升扫描性能和响应速度

<!-- INSTALLATION -->
## 🚀 快速开始

### 安装步骤

1. **下载项目**
   ```bash
   git clone https://github.com/Team-intN18-SoybeanSeclab/Phantom.git
   ```

2. **打开浏览器扩展页面**
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`

3. **启用开发者模式**
<details>
<summary>📸 点击查看开发者模式演示图</summary>
   <div align="center">
     <img src="https://via.placeholder.com/600x300/f8f9fa/212529?text=启用开发者模式" alt="开发者模式" width="600"/>
   </div>
</details>

4. **加载扩展**
   点击"加载已解压的扩展程序"，选择项目文件夹

5. **开始使用**
   点击浏览器工具栏中的幻影图标即可开始使用

### 基础使用

#### 🔍 快速扫描
<details>
<summary>📋 点击查看快速扫描步骤</summary>

1. 打开目标网页
2. 点击幻影扩展图标
3. 点击"开始扫描"按钮
4. 查看扫描结果

</details>

#### 🚀 深度扫描
<details>
<summary>📋 点击查看深度扫描步骤</summary>

1. 切换到"深度扫描"页面
2. 配置扫描参数（深度、并发数）
3. 点击"开始深度扫描"
4. 在新窗口中查看实时结果

</details>

#### ⚡ API测试
<details>
<summary>📋 点击查看API测试步骤</summary>

1. 切换到"API测试"页面
2. 选择要测试的数据分类
3. 配置请求参数
4. 执行批量测试

</details>

<!-- DATA CATEGORIES -->
## 📋 支持的数据类型

### 🔗 网络与资源
| 分类 | 说明 | 示例 |
|------|------|------|
| `absoluteApis` | 绝对路径API | `https://api.example.com/users` |
| `relativeApis` | 相对路径API | `/api/v1/users` |
| `urls` | 完整URL | `https://example.com/page` |
| `domains` | 域名信息 | `example.com` |
| `subdomains` | 子域名 | `api.example.com` |
| `jsFiles` | JavaScript文件 | `/static/app.js` |
| `cssFiles` | CSS样式文件 | `/static/style.css` |
| `images` | 图片资源 | `/img/logo.png` |

### 🔐 安全敏感信息
| 分类 | 说明 | 示例 |
|------|------|------|
| `emails` | 邮箱地址 | `admin@example.com` |
| `phoneNumbers` | 手机号 | `13800138000` |
| `ipAddresses` | IP地址 | `192.168.1.1` |
| `jwts` | JWT令牌 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `awsKeys` | AWS密钥 | `AKIAIOSFODNN7EXAMPLE` |
| `githubTokens` | GitHub令牌 | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `credentials` | 认证凭证 | `username:password` |

### 📊 其他信息
| 分类 | 说明 |
|------|------|
| `paths` | 路径信息 |
| `parameters` | URL参数 |
| `ports` | 端口信息 |
| `comments` | 代码注释 |
| `companies` | 公司名称 |
| `cryptoUsage` | 加密算法使用 |

<!-- CONFIGURATION -->
## ⚙️ 高级配置

### 深度扫描参数
- **最大深度**: 建议2-3层，避免过度抓取
- **并发数**: 推荐5-16个，平衡速度和稳定性
- **超时时间**: 建议5-10秒
- **扫描范围**: 可选择同域名、子域名或全部域名

### 自定义正则表达式
<details>
<summary>💻 点击查看代码示例</summary>

```javascript
// 示例：自定义API规则
const customApiRegex = /\/api\/v[0-9]+\/[a-zA-Z]+/g;

// 示例：自定义敏感信息
const customSensitiveRegex = /password[=:]\s*[\'"]?([^\'"\s]+)/gi;
```

</details>

### 请求头配置
- **Cookie管理**: 自动获取当前站点Cookie
- **自定义Header**: 支持任意HTTP请求头配置
- **认证信息**: 支持Bearer Token、Basic Auth等

<!-- TROUBLESHOOTING -->
## 🔧 常见问题

### ❓ 扫描无结果或结果很少？
<details>
<summary>🔍 点击查看详细解决方案</summary>

**可能原因：**
- 目标为系统页面（chrome://、chrome-extension://）
- 页面首次扫描后5分钟内处于静默节流期
- 自定义规则过于严格或存在错误

**解决方案：**
- 确保在普通网页上进行扫描
- 手动点击"开始扫描"强制触发
- 检查设置中的自定义正则规则

</details>

### ❓ 深度扫描不生效？
<details>
<summary>🔍 点击查看详细解决方案</summary>

**可能原因：**
- 目标站点需要认证授权
- 并发数设置过高导致请求失败
- 网络超时时间设置过短

**解决方案：**
- 在设置中添加目标站点的Cookie
- 适当降低并发数（建议5-10个）
- 增加网络超时时间（建议10秒以上）

</details>

### ❓ Excel文件无法打开？
<details>
<summary>🔍 点击查看详细解决方案</summary>

**解决方案：**
- 确保使用支持XML格式的Excel版本
- 如提示编码问题，选择UTF-8编码
- 可尝试使用JSON格式导出

</details>

### ❓ 浏览器出现卡顿？
<details>
<summary>🔍 点击查看详细优化建议</summary>

**优化建议：**
- 降低深度扫描的并发数
- 减少最大扫描深度
- 关闭不必要的扫描选项

</details>

<!-- SECURITY -->
## 🔒 安全与合规

### ✅ 合规使用
- 本工具仅用于授权范围内的安全测试
- 适用于SRC漏洞挖掘和自查场景
- 请遵循目标站点的安全策略

### 🔐 隐私保护
- 所有数据本地存储，不会上传到服务器
- 使用IndexedDB进行本地数据持久化
- 支持一键清除所有扫描数据

### ⚖️ 法律声明
- 用户需自行承担使用责任
- 禁止用于任何非法用途
- 请遵守相关法律法规

<!-- CONTRIBUTING -->
## 🤝 贡献指南

我们欢迎社区成员参与项目贡献！

### 🐛 报告问题
- 使用GitHub Issues报告bug
- 提供详细的复现步骤
- 包含相关截图和日志

### ✨ 功能建议
- 在Issues中提出新功能建议
- 描述具体的使用场景
- 说明期望的实现方式

### 🔧 代码贡献
1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

<!-- ACKNOWLEDGMENTS -->
## 🙏 致谢

D3f4ultX、findsomething、SnowEyes、0xsdeo、hama、zeroqing

隼目安全、知攻善防实验室、零羊Web、表哥带我

### 相关链接
- 项目官网：[https://www.cn-fnst.top/](https://www.cn-fnst.top/)
- 技术博客：[https://blog.h-acker.cn/](https://blog.h-acker.cn/)
- 安全研究：[https://www.hdsec.cn/](https://www.hdsec.cn/)
- 宣传文章：[微信公众号文章](https://mp.weixin.qq.com/s/FrUeZ9VYk6EP1EEikpwfzQ)

<!-- LICENSE -->
## 📄 许可证

本项目采用Apache-2.0许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/Team-intN18-SoybeanSeclab/Phantom.svg?style=for-the-badge
[contributors-url]: https://github.com/Team-intN18-SoybeanSeclab/Phantom/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Team-intN18-SoybeanSeclab/Phantom.svg?style=for-the-badge
[forks-url]: https://github.com/Team-intN18-SoybeanSeclab/Phantom/network/members
[stars-shield]: https://img.shields.io/github/stars/Team-intN18-SoybeanSeclab/Phantom.svg?style=for-the-badge
[stars-url]: https://github.com/Team-intN18-SoybeanSeclab/Phantom/stargazers
[issues-shield]: https://img.shields.io/github/issues/Team-intN18-SoybeanSeclab/Phantom.svg?style=for-the-badge
[issues-url]: https://github.com/Team-intN18-SoybeanSeclab/Phantom/issues
[license-shield]: https://img.shields.io/github/license/Team-intN18-SoybeanSeclab/Phantom.svg?style=for-the-badge
[license-url]: https://github.com/Team-intN18-SoybeanSeclab/Phantom/blob/master/LICENSE

---

<div align="center">
  <p><strong>幻影 (Phantom)</strong></p>
  <p>让SRC漏洞挖掘更高效、更智能</p>
  <p>
    <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom">
      <img src="https://img.shields.io/badge/⭐-Star%20This%20Project-blue" alt="Star">
    </a>
    <a href="https://github.com/Team-intN18-SoybeanSeclab/Phantom/fork">
      <img src="https://img.shields.io/badge/🍴-Fork%20This%20Project-green" alt="Fork">
    </a>
  </p>
</div>
