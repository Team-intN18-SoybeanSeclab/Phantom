# 幻影（Phantom）SRC漏洞挖掘辅助工具
Tips：由于这个项目刚刚开始，所以可能会有一些bug，师傅们可以提Issues哦，我们都会尽快处理的~

一款面向 SRC 场景的浏览器扩展），自动收集页面及相关资源中的敏感信息与可疑线索，支持基础扫描、深度递归扫描、批量 API 测试及结果导出与自定义正则配置，js脚本注入。

## 特性概览
+ 一键基础扫描：自动提取页面内的 API、URL、域名、邮箱、手机号、路径、参数、注释、多类 Token/Key 等
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856171098-216b0f27-45f5-4234-ab67-d47d36097764.png)
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856190392-1d4b6033-eeda-4d67-b37b-59d35dde7b55.png)
+ 深度递归扫描：多层链接/资源爬取，支持并发、超时配置，并在新窗口中运行，不阻塞当前操作
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856217086-7079d830-9736-4ca6-9f8c-1c0472aa8be0.png)
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856238274-e1fdcc5c-5bfd-422a-8e6f-55538c127cc2.png)
+ 批量 API 测试：对扫描到的分类条目进行 GET/POST 批测，并发与超时可配置，结果支持复制
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856263728-39e2f9a1-c900-4db8-a9c7-1c3c221904b6.png)
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856293628-7e746690-0d2c-4325-a3d5-68b409126f2b.png)
+ 导出能力：支持 JSON 与 Excel（.xls XML 格式）两种导出
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856359165-db64aed3-d145-4154-ac77-85e3d0320c6c.png)
+ 自定义正则：内置丰富默认规则，可在「设置」中按分类自定义正则并即时生效
![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856108718-5297beca-ea38-465c-a09b-57866dae115a.png)
+ 自定义请求头支持：可一键获取当前站点 Cookie 并保存，便于需要鉴权的请求场景,可以自行配置任何请求头
![](https://raw.githubusercontent.com/Team-intN18-SoybeanSeclab/Phantom/refs/heads/master/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202025-09-18%20193536.png)
+ 去重与过滤：内置增强过滤器（域名/邮箱/手机号/API），减少误报
+ 自动与增量：页面加载、DOM 变化与定时策略触发静默扫描；深度扫描过程中分层/分批实时合并与展示
+ 可添加自定义正则配置，更好的提取你自己想要的内容
![](https://raw.githubusercontent.com/Team-intN18-SoybeanSeclab/Phantom/refs/heads/master/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202025-08-26%20120117.png)
+ 内置许多jshook脚本，可以直接注入页面使用，方便进行js逆向操作，并且支持自定义脚本添加
+ 内置了FakeCryptoJS脚本，可以直接提取aes以及rsa的加密iv和ky，并调用进行加密，感谢https://github.com/keecth/FakeCryptoJS?tab=readme-ov-file
![](https://raw.githubusercontent.com/Team-intN18-SoybeanSeclab/Phantom/refs/heads/master/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202025-09-18%20193819.png)

## 安装
1. 打开 Chrome/Edge 等 Chromium 内核浏览器，访问 扩展程序 
    - Chrome：chrome://extensions
    - Edge：edge://extensions
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹（包含 manifest.json 的目录）

安装完成后，点击工具栏图标打开弹窗界面（popup.html）。

## 快速上手
+ 基础扫描
    1. 打开目标页面
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856406509-40692024-9516-4068-9d5b-caf3f4cc4b43.png)
    2. 点击扩展图标打开弹窗，默认会显示当前域
    3. 点击「开始扫描」或等待自动扫描（首次或超过5分钟未扫描会静默触发）
    4. 结果按分类展示，可点击条目复制
+ 深度递归扫描
    1. 切换至「深度扫描」页
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856423366-5e86dbd0-972a-496d-9669-5db1263f4399.png)
    2. 展开配置（最大深度、并发数、超时；可选：扫描 JS/HTML/API）
    3. 再次点击按钮启动，新窗口将执行分层递归扫描并实时更新结果
    4. 扫描完成后结果会自动合并保存并回显
+ 批量 API 测试
    1. 切换至「API测试」页
    2. 选择请求方法及要测试的分类（如绝对路径API、相对路径API、JS/CSS/图片/URL/域名/路径）
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856435462-f6d693ea-0e57-498b-81dd-c70d8f9b7a3b.png)
    3. 支持选择GET/POST请求方式来进行测试
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856444374-7cdeac95-cde9-4997-bfad-124643657cd0.png)
    4. 配置并发与超时，点击「批量请求测试」
    5. 在弹窗结果中排序，查看与复制
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856467310-881b309b-4d17-427d-91b8-35c44833f0ef.png)
    6. 支持预览响应

![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856486542-279b74f0-4090-4d42-a042-885f5afb985b.png)

