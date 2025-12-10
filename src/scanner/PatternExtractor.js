/**
 * 模式提取器 - 只使用设置界面配置的正则表达式
 * 统一化版本 - 去除所有内置正则和降级机制
 * 性能优化版本 - 添加分块处理和缓存机制
 */
class PatternExtractor {
    constructor() {
        // === 性能优化配置 ===
        this.performanceConfig = {
            maxMatchesPerPattern: 5000,     // 每个正则最大匹配数
            chunkSize: 100000,              // 分块处理大小（字符）
            enableChunking: true,           // 是否启用分块处理
            cacheEnabled: true,             // 是否启用缓存
            maxCacheSize: 50                // 最大缓存条目数
        };
        
        // 结果缓存
        this._resultCache = new Map();
        
        // 静态文件扩展名列表 - 用于过滤绝对路径和相对路径API
        this.staticFileExtensions = [
            // 图片文件
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif','.jpg)', '.jpeg)', '.png)', '.gif)', '.bmp)', '.webp)', '.svg)', '.ico)', '.tiff)', '.tif)',
            // 样式文件
            '.css', '.scss', '.sass', '.less',
            // 脚本文件
            '.js', '.jsx', '.ts', '.tsx', '.vue', '.coffee',
            // 字体文件
            '.woff', '.woff2', '.ttf', '.otf', '.eot',
            // 音频文件
            '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac',
            // 视频文件
            '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.swf'
        ];

        // 域名黑名单：不会展示以下域名
        this.DOMAIN_BLACKLIST = [
            // 代码中的属性访问模式
            'el.datepicker.today',
            'obj.style.top',
            'window.top',
            'mydragdiv.style.top',
            'container.style.top',
            'location.host',
            'page.info',
            'res.info',
            'item.info',
            // Vue/JS 组件相关
            'refs.timepicker.date',
            'refs.mintimepicker.date',
            'refs.maxtimepicker.date',
            'refs.input.click',
            'refs.datepicker.date',
            'refs.picker.date',
            'refs.dialog.show',
            'refs.modal.show',
            'refs.form.submit',
            'refs.table.data',
            // 常见框架文档域名（通常不需要）
            'vuejs.org',
            'www.w3.org',
            'reactjs.org',
            'angular.io',
            'nodejs.org',
            'npmjs.com',
            'github.com',
            'stackoverflow.com',
            'developer.mozilla.org'
        ];
        
        // 🔥 新增：域名垃圾模式过滤（过滤代码中的变量访问等非真实域名）
        this.DOMAIN_GARBAGE_PATTERNS = [
            // === JS 对象属性访问模式 ===
            /^this\./i,                       // this.xxx
            /^props\./i,                      // props.xxx
            /^value\./i,                      // value.xxx
            /^refs\./i,                       // refs.xxx (Vue refs)
            /^state\./i,                      // state.xxx
            /^data\./i,                       // data.xxx
            /^options\./i,                    // options.xxx
            /^config\./i,                     // config.xxx
            /^params\./i,                     // params.xxx
            /^query\./i,                      // query.xxx
            /^result\./i,                     // result.xxx
            /^response\./i,                   // response.xxx
            /^request\./i,                    // request.xxx
            /^event\./i,                      // event.xxx
            /^target\./i,                     // target.xxx
            /^currentTarget\./i,              // currentTarget.xxx
            /^style\./i,                      // style.xxx
            /^window\./i,                     // window.xxx
            /^document\./i,                   // document.xxx
            /^console\./i,                    // console.xxx
            /^Math\./i,                       // Math.xxx
            /^Object\./i,                     // Object.xxx
            /^Array\./i,                      // Array.xxx
            /^String\./i,                     // String.xxx
            /^Number\./i,                     // Number.xxx
            /^JSON\./i,                       // JSON.xxx
            /^Date\./i,                       // Date.xxx
            /^Promise\./i,                    // Promise.xxx
            /^Error\./i,                      // Error.xxx
            /^\$\./i,                         // $.xxx (jQuery)
            /^_\./i,                          // _.xxx (lodash)
            /^\w+Element\./i,                 // parentElement.xxx, childElement.xxx
            
            // === 多级属性访问（如 refs.timepicker.date）===
            // 注意：不再使用 /^[a-z]+\.[a-z]+\.[a-z]+/i，因为它会误杀三级域名如 www.example.com
            /refs\.[a-z]+\./i,                // refs.xxx.yyy
            /\$refs\./i,                      // $refs.xxx
            
            // === 代码变量模式 ===
            /^[A-Z][a-z]\./i,                 // Tr.info 等大写开头单词
            /^[a-z]{1,2}\.[a-z]{1,2}$/i,      // a.b, ab.cd 等极短的变量访问
            /^[a-z]\.[a-z]+\(/i,              // a.test(, e.exec( 等方法调用
            
            // === CSS/样式相关 ===
            /^clientY-/i,                     // clientY-xxx
            /^clientX-/i,                     // clientX-xxx
            /^offset[A-Z]/i,                  // offsetWidth, offsetHeight
            /^scroll[A-Z]/i,                  // scrollTop, scrollLeft
            
            // === 明显的代码片段 ===
            /\.(test|exec|match|replace|split|join|map|filter|reduce|forEach)\s*\(/i,  // 方法调用
            /\.(length|value|name|type|id|class|style|data)\s*[=;,)]/i,  // 属性访问
        ];
        
        // 🔥 常见短域名白名单（这些短域名是真实的）
        this.SHORT_DOMAIN_WHITELIST = new Set([
            't.co', 'j.mp', 'g.co', 'fb.me', 'bit.ly', 'goo.gl', 'ow.ly', 'is.gd',
            'v.gd', 'tr.im', 'cli.gs', 'tinyurl.com', 'tiny.cc', 'lnkd.in', 'db.tt',
            'qr.ae', 'adf.ly', 'po.st', 'bc.vc', 'su.pr', 'twurl.nl', 'u.nu',
            'x.co', 'me.com', 'qq.com', 'jd.com', 'so.com', 'cn.com', 'hk.com',
            'tw.com', 'jp.com', 'kr.com', 'ru.com', 'de.com', 'uk.com', 'eu.com',
            'us.com', 'za.com', 'br.com', 'ar.com', 'mx.com', 'co.uk', 'co.jp',
            'co.kr', 'co.nz', 'co.za', 'co.in', 'ne.jp', 'or.jp', 'ac.uk', 'gov.uk',
            'org.uk', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn', 'mil.cn'
        ]);
        
        // 🔥 新增：绝对路径垃圾模式过滤
        this.ABSOLUTE_PATH_GARBAGE_PATTERNS = [
            /^\/gi\.test$/i,                  // /gi.test
            /^\/gi$/i,                        // /gi
            /^\/\d+-[A-Za-z]-[A-Za-z]/i,      // /2-U-j-de-R.mainAxis 等
            /^\/\d+\.\d+$/,                   // /1.055
            /^\/[a-z]\.test$/i,               // /i.test
            /^\/[a-z]\.exec$/i,               // /i.exec
            /^\/Math\./i,                     // /Math.xxx
            /^\/[a-z]\.[a-z]+$/i,             // /a.b
            /^\/--/,                          // /--xxx
            /^\/\.\//,                        // /./ 
            /^\/`/,                           // /`xxx
            /`\/$/,                           // xxx`/
            /\.mainAxis$/i,                   // xxx.mainAxis
            /\.crossAxis$/i,                  // xxx.crossAxis
            /^\/[a-z]{1,2}$/i,                // /a, /ab 等单字母路径
            /\.[A-Z][a-z]+[A-Z]/,             // 驼峰命名的属性访问
        ];

        // 内容类型过滤列表 - 用于静态路径和相对路径过滤
        this.FILTERED_CONTENT_TYPES = [  
            'multipart/form-data',
            'node_modules/',
            'pause/break',
            'partial/ajax',
            'chrome/',
            'firefox/',
            'edge/',
            'examples/element-ui',
            'static/css/',
            'stylesheet/less',
            'jpg/jpeg/png/pdf',
            // 日期类型
            'yyyy/mm/dd',
            'dd/mm/yyyy',
            'mm/dd/yy',
            'yy/mm/dd',
            'm/d/Y',
            'm/d/y',
            'xx/xx',
            'zrender/vml/vml',
            // CSS单位和正则表达式模式
            '/rem/g',
            '/vw/g',
            '/vh/g',
            '/-/g',
            '/./g',
            '/f.value',
            '/i.test',
            // 操作系统检测模式
            '/android/i.test',
            '/CrOS/.test',
            '/windows/i.test',
            '/macintosh/i.test',
            '/linux/i.test',
            '/tablet/i.test',
            '/xbox/i.test',
            '/bada/i.test',
            // 浏览器检测模式
            '/silk/i.test',
            '/sailfish/i.test',
            '/tizen/i.test',
            '/SamsungBrowser/i.test',
            '/opera/i.test',
            '/Whale/i.test',
            '/MZBrowser/i.test',
            '/coast/i.test',
            '/focus/i.test',
            '/yabrowser/i.test',
            '/ucbrowser/i.test',
            '/mxios/i.test',
            '/epiphany/i.test',
            '/puffin/i.test',
            '/sleipnir/i.test',
            '/k-meleon/i.test',
            '/vivaldi/i.test',
            '/phantom/i.test',
            '/slimerjs/i.test',
            '/qupzilla/i.test',
            '/chromium/i.test',
            '/googlebot/i.test',
            '/Android/i.exec',
            '/t.getWidth',
            '/t.getHeight',
            '/t.get',
            '/i.exec',
            '/e.offsetWidth',
            '/e.offsetHeight',
            '/e.offset',
            '/t.ratio/a.value',
            '/i.exec',
            '/Mobile/i.exec',
            '/Win64/.exec',
            '/d.count',
            '/Math.LN10',
            '/2-z-Y-Ie-A.mainAxis',
            '/2-U-j-de-R.mainAxis',
            '/top/.test',
            '/Y/.test',
            '.test(',
            '/s.x',
            '/s.y',
            '/x/g',
            '/Math.PI',
            '/t.length',
            '/c.async',
            // 🔥 新增：更多垃圾路径模式
            '/gi.test',
            '/1.055',
            '.mainAxis',
            '.crossAxis',
            '.offsetWidth',
            '.offsetHeight',
            '/./.exec',
            '/__/g',
            '/s/g',
            '/a/g',
            '/--/',
            '/-./',
            '/.source.replace',
            '/.11',
            '/a/i',
            '/a/b',
            '/i.11',
            '/e.1t',
            '/4i/',
            '/`',
            '`/'
        ];
        
        // 新增：基于正则的二次过滤规则（用于过滤 /字母.字母... 这类噪声，且避免误伤常见静态资源）
        this.FILTERED_REGEXES = [
            // 1) /i.test /e.offsetHeight /t.getWidth /i.exec 等（单字母.标识符，末尾可接 ( 或 / 或 结尾）
            /\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\(|\/|$)/,
            // 2) /t.ratio/a.value 这类“单字母.标识符/单字母.标识符”的链式片段
            /\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\/[A-Za-z]\.[A-Za-z][A-Za-z]*)+(?:\(|\/|$)/,
            /^\/[a-zA-Z]\/[a-zA-Z]$/gm
        ];
        
        // 引入身份证验证过滤器
        this.idCardFilter = null;
        this.loadIdCardFilter();
        
        // 当前使用的正则表达式配置 - 初始为空，只使用设置界面配置
        this.patterns = {};
        
        // 自定义正则表达式配置
        this.customRegexConfig = null;
        
        // 标记是否已加载自定义配置
        this.customPatternsLoaded = false;
        
        // 设置全局引用，供设置管理器调用
        window.patternExtractor = this;
        
        // 监听配置更新事件
        window.addEventListener('regexConfigUpdated', (event) => {
            //console.log('🔄 收到正则配置更新事件:', event.detail);
            this.updatePatterns(event.detail);
        }, { once: false });
        
        // 异步加载自定义配置，但不阻塞构造函数
        this.loadCustomPatterns().catch(error => {
            console.error('❌ 异步加载自定义配置失败:', error);
        });
    }
    
    /**
     * 加载身份证验证过滤器
     */
    loadIdCardFilter() {
        try {
            // 尝试从全局变量获取
            if (typeof window !== 'undefined' && window.idCardFilter) {
                this.idCardFilter = window.idCardFilter;
                //console.log('✅ 身份证过滤器加载成功 (全局变量)');
                return;
            }
            
            // 尝试动态加载
            const script = document.createElement('script');
            script.src = 'filters/id-card-filter.js';
            script.onload = () => {
                if (window.idCardFilter) {
                    this.idCardFilter = window.idCardFilter;
                    //console.log('✅ 身份证过滤器动态加载成功');
                } else {
                    console.warn('⚠️ 身份证过滤器加载失败：未找到 idCardFilter');
                }
            };
            script.onerror = () => {
                console.error('❌ 身份证过滤器脚本加载失败');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('❌ 加载身份证过滤器时出错:', error);
        }
    }
    
    /**
     * 检测URL是否为静态文件
     * @param {string} url - 要检测的URL
     * @returns {boolean} 是否为静态文件
     */
    isStaticFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        // 🔥 增强清理：移除引号、查询参数、锚点和尾部特殊字符
        let cleanUrl = url
            .replace(/^["'`]+|["'`]+$/g, '')  // 移除首尾引号
            .split('?')[0]
            .split('#')[0]
            .replace(/[)"'\s]+$/g, '')  // 移除尾部的括号、引号、空格
            .toLowerCase()
            .trim();
        
        // 检查是否以静态文件扩展名结尾
        if (this.staticFileExtensions.some(ext => cleanUrl.endsWith(ext))) {
            return true;
        }
        
        // 🔥 增强检测：使用正则匹配常见静态资源模式
        const staticPatterns = [
            /\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff?|avif)(\?.*)?$/i,  // 图片
            /\.(css|scss|sass|less|styl)(\?.*)?$/i,  // 样式
            /\.(js|jsx|ts|tsx|mjs|cjs|vue|coffee)(\?.*)?$/i,  // 脚本
            /\.(woff2?|ttf|otf|eot|font)(\?.*)?$/i,  // 字体
            /\.(mp3|wav|ogg|m4a|aac|flac|wma)(\?.*)?$/i,  // 音频
            /\.(mp4|avi|mov|wmv|flv|webm|mkv|swf|m4v)(\?.*)?$/i,  // 视频
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz)(\?.*)?$/i,  // 文档/压缩
            /\.(map|json\.map|js\.map|css\.map)$/i,  // Source maps
            /\/[^/]+\.(png|jpg|jpeg|gif|svg|ico|webp)[^a-zA-Z0-9]/i,  // 路径中包含图片扩展名
        ];
        
        return staticPatterns.some(pattern => pattern.test(cleanUrl));
    }

    /**
     * 🔥 检查URL是否为图片文件
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否为图片文件
     */
    isImageFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif','.jpg)', '.jpeg)', '.png)', '.gif)', '.bmp)', '.webp)', '.svg)', '.ico)', '.tiff)', '.tif)','.ttf','.woff','.eot','.woff2'];
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return imageExtensions.some(ext => cleanUrl.endsWith(ext));
    }

    /**
     * 🔥 检查URL是否为JS文件
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否为JS文件
     */
    isJsFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.js') || cleanUrl.includes('.js?');
    }

    /**
     * 🔥 检查URL是否为CSS文件
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否为CSS文件
     */
    isCssFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.css') || cleanUrl.includes('.css?');
    }

    /**
     * 🔥 检查路径是否为静态资源路径（增强版）
     * 用于过滤相对路径中的静态资源文件
     * @param {string} path - 要检查的路径
     * @returns {boolean} 是否为静态资源路径
     */
    isStaticResourcePath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }
        
        // 清理路径：移除引号、空格等
        let cleanPath = path
            .replace(/^["'`]+|["'`]+$/g, '')  // 移除首尾引号
            .replace(/[)"'\s]+$/g, '')  // 移除尾部特殊字符
            .trim();
        
        // 🔥 静态资源文件扩展名正则（更全面）
        const staticExtensionPattern = /\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff?|avif|heic|heif|raw|psd|ai|eps|pdf|doc|docx|xls|xlsx|ppt|pptx|css|scss|sass|less|styl|js|jsx|ts|tsx|mjs|cjs|vue|coffee|woff2?|ttf|otf|eot|font|mp3|wav|ogg|m4a|aac|flac|wma|mp4|avi|mov|wmv|flv|webm|mkv|swf|m4v|3gp|zip|rar|7z|tar|gz|bz2|xz|map|json\.map|js\.map|css\.map)(\?[^/]*)?$/i;
        
        if (staticExtensionPattern.test(cleanPath)) {
            return true;
        }
        
        // 🔥 检查路径中是否包含常见静态资源目录
        const staticDirPatterns = [
            /\/images?\//i,
            /\/img\//i,
            /\/icons?\//i,
            /\/assets?\//i,
            /\/static\//i,
            /\/media\//i,
            /\/uploads?\//i,
            /\/files?\//i,
            /\/fonts?\//i,
            /\/styles?\//i,
            /\/css\//i,
            /\/scripts?\//i,
            /\/vendor\//i,
            /\/lib\//i,
            /\/dist\//i,
            /\/build\//i,
            /\/public\//i,
            /\/resources?\//i,
        ];
        
        // 如果路径包含静态资源目录且以静态文件扩展名结尾
        const hasStaticDir = staticDirPatterns.some(pattern => pattern.test(cleanPath));
        const hasStaticExt = /\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|mp3|mp4)(\?.*)?$/i.test(cleanPath);
        
        if (hasStaticDir && hasStaticExt) {
            return true;
        }
        
        // 🔥 检查是否是纯静态资源文件名（无路径分隔符的情况）
        const pureStaticFilePattern = /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|mp3|mp4)$/i;
        if (pureStaticFilePattern.test(cleanPath)) {
            return true;
        }
        
        // 🔥 检查路径是否以静态资源扩展名结尾（带查询参数的情况）
        const extWithQueryPattern = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|tiff?)\?/i;
        if (extWithQueryPattern.test(cleanPath)) {
            return true;
        }
        
        return false;
    }

    /**
     * 🔥 检查内容是否为 CSS 样式代码（用于过滤误识别的敏感凭据）
     * @param {string} text - 要检查的文本
     * @returns {boolean} 是否为 CSS 样式代码
     */
    isCssStyleCode(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        const cleanText = text.trim().toLowerCase();
        
        // 🔥 CSS 颜色值模式
        const cssColorPatterns = [
            /^rgba?\s*\(\s*\d+/i,                    // rgba(0, 0, 0 或 rgb(255, 255, 255
            /^hsla?\s*\(\s*\d+/i,                    // hsla(0, 0%, 0% 或 hsl(360, 100%, 50%
            /^#[0-9a-f]{3,8}$/i,                     // #fff, #ffffff, #ffffffff
            /rgba?\s*\([^)]+\)\s*(solid|dashed|dotted|double|groove|ridge|inset|outset)?/i,  // rgba(...) solid
            /\d+px\s+rgba?\s*\(/i,                   // 1px rgba(
            /\d+(px|em|rem|%|vh|vw)\s+rgba?\s*\(/i,  // 带单位的值后跟 rgba
        ];
        
        // 🔥 CSS 属性值模式
        const cssPropertyPatterns = [
            /^\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|pt|pc|in|cm|mm)\s/i,  // 带单位的数值
            /^(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)$/i,  // 边框样式
            /^(default|pointer|crosshair|move|text|wait|help|not-allowed|grab|grabbing)$/i,  // 光标样式
            /^(block|inline|inline-block|flex|grid|none|table|list-item)$/i,  // display 值
            /^(absolute|relative|fixed|sticky|static)$/i,  // position 值
            /^(left|right|center|justify|start|end)$/i,  // 对齐值
            /^(top|bottom|left|right|center|middle|baseline)$/i,  // 位置值
            /^(bold|normal|lighter|bolder|\d{3})$/i,  // font-weight 值
            /^(italic|oblique|normal)$/i,  // font-style 值
            /^(uppercase|lowercase|capitalize|none)$/i,  // text-transform 值
            /^(underline|overline|line-through|none)$/i,  // text-decoration 值
            /^(visible|hidden|scroll|auto|clip)$/i,  // overflow 值
            /^(wrap|nowrap|pre|pre-wrap|pre-line|break-spaces)$/i,  // white-space 值
            /^(cover|contain|auto|\d+%|\d+px)$/i,  // background-size 值
            /^(repeat|no-repeat|repeat-x|repeat-y|space|round)$/i,  // background-repeat 值
            /^(border-box|content-box|padding-box)$/i,  // box-sizing 值
            /^(ease|linear|ease-in|ease-out|ease-in-out)$/i,  // transition-timing-function 值
            /^(row|column|row-reverse|column-reverse)$/i,  // flex-direction 值
            /^(stretch|flex-start|flex-end|center|baseline|space-between|space-around|space-evenly)$/i,  // flex 对齐值
        ];
        
        // 🔥 CSS 复合值模式（如 "1px rgba(0,0,0,.9) solid"）
        const cssCompoundPatterns = [
            /^\d+(px|em|rem)?\s+(rgba?\s*\([^)]+\)|#[0-9a-f]{3,8})\s+(solid|dashed|dotted|double|none)/i,  // border 值
            /^(rgba?\s*\([^)]+\)|#[0-9a-f]{3,8})\s+\d+(px|em|rem)/i,  // 颜色 + 尺寸
            /^\d+(px|em|rem|%)\s+\d+(px|em|rem|%)/i,  // 多个尺寸值
            /^(inset\s+)?\d+(px|em|rem)\s+\d+(px|em|rem)\s+\d+(px|em|rem)/i,  // box-shadow 值
            /^url\s*\([^)]+\)/i,  // url() 函数
            /^linear-gradient\s*\(/i,  // 渐变
            /^radial-gradient\s*\(/i,  // 径向渐变
            /^(nav|dot|round|index|indexes)$/i,  // 常见 CSS 类名/ID
        ];
        
        // 🔥 CSS 特殊关键字
        const cssKeywords = [
            'default', 'inherit', 'initial', 'unset', 'revert',
            'auto', 'none', 'normal', 'transparent',
            'solid', 'dashed', 'dotted', 'double',
            'block', 'inline', 'flex', 'grid',
            'absolute', 'relative', 'fixed', 'sticky',
            'hidden', 'visible', 'scroll', 'clip',
            'pointer', 'crosshair', 'move', 'text',
            'bold', 'italic', 'underline',
            'left', 'right', 'center', 'top', 'bottom',
            'row', 'column', 'wrap', 'nowrap',
            'ease', 'linear', 'ease-in', 'ease-out',
            'cover', 'contain', 'repeat', 'no-repeat',
            'border-box', 'content-box',
            'nav', 'dot', 'round', 'index', 'indexes',
            'navindexes', 'dotround', 'roundnav',
        ];
        
        // 检查是否匹配 CSS 颜色模式
        if (cssColorPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }
        
        // 检查是否匹配 CSS 属性值模式
        if (cssPropertyPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }
        
        // 检查是否匹配 CSS 复合值模式
        if (cssCompoundPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }
        
        // 检查是否为 CSS 关键字
        if (cssKeywords.includes(cleanText)) {
            return true;
        }
        
        // 🔥 检查是否包含典型的 CSS 值组合
        // 如 "3331px rgba(0, 0, 0, .9) soliddefaultdotroundnavindexesrgba(255, 90, 95,0.9)1px rgba(255, 90, 95,0.9) solid"
        const hasCssColorFunction = /rgba?\s*\([^)]+\)/i.test(cleanText);
        const hasCssUnit = /\d+(px|em|rem|%|vh|vw)/i.test(cleanText);
        const hasCssBorderStyle = /(solid|dashed|dotted|double|none)/i.test(cleanText);
        
        // 如果同时包含颜色函数和单位，很可能是 CSS 代码
        if (hasCssColorFunction && (hasCssUnit || hasCssBorderStyle)) {
            return true;
        }
        
        // 🔥 检查是否是纯 CSS 关键字组合（无空格连接）
        const cssKeywordCombination = /^(default|dot|round|nav|index|indexes|solid|dashed|pointer|block|flex|grid|auto|none|normal|hidden|visible)+$/i;
        if (cssKeywordCombination.test(cleanText.replace(/\s+/g, ''))) {
            return true;
        }
        
        return false;
    }

    /**
     * 检查域名是否在黑名单中
     * @param {string} domain - 要检查的域名
     * @returns {boolean} 是否在黑名单中
     */
    isDomainBlacklisted(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }
        
        // 清理域名，移除协议、路径等
        const cleanDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')  // 移除协议
            .replace(/\/.*$/, '')         // 移除路径
            .replace(/:\d+$/, '')         // 移除端口
            .trim();
        
        // 检查是否在黑名单中
        const isBlacklisted = this.DOMAIN_BLACKLIST.includes(cleanDomain);
        
        if (isBlacklisted) {
            //console.log(`🚫 [PatternExtractor] 域名已被黑名单过滤: "${cleanDomain}"`);
        }
        
        return isBlacklisted;
    }
    
    /**
     * 🔥 检查域名是否为垃圾域名（代码变量访问等）
     * @param {string} domain - 要检查的域名
     * @returns {boolean} 是否为垃圾域名
     */
    isGarbageDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }
        
        const cleanDomain = domain.trim().toLowerCase();
        
        // 🔥 首先检查短域名白名单（这些是真实的短域名）
        if (this.SHORT_DOMAIN_WHITELIST && this.SHORT_DOMAIN_WHITELIST.has(cleanDomain)) {
            return false; // 白名单中的域名不是垃圾域名
        }
        
        // 🔥 检查是否包含多个点号（可能是多级属性访问如 refs.timepicker.date）
        const dotCount = (cleanDomain.match(/\./g) || []).length;
        if (dotCount >= 3) {
            // 超过3个点的很可能是代码中的属性访问链
            return true;
        }
        
        // 检查是否匹配垃圾模式
        for (const pattern of this.DOMAIN_GARBAGE_PATTERNS) {
            if (pattern.test(cleanDomain)) {
                return true;
            }
        }
        
        // 🔥 检查是否包含常见的代码关键字
        const codeKeywords = ['refs', 'props', 'state', 'data', 'config', 'options', 
                              'params', 'query', 'result', 'response', 'request',
                              'event', 'target', 'style', 'class', 'element',
                              'picker', 'input', 'button', 'form', 'modal', 'dialog'];
        for (const keyword of codeKeywords) {
            // 如果域名中包含这些关键字且后面跟着点号，很可能是代码
            if (cleanDomain.includes(keyword + '.') || cleanDomain.includes('.' + keyword + '.')) {
                return true;
            }
        }
        
        // 🔥 检查是否以常见的代码后缀结尾（排除真实TLD如 .click, .date 等）
        // 注意：.click, .date, .name, .style, .data 等是真实的 gTLD，不应该被过滤
        const codeSuffixes = ['.input', '.value', '.length', '.type', 
                              '.id', '.class', '.text',
                              '.html', '.json', '.xml', '.form', '.submit', '.reset',
                              '.focus', '.blur', '.change', '.select', '.load', '.error',
                              '.test', '.exec', '.match', '.replace', '.split'];
        // 只有当域名看起来像代码时才过滤（包含多个点或以代码关键字开头）
        if (dotCount >= 2) {
            for (const suffix of codeSuffixes) {
                if (cleanDomain.endsWith(suffix)) {
                    return true;
                }
            }
        }
        
        // 🔥 放宽短域名限制：只过滤明显不是域名的情况
        // 不再简单地按长度过滤，而是检查是否符合域名格式
        const parts = cleanDomain.split('.');
        if (parts.length === 2) {
            const [name, tld] = parts;
            // 如果名称部分只有1个字符且TLD不是常见的，可能是代码
            if (name.length === 1 && !['co', 'me', 'io', 'tv', 'cc', 'ly', 'gl', 'gd', 'im', 'nu', 'tk', 'ml', 'ga', 'cf'].includes(tld)) {
                // 检查是否是常见的单字母域名
                if (!['t', 'g', 'j', 'x', 'u', 'v', 'i', 'q', 's', 'w', 'y', 'z'].includes(name)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 🔥 检查绝对路径是否为垃圾路径
     * @param {string} path - 要检查的路径
     * @returns {boolean} 是否为垃圾路径
     */
    isGarbageAbsolutePath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }
        
        const cleanPath = path.trim();
        
        // 检查是否匹配垃圾模式
        for (const pattern of this.ABSOLUTE_PATH_GARBAGE_PATTERNS) {
            if (pattern.test(cleanPath)) {
                return true;
            }
        }
        
        // 🔥 额外检查：路径中包含 .test, .exec, .mainAxis 等代码模式
        if (/\.(test|exec|mainAxis|crossAxis|offsetWidth|offsetHeight|value|length|count|ratio)$/i.test(cleanPath)) {
            return true;
        }
        
        // 🔥 额外检查：路径看起来像正则表达式 /xxx/g, /xxx/i 等
        if (/^\/[^/]+\/[gim]+$/i.test(cleanPath)) {
            return true;
        }
        
        // 🔥 额外检查：路径只包含数字和点（如 /1.055）
        if (/^\/[\d.]+$/.test(cleanPath)) {
            return true;
        }
        
        // 🔥 额外检查：路径包含连续的大小写字母和连字符（如 /2-U-j-de-R）
        if (/^\/\d+-[A-Za-z]+-?[A-Za-z]*-?[A-Za-z]*-?[A-Za-z]*/.test(cleanPath)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 🔥 检查Vue文件路径是否有效（只保留完整路径）
     * @param {string} vuePath - Vue文件路径
     * @returns {boolean} 是否为有效的Vue文件路径
     */
    isValidVueFilePath(vuePath) {
        if (!vuePath || typeof vuePath !== 'string') {
            return false;
        }
        
        const cleanPath = vuePath.trim().replace(/^["']|["']$/g, ''); // 去除引号
        
        // 必须以 .vue 结尾
        if (!cleanPath.toLowerCase().endsWith('.vue')) {
            return false;
        }
        
        // 必须包含路径分隔符（完整路径）
        // 有效示例: /home/runner/work/xxx/xxx.vue, src/components/xxx.vue
        // 无效示例: zoom-out.vue, button.vue
        if (!cleanPath.includes('/') && !cleanPath.includes('\\')) {
            return false;
        }
        
        // 路径长度必须大于10（排除短路径如 a/b.vue）
        if (cleanPath.length < 10) {
            return false;
        }
        
        return true;
    }

    /**
     * 检查路径是否包含需要过滤的内容类型
     * @param {string} path - 要检查的路径
     * @returns {boolean} 是否包含需要过滤的内容类型
     */
    containsFilteredContentType(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }
        
        const lowerPath = path.toLowerCase();
        
        // 检查是否包含任何过滤的内容类型
        const isFiltered = this.FILTERED_CONTENT_TYPES.some(contentType => {
            return lowerPath.includes(contentType.toLowerCase());
        });
        
        if (isFiltered) {
            //console.log(`🚫 [PatternExtractor] 路径包含过滤内容类型，已过滤: "${path}"`);
        }
        
        return isFiltered;
    }

    /**
     * 正则二次过滤：命中任意 FILTERED_REGEXES 则视为需要过滤
     * @param {string} text
     * @returns {boolean}
     */
    isFilteredByRegex(text) {
        if (!text || typeof text !== 'string') return false;
        try {
            // 基础正则过滤
            const matchedByRegex = this.FILTERED_REGEXES?.some(re => {
                try { return re.test(text); } catch { return false; }
            }) || false;
            
            if (matchedByRegex) return true;
            
            // 🔥 额外的过滤规则
            // 1) /this._xxx 格式（JS属性访问）
            if (/\/this\.[_a-zA-Z]/.test(text)) return true;
            
            // 2) /_/g 格式（正则表达式标志）
            if (/\/[_a-zA-Z]+\/[gimsuvy]+$/.test(text)) return true;
            
            // 3) 超长随机字符串（超过50个连续字母数字，可能是Base64或混淆代码）
            if (/\/[A-Za-z0-9]{50,}/.test(text)) return true;
            
            // 4) 包含下划线开头的属性访问 /xxx._yyy
            if (/\/[a-zA-Z]+\._[a-zA-Z]/.test(text)) return true;
            
            // 5) 纯数字或单字母路径
            if (/^\/\d+$/.test(text) || /^\/[a-zA-Z]$/.test(text)) return true;
            
            // 6) 包含多个连续大写字母（可能是混淆代码）
            if (/\/[A-Z]{10,}/.test(text)) return true;
            
            // 7) 路径中包含特殊字符组合（非正常API路径）
            if (/\/[a-zA-Z]+[A-Z]{5,}[a-z]+[A-Z]{5,}/.test(text)) return true;
            
            // 8) 路径段过长（单个段超过100字符）
            const segments = text.split('/');
            if (segments.some(seg => seg.length > 100)) return true;
            
            // 9) 🔥 过滤随机字符串路径（如 /WB/taQT5uSAQIYhGDXvvDvn17dy5cunDhkiU7F1haHraPcnWAWkA）
            // 检测路径段中包含大小写混合且长度超过20的随机字符串
            for (const seg of segments) {
                if (seg.length > 20) {
                    // 检查是否是大小写混合的随机字符串（包含大写、小写和数字混合）
                    const hasUpper = /[A-Z]/.test(seg);
                    const hasLower = /[a-z]/.test(seg);
                    const hasDigit = /\d/.test(seg);
                    const isAlphanumeric = /^[A-Za-z0-9]+$/.test(seg);
                    
                    // 如果是纯字母数字且大小写混合，很可能是随机字符串
                    if (isAlphanumeric && hasUpper && hasLower && seg.length > 25) {
                        return true;
                    }
                    
                    // 检查是否有过多的大小写交替（随机字符串特征）
                    let caseChanges = 0;
                    for (let i = 1; i < seg.length; i++) {
                        const prevIsUpper = /[A-Z]/.test(seg[i-1]);
                        const currIsUpper = /[A-Z]/.test(seg[i]);
                        const prevIsLetter = /[a-zA-Z]/.test(seg[i-1]);
                        const currIsLetter = /[a-zA-Z]/.test(seg[i]);
                        if (prevIsLetter && currIsLetter && prevIsUpper !== currIsUpper) {
                            caseChanges++;
                        }
                    }
                    // 如果大小写交替次数过多（超过段长度的30%），认为是随机字符串
                    if (caseChanges > seg.length * 0.3 && seg.length > 15) {
                        return true;
                    }
                }
            }
            
            // 10) 过滤看起来像 Base64 或 hash 的路径段
            for (const seg of segments) {
                // Base64 特征：长度是4的倍数，只包含字母数字和+/=
                if (seg.length >= 32 && seg.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(seg)) {
                    return true;
                }
                // Hash 特征：固定长度的十六进制字符串
                if ((seg.length === 32 || seg.length === 40 || seg.length === 64) && /^[a-fA-F0-9]+$/.test(seg)) {
                    return true;
                }
            }
            
            return false;
        } catch {
            return false;
        }
    }

    /**
     * 统一过滤入口：先执行内容类型包含式过滤，再执行正则二次过滤
     * @param {string} text
     * @returns {boolean}
     */
    shouldFilter(text) {
        return this.containsFilteredContentType(text) || this.isFilteredByRegex(text);
    }

    /**
     * 过滤静态文件路径
     * @param {Array} paths - 路径数组
     * @returns {Array} 过滤后的路径数组
     */
    filterStaticPaths(paths) {
        return paths.filter(path => {
            // 检查是否包含需要过滤的内容类型
            if (this.containsFilteredContentType(path)) {
                return false;
            }
            // 新增：基于正则的二次过滤
            if (this.isFilteredByRegex(path)) {
                return false;
            }
            
            // 获取文件扩展名
            const ext = path.toLowerCase().match(/\.[^.]*$/);
            if (!ext) return true; // 没有扩展名的保留
            
            // 检查是否为静态文件扩展名
            return !this.staticFileExtensions.includes(ext[0]);
        });
    }

    /**
     * 过滤相对路径中的静态文件
     * @param {Array} relativePaths - 相对路径数组
     * @returns {Array} 过滤后的相对路径数组
     */
    filterStaticRelativePaths(relativePaths) {
        return relativePaths.filter(path => {
            // 检查是否包含需要过滤的内容类型
            if (this.containsFilteredContentType(path)) {
                return false;
            }
            // 新增：基于正则的二次过滤
            if (this.isFilteredByRegex(path)) {
                return false;
            }
            
            // 🔥 使用增强的静态资源路径检测
            if (this.isStaticFile(path)) {
                return false;
            }
            
            // 🔥 使用专门的静态资源路径检测
            if (this.isStaticResourcePath(path)) {
                return false;
            }
            
            // 处理相对路径，可能包含 ../ 或 ./
            const normalizedPath = path.replace(/^\.\.?\//, '');
            
            // 获取文件扩展名
            const ext = normalizedPath.toLowerCase().match(/\.[^.]*$/);
            if (!ext) return true; // 没有扩展名的保留
            
            // 检查是否为静态文件扩展名
            const isStaticFile = this.staticFileExtensions.includes(ext[0]);
            
            // 记录过滤的静态文件（用于调试）
            if (isStaticFile) {
                //console.log(`🚫 [PatternExtractor] 过滤相对路径静态文件: ${path}`);
            }
            
            return !isStaticFile;
        });
    }

    // 处理相对路径API，去除开头的"."符号但保留"/"
    processRelativeApi(api) {
        try {
            // 去除开头的"."符号，但保留"/"
            if (api.startsWith('./')) {
                return api.substring(1); // 去除开头的"."，保留"/"
            } else if (api.startsWith('.') && !api.startsWith('/')) {
                return api.substring(1); // 去除开头的"."
            }
            return api; // 其他情况保持不变
        } catch (error) {
            console.warn('⚠️ 处理相对路径API时出错:', error);
            return api;
        }
    }
    
    /**
     * 验证并过滤身份证号码，只保留18位有效身份证
     * @param {Array} idCards - 提取到的身份证号码数组
     * @returns {Array} 验证通过的18位身份证号码数组
     */
    validateIdCards(idCards) {
        if (!this.idCardFilter || !Array.isArray(idCards)) {
            return idCards || [];
        }
        
        const validIdCards = [];
        
        for (const idCard of idCards) {
            try {
                const cleanIdCard = idCard.replace(/['"]/g, '').trim();
                
                // 只处理18位身份证
                if (cleanIdCard.length !== 18) {
                    continue;
                }
                
                const result = this.idCardFilter.validate(cleanIdCard);
                if (result.valid && result.type === '18位身份证') {
                    validIdCards.push(cleanIdCard);
                    //console.log(`✅ 身份证验证通过: ${cleanIdCard} (${result.province}, ${result.gender})`);
                } else {
                    //console.log(`❌ 身份证验证失败: ${cleanIdCard} - ${result.error || '格式错误'}`);
                }
            } catch (error) {
                console.error('❌ 身份证验证过程出错:', error, '身份证:', idCard);
            }
        }
        
        return validIdCards;
    }
    
    /**
     * 加载自定义正则表达式配置 - 统一化版本
     */
    async loadCustomPatterns() {
        try {
            //console.log('🔄 PatternExtractor统一化版本开始加载自定义配置...');
            
            // 修复：保存现有的自定义正则模式，避免被清空
            const existingCustomPatterns = {};
            Object.keys(this.patterns).forEach(key => {
                if (key.startsWith('custom_')) {
                    existingCustomPatterns[key] = this.patterns[key];
                    //console.log(`💾 [PatternExtractor] 保存现有自定义正则: ${key}`);
                }
            });
            
            // 只重置非自定义的正则模式
            const newPatterns = {};
            Object.keys(existingCustomPatterns).forEach(key => {
                newPatterns[key] = existingCustomPatterns[key];
            });
            this.patterns = newPatterns;
            
            // 加载所有相关配置：regexSettings + 动态自定义正则配置
            const result = await chrome.storage.local.get(['regexSettings', 'customRegexConfigs']);
            
            //console.log('📊 PatternExtractor加载的存储数据:', result);
            
            if (result.regexSettings) {
                //console.log('🔄 PatternExtractor加载regexSettings配置:', result.regexSettings);
                this.updatePatterns(result.regexSettings);
                //console.log('✅ PatternExtractor基础正则表达式配置已更新');
            } else {
                console.warn('⚠️ PatternExtractor未找到regexSettings配置，添加基础资源正则');
                // 添加基础资源文件正则（这些不依赖设置界面，是基础功能）
                this.patterns.jsFile = /<script[^>]*\ssrc\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`][^>]*>|(?:src|href)\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`]|import\s+.*?from\s+["'`]([^"'`]*\.js)["'`]|require\s*\(\s*["'`]([^"'`]*\.js)["'`]\s*\)/gi;
                this.patterns.cssFile = /(?:href)\s*=\s*["'`]([^"'`]*\.css(?:\?[^"'`]*)?)["'`]/gi;
                this.patterns.image = /(?:src|href|data-src)\s*=\s*["'`]([^"'`]*\.(?:jpg|jpeg|png|gif|bmp|svg|webp|ico|tiff)(?:\?[^"'`]*)?)["'`]/gi;
                this.patterns.url = /(https?:\/\/[a-zA-Z0-9\-\.]+(?:\:[0-9]+)?(?:\/[^\s"'<>]*)?)/g;
            }
            
            // 加载动态自定义正则配置 - 修复：支持对象和数组两种存储格式
            if (result.customRegexConfigs) {
                //console.log('🔄 PatternExtractor开始加载动态自定义正则配置:', result.customRegexConfigs);
                
                let configsToProcess = [];
                
                // 检查存储格式：对象格式还是数组格式
                if (Array.isArray(result.customRegexConfigs)) {
                    // 数组格式
                    configsToProcess = result.customRegexConfigs;
                    //console.log('📋 PatternExtractor检测到数组格式的自定义正则配置');
                } else if (typeof result.customRegexConfigs === 'object') {
                    // 对象格式，转换为数组
                    configsToProcess = Object.entries(result.customRegexConfigs).map(([key, config]) => ({
                        key: `custom_${key}`, // 添加 custom_ 前缀
                        name: config.name,
                        pattern: config.pattern,
                        createdAt: config.createdAt
                    }));
                    //console.log('📋 PatternExtractor检测到对象格式的自定义正则配置，已转换为数组格式');
                }
                
                if (configsToProcess.length > 0) {
                    configsToProcess.forEach((config, index) => {
                        try {
                            if (config.key && config.pattern && config.name) {
                                // 将自定义正则添加到patterns中
                                const regex = new RegExp(config.pattern, 'g');
                                this.patterns[config.key] = regex;
                                //console.log(`✅ PatternExtractor添加自定义正则 ${index + 1}: ${config.name} (${config.key}) - ${config.pattern}`);
                            } else {
                                console.warn(`⚠️ PatternExtractor跳过无效的自定义正则配置 ${index + 1}:`, config);
                            }
                        } catch (error) {
                            console.error(`❌ PatternExtractor自定义正则配置 ${index + 1} 格式错误:`, error, config);
                        }
                    });
                    
                    //console.log(`✅ PatternExtractor动态自定义正则配置加载完成，共加载 ${configsToProcess.length} 个配置`);
                } else {
                    //console.log('⚠️ PatternExtractor动态自定义正则配置为空');
                }
            } else {
                //console.log('ℹ️ PatternExtractor未找到动态自定义正则配置');
            }
            
            // 标记配置已加载
            this.customPatternsLoaded = true;
            //console.log('✅ PatternExtractor统一化版本自定义配置加载完成');
            //console.log('📊 PatternExtractor当前可用的正则模式:', Object.keys(this.patterns));
            
        } catch (error) {
            console.error('❌ PatternExtractor加载自定义正则表达式配置失败:', error);
            this.customPatternsLoaded = true; // 即使失败也标记为已加载，避免无限等待
        }
    }
    
    /**
     * 解析正则表达式输入，支持 /pattern/flags 格式和普通字符串格式
     * @param {string} input - 输入的正则表达式字符串
     * @param {string} defaultFlags - 默认标志，默认为 'g'
     * @returns {RegExp|null} 解析后的正则表达式对象
     */
    parseRegexInput(input, defaultFlags = 'g') {
        if (typeof input !== 'string' || !input.trim()) {
            return null;
        }
        
        const trimmedInput = input.trim();
        
        // 检查是否为 /pattern/flags 格式
        const match = trimmedInput.match(/^\/(.*)\/([gimuy]*)$/);
        if (match) {
            const [, pattern, flags] = match;
            try {
                return new RegExp(pattern, flags || defaultFlags);
            } catch (error) {
                console.error('❌ 正则表达式格式错误 (字面量格式):', error, 'Pattern:', pattern, 'Flags:', flags);
                return null;
            }
        } else {
            // 兼容旧写法（非 /.../ 形式）
            try {
                return new RegExp(trimmedInput, defaultFlags);
            } catch (error) {
                console.error('❌ 正则表达式格式错误 (字符串格式):', error, 'Pattern:', trimmedInput);
                return null;
            }
        }
    }

    /**
     * 更新正则表达式配置 - 只使用设置界面的配置
     */
    updatePatterns(customSettings) {
        try {
            //console.log('🔧 开始更新正则表达式配置...', customSettings);
            
            // 保存现有的自定义正则模式
            const existingCustomPatterns = {};
            Object.keys(this.patterns).forEach(key => {
                if (key.startsWith('custom_')) {
                    existingCustomPatterns[key] = this.patterns[key];
                    //console.log(`💾 [PatternExtractor] 保存现有自定义正则: ${key}`);
                }
            });
            
            // 清空所有现有模式
            this.patterns = {};
            
            // 恢复自定义正则模式
            Object.keys(existingCustomPatterns).forEach(key => {
                this.patterns[key] = existingCustomPatterns[key];
                //console.log(`🔄 [PatternExtractor] 恢复自定义正则: ${key}`);
            });
            
            // 更新绝对路径API正则
            if (customSettings.absoluteApis && customSettings.absoluteApis.trim()) {
                this.patterns.absoluteApi = this.parseRegexInput(customSettings.absoluteApis);
                //console.log('📝 更新绝对路径API正则表达式:', customSettings.absoluteApis);
            }
            
            // 更新相对路径API正则
            if (customSettings.relativeApis && customSettings.relativeApis.trim()) {
                this.patterns.relativeApi = this.parseRegexInput(customSettings.relativeApis);
                //console.log('📝 更新相对路径API正则表达式:', customSettings.relativeApis);
            }
            
            // 更新域名正则
            if (customSettings.domains && customSettings.domains.trim()) {
                this.patterns.domain = this.parseRegexInput(customSettings.domains);
                //console.log('📝 更新域名正则表达式:', customSettings.domains);
            }
            
            // 更新邮箱正则
            if (customSettings.emails && customSettings.emails.trim()) {
                this.patterns.email = this.parseRegexInput(customSettings.emails);
                //console.log('📝 更新邮箱正则表达式:', customSettings.emails);
            }
            
            // 更新电话正则
            if (customSettings.phoneNumbers && customSettings.phoneNumbers.trim()) {
                this.patterns.phone = this.parseRegexInput(customSettings.phoneNumbers);
                //console.log('📝 更新电话正则表达式:', customSettings.phoneNumbers);
            }
            
            // 更新敏感信息正则
            if (customSettings.credentials && customSettings.credentials.trim()) {
                this.patterns.credentials = this.parseRegexInput(customSettings.credentials, 'gi');
                //console.log('📝 更新敏感信息正则表达式:', customSettings.credentials);
            }
            
            // 更新IP地址正则
            if (customSettings.ipAddresses && customSettings.ipAddresses.trim()) {
                this.patterns.ip = this.parseRegexInput(customSettings.ipAddresses);
                //console.log('📝 更新IP地址正则表达式:', customSettings.ipAddresses);
            }
            
            // 更新路径正则
            if (customSettings.paths && customSettings.paths.trim()) {
                this.patterns.paths = this.parseRegexInput(customSettings.paths);
                //console.log('📝 更新路径正则表达式:', customSettings.paths);
            }
            
            // 更新JWT令牌正则
            if (customSettings.jwts && customSettings.jwts.trim()) {
                this.patterns.jwt = this.parseRegexInput(customSettings.jwts);
                //console.log('📝 更新JWT令牌正则表达式:', customSettings.jwts);
            }
            
            // 更新GitHub链接正则
            if (customSettings.githubUrls && customSettings.githubUrls.trim()) {
                this.patterns.github = this.parseRegexInput(customSettings.githubUrls);
                //console.log('📝 更新GitHub链接正则表达式:', customSettings.githubUrls);
            }
            
            // 更新Vue文件正则
            if (customSettings.vueFiles && customSettings.vueFiles.trim()) {
                this.patterns.vue = this.parseRegexInput(customSettings.vueFiles);
                //console.log('📝 更新Vue文件正则表达式:', customSettings.vueFiles);
            }
            
            // 更新公司名称正则
            if (customSettings.companies && customSettings.companies.trim()) {
                this.patterns.company = this.parseRegexInput(customSettings.companies);
                //console.log('📝 更新公司名称正则表达式:', customSettings.companies);
            }
            
            // 更新注释正则
            if (customSettings.comments && customSettings.comments.trim()) {
                this.patterns.comments = this.parseRegexInput(customSettings.comments, 'gm');
                //console.log('📝 更新注释正则表达式:', customSettings.comments);
            }
            
            // 更新身份证正则
            if (customSettings.idCards && customSettings.idCards.trim()) {
                this.patterns.idCard = this.parseRegexInput(customSettings.idCards);
                //console.log('📝 更新身份证正则表达式:', customSettings.idCards);
            }
            
            // 更新Bearer Token正则
            if (customSettings.bearerTokens && customSettings.bearerTokens.trim()) {
                this.patterns.bearerToken = this.parseRegexInput(customSettings.bearerTokens);
                //console.log('📝 更新Bearer Token正则表达式:', customSettings.bearerTokens);
            }
            
            // 更新Basic Auth正则
            if (customSettings.basicAuth && customSettings.basicAuth.trim()) {
                this.patterns.basicAuth = this.parseRegexInput(customSettings.basicAuth);
                //console.log('📝 更新Basic Auth正则表达式:', customSettings.basicAuth);
            }
            
            // 更新Authorization Header正则
            if (customSettings.authHeaders && customSettings.authHeaders.trim()) {
                this.patterns.authHeader = this.parseRegexInput(customSettings.authHeaders);
                //console.log('📝 更新Authorization Header正则表达式:', customSettings.authHeaders);
            }
            
            // 更新微信AppID正则
            if (customSettings.wechatAppIds && customSettings.wechatAppIds.trim()) {
                this.patterns.wechatAppId = this.parseRegexInput(customSettings.wechatAppIds);
                //console.log('📝 更新微信AppID正则表达式:', customSettings.wechatAppIds);
            }
            
            // 更新AWS密钥正则
            if (customSettings.awsKeys && customSettings.awsKeys.trim()) {
                this.patterns.awsKey = this.parseRegexInput(customSettings.awsKeys);
                //console.log('📝 更新AWS密钥正则表达式:', customSettings.awsKeys);
            }
            
            // 更新Google API Key正则
            if (customSettings.googleApiKeys && customSettings.googleApiKeys.trim()) {
                this.patterns.googleApiKey = this.parseRegexInput(customSettings.googleApiKeys);
                //console.log('📝 更新Google API Key正则表达式:', customSettings.googleApiKeys);
            }
            
            // 更新GitHub Token正则
            if (customSettings.githubTokens && customSettings.githubTokens.trim()) {
                this.patterns.githubToken = this.parseRegexInput(customSettings.githubTokens);
                //console.log('📝 更新GitHub Token正则表达式:', customSettings.githubTokens);
            }
            
            // 更新GitLab Token正则
            if (customSettings.gitlabTokens && customSettings.gitlabTokens.trim()) {
                this.patterns.gitlabToken = this.parseRegexInput(customSettings.gitlabTokens);
                //console.log('📝 更新GitLab Token正则表达式:', customSettings.gitlabTokens);
            }
            
            // 更新Webhook URLs正则
            if (customSettings.webhookUrls && customSettings.webhookUrls.trim()) {
                this.patterns.webhookUrls = this.parseRegexInput(customSettings.webhookUrls);
                //console.log('📝 更新Webhook URLs正则表达式:', customSettings.webhookUrls);
            }
            
            // 更新加密算法使用正则
            if (customSettings.cryptoUsage && customSettings.cryptoUsage.trim()) {
                this.patterns.cryptoUsage = this.parseRegexInput(customSettings.cryptoUsage, 'gi');
                //console.log('📝 更新加密算法使用正则表达式:', customSettings.cryptoUsage);
            }
            
            // 添加基础资源文件正则（这些不依赖设置界面，是基础功能）
            this.patterns.jsFile = /<script[^>]*\ssrc\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`][^>]*>|(?:src|href)\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`]|import\s+.*?from\s+["'`]([^"'`]*\.js)["'`]|require\s*\(\s*["'`]([^"'`]*\.js)["'`]\s*\)/gi;
            this.patterns.cssFile = /(?:href)\s*=\s*["'`]([^"'`]*\.css(?:\?[^"'`]*)?)["'`]/gi;
            this.patterns.image = /(?:src|href|data-src)\s*=\s*["'`]([^"'`]*\.(?:jpg|jpeg|png|gif|bmp|svg|webp|ico|tiff)(?:\?[^"'`]*)?)["'`]/gi;
            this.patterns.url = /(https?:\/\/[a-zA-Z0-9\-\.]+(?:\:[0-9]+)?(?:\/[^\s"'<>]*)?)/g;
            
            //console.log('✅ 正则表达式配置更新完成');
            //console.log('📊 当前可用的正则模式:', Object.keys(this.patterns));
            
            // 保存当前配置状态
            this.customRegexConfig = customSettings;
            
        } catch (error) {
            console.error('❌ 更新正则表达式配置失败:', error);
        }
    }
    
    /**
     * 确保自定义配置已加载 - 统一化版本
     * 修复：只在必要时重新加载配置，避免清空现有配置
     */
    async ensureCustomPatternsLoaded() {
        if (!this.customPatternsLoaded) {
            //console.log('🔄 PatternExtractor统一化版本：首次加载配置...');
            await this.loadCustomPatterns();
        } else {
            //console.log('✅ PatternExtractor统一化版本：配置已加载，跳过重复加载');
        }
    }
    
    /**
     * 使用exec方法执行正则匹配 - 性能优化版本
     */
    executeRegexWithExec(regex, content, results, resultKey, patternKey) {
        // 重置正则表达式状态
        regex.lastIndex = 0;
        let match;
        let matchCount = 0;
        let addedCount = 0;
        let lastIndex = -1;
        
        // 性能优化：限制最大匹配数
        const maxMatches = this.performanceConfig.maxMatchesPerPattern;
        
        while ((match = regex.exec(content)) !== null) {
            const matchedText = match[1] || match[0];
            if (matchedText && matchedText.trim()) {
                const trimmedText = matchedText.trim();
                
                // 快速过滤检查
                let shouldSkip = false;
                
                // 过滤绝对路径API中包含协议的内容
                if (patternKey === 'absoluteApi' && (trimmedText.includes('http://') || trimmedText.includes('https://'))) {
                    shouldSkip = true;
                }
                // 过滤绝对路径API中的静态文件
                else if (patternKey === 'absoluteApi' && this.isStaticFile(trimmedText)) {
                    shouldSkip = true;
                }
                // 过滤域名黑名单和垃圾域名
                else if (patternKey === 'domain' && (this.isDomainBlacklisted(trimmedText) || this.isGarbageDomain(trimmedText))) {
                    shouldSkip = true;
                }
                // 🔥 过滤Vue文件（只保留完整路径）
                else if (patternKey === 'vue' && !this.isValidVueFilePath(trimmedText)) {
                    shouldSkip = true;
                }
                // 🔥 过滤垃圾绝对路径
                else if (patternKey === 'absoluteApi' && this.isGarbageAbsolutePath(trimmedText)) {
                    shouldSkip = true;
                }
                // 过滤包含过滤内容类型的内容
                else if (this.containsFilteredContentType(trimmedText)) {
                    shouldSkip = true;
                }
                // 基于正则的二次过滤
                else if (this.isFilteredByRegex(trimmedText)) {
                    shouldSkip = true;
                }
                // 🔥 过滤敏感凭据中的 CSS 样式代码
                else if (patternKey === 'credentials' && this.isCssStyleCode(trimmedText)) {
                    shouldSkip = true;
                }
                
                if (!shouldSkip) {
                    // 🔥 对 Vue 文件去除引号
                    let finalText = trimmedText;
                    if (patternKey === 'vue') {
                        finalText = trimmedText.replace(/^["']|["']$/g, '');
                    }
                    results[resultKey].add(finalText);
                    addedCount++;
                }
                matchCount++;
            }
            
            // 性能优化：达到最大匹配数时停止
            if (addedCount >= maxMatches) {
                console.warn(`⚠️ [PatternExtractor] ${patternKey} 达到最大匹配数 ${maxMatches}，停止匹配`);
                break;
            }
            
            // 防止无限循环
            if (matchCount > maxMatches * 2) {
                console.warn(`⚠️ [PatternExtractor] ${patternKey} 匹配次数过多，停止匹配`);
                break;
            }
            
            // 检查是否陷入无限循环
            if (regex.lastIndex === lastIndex) {
                regex.lastIndex = lastIndex + 1;
                if (regex.lastIndex >= content.length) {
                    break;
                }
            }
            lastIndex = regex.lastIndex;
            
            // 对于非全局正则或者lastIndex为0的情况，手动推进
            if (!regex.global || regex.lastIndex === 0) {
                regex.lastIndex = match.index + 1;
                if (regex.lastIndex >= content.length) {
                    break;
                }
            }
        }
        
        //console.log(`📊 [PatternExtractor] ${patternKey} exec方法提取完成，共找到 ${matchCount} 个`);
    }
    
    // 专门的API提取方法
    extractAPIs(content, results) {
        //console.log('🔍 [PatternExtractor] 开始提取API...');
        //console.log('🔍 [PatternExtractor] 当前patterns对象:', Object.keys(this.patterns));
        //console.log('🔍 [PatternExtractor] absoluteApi配置:', this.patterns.absoluteApi);
        //console.log('🔍 [PatternExtractor] relativeApi配置:', this.patterns.relativeApi);
        
        // 检查是否有API正则配置
        if (!this.patterns.absoluteApi && !this.patterns.relativeApi) {
            console.warn('⚠️ [PatternExtractor] 未配置API正则表达式，跳过API提取');
            console.warn('⚠️ [PatternExtractor] absoluteApi存在:', !!this.patterns.absoluteApi);
            console.warn('⚠️ [PatternExtractor] relativeApi存在:', !!this.patterns.relativeApi);
            return;
        }
        
        // 移除内容大小限制，处理完整内容
        const processContent = content;
        
        //console.log(`📊 [PatternExtractor] 处理内容大小: ${processContent.length} 字符`);
        //console.log(`📊 [PatternExtractor] 内容预览: ${processContent.substring(0, 200)}...`);
        
        // 提取绝对路径API - 修复：支持RegExp对象
        if (this.patterns.absoluteApi) {
            //console.log(`🔍 [PatternExtractor] 开始提取绝对路径API`);
            //console.log(`🔍 [PatternExtractor] 绝对路径API正则类型: ${typeof this.patterns.absoluteApi}`);
            //console.log(`🔍 [PatternExtractor] 绝对路径API正则内容: ${this.patterns.absoluteApi.source || this.patterns.absoluteApi}`);
            
            let absoluteApiCount = 0;
            const regex = this.patterns.absoluteApi;
            
            // 重置正则表达式状态
            regex.lastIndex = 0;
            let match;
            let matchCount = 0;
            
            while ((match = regex.exec(processContent)) !== null) {
                const api = match[1] || match[0];
                //console.log(`🎯 [PatternExtractor] 绝对路径API匹配到: "${api}"`);
                if (api && api.trim()) {
                    const trimmedApi = api.trim();
                    // 🔥 添加校验：过滤掉包含http://或https://的绝对路径API
                    if (trimmedApi.includes('http://') || trimmedApi.includes('https://')) {
                        //console.log(`🚫 [PatternExtractor] 绝对路径API包含协议，已过滤: "${trimmedApi}"`);
                    }
                    // 🔥 新增校验：过滤掉静态文件（如.jpg, .png, .css等）
                    else if (this.isStaticFile(trimmedApi)) {
                        //console.log(`🚫 [PatternExtractor] 绝对路径API为静态文件，已过滤: "${trimmedApi}"`);
                    }
                    // 🔥 新增校验：过滤掉包含过滤内容类型的API
                    else if (this.shouldFilter(trimmedApi)) {
                        //console.log(`🚫 [PatternExtractor] 绝对路径API被shouldFilter过滤: "${trimmedApi}"`);
                    }
                    // 🔥 新增校验：过滤垃圾绝对路径
                    else if (this.isGarbageAbsolutePath(trimmedApi)) {
                        //console.log(`🚫 [PatternExtractor] 绝对路径API为垃圾路径，已过滤: "${trimmedApi}"`);
                    } else {
                        results.absoluteApis.add(trimmedApi);
                        absoluteApiCount++;
                        //console.log(`✅ [PatternExtractor] 绝对路径API添加: "${trimmedApi}"`);
                    }
                    matchCount++;
                }
                
                // 防止无限循环
                if (matchCount > 1000) {
                    console.warn(`⚠️ [PatternExtractor] 绝对路径API匹配次数过多，停止匹配`);
                    break;
                }
                
                // 检查是否陷入无限循环
                if (regex.lastIndex === match.index) {
                    console.warn(`⚠️ [PatternExtractor] 绝对路径API检测到无限循环，强制推进`);
                    regex.lastIndex = match.index + 1;
                    if (regex.lastIndex >= processContent.length) {
                        break;
                    }
                }
            }
            
            //console.log(`✅ [PatternExtractor] 绝对路径API提取完成，共找到 ${absoluteApiCount} 个API`);
        } else {
            console.warn('⚠️ [PatternExtractor] 绝对路径API配置为空');
        }
        
        // 提取相对路径API - 修复：支持RegExp对象
        if (this.patterns.relativeApi) {
            //console.log(`🔍 [PatternExtractor] 开始提取相对路径API`);
            //console.log(`🔍 [PatternExtractor] 相对路径API正则类型: ${typeof this.patterns.relativeApi}`);
            //console.log(`🔍 [PatternExtractor] 相对路径API正则内容: ${this.patterns.relativeApi.source || this.patterns.relativeApi}`);
            
            let relativeApiCount = 0;
            const regex = this.patterns.relativeApi;
            
            // 重置正则表达式状态
            regex.lastIndex = 0;
            let match;
            let matchCount = 0;
            
            while ((match = regex.exec(processContent)) !== null) {
                const api = match[1] || match[0];
                //console.log(`🎯 [PatternExtractor] 相对路径API匹配到: "${api}"`);
                if (api && api.trim()) {
                    // 🔥 新增：处理相对路径API，去除开头的"."符号但保留"/"
                    const processedApi = this.processRelativeApi(api.trim());
                    
                    // 🔥 跨类别去重：如果已在 absoluteApis 中存在，跳过
                    if (results.absoluteApis.has(processedApi)) {
                        //console.log(`🚫 [PatternExtractor] 相对路径API已在绝对路径中存在，跳过: "${processedApi}"`);
                    }
                    // 🔥 新增特殊处理：过滤相对路径API中的静态文件（应用绝对路径API的过滤模式）
                    else if (this.isStaticFile(processedApi)) {
                        //console.log(`🚫 [PatternExtractor] 相对路径API为静态文件，已过滤: "${processedApi}"`);
                    }
                    // 🔥 增强：使用专门的静态资源路径检测
                    else if (this.isStaticResourcePath(processedApi)) {
                        //console.log(`🚫 [PatternExtractor] 相对路径API为静态资源路径，已过滤: "${processedApi}"`);
                    }
                    // 🔥 新增特殊处理：过滤相对路径API中包含过滤内容类型的API
                    else if (this.shouldFilter(processedApi)) {
                        //console.log(`🚫 [PatternExtractor] 相对路径API被shouldFilter过滤: "${processedApi}"`);
                    } else {
                        results.relativeApis.add(processedApi);
                        relativeApiCount++;
                        //console.log(`✅ [PatternExtractor] 相对路径API处理后添加: "${processedApi}" (原始: "${api.trim()}")`);
                    }
                    matchCount++;
                }
                
                // 防止无限循环
                if (matchCount > 1000) {
                    console.warn(`⚠️ [PatternExtractor] 相对路径API匹配次数过多，停止匹配`);
                    break;
                }
                
                // 检查是否陷入无限循环
                if (regex.lastIndex === match.index) {
                    console.warn(`⚠️ [PatternExtractor] 相对路径API检测到无限循环，强制推进`);
                    regex.lastIndex = match.index + 1;
                    if (regex.lastIndex >= processContent.length) {
                        break;
                    }
                }
            }
            
            //console.log(`✅ [PatternExtractor] 相对路径API提取完成，共找到 ${relativeApiCount} 个API`);
        } else {
            console.warn('⚠️ [PatternExtractor] 相对路径API配置为空');
        }
        
        //console.log(`📊 [PatternExtractor] API提取总结 - 绝对路径: ${results.absoluteApis.size}, 相对路径: ${results.relativeApis.size}`);
    }
    
    // 提取其他资源
    extractOtherResources(content, results, sourceUrl = '') {
        //console.log('📁 [PatternExtractor] 开始提取其他资源...');
        
        // 移除内容大小限制，处理完整内容
        const processContent = content;
        
        //console.log(`📊 [PatternExtractor] 其他资源处理内容大小: ${processContent.length} 字符`);
        //console.log(`🌐 [PatternExtractor] 当前处理的URL: ${sourceUrl}`);
        
        // 提取JS文件
        if (this.patterns.jsFile) {
            //console.log('🔍 [PatternExtractor] 开始提取JS文件...');
            this.patterns.jsFile.lastIndex = 0;
            let match;
            let jsFileCount = 0;
            while ((match = this.patterns.jsFile.exec(processContent)) !== null) {
                const jsFile = match[1] || match[2] || match[3] || match[4];
                if (jsFile) {
                    const cleanJsFile = jsFile.replace(/["'`]/g, '').trim();
                    results.jsFiles.add(cleanJsFile);
                    jsFileCount++;
                    //console.log(`✅ [PatternExtractor] JS文件添加: "${cleanJsFile}"`);
                }
            }
            //console.log(`📊 [PatternExtractor] JS文件提取完成，共找到 ${jsFileCount} 个`);
        }
        
        // 提取CSS文件
        if (this.patterns.cssFile) {
            //console.log('🔍 [PatternExtractor] 开始提取CSS文件...');
            this.patterns.cssFile.lastIndex = 0;
            let match;
            let cssFileCount = 0;
            while ((match = this.patterns.cssFile.exec(processContent)) !== null) {
                const cssFile = match[1];
                if (cssFile) {
                    const cleanCssFile = cssFile.replace(/["'`]/g, '').trim();
                    // 🔥 应用过滤：检查是否包含过滤内容类型
                    if (!this.containsFilteredContentType(cleanCssFile)) {
                        results.cssFiles.add(cleanCssFile);
                        cssFileCount++;
                        //console.log(`✅ [PatternExtractor] CSS文件添加: "${cleanCssFile}"`);
                    } else {
                        //console.log(`🚫 [PatternExtractor] CSS文件包含过滤内容类型，已过滤: "${cleanCssFile}"`);
                    }
                }
            }
            //console.log(`📊 [PatternExtractor] CSS文件提取完成，共找到 ${cssFileCount} 个`);
        }
        
        // 提取图片
        if (this.patterns.image) {
            //console.log('🔍 [PatternExtractor] 开始提取图片...');
            this.patterns.image.lastIndex = 0;
            let match;
            let imageCount = 0;
            while ((match = this.patterns.image.exec(processContent)) !== null) {
                const image = match[1];
                if (image) {
                    const cleanImage = image.replace(/["'`]/g, '').trim();
                    // 🔥 应用过滤：检查是否包含过滤内容类型
                    if (!this.containsFilteredContentType(cleanImage)) {
                        results.images.add(cleanImage);
                        imageCount++;
                        //console.log(`✅ [PatternExtractor] 图片添加: "${cleanImage}"`);
                    } else {
                        //console.log(`🚫 [PatternExtractor] 图片包含过滤内容类型，已过滤: "${cleanImage}"`);
                    }
                }
            }
            //console.log(`📊 [PatternExtractor] 图片提取完成，共找到 ${imageCount} 个`);
        }
        
        // 提取URL - 🔥 新增：过滤图片文件，重新分类JS文件和CSS文件
        if (this.patterns.url) {
            //console.log('🔍 [PatternExtractor] 开始提取URL...');
            
            this.patterns.url.lastIndex = 0;
            let match;
            let urlCount = 0;
            let filteredImageCount = 0;
            let reclassifiedJsCount = 0;
            let reclassifiedCssCount = 0;
            
            while ((match = this.patterns.url.exec(processContent)) !== null) {
                const url = match[0];
                if (url) {
                    // 🔥 新增：检查是否为图片文件
                    if (this.isImageFile(url)) {
                        filteredImageCount++;
                        //console.log(`🚫 [PatternExtractor] URL为图片文件，已过滤: "${url}"`);
                        
                        // 🔥 增强：从图片 URL 中也提取域名（图片可能来自 CDN 等外部域名）
                        const imgDomain = this.extractDomainFromUrl(url);
                        if (imgDomain && !this.isDomainBlacklisted(imgDomain) && !this.isGarbageDomain(imgDomain)) {
                            results.domains.add(imgDomain);
                        }
                        continue;
                    }
                    
                    // 🔥 新增：检查是否为JS文件，如果是则重新分类到JS文件中
                    if (this.isJsFile(url)) {
                        results.jsFiles.add(url);
                        reclassifiedJsCount++;
                        //console.log(`🔄 [PatternExtractor] URL为JS文件，已重新分类到JS文件: "${url}"`);
                        
                        // 🔥 增强：从 JS 文件 URL 中也提取域名
                        const jsDomain = this.extractDomainFromUrl(url);
                        if (jsDomain && !this.isDomainBlacklisted(jsDomain) && !this.isGarbageDomain(jsDomain)) {
                            results.domains.add(jsDomain);
                        }
                        continue;
                    }
                    
                    // 🔥 新增：检查是否为CSS文件，如果是则重新分类到CSS文件中
                    if (this.isCssFile(url)) {
                        results.cssFiles.add(url);
                        reclassifiedCssCount++;
                        //console.log(`🔄 [PatternExtractor] URL为CSS文件，已重新分类到CSS文件: "${url}"`);
                        
                        // 🔥 增强：从 CSS 文件 URL 中也提取域名
                        const cssDomain = this.extractDomainFromUrl(url);
                        if (cssDomain && !this.isDomainBlacklisted(cssDomain) && !this.isGarbageDomain(cssDomain)) {
                            results.domains.add(cssDomain);
                        }
                        continue;
                    }
                    
                    // 🔥 应用过滤：检查是否包含过滤内容类型
                    if (!this.containsFilteredContentType(url)) {
                        results.urls.add(url);
                        urlCount++;
                        //console.log(`✅ [PatternExtractor] URL添加: "${url}"`);
                        
                        // 🔥 新增：从URL中提取域名并添加到域名列表
                        const extractedDomain = this.extractDomainFromUrl(url);
                        if (extractedDomain) {
                            const isBlacklisted = this.isDomainBlacklisted(extractedDomain);
                            const isGarbage = this.isGarbageDomain(extractedDomain);
                            
                            if (!isBlacklisted && !isGarbage) {
                                results.domains.add(extractedDomain);
                                //console.log(`✅ [PatternExtractor] 从URL提取域名成功: "${extractedDomain}"`);
                            }
                        }
                    }
                }
            }
            //console.log(`📊 [PatternExtractor] URL提取完成，共找到 ${urlCount} 个`);
        }
        
        // 🔥 提取 Vue 文件
        this.extractVueFiles(processContent, results);
        
        // 🔥 提取 Source Map 文件
        this.extractSourceMapFiles(processContent, results);
        
        //console.log('✅ [PatternExtractor] 其他资源提取完成');
    }
    
    /**
     * 🔥 提取 Vue 单文件组件引用
     * @param {string} content - 内容
     * @param {Object} results - 结果对象
     */
    extractVueFiles(content, results) {
        if (!content) return;
        
        // Vue 文件引用模式
        const vuePatterns = [
            // import 语句
            /import\s+(?:\w+|\{[^}]+\})\s+from\s+['"]([^'"]+\.vue)['"]/gi,
            // require 语句
            /require\s*\(\s*['"]([^'"]+\.vue)['"]\s*\)/gi,
            // 动态 import
            /import\s*\(\s*['"]([^'"]+\.vue)['"]\s*\)/gi,
            // webpack chunk 注释
            /webpackChunkName:\s*['"][^'"]+['"]\s*\*\/\s*['"]([^'"]+\.vue)['"]/gi,
            // 字符串中的 .vue 路径
            /['"]([^'"]*\/[^'"]+\.vue)['"]/gi
        ];
        
        for (const pattern of vuePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const vuePath = match[1];
                if (vuePath && !vuePath.includes('node_modules')) {
                    results.vueFiles.add({
                        value: vuePath,
                        type: 'vue-import',
                        extractedAt: new Date().toISOString()
                    });
                }
            }
        }
    }
    
    /**
     * 🔥 提取 Source Map 文件引用
     * @param {string} content - 内容
     * @param {Object} results - 结果对象
     */
    extractSourceMapFiles(content, results) {
        if (!content) return;
        
        // 初始化 sourceMapFiles 如果不存在
        if (!results.sourceMapFiles) {
            results.sourceMapFiles = new Set();
        }
        
        // Source Map 引用模式
        const sourceMapPatterns = [
            // sourceMappingURL 注释
            /\/\/[#@]\s*sourceMappingURL=([^\s\n]+)/g,
            /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//g,
            // .map 文件引用
            /['"]([^'"]+\.map)['"]/gi,
            // .js.map 文件引用
            /['"]([^'"]+\.js\.map)['"]/gi
        ];
        
        for (const pattern of sourceMapPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const mapPath = match[1];
                if (mapPath && !mapPath.startsWith('data:')) {
                    results.sourceMapFiles.add({
                        value: mapPath,
                        type: 'sourcemap-reference',
                        extractedAt: new Date().toISOString()
                    });
                }
            }
        }
    }
    
    /**
     * 🔥 从URL中提取域名
     * @param {string} url - 完整的URL
     * @returns {string|null} 提取的域名，如果无法提取则返回null
     */
    extractDomainFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        
        try {
            // 移除协议前缀
            let domain = url.replace(/^https?:\/\//, '');
            
            // 移除www前缀
            domain = domain.replace(/^www\./, '');
            
            // 移除路径、查询参数、锚点和端口
            domain = domain.split('/')[0];
            domain = domain.split('?')[0];
            domain = domain.split('#')[0];
            domain = domain.split(':')[0];
            
            // 清理并转小写
            domain = domain.toLowerCase().trim();
            
            // 验证域名格式
            if (!domain || domain.length < 3 || !domain.includes('.')) {
                return null;
            }
            
            // 检查是否是IP地址（不作为域名返回）
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
                return null;
            }
            
            return domain;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 提取动态自定义正则模式 - 统一化版本
     * 🔥 性能优化：使用已加载的 patterns 而不是重新从 storage 读取
     */
    async extractDynamicCustomPatterns(content, results) {
        try {
            //console.log('🔄 [PatternExtractor] 开始提取动态自定义正则模式...');
            
            // 🔥 性能优化：直接使用已加载的 patterns，不再重复读取 storage
            // 自定义正则已经在 loadCustomPatterns 中加载到 this.patterns 中了
            const customPatternKeys = Object.keys(this.patterns).filter(key => key.startsWith('custom_'));
            
            if (customPatternKeys.length === 0) {
                //console.log('ℹ️ [PatternExtractor] 未找到动态自定义正则配置');
                return;
            }
            
            // 🔥 性能优化：移除重复的 storage 读取
            const storageResult = { customRegexConfigs: null }; // 占位符，不再使用
            
            if (!storageResult.customRegexConfigs) {
                //console.log('ℹ️ [PatternExtractor] 未找到动态自定义正则配置');
                return;
            }
            
            //console.log('📊 [PatternExtractor] 当前动态自定义正则配置:', storageResult.customRegexConfigs);
            
            let configsToProcess = [];
            
            // 检查存储格式：对象格式还是数组格式
            if (Array.isArray(storageResult.customRegexConfigs)) {
                // 数组格式
                configsToProcess = storageResult.customRegexConfigs;
                //console.log('📋 [PatternExtractor] 检测到数组格式的自定义正则配置');
            } else if (typeof storageResult.customRegexConfigs === 'object') {
                // 对象格式，转换为数组
                configsToProcess = Object.entries(storageResult.customRegexConfigs).map(([key, config]) => ({
                    key: `custom_${key}`, // 添加 custom_ 前缀
                    name: config.name,
                    pattern: config.pattern,
                    createdAt: config.createdAt
                }));
                //console.log('📋 [PatternExtractor] 检测到对象格式的自定义正则配置，已转换为数组格式');
            }
            
            if (configsToProcess.length === 0) {
                //console.log('ℹ️ [PatternExtractor] 动态自定义正则配置为空');
                return;
            }
            
            // 移除内容大小限制，处理完整内容
            const processContent = content;
            
            //console.log(`📊 [PatternExtractor] 动态自定义正则处理内容大小: ${processContent.length} 字符`);
            
            // 处理每个自定义正则配置
            configsToProcess.forEach((config, index) => {
                try {
                    if (!config.key || !config.pattern || !config.name) {
                        console.warn(`⚠️ [PatternExtractor] 跳过无效的自定义正则配置 ${index + 1}:`, config);
                        return;
                    }
                    
                    //console.log(`🔍 [PatternExtractor] 处理自定义正则 ${index + 1}: ${config.name} (${config.key})`);
                    //console.log(`📝 [PatternExtractor] 正则模式: ${config.pattern}`);
                    
                    // 创建正则表达式
                    const regex = new RegExp(config.pattern, 'g');
                    
                    // 确保results中有对应的Set
                    if (!results[config.key]) {
                        results[config.key] = new Set();
                        //console.log(`📦 [PatternExtractor] 为自定义正则 ${config.key} 创建结果集合`);
                    }
                    
                    //console.log(`🔍 [PatternExtractor] 开始在内容中匹配自定义正则 ${config.key}...`);
                    //console.log(`📊 [PatternExtractor] 待匹配内容长度: ${processContent.length} 字符`);
                    
                    // 先在小样本上测试正则表达式
                    const testContent = processContent.substring(0, 1000);
                    //console.log(`🧪 [PatternExtractor] 测试自定义正则 ${config.key} 在小样本上的匹配...`);
                    const testRegex = new RegExp(config.pattern, 'g');
                    let testMatch;
                    let testCount = 0;
                    while ((testMatch = testRegex.exec(testContent)) !== null && testCount < 5) {
                        //console.log(`🎯 [PatternExtractor] 测试匹配 ${testCount + 1}: "${testMatch[0]}"`);
                        testCount++;
                    }
                    //console.log(`📊 [PatternExtractor] 小样本测试完成，匹配到 ${testCount} 个结果`);
                    
                    // 执行完整匹配
                    let match;
                    let matchCount = 0;
                    regex.lastIndex = 0; // 重置正则表达式状态
                    
                    //console.log(`🔍 [PatternExtractor] 开始完整内容匹配...`);
                    while ((match = regex.exec(processContent)) !== null) {
                        const matchedText = match[0];
                        if (matchedText && matchedText.trim()) {
                            results[config.key].add(matchedText.trim());
                            matchCount++;
                            //console.log(`✅ [PatternExtractor] 自定义正则 ${config.key} 匹配到 ${matchCount}: "${matchedText.trim()}"`);
                        }
                        
                        // 防止无限循环
                        if (matchCount > 1000) {
                            console.warn(`⚠️ [PatternExtractor] 自定义正则 ${config.key} 匹配次数过多，停止匹配`);
                            break;
                        }
                        
                        // 防止正则表达式无限循环
                        if (regex.lastIndex === match.index) {
                            console.warn(`⚠️ [PatternExtractor] 自定义正则 ${config.key} 检测到无限循环，停止匹配`);
                            break;
                        }
                    }
                    
                    //console.log(`📊 [PatternExtractor] 自定义正则 ${config.key} 匹配完成，共找到 ${matchCount} 个结果`);
                    //console.log(`📦 [PatternExtractor] 自定义正则 ${config.key} 结果集合大小: ${results[config.key].size}`);
                    
                    // 验证结果是否正确添加到results对象中
                    if (results[config.key].size > 0) {
                        //console.log(`✅ [PatternExtractor] 自定义正则 ${config.key} 结果已成功添加到results对象`);
                        //console.log(`🎯 [PatternExtractor] 自定义正则 ${config.key} 结果预览:`, Array.from(results[config.key]).slice(0, 3));
                    } else {
                        //console.log(`ℹ️ [PatternExtractor] 自定义正则 ${config.key} 未匹配到任何结果`);
                        // 如果没有匹配到结果，仍然保留空的Set，确保键存在
                        //console.log(`🔧 [PatternExtractor] 保留空的结果集合以确保键 ${config.key} 存在`);
                    }
                    
                } catch (error) {
                    console.error(`❌ [PatternExtractor] 自定义正则配置 ${index + 1} 处理失败:`, error, config);
                    // 即使出错也要确保键存在
                    if (!results[config.key]) {
                        results[config.key] = new Set();
                        //console.log(`🔧 [PatternExtractor] 为出错的自定义正则 ${config.key} 创建空结果集合`);
                    }
                }
            });
            
            //console.log('✅ [PatternExtractor] 动态自定义正则模式提取完成');
            
        } catch (error) {
            console.error('❌ [PatternExtractor] 提取动态自定义正则模式失败:', error);
        }
    }
    
    /**
     * 提取所有模式 - 统一化版本，只使用设置界面配置
     * 🔥 性能优化：移除重复的配置加载检查
     */
    async extractPatterns(content, sourceUrl = '') {
        try {
            //console.log('🚀🚀🚀 [PatternExtractor] 统一化版本开始提取模式 - 强制日志！');
            //console.log(`📊 [PatternExtractor] 内容长度: ${content.length} 字符`);
            //console.log(`🌐 [PatternExtractor] 源URL: ${sourceUrl}`);
            //console.log('🔍🔍🔍 [PatternExtractor] 这个方法被调用了！');
            
            // 🔥 性能优化：配置已在扫描开始时加载，这里不再重复加载
            // 只有在配置确实未加载时才加载（首次调用的情况）
            if (!this.customPatternsLoaded && Object.keys(this.patterns).length === 0) {
                await this.ensureCustomPatternsLoaded();
            }
            
            // 初始化结果对象，使用Set避免重复 - 修复：使用正确的键名
            const results = {
                // API相关
                absoluteApis: new Set(),
                relativeApis: new Set(),
                
                // 资源文件
                jsFiles: new Set(),
                cssFiles: new Set(),
                images: new Set(),
                urls: new Set(),
                
                // 敏感信息 - 修复：使用与DisplayManager一致的键名
                domains: new Set(),
                emails: new Set(),
                phoneNumbers: new Set(), // 修复：从phones改为phoneNumbers
                credentials: new Set(),
                ipAddresses: new Set(), // 修复：从ips改为ipAddresses
                paths: new Set(),
                jwts: new Set(),
                githubUrls: new Set(), // 修复：从githubs改为githubUrls
                vueFiles: new Set(), // 修复：从vues改为vueFiles
                companies: new Set(),
                comments: new Set(),
                idCards: new Set(),
                bearerTokens: new Set(),
                basicAuth: new Set(),
                authHeaders: new Set(),
                wechatAppIds: new Set(),
                awsKeys: new Set(),
                googleApiKeys: new Set(),
                githubTokens: new Set(),
                gitlabTokens: new Set(),
                webhookUrls: new Set(),
                cryptoUsage: new Set()
            };
            
            //console.log('📦 [PatternExtractor] 结果对象初始化完成');
            //console.log('📊 [PatternExtractor] 当前可用的正则模式:', Object.keys(this.patterns));
            
            // 移除内容大小限制，处理完整内容
            const processContent = content;
            
            //console.log(`📊 [PatternExtractor] 实际处理内容大小: ${processContent.length} 字符`);
            
            // 1. 提取API（特殊处理，因为可能有多个正则）
            this.extractAPIs(processContent, results);
            
            // 2. 提取其他资源文件
            this.extractOtherResources(processContent, results, sourceUrl);
            
            // 3. 提取其他模式（使用设置界面配置的正则） - 修复：使用正确的键名映射
            const patternMappings = {
                domain: 'domains',
                email: 'emails', 
                phone: 'phoneNumbers', // 修复：从phones改为phoneNumbers
                credentials: 'credentials',
                ip: 'ipAddresses', // 修复：从ips改为ipAddresses
                paths: 'paths',
                jwt: 'jwts',
                github: 'githubUrls', // 修复：从githubs改为githubUrls
                vue: 'vueFiles', // 修复：从vues改为vueFiles
                company: 'companies',
                comments: 'comments',
                idCard: 'idCards',
                bearerToken: 'bearerTokens',
                basicAuth: 'basicAuth',
                authHeader: 'authHeaders',
                wechatAppId: 'wechatAppIds',
                awsKey: 'awsKeys',
                googleApiKey: 'googleApiKeys',
                githubToken: 'githubTokens',
                gitlabToken: 'gitlabTokens',
                webhookUrls: 'webhookUrls',
                cryptoUsage: 'cryptoUsage'
            };
            
            //console.log('🔍 [PatternExtractor] 开始提取其他模式...');
            
            Object.entries(patternMappings).forEach(([patternKey, resultKey]) => {
                if (this.patterns[patternKey]) {
                    //console.log(`🔍 [PatternExtractor] 提取 ${patternKey} -> ${resultKey}`);
                    //console.log(`📝 [PatternExtractor] 使用正则: ${this.patterns[patternKey].source}`);
                    
                    // 修复：针对负向断言的特殊处理
                    const regex = this.patterns[patternKey];
                    const regexSource = regex.source;
                    const hasLookbehind = regexSource.includes('(?<!') || regexSource.includes('(?<=');
                    const hasLookahead = regexSource.includes('(?!') || regexSource.includes('(?=');
                    
                    if (hasLookbehind || hasLookahead) {
                        //console.log(`🔧 [PatternExtractor] 检测到负向断言，使用特殊处理: ${patternKey}`);
                        
                        // 对于包含负向断言的正则，使用 matchAll 方法
                        try {
                            const matches = [...processContent.matchAll(regex)];
                            //console.log(`📊 [PatternExtractor] ${patternKey} 使用matchAll找到 ${matches.length} 个匹配`);
                            
                            matches.forEach((match, index) => {
                                const matchedText = match[1] || match[0];
                                if (matchedText && matchedText.trim()) {
                                    const trimmedText = matchedText.trim();
                                    
                                    // 🔥 特殊处理：过滤绝对路径API中包含协议的内容
                                    if (patternKey === 'absoluteApi' && (trimmedText.includes('http://') || trimmedText.includes('https://'))) {
                                        //console.log(`🚫 [PatternExtractor] 绝对路径API包含协议，已过滤: "${trimmedText}"`);
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤绝对路径API中的静态文件
                                    if (patternKey === 'absoluteApi' && this.isStaticFile(trimmedText)) {
                                        //console.log(`🚫 [PatternExtractor] 绝对路径API为静态文件，已过滤: "${trimmedText}"`);
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤域名黑名单和垃圾域名
                                    if (patternKey === 'domain') {
                                        if (this.isDomainBlacklisted(trimmedText)) {
                                            return;
                                        }
                                        if (this.isGarbageDomain(trimmedText)) {
                                            return;
                                        }
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤Vue文件（只保留完整路径）
                                    if (patternKey === 'vue' && !this.isValidVueFilePath(trimmedText)) {
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤垃圾绝对路径
                                    if (patternKey === 'absoluteApi' && this.isGarbageAbsolutePath(trimmedText)) {
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤包含过滤内容类型的内容
                                    if (this.containsFilteredContentType(trimmedText)) {
                                        //console.log(`🚫 [PatternExtractor] ${patternKey} 包含过滤内容类型，已过滤: "${trimmedText}"`);
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤敏感凭据中的 CSS 样式代码
                                    if (patternKey === 'credentials' && this.isCssStyleCode(trimmedText)) {
                                        //console.log(`🚫 [PatternExtractor] 敏感凭据为CSS样式代码，已过滤: "${trimmedText}"`);
                                        return;
                                    }
                                    
                                    // 🔥 新增特殊处理：过滤注释中的空内容
                                    if (patternKey === 'comments' && this.isEmptyComment(trimmedText)) {
                                        //console.log(`🚫 [PatternExtractor] 注释内容为空，已过滤: "${trimmedText}"`);
                                        return;
                                    }
                                    
                                    // 🔥 对 Vue 文件去除引号
                                    let finalText = trimmedText;
                                    if (patternKey === 'vue') {
                                        finalText = trimmedText.replace(/^["']|["']$/g, '');
                                    }
                                    results[resultKey].add(finalText);
                                    //console.log(`✅ [PatternExtractor] ${patternKey} 匹配到 ${index + 1}: "${trimmedText}"`);
                                }
                            });
                            
                            //console.log(`📊 [PatternExtractor] ${patternKey} 提取完成，共找到 ${matches.length} 个`);
                        } catch (error) {
                            console.error(`❌ [PatternExtractor] ${patternKey} matchAll失败，回退到exec方法:`, error);
                            // 回退到原来的exec方法
                            this.executeRegexWithExec(regex, processContent, results, resultKey, patternKey);
                        }
                    } else {
                        // 对于普通正则，使用原来的exec方法
                        this.executeRegexWithExec(regex, processContent, results, resultKey, patternKey);
                    }
                } else {
                    //console.log(`⚠️ [PatternExtractor] 跳过未配置的模式: ${patternKey}`);
                }
            });
            
            
            // 4. 提取动态自定义正则模式 - 修复：直接使用已加载的patterns
            //console.log('🔍 [PatternExtractor] 开始提取动态自定义正则模式...');
            //console.log('🔍 [PatternExtractor] 当前this.patterns的所有键:', Object.keys(this.patterns));
            
            // 查找所有自定义正则模式
            const customPatternKeys = Object.keys(this.patterns).filter(key => key.startsWith('custom_'));
            //console.log(`📊 [PatternExtractor] 发现 ${customPatternKeys.length} 个自定义正则模式:`, customPatternKeys);
            //console.log(`🔍 [PatternExtractor] 自定义正则模式详情:`, customPatternKeys.map(key => ({
            //    key,
            //    regex: this.patterns[key] ? this.patterns[key].source : 'null',
            //    type: typeof this.patterns[key]
            //})));
            
            if (customPatternKeys.length > 0) {
                customPatternKeys.forEach(patternKey => {
                    try {
                        //console.log(`🔍 [PatternExtractor] 处理自定义正则: ${patternKey}`);
                        
                        const regex = this.patterns[patternKey];
                        if (!regex) {
                            console.warn(`⚠️ [PatternExtractor] 自定义正则 ${patternKey} 未找到对应的正则表达式`);
                            return;
                        }
                        
                        // 确保results中有对应的Set
                        if (!results[patternKey]) {
                            results[patternKey] = new Set();
                            //console.log(`📦 [PatternExtractor] 为自定义正则 ${patternKey} 创建结果集合`);
                        }
                        
                        //console.log(`🔍 [PatternExtractor] 开始匹配自定义正则 ${patternKey}...`);
                        //console.log(`📝 [PatternExtractor] 正则表达式: ${regex.source}`);
                        
                        // 重置正则表达式状态
                        regex.lastIndex = 0;
                        
                        let match;
                        let matchCount = 0;
                        
                        while ((match = regex.exec(processContent)) !== null) {
                            const matchedText = match[0];
                            if (matchedText && matchedText.trim()) {
                                const trimmedText = matchedText.trim();
                                
                                // 🔥 应用过滤：检查是否包含过滤内容类型
                                if (!this.containsFilteredContentType(trimmedText)) {
                                    results[patternKey].add(trimmedText);
                                    matchCount++;
                                    //console.log(`✅ [PatternExtractor] 自定义正则 ${patternKey} 匹配到 ${matchCount}: "${trimmedText}"`);
                                } else {
                                    //console.log(`🚫 [PatternExtractor] 自定义正则 ${patternKey} 包含过滤内容类型，已过滤: "${trimmedText}"`);
                                }
                            }
                            
                            // 防止无限循环
                            if (matchCount > 1000) {
                                console.warn(`⚠️ [PatternExtractor] 自定义正则 ${patternKey} 匹配次数过多，停止匹配`);
                                break;
                            }
                            
                            // 防止正则表达式无限循环
                            if (regex.lastIndex === match.index) {
                                console.warn(`⚠️ [PatternExtractor] 自定义正则 ${patternKey} 检测到无限循环，停止匹配`);
                                break;
                            }
                        }
                        
                        //console.log(`📊 [PatternExtractor] 自定义正则 ${patternKey} 匹配完成，共找到 ${matchCount} 个结果`);
                        //console.log(`📦 [PatternExtractor] 自定义正则 ${patternKey} 结果集合大小: ${results[patternKey].size}`);
                        
                        if (results[patternKey].size > 0) {
                            //console.log(`✅ [PatternExtractor] 自定义正则 ${patternKey} 结果预览:`, Array.from(results[patternKey]).slice(0, 3));
                        } else {
                            //console.log(`ℹ️ [PatternExtractor] 自定义正则 ${patternKey} 未匹配到任何结果`);
                        }
                        
                    } catch (error) {
                        console.error(`❌ [PatternExtractor] 自定义正则 ${patternKey} 处理失败:`, error);
                        // 即使出错也要确保键存在
                        if (!results[patternKey]) {
                            results[patternKey] = new Set();
                            //console.log(`🔧 [PatternExtractor] 为出错的自定义正则 ${patternKey} 创建空结果集合`);
                        }
                    }
                });
            } else {
                //console.log('ℹ️ [PatternExtractor] 未发现自定义正则模式');
            }
            
            //console.log('🔍 [PatternExtractor] 动态自定义正则模式提取完成，当前results键:', Object.keys(results));
            
            // 5. 特殊处理身份证验证
            if (results.idCards.size > 0) {
                //console.log(`🔍 [PatternExtractor] 开始验证身份证，共 ${results.idCards.size} 个`);
                const validatedIdCards = this.validateIdCards(Array.from(results.idCards));
                results.idCards = new Set(validatedIdCards);
                //console.log(`✅ [PatternExtractor] 身份证验证完成，有效身份证 ${results.idCards.size} 个`);
            }
            
            // 6. 转换Set为Array并添加源URL信息，包括所有动态创建的键
            const finalResults = {};
            
            //console.log('🔍 [PatternExtractor] 开始转换结果并添加源URL信息，当前results对象的所有键:', Object.keys(results));
            
            // 修复：遍历所有键，包括动态创建的自定义正则键，并为每个项目添加源URL
            for (const [key, value] of Object.entries(results)) {
                if (value instanceof Set) {
                    // 将Set转换为包含源URL信息的对象数组
                    finalResults[key] = [...value].map(item => {
                        // 🔥 修复：检查item是否已经是包含sourceUrl的对象
                        if (typeof item === 'object' && item !== null && item.hasOwnProperty('value')) {
                            // 如果已经是对象格式，确保包含所有必要字段
                            return {
                                value: item.value,
                                sourceUrl: item.sourceUrl || sourceUrl,
                                extractedAt: item.extractedAt || new Date().toISOString(),
                                pageTitle: item.pageTitle || document.title || 'Unknown Page'
                            };
                        } else {
                            // 如果是字符串，转换为对象格式
                            return {
                                value: item,
                                sourceUrl: sourceUrl,
                                extractedAt: new Date().toISOString(),
                                pageTitle: document.title || 'Unknown Page'
                            };
                        }
                    });
                    
                    //console.log(`🔄 [PatternExtractor] 转换 ${key}: Set(${value.size}) -> Array(${finalResults[key].length}) 并添加源URL`);
                    if (finalResults[key].length > 0) {
                        //console.log(`📊 [PatternExtractor] ${key}: ${finalResults[key].length} 个结果，源URL: ${sourceUrl}`);
                        // 如果是自定义正则结果，显示更详细的信息
                        if (key.startsWith('custom_')) {
                            //console.log(`🎯 [PatternExtractor] 自定义正则 ${key} 结果预览:`, finalResults[key].slice(0, 3));
                        }
                    } else if (key.startsWith('custom_')) {
                        // 即使是空的自定义正则结果，也要保留在最终结果中
                        //console.log(`📦 [PatternExtractor] 保留空的自定义正则键 ${key}`);
                    }
                } else if (value) {
                    // 对于非Set类型的值，也添加源URL信息
                    if (Array.isArray(value)) {
                        finalResults[key] = value.map(item => {
                            // 🔥 修复：检查item是否已经是包含sourceUrl的对象
                            if (typeof item === 'object' && item !== null && item.hasOwnProperty('value')) {
                                return {
                                    value: item.value,
                                    sourceUrl: item.sourceUrl || sourceUrl,
                                    extractedAt: item.extractedAt || new Date().toISOString(),
                                    pageTitle: item.pageTitle || document.title || 'Unknown Page'
                                };
                            } else {
                                return {
                                    value: item,
                                    sourceUrl: sourceUrl,
                                    extractedAt: new Date().toISOString(),
                                    pageTitle: document.title || 'Unknown Page'
                                };
                            }
                        });
                    } else {
                        // 🔥 修复：单个值也要转换为对象格式
                        if (typeof value === 'object' && value !== null && value.hasOwnProperty('value')) {
                            finalResults[key] = [{
                                value: value.value,
                                sourceUrl: value.sourceUrl || sourceUrl,
                                extractedAt: value.extractedAt || new Date().toISOString(),
                                pageTitle: value.pageTitle || document.title || 'Unknown Page'
                            }];
                        } else {
                            finalResults[key] = [{
                                value: value,
                                sourceUrl: sourceUrl,
                                extractedAt: new Date().toISOString(),
                                pageTitle: document.title || 'Unknown Page'
                            }];
                        }
                    }
                    //console.log(`🔄 [PatternExtractor] 直接复制并添加源URL ${key}:`, typeof value);
                } else {
                    // 空值保持为空数组
                    finalResults[key] = [];
                }
            }
            
            // 验证所有自定义正则键都被正确处理
            const customKeys = Object.keys(results).filter(key => key.startsWith('custom_'));
            if (customKeys.length > 0) {
                //console.log(`✅ [PatternExtractor] 发现并处理了 ${customKeys.length} 个自定义正则键:`, customKeys);
                customKeys.forEach(key => {
                    //console.log(`✅ [PatternExtractor] 自定义正则键 ${key} 已正确转换: ${finalResults[key].length} 个结果`);
                });
            } else {
                //console.log('ℹ️ [PatternExtractor] 未发现自定义正则键');
            }
            
            //console.log('✅ [PatternExtractor] 统一化版本模式提取完成');
            //console.log('📊 [PatternExtractor] 最终结果键:', Object.keys(finalResults));
            
            return finalResults;
            
        } catch (error) {
            console.error('❌ [PatternExtractor] 提取模式失败:', error);
            return {};
        }
    }

    /**
     * 🔥 检查注释内容是否为空
     * @param {string} comment - 要检查的注释内容
     * @returns {boolean} 是否为空注释
     */
    isEmptyComment(comment) {
        if (!comment || typeof comment !== 'string') {
            return true;
        }
        
        // 移除常见的注释标记和空白字符
        const cleanedComment = comment
            .replace(/^\/\*+|\*+\/$/g, '')  // 移除 /* */ 标记
            .replace(/^\/\/+/g, '')         // 移除 // 标记
            .replace(/^<!--+|--+>$/g, '')   // 移除 <!-- --> 标记
            .replace(/^\*+/g, '')           // 移除开头的 * 标记
            .trim();                        // 移除首尾空白
        
        // 检查清理后的内容是否为空或只包含空白字符
        return cleanedComment.length === 0 || /^\s*$/.test(cleanedComment);
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExtractor;
} else if (typeof window !== 'undefined') {
    window.PatternExtractor = PatternExtractor;
}