+ 导出数据
    1. 在「扫描」页点击「导出数据」
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856503381-6c84b75b-6a7f-489d-8dbc-18f8b05efde8.png)
    2. 选择导出为 JSON 或 Excel（.xls）
       ![](https://cdn.nlark.com/yuque/0/2025/png/44105438/1755856115430-91a6406d-38db-46c3-823c-d9a26a526854.png)
    3. 文件名格式：域名__随机数，例如 example.com__123456.xls
+ 设置（Cookie与正则）
    1. 切换至「设置」页
    2. Cookie：点击获取当前站点 Cookie 或手动粘贴保存
    3. 正则：按分类编辑后「保存配置」即时生效；可「恢复默认」

## 支持的数据分类（部分）
+ API：absoluteApis
+ 网络与资源：urls、domains、subdomains、ports、paths、parameters、jsFiles、cssFiles、images、audios、videos、vueFiles、githubUrls
+ 身份与联络：emails、phoneNumbers、ipAddresses、companies
+ 安全敏感：sensitiveKeywords、credentials、jwts、bearerTokens、basicAuth、authHeaders、wechatAppIds、awsKeys、googleApiKeys、githubTokens、gitlabTokens、webhookUrls、idCards、cryptoUsage
+ 表单信息：forms、inputFields、hiddenFields
+ 注释：comments

说明：实际输出在展示前做去重、数量限制与过滤，避免噪音。

## 深度扫描原理与限制
+ 原理
    - 从当前页初始结果中收集候选 URL（JS/HTML/API）
    - 分层递归（最大深度可配），队列+并发 worker 处理，URL 内容经 PatternExtractor 提取
    - 通过 background.js 代发请求（runtime.sendMessage: makeRequest），处理跨域、超时、类型与文本提取
    - 应用增强过滤器（域名/邮箱/手机号与 API），结果实时合并到 deepScanResults，并回显与持久化
    - 支持配置扫描同域名，子域名，以及全部域名扫描
+ 配置建议
    - 最大深度 2~3，避免过度抓取
    - 并发 5~16 之间；超时 5~10 秒
    - 若目标需要授权访问，请先在设置中添加 Cookie
+ 已做优化
    - URL 内容缓存、正则缓存、分层显示更新、Set 去重、分批持久化

## 自定义正则（Settings）
+ 保存位置与生效链路 
    - PatternExtractor 在扫描/深度扫描前会 load/update 自定义规则并即时生效
+ 可配置项（示例） 
    - API / 域名 / 邮箱 / 手机号 / 敏感信息 / IP / 路径 / JWT / Bearer / Basic / Authorization / 微信AppID / AWS / Google API Key / GitHub/GitLab Token / Webhook / 加密调用 / GitHub 链接 / Vue 文件 / 公司名称 / 注释 等
+ 校验 
    - 保存前会对每条正则进行语法校验，失败会提示并中断保存



## 常见问题
+ 扫描无结果或很少 
    - 目标为系统页（chrome://、chrome-extension://）会被跳过
    - 页面首扫后 5 分钟内静默节流；可手动点「开始扫描」
    - 规则过严或错误：检查设置中的自定义正则；可恢复默认
+ 深度扫描不生效/请求失败 
    - 站点需要鉴权：先保存 Cookie 后再执行
    - 并发过高或超时过短：适度调小并发、调大超时
+ Excel 打不开 
    - 导出为 .xls可直接用 Excel 打开；若提示编码，选择 UTF-8
+ 性能建议 
    - 复杂页面建议使用默认节流与深度参数，避免过高并发导致浏览器卡顿

## 安全与合规
+ 工具仅用于授权范围内的安全测试与 SRC 场景自查，请勿用于非法用途
+ 结果保存在本地IndexedDB，不会自动对外发送
+ 在进行深度扫描与批量请求时，请遵循目标站点策略与相关法律法规

## 版本与致谢
+ 版本：1.7.8
+ 作者： 
  - [Phantom](https://github.com/Attack-Phantom)  
  - [Xuan8a1](https://github.com/Xuan8a1)  
  - [yihuo](https://github.com/yiyihuohuo)  
  - [LamentXU](https://github.com/LamentXU123)  
+ 站点： 
    - [https://www.cn-fnst.top/](https://www.cn-fnst.top/)
    - [https://blog.h-acker.cn/](https://blog.h-acker.cn/)
    - [https://www.hdsec.cn/](https://www.hdsec.cn/)
    - [https://www.tutusec.com/](https://www.tutusec.com/)
+ 开源地址：[https://github.com/Team-intN18-SoybeanSeclab/Phantom/](https://github.com/Team-intN18-SoybeanSeclab/Phantom/)
+ 致谢个人/团体/工具：D3f4ultX、findsomething、SnowEyes、0xsdeo、hama、zeroqing
+ 致谢媒体：隼目安全、知攻善防实验室、零羊Web、表哥带我

## 宣传文章
URL：[https://mp.weixin.qq.com/s/FrUeZ9VYk6EP1EEikpwfzQ](https://mp.weixin.qq.com/s/FrUeZ9VYk6EP1EEikpwfzQ)



> 来自: [Team-intN18-SoybeanSeclab/Phantom: 一款面向SRC漏洞挖掘中，页面信息收集场景的浏览器扩展，自动收集页面及相关资源中的敏感信息与可疑线索，支持基础扫描、深度递归扫描、批量 API 测试及结果导出与自定义正则配置](https://github.com/Team-intN18-SoybeanSeclab/Phantom/)




