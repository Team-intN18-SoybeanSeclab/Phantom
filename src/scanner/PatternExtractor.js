class PatternExtractor {
    constructor() {

        this.performanceConfig = {
            maxMatchesPerPattern: 1000,
            chunkSize: 100000,
            enableChunking: true,
            cacheEnabled: true,
            maxCacheSize: 30
        };


        this._resultCache = new Map();


        this.staticFileExtensions = [

            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif','.jpg)', '.jpeg)', '.png)', '.gif)', '.bmp)', '.webp)', '.svg)', '.ico)', '.tiff)', '.tif)',

            '.css', '.scss', '.sass', '.less',

            '.js', '.jsx', '.ts', '.tsx', '.vue', '.coffee',

            '.woff', '.woff2', '.ttf', '.otf', '.eot',

            '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac',

            '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.swf'
        ];


        this.DOMAIN_BLACKLIST = [

            'el.datepicker.today',
            'obj.style.top',
            'window.top',
            'mydragdiv.style.top',
            'container.style.top',
            'location.host',
            'page.info',
            'res.info',
            'item.info',

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


        this.DOMAIN_GARBAGE_PATTERNS = [

            /^this\./i,
            /^props\./i,
            /^value\./i,
            /^refs\./i,
            /^state\./i,
            /^data\./i,
            /^options\./i,
            /^config\./i,
            /^params\./i,
            /^query\./i,
            /^result\./i,
            /^response\./i,
            /^request\./i,
            /^event\./i,
            /^target\./i,
            /^currentTarget\./i,
            /^style\./i,
            /^window\./i,
            /^document\./i,
            /^console\./i,
            /^Math\./i,
            /^Object\./i,
            /^Array\./i,
            /^String\./i,
            /^Number\./i,
            /^JSON\./i,
            /^Date\./i,
            /^Promise\./i,
            /^Error\./i,
            /^\$\./i,
            /^_\./i,
            /^\w+Element\./i,



            /refs\.[a-z]+\./i,
            /\$refs\./i,


            /^[A-Z][a-z]\./i,
            /^[a-z]{1,2}\.[a-z]{1,2}$/i,
            /^[a-z]\.[a-z]+\(/i,


            /^clientY-/i,
            /^clientX-/i,
            /^offset[A-Z]/i,
            /^scroll[A-Z]/i,


            /\.(test|exec|match|replace|split|join|map|filter|reduce|forEach)\s*\(/i,
            /\.(length|value|name|type|id|class|style|data)\s*[=;,)]/i,
        ];


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


        this.ABSOLUTE_PATH_GARBAGE_PATTERNS = [
            /^\/gi\.test$/i,
            /^\/gi$/i,
            /^\/\d+-[A-Za-z]-[A-Za-z]/i,
            /^\/\d+\.\d+$/,
            /^\/[a-z]\.test$/i,
            /^\/[a-z]\.exec$/i,
            /^\/Math\./i,
            /^\/[a-z]\.[a-z]+$/i,
            /^\/--/,
            /^\/\.\//,
            /^\/`/,
            /`\/$/,
            /\.mainAxis$/i,
            /\.crossAxis$/i,
            /^\/[a-z]{1,2}$/i,
            /\.[A-Z][a-z]+[A-Z]/,
        ];


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

            'yyyy/mm/dd',
            'dd/mm/yyyy',
            'mm/dd/yy',
            'yy/mm/dd',
            'm/d/Y',
            'm/d/y',
            'xx/xx',
            'zrender/vml/vml',

            '/rem/g',
            '/vw/g',
            '/vh/g',
            '/-/g',
            '/./g',
            '/f.value',
            '/i.test',

            '/android/i.test',
            '/CrOS/.test',
            '/windows/i.test',
            '/macintosh/i.test',
            '/linux/i.test',
            '/tablet/i.test',
            '/xbox/i.test',
            '/bada/i.test',

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


        this.FILTERED_REGEXES = [

            /\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\(|\/|$)/,

            /\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\/[A-Za-z]\.[A-Za-z][A-Za-z]*)+(?:\(|\/|$)/,
            /^\/[a-zA-Z]\/[a-zA-Z]$/gm
        ];


        this.idCardFilter = null;
        this.loadIdCardFilter();


        this.patterns = {};


        this.customRegexConfig = null;


        this.customPatternsLoaded = false;


        window.patternExtractor = this;


        window.addEventListener('regexConfigUpdated', (event) => {

            this.updatePatterns(event.detail);
        }, { once: false });


        this.loadCustomPatterns().catch(error => {
            console.error(' 异步加载自定义配置失败:', error);
        });
    }


    loadIdCardFilter() {
        try {

            if (typeof window !== 'undefined' && window.idCardFilter) {
                this.idCardFilter = window.idCardFilter;

                return;
            }


            const script = document.createElement('script');
            script.src = 'filters/idfilter.js';
            script.onload = () => {
                if (window.idCardFilter) {
                    this.idCardFilter = window.idCardFilter;

                } else {
                    console.warn(' 身份证过滤器加载失败：未找到 idCardFilter');
                }
            };
            script.onerror = () => {
                console.error(' 身份证过滤器脚本加载失败');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error(' 加载身份证过滤器时出错:', error);
        }
    }


    isStaticFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }


        let cleanUrl = url
            .replace(/^["'`]+|["'`]+$/g, '')
            .split('?')[0]
            .split('#')[0]
            .replace(/[)"'\s]+$/g, '')
            .toLowerCase()
            .trim();


        if (this.staticFileExtensions.some(ext => cleanUrl.endsWith(ext))) {
            return true;
        }


        const staticPatterns = [
            /\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff?|avif)(\?.*)?$/i,
            /\.(css|scss|sass|less|styl)(\?.*)?$/i,
            /\.(js|jsx|ts|tsx|mjs|cjs|vue|coffee)(\?.*)?$/i,
            /\.(woff2?|ttf|otf|eot|font)(\?.*)?$/i,
            /\.(mp3|wav|ogg|m4a|aac|flac|wma)(\?.*)?$/i,
            /\.(mp4|avi|mov|wmv|flv|webm|mkv|swf|m4v)(\?.*)?$/i,
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz)(\?.*)?$/i,
            /\.(map|json\.map|js\.map|css\.map)$/i,
            /\/[^/]+\.(png|jpg|jpeg|gif|svg|ico|webp)[^a-zA-Z0-9]/i,
        ];

        return staticPatterns.some(pattern => pattern.test(cleanUrl));
    }


    isImageFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif','.jpg)', '.jpeg)', '.png)', '.gif)', '.bmp)', '.webp)', '.svg)', '.ico)', '.tiff)', '.tif)','.ttf','.woff','.eot','.woff2'];
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return imageExtensions.some(ext => cleanUrl.endsWith(ext));
    }


    isJsFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.js') || cleanUrl.includes('.js?');
    }


    isCssFile(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.css') || cleanUrl.includes('.css?');
    }


    isStaticResourcePath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }


        let cleanPath = path
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/[)"'\s]+$/g, '')
            .trim();


        const staticExtensionPattern = /\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff?|avif|heic|heif|raw|psd|ai|eps|pdf|doc|docx|xls|xlsx|ppt|pptx|css|scss|sass|less|styl|js|jsx|ts|tsx|mjs|cjs|vue|coffee|woff2?|ttf|otf|eot|font|mp3|wav|ogg|m4a|aac|flac|wma|mp4|avi|mov|wmv|flv|webm|mkv|swf|m4v|3gp|zip|rar|7z|tar|gz|bz2|xz|map|json\.map|js\.map|css\.map)(\?[^/]*)?$/i;

        if (staticExtensionPattern.test(cleanPath)) {
            return true;
        }


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


        const hasStaticDir = staticDirPatterns.some(pattern => pattern.test(cleanPath));
        const hasStaticExt = /\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|mp3|mp4)(\?.*)?$/i.test(cleanPath);

        if (hasStaticDir && hasStaticExt) {
            return true;
        }


        const pureStaticFilePattern = /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|mp3|mp4)$/i;
        if (pureStaticFilePattern.test(cleanPath)) {
            return true;
        }


        const extWithQueryPattern = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|tiff?)\?/i;
        if (extWithQueryPattern.test(cleanPath)) {
            return true;
        }

        return false;
    }


    isCssStyleCode(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        const cleanText = text.trim().toLowerCase();


        const cssColorPatterns = [
            /^rgba?\s*\(\s*\d+/i,
            /^hsla?\s*\(\s*\d+/i,
            /^#[0-9a-f]{3,8}$/i,
            /rgba?\s*\([^)]+\)\s*(solid|dashed|dotted|double|groove|ridge|inset|outset)?/i,
            /\d+px\s+rgba?\s*\(/i,
            /\d+(px|em|rem|%|vh|vw)\s+rgba?\s*\(/i,
        ];


        const cssPropertyPatterns = [
            /^\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|pt|pc|in|cm|mm)\s/i,
            /^(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)$/i,
            /^(default|pointer|crosshair|move|text|wait|help|not-allowed|grab|grabbing)$/i,
            /^(block|inline|inline-block|flex|grid|none|table|list-item)$/i,
            /^(absolute|relative|fixed|sticky|static)$/i,
            /^(left|right|center|justify|start|end)$/i,
            /^(top|bottom|left|right|center|middle|baseline)$/i,
            /^(bold|normal|lighter|bolder|\d{3})$/i,
            /^(italic|oblique|normal)$/i,
            /^(uppercase|lowercase|capitalize|none)$/i,
            /^(underline|overline|line-through|none)$/i,
            /^(visible|hidden|scroll|auto|clip)$/i,
            /^(wrap|nowrap|pre|pre-wrap|pre-line|break-spaces)$/i,
            /^(cover|contain|auto|\d+%|\d+px)$/i,
            /^(repeat|no-repeat|repeat-x|repeat-y|space|round)$/i,
            /^(border-box|content-box|padding-box)$/i,
            /^(ease|linear|ease-in|ease-out|ease-in-out)$/i,
            /^(row|column|row-reverse|column-reverse)$/i,
            /^(stretch|flex-start|flex-end|center|baseline|space-between|space-around|space-evenly)$/i,
        ];


        const cssCompoundPatterns = [
            /^\d+(px|em|rem)?\s+(rgba?\s*\([^)]+\)|#[0-9a-f]{3,8})\s+(solid|dashed|dotted|double|none)/i,
            /^(rgba?\s*\([^)]+\)|#[0-9a-f]{3,8})\s+\d+(px|em|rem)/i,
            /^\d+(px|em|rem|%)\s+\d+(px|em|rem|%)/i,
            /^(inset\s+)?\d+(px|em|rem)\s+\d+(px|em|rem)\s+\d+(px|em|rem)/i,
            /^url\s*\([^)]+\)/i,
            /^linear-gradient\s*\(/i,
            /^radial-gradient\s*\(/i,
            /^(nav|dot|round|index|indexes)$/i,
        ];


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


        if (cssColorPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }


        if (cssPropertyPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }


        if (cssCompoundPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }


        if (cssKeywords.includes(cleanText)) {
            return true;
        }



        const hasCssColorFunction = /rgba?\s*\([^)]+\)/i.test(cleanText);
        const hasCssUnit = /\d+(px|em|rem|%|vh|vw)/i.test(cleanText);
        const hasCssBorderStyle = /(solid|dashed|dotted|double|none)/i.test(cleanText);


        if (hasCssColorFunction && (hasCssUnit || hasCssBorderStyle)) {
            return true;
        }


        const cssKeywordCombination = /^(default|dot|round|nav|index|indexes|solid|dashed|pointer|block|flex|grid|auto|none|normal|hidden|visible)+$/i;
        if (cssKeywordCombination.test(cleanText.replace(/\s+/g, ''))) {
            return true;
        }

        return false;
    }


    isJunkCredentialValue(text) {
        if (typeof text !== 'string') return true;
        const s = text.trim();
        if (s.length < 6) return true;
        if (/[:=]/.test(s)) {
            const val = s.slice(s.search(/[:=]/) + 1).replace(/['"{}\[\]\s,;]/g, '');
            if (val.length <= 2) return true;
            if (/^(?:true|false|null|undefined|function|\d+)$/i.test(val)) return true;
            return false;
        }
        if (s.length < 16) return true;
        if (/^[A-Za-z_$][\w$.]*$/.test(s)) return true;
        return false;
    }

    isJunkApiEndpoint(value) {
        if (typeof value !== 'string') return true;
        const s = value.trim();
        if (!s) return true;
        if (/^https?:\/\//i.test(s) || s.startsWith('//')) {
            return /^\/+$/.test(s);
        }
        if (/^\/+$/.test(s)) return true;
        if (!s.includes('/')) return true;
        return false;
    }

    isDomainBlacklisted(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }


        const cleanDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/:\d+$/, '')
            .trim();


        const isBlacklisted = this.DOMAIN_BLACKLIST.includes(cleanDomain);

        if (isBlacklisted) {

        }

        return isBlacklisted;
    }


    isGarbageDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }

        const cleanDomain = domain.trim().toLowerCase();


        if (this.SHORT_DOMAIN_WHITELIST && this.SHORT_DOMAIN_WHITELIST.has(cleanDomain)) {
            return false;
        }


        const dotCount = (cleanDomain.match(/\./g) || []).length;
        if (dotCount >= 3) {

            return true;
        }


        for (const pattern of this.DOMAIN_GARBAGE_PATTERNS) {
            if (pattern.test(cleanDomain)) {
                return true;
            }
        }


        const codeKeywords = ['refs', 'props', 'state', 'data', 'config', 'options',
                              'params', 'query', 'result', 'response', 'request',
                              'event', 'target', 'style', 'class', 'element',
                              'picker', 'input', 'button', 'form', 'modal', 'dialog'];
        for (const keyword of codeKeywords) {

            if (cleanDomain.includes(keyword + '.') || cleanDomain.includes('.' + keyword + '.')) {
                return true;
            }
        }



        const codeSuffixes = ['.input', '.value', '.length', '.type',
                              '.id', '.class', '.text',
                              '.html', '.json', '.xml', '.form', '.submit', '.reset',
                              '.focus', '.blur', '.change', '.select', '.load', '.error',
                              '.test', '.exec', '.match', '.replace', '.split'];

        if (dotCount >= 2) {
            for (const suffix of codeSuffixes) {
                if (cleanDomain.endsWith(suffix)) {
                    return true;
                }
            }
        }



        const parts = cleanDomain.split('.');
        if (parts.length === 2) {
            const [name, tld] = parts;

            if (name.length === 1 && !['co', 'me', 'io', 'tv', 'cc', 'ly', 'gl', 'gd', 'im', 'nu', 'tk', 'ml', 'ga', 'cf'].includes(tld)) {

                if (!['t', 'g', 'j', 'x', 'u', 'v', 'i', 'q', 's', 'w', 'y', 'z'].includes(name)) {
                    return true;
                }
            }
        }

        return false;
    }


    isGarbageAbsolutePath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }

        const cleanPath = path.trim();


        for (const pattern of this.ABSOLUTE_PATH_GARBAGE_PATTERNS) {
            if (pattern.test(cleanPath)) {
                return true;
            }
        }


        if (/\.(test|exec|mainAxis|crossAxis|offsetWidth|offsetHeight|value|length|count|ratio)$/i.test(cleanPath)) {
            return true;
        }


        if (/^\/[^/]+\/[gim]+$/i.test(cleanPath)) {
            return true;
        }


        if (/^\/[\d.]+$/.test(cleanPath)) {
            return true;
        }


        if (/^\/\d+-[A-Za-z]+-?[A-Za-z]*-?[A-Za-z]*-?[A-Za-z]*/.test(cleanPath)) {
            return true;
        }

        if (cleanPath.length <= 4 && /[A-Z.#+?]/.test(cleanPath.replace(/^\//, ''))) {
            return true;
        }

        return false;
    }


    isValidVueFilePath(vuePath) {
        if (!vuePath || typeof vuePath !== 'string') {
            return false;
        }

        const cleanPath = vuePath.trim().replace(/^["']|["']$/g, '');


        if (!cleanPath.toLowerCase().endsWith('.vue')) {
            return false;
        }




        if (!cleanPath.includes('/') && !cleanPath.includes('\\')) {
            return false;
        }


        if (cleanPath.length < 10) {
            return false;
        }

        return true;
    }


    containsFilteredContentType(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }

        const lowerPath = path.toLowerCase();


        const isFiltered = this.FILTERED_CONTENT_TYPES.some(contentType => {
            return lowerPath.includes(contentType.toLowerCase());
        });

        if (isFiltered) {

        }

        return isFiltered;
    }


    isFilteredByRegex(text) {
        if (!text || typeof text !== 'string') return false;
        try {

            const matchedByRegex = this.FILTERED_REGEXES?.some(re => {
                try { return re.test(text); } catch { return false; }
            }) || false;

            if (matchedByRegex) return true;



            if (/\/this\.[_a-zA-Z]/.test(text)) return true;


            if (/\/[_a-zA-Z]+\/[gimsuvy]+$/.test(text)) return true;


            if (/\/[A-Za-z0-9]{50,}/.test(text)) return true;


            if (/\/[a-zA-Z]+\._[a-zA-Z]/.test(text)) return true;


            if (/^\/\d+$/.test(text) || /^\/[a-zA-Z]$/.test(text)) return true;


            if (/\/[A-Z]{10,}/.test(text)) return true;


            if (/\/[a-zA-Z]+[A-Z]{5,}[a-z]+[A-Z]{5,}/.test(text)) return true;


            const segments = text.split('/');
            if (segments.some(seg => seg.length > 100)) return true;



            for (const seg of segments) {
                if (seg.length > 20) {

                    const hasUpper = /[A-Z]/.test(seg);
                    const hasLower = /[a-z]/.test(seg);
                    const hasDigit = /\d/.test(seg);
                    const isAlphanumeric = /^[A-Za-z0-9]+$/.test(seg);


                    if (isAlphanumeric && hasUpper && hasLower && seg.length > 25) {
                        return true;
                    }


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

                    if (caseChanges > seg.length * 0.3 && seg.length > 15) {
                        return true;
                    }
                }
            }


            for (const seg of segments) {

                if (seg.length >= 32 && seg.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(seg)) {
                    return true;
                }

                if ((seg.length === 32 || seg.length === 40 || seg.length === 64) && /^[a-fA-F0-9]+$/.test(seg)) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }


    shouldFilter(text) {
        return this.containsFilteredContentType(text) || this.isFilteredByRegex(text);
    }


    filterStaticPaths(paths) {
        return paths.filter(path => {

            if (this.containsFilteredContentType(path)) {
                return false;
            }

            if (this.isFilteredByRegex(path)) {
                return false;
            }


            const ext = path.toLowerCase().match(/\.[^.]*$/);
            if (!ext) return true;


            return !this.staticFileExtensions.includes(ext[0]);
        });
    }


    filterStaticRelativePaths(relativePaths) {
        return relativePaths.filter(path => {

            if (this.containsFilteredContentType(path)) {
                return false;
            }

            if (this.isFilteredByRegex(path)) {
                return false;
            }


            if (this.isStaticFile(path)) {
                return false;
            }


            if (this.isStaticResourcePath(path)) {
                return false;
            }


            const normalizedPath = path.replace(/^\.\.?\//, '');


            const ext = normalizedPath.toLowerCase().match(/\.[^.]*$/);
            if (!ext) return true;


            const isStaticFile = this.staticFileExtensions.includes(ext[0]);


            if (isStaticFile) {

            }

            return !isStaticFile;
        });
    }


    processRelativeApi(api) {
        try {

            if (api.startsWith('./')) {
                return api.substring(1);
            } else if (api.startsWith('.') && !api.startsWith('/')) {
                return api.substring(1);
            }
            return api;
        } catch (error) {
            console.warn(' 处理相对路径API时出错:', error);
            return api;
        }
    }


    validateIdCards(idCards) {
        if (!this.idCardFilter || !Array.isArray(idCards)) {
            return idCards || [];
        }

        const validIdCards = [];

        for (const idCard of idCards) {
            try {
                const cleanIdCard = idCard.replace(/['"]/g, '').trim();


                if (cleanIdCard.length !== 18) {
                    continue;
                }

                const result = this.idCardFilter.validate(cleanIdCard);
                if (result.valid && result.type === '18位身份证') {
                    validIdCards.push(cleanIdCard);

                } else {

                }
            } catch (error) {
                console.error(' 身份证验证过程出错:', error, '身份证:', idCard);
            }
        }

        return validIdCards;
    }


    async loadCustomPatterns() {
        try {



            const existingCustomPatterns = {};
            Object.keys(this.patterns).forEach(key => {
                if (key.startsWith('custom_')) {
                    existingCustomPatterns[key] = this.patterns[key];

                }
            });


            const newPatterns = {};
            Object.keys(existingCustomPatterns).forEach(key => {
                newPatterns[key] = existingCustomPatterns[key];
            });
            this.patterns = newPatterns;


            const result = await chrome.storage.local.get(['regexSettings', 'customRegexConfigs']);



            if (result.regexSettings) {

                this.updatePatterns(result.regexSettings);

            } else {
                console.warn(' PatternExtractor未找到regexSettings配置，添加基础资源正则');

                this.patterns.jsFile = /<script[^>]*\ssrc\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`][^>]*>|(?:src|href)\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`]|import\s+.*?from\s+["'`]([^"'`]*\.js)["'`]|require\s*\(\s*["'`]([^"'`]*\.js)["'`]\s*\)/gi;
                this.patterns.cssFile = /(?:href)\s*=\s*["'`]([^"'`]*\.css(?:\?[^"'`]*)?)["'`]/gi;
                this.patterns.image = /(?:src|href|data-src)\s*=\s*["'`]([^"'`]*\.(?:jpg|jpeg|png|gif|bmp|svg|webp|ico|tiff)(?:\?[^"'`]*)?)["'`]/gi;
                this.patterns.url = /(https?:\/\/[a-zA-Z0-9\-\.]+(?:\:[0-9]+)?(?:\/[^\s"'<>]*)?)/g;
                this.applyBuiltinDefaults();
            }


            if (result.customRegexConfigs) {


                let configsToProcess = [];


                if (Array.isArray(result.customRegexConfigs)) {

                    configsToProcess = result.customRegexConfigs;

                } else if (typeof result.customRegexConfigs === 'object') {

                    configsToProcess = Object.entries(result.customRegexConfigs).map(([key, config]) => ({
                        key: `custom_${key}`,
                        name: config.name,
                        pattern: config.pattern,
                        createdAt: config.createdAt
                    }));

                }

                if (configsToProcess.length > 0) {
                    configsToProcess.forEach((config, index) => {
                        try {
                            if (config.key && config.pattern && config.name) {

                                const regex = new RegExp(config.pattern, 'g');
                                this.patterns[config.key] = regex;

                            } else {
                                console.warn(` PatternExtractor跳过无效的自定义正则配置 ${index + 1}:`, config);
                            }
                        } catch (error) {
                            console.error(` PatternExtractor自定义正则配置 ${index + 1} 格式错误:`, error, config);
                        }
                    });


                } else {

                }
            } else {

            }


            this.customPatternsLoaded = true;



        } catch (error) {
            console.error(' PatternExtractor加载自定义正则表达式配置失败:', error);
            this.customPatternsLoaded = true;
        }
    }


    parseRegexInput(input, defaultFlags = 'g') {
        if (typeof input !== 'string' || !input.trim()) {
            return null;
        }

        const trimmedInput = input.trim();


        const match = trimmedInput.match(/^\/(.*)\/([gimuy]*)$/);
        if (match) {
            const [, pattern, flags] = match;
            try {
                return new RegExp(pattern, flags || defaultFlags);
            } catch (error) {
                console.error(' 正则表达式格式错误 (字面量格式):', error, 'Pattern:', pattern, 'Flags:', flags);
                return null;
            }
        } else {

            try {
                return new RegExp(trimmedInput, defaultFlags);
            } catch (error) {
                console.error(' 正则表达式格式错误 (字符串格式):', error, 'Pattern:', trimmedInput);
                return null;
            }
        }
    }


    updatePatterns(customSettings) {
        try {



            const existingCustomPatterns = {};
            Object.keys(this.patterns).forEach(key => {
                if (key.startsWith('custom_')) {
                    existingCustomPatterns[key] = this.patterns[key];

                }
            });


            this.patterns = {};


            Object.keys(existingCustomPatterns).forEach(key => {
                this.patterns[key] = existingCustomPatterns[key];

            });


            if (customSettings.absoluteApis && customSettings.absoluteApis.trim()) {
                this.patterns.absoluteApi = this.parseRegexInput(customSettings.absoluteApis);

            }


            if (customSettings.relativeApis && customSettings.relativeApis.trim()) {
                this.patterns.relativeApi = this.parseRegexInput(customSettings.relativeApis);

            }


            if (customSettings.domains && customSettings.domains.trim()) {
                this.patterns.domain = this.parseRegexInput(customSettings.domains);

            }


            if (customSettings.emails && customSettings.emails.trim()) {
                this.patterns.email = this.parseRegexInput(customSettings.emails);

            }


            if (customSettings.phoneNumbers && customSettings.phoneNumbers.trim()) {
                this.patterns.phone = this.parseRegexInput(customSettings.phoneNumbers);

            }


            if (customSettings.credentials && customSettings.credentials.trim()) {
                this.patterns.credentials = this.parseRegexInput(customSettings.credentials, 'gi');

            }


            if (customSettings.ipAddresses && customSettings.ipAddresses.trim()) {
                this.patterns.ip = this.parseRegexInput(customSettings.ipAddresses);

            }


            if (customSettings.paths && customSettings.paths.trim()) {
                this.patterns.paths = this.parseRegexInput(customSettings.paths);

            }


            if (customSettings.jwts && customSettings.jwts.trim()) {
                this.patterns.jwt = this.parseRegexInput(customSettings.jwts);

            }


            if (customSettings.githubUrls && customSettings.githubUrls.trim()) {
                this.patterns.github = this.parseRegexInput(customSettings.githubUrls);

            }


            if (customSettings.vueFiles && customSettings.vueFiles.trim()) {
                this.patterns.vue = this.parseRegexInput(customSettings.vueFiles);

            }


            if (customSettings.companies && customSettings.companies.trim()) {
                this.patterns.company = this.parseRegexInput(customSettings.companies);

            }


            if (customSettings.comments && customSettings.comments.trim()) {
                this.patterns.comments = this.parseRegexInput(customSettings.comments, 'gm');

            }


            if (customSettings.idCards && customSettings.idCards.trim()) {
                this.patterns.idCard = this.parseRegexInput(customSettings.idCards);

            }


            if (customSettings.bearerTokens && customSettings.bearerTokens.trim()) {
                this.patterns.bearerToken = this.parseRegexInput(customSettings.bearerTokens);

            }


            if (customSettings.basicAuth && customSettings.basicAuth.trim()) {
                this.patterns.basicAuth = this.parseRegexInput(customSettings.basicAuth);

            }


            if (customSettings.authHeaders && customSettings.authHeaders.trim()) {
                this.patterns.authHeader = this.parseRegexInput(customSettings.authHeaders);

            }


            if (customSettings.wechatAppIds && customSettings.wechatAppIds.trim()) {
                this.patterns.wechatAppId = this.parseRegexInput(customSettings.wechatAppIds);

            }


            if (customSettings.awsKeys && customSettings.awsKeys.trim()) {
                this.patterns.awsKey = this.parseRegexInput(customSettings.awsKeys);

            }


            if (customSettings.googleApiKeys && customSettings.googleApiKeys.trim()) {
                this.patterns.googleApiKey = this.parseRegexInput(customSettings.googleApiKeys);

            }


            if (customSettings.githubTokens && customSettings.githubTokens.trim()) {
                this.patterns.githubToken = this.parseRegexInput(customSettings.githubTokens);

            }


            if (customSettings.gitlabTokens && customSettings.gitlabTokens.trim()) {
                this.patterns.gitlabToken = this.parseRegexInput(customSettings.gitlabTokens);

            }


            if (customSettings.webhookUrls && customSettings.webhookUrls.trim()) {
                this.patterns.webhookUrls = this.parseRegexInput(customSettings.webhookUrls);

            }


            if (customSettings.cryptoUsage && customSettings.cryptoUsage.trim()) {
                this.patterns.cryptoUsage = this.parseRegexInput(customSettings.cryptoUsage, 'gi');

            }


            this.patterns.jsFile = /<script[^>]*\ssrc\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`][^>]*>|(?:src|href)\s*=\s*["'`]([^"'`]*\.js(?:\?[^"'`]*)?)["'`]|import\s+.*?from\s+["'`]([^"'`]*\.js)["'`]|require\s*\(\s*["'`]([^"'`]*\.js)["'`]\s*\)/gi;
            this.patterns.cssFile = /(?:href)\s*=\s*["'`]([^"'`]*\.css(?:\?[^"'`]*)?)["'`]/gi;
            this.patterns.image = /(?:src|href|data-src)\s*=\s*["'`]([^"'`]*\.(?:jpg|jpeg|png|gif|bmp|svg|webp|ico|tiff)(?:\?[^"'`]*)?)["'`]/gi;
            this.patterns.url = /(https?:\/\/[a-zA-Z0-9\-\.]+(?:\:[0-9]+)?(?:\/[^\s"'<>]*)?)/g;





            this.customRegexConfig = customSettings;

        } catch (error) {
            console.error(' 更新正则表达式配置失败:', error);
        }
    }


    applyBuiltinDefaults() {
        const d = {
            absoluteApi: /(?<![\w/\\.-])(?:\/[\w.-]+(?:\/[\w.-]+)+|\/[\w.-]+\.\w+)(?![\w/\\])/g,
            relativeApi: /(?<![\w/\\-])(?:\.{1,2}\/)+(?:[^/ \t\r\n<>|"']+\/)*[^/ \t\r\n<>|"']*(?![\w/\\])/g,
            domain: /(?<!\w)(?:[a-zA-Z0-9-]{2,}\.)+(?:com|cn|net|org|com\.cn|net\.cn|org\.cn|gov\.cn|edu\.cn|vip|top|cc|shop|club|xyz|site|news|pub|fun|online|tech|store|ltd|info|pro|biz|co|io|me|tv)(?=\b|(?::\d{1,5})?(?:\/|$))(?![.\w])/g,
            email: /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]{1,63}\.(?!js|css|jpg|jpeg|png|ico|gif|webp)[a-zA-Z]{2,}/g,
            phone: /(?<![\d.])(?:13\d|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18\d|19[0-35-9])\d{8}(?!\d)/g,
            ip: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?::\d{1,5})?(?![\d.])/g,
            jwt: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
            idCard: /(?<![0-9a-zA-Z])[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx](?![0-9a-zA-Z])/g,
            awsKey: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}|LTAI[A-Za-z\d]{12,30}|AKID[A-Za-z\d]{13,40}|JDC_[0-9A-Z]{25,40}|(?:AKLT|AKTP)[a-zA-Z0-9]{35,50}|APID[a-zA-Z0-9]{32,42}/g,
            googleApiKey: /AIza[0-9A-Za-z_-]{35}/g,
            githubToken: /(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,255}/g,
            gitlabToken: /glpat-[a-zA-Z0-9\-=_]{20,22}/g,
            wechatAppId: /["'](?:wx|ww)[a-z0-9]{15,18}["']/g,
            bearerToken: /[Bb]earer\s+[a-zA-Z0-9\-=._+/\\]{20,500}/g,
            basicAuth: /[Bb]asic\s+[A-Za-z0-9+/]{18,}={0,2}/g,
            authHeader: /["'\[]*[Aa]uthorization["'\]]*\s*[:=]\s*['"]?\b(?:[Tt]oken\s+)?[a-zA-Z0-9\-_+/]{20,500}['"]?/g,
            credentials: /['"]?\w*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|accesskey|auth)\w*['"]?\s*[:=]\s*['"]?[^\s'"<>,;){}]{4,200}['"]?/gi,
            cryptoUsage: /\b(?:CryptoJS\.(?:AES|DES)|JSEncrypt|KJUR|btoa|atob|md5|sha1|sha256|sha512)\s*\([^)]*\)/g,
            vue: /["'][^"']*\.vue["']/g,
            github: /https?:\/\/github\.com\/[a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+/g,
            comments: /<!--(?![\s\S]*?Performance optimized)[\s\S]{0,1000}?-->|\/\*(?![\s\S]*?Performance optimized)[\s\S]{0,1000}?\*\//g
        };
        for (const key in d) {
            if (!this.patterns[key]) {
                this.patterns[key] = d[key];
            }
        }
    }

    async ensureCustomPatternsLoaded() {
        if (!this.customPatternsLoaded) {

            await this.loadCustomPatterns();
        } else {

        }
    }


    executeRegexWithExec(regex, content, results, resultKey, patternKey) {

        regex.lastIndex = 0;
        let match;
        let matchCount = 0;
        let addedCount = 0;
        let lastIndex = -1;


        const maxMatches = this.performanceConfig.maxMatchesPerPattern;

        while ((match = regex.exec(content)) !== null) {
            const matchedText = match[1] || match[0];
            if (matchedText && matchedText.trim()) {
                const trimmedText = matchedText.trim();


                let shouldSkip = false;


                if (patternKey === 'absoluteApi' && (trimmedText.includes('http://') || trimmedText.includes('https://'))) {
                    shouldSkip = true;
                }

                else if (patternKey === 'absoluteApi' && this.isStaticFile(trimmedText)) {
                    shouldSkip = true;
                }

                else if (patternKey === 'domain' && (this.isDomainBlacklisted(trimmedText) || this.isGarbageDomain(trimmedText))) {
                    shouldSkip = true;
                }

                else if (patternKey === 'vue' && !this.isValidVueFilePath(trimmedText)) {
                    shouldSkip = true;
                }

                else if (patternKey === 'absoluteApi' && this.isGarbageAbsolutePath(trimmedText)) {
                    shouldSkip = true;
                }

                else if (this.containsFilteredContentType(trimmedText)) {
                    shouldSkip = true;
                }

                else if (this.isFilteredByRegex(trimmedText)) {
                    shouldSkip = true;
                }

                else if (patternKey === 'credentials' && this.isCssStyleCode(trimmedText)) {
                    shouldSkip = true;
                }

                else if (patternKey === 'credentials' && this.isJunkCredentialValue(trimmedText)) {
                    shouldSkip = true;
                }

                else if (patternKey === 'comments' && trimmedText.length > 1000) {
                    shouldSkip = true;
                }

                if (!shouldSkip) {

                    let finalText = trimmedText;
                    if (patternKey === 'vue') {
                        finalText = trimmedText.replace(/^["']|["']$/g, '');
                    }
                    results[resultKey].add(finalText);
                    addedCount++;
                }
                matchCount++;
            }


            if (addedCount >= maxMatches) {
                console.warn(` [PatternExtractor] ${patternKey} 达到最大匹配数 ${maxMatches}，停止匹配`);
                break;
            }


            if (matchCount > maxMatches * 2) {
                console.warn(` [PatternExtractor] ${patternKey} 匹配次数过多，停止匹配`);
                break;
            }


            if (regex.lastIndex === lastIndex) {
                regex.lastIndex = lastIndex + 1;
                if (regex.lastIndex >= content.length) {
                    break;
                }
            }
            lastIndex = regex.lastIndex;


            if (!regex.global || regex.lastIndex === 0) {
                regex.lastIndex = match.index + 1;
                if (regex.lastIndex >= content.length) {
                    break;
                }
            }
        }


    }


    extractAPIs(content, results) {






        if (!this.patterns.absoluteApi && !this.patterns.relativeApi) {
            console.warn(' [PatternExtractor] 未配置API正则表达式，跳过API提取');
            console.warn(' [PatternExtractor] absoluteApi存在:', !!this.patterns.absoluteApi);
            console.warn(' [PatternExtractor] relativeApi存在:', !!this.patterns.relativeApi);
            return;
        }


        const processContent = content;





        if (this.patterns.absoluteApi) {




            let absoluteApiCount = 0;
            const regex = this.patterns.absoluteApi;


            regex.lastIndex = 0;
            let match;
            let matchCount = 0;

            while ((match = regex.exec(processContent)) !== null) {
                const api = match[1] || match[0];

                if (api && api.trim()) {
                    const trimmedApi = api.trim();

                    if (trimmedApi.includes('http://') || trimmedApi.includes('https://')) {

                    }

                    else if (this.isStaticFile(trimmedApi)) {

                    }

                    else if (this.shouldFilter(trimmedApi)) {

                    }

                    else if (this.isGarbageAbsolutePath(trimmedApi)) {

                    } else {
                        results.absoluteApis.add(trimmedApi);
                        absoluteApiCount++;

                    }
                    matchCount++;
                }


                if (matchCount > 500) {
                    console.warn(` [PatternExtractor] 绝对路径API匹配次数过多(${matchCount})，停止匹配`);
                    break;
                }


                if (absoluteApiCount > 300) {
                    console.warn(` [PatternExtractor] 绝对路径API结果过多(${absoluteApiCount})，停止匹配`);
                    break;
                }


                if (regex.lastIndex === match.index) {
                    console.warn(` [PatternExtractor] 绝对路径API检测到无限循环，强制推进`);
                    regex.lastIndex = match.index + 1;
                    if (regex.lastIndex >= processContent.length) {
                        break;
                    }
                }
            }


        } else {
            console.warn(' [PatternExtractor] 绝对路径API配置为空');
        }


        if (this.patterns.relativeApi) {




            let relativeApiCount = 0;
            const regex = this.patterns.relativeApi;


            regex.lastIndex = 0;
            let match;
            let matchCount = 0;

            while ((match = regex.exec(processContent)) !== null) {
                const api = match[1] || match[0];

                if (api && api.trim()) {

                    const processedApi = this.processRelativeApi(api.trim());


                    if (results.absoluteApis.has(processedApi)) {

                    }

                    else if (this.isStaticFile(processedApi)) {

                    }

                    else if (this.isStaticResourcePath(processedApi)) {

                    }

                    else if (this.shouldFilter(processedApi)) {

                    } else {
                        results.relativeApis.add(processedApi);
                        relativeApiCount++;

                    }
                    matchCount++;
                }


                if (matchCount > 500) {
                    console.warn(` [PatternExtractor] 相对路径API匹配次数过多(${matchCount})，停止匹配`);
                    break;
                }


                if (relativeApiCount > 300) {
                    console.warn(` [PatternExtractor] 相对路径API结果过多(${relativeApiCount})，停止匹配`);
                    break;
                }


                if (regex.lastIndex === match.index) {
                    console.warn(` [PatternExtractor] 相对路径API检测到无限循环，强制推进`);
                    regex.lastIndex = match.index + 1;
                    if (regex.lastIndex >= processContent.length) {
                        break;
                    }
                }
            }


        } else {
            console.warn(' [PatternExtractor] 相对路径API配置为空');
        }


    }


    extractOtherResources(content, results, sourceUrl = '') {



        const processContent = content;





        if (this.patterns.jsFile) {

            this.patterns.jsFile.lastIndex = 0;
            let match;
            let jsFileCount = 0;
            while ((match = this.patterns.jsFile.exec(processContent)) !== null) {
                const jsFile = match[1] || match[2] || match[3] || match[4];
                if (jsFile) {
                    const cleanJsFile = jsFile.replace(/["'`]/g, '').trim();
                    results.jsFiles.add(cleanJsFile);
                    jsFileCount++;

                }
            }

        }


        if (this.patterns.cssFile) {

            this.patterns.cssFile.lastIndex = 0;
            let match;
            let cssFileCount = 0;
            while ((match = this.patterns.cssFile.exec(processContent)) !== null) {
                const cssFile = match[1];
                if (cssFile) {
                    const cleanCssFile = cssFile.replace(/["'`]/g, '').trim();

                    if (!this.containsFilteredContentType(cleanCssFile)) {
                        results.cssFiles.add(cleanCssFile);
                        cssFileCount++;

                    } else {

                    }
                }
            }

        }


        if (this.patterns.image) {

            this.patterns.image.lastIndex = 0;
            let match;
            let imageCount = 0;
            while ((match = this.patterns.image.exec(processContent)) !== null) {
                const image = match[1];
                if (image) {
                    const cleanImage = image.replace(/["'`]/g, '').trim();

                    if (!this.containsFilteredContentType(cleanImage)) {
                        results.images.add(cleanImage);
                        imageCount++;

                    } else {

                    }
                }
            }

        }


        if (this.patterns.url) {


            this.patterns.url.lastIndex = 0;
            let match;
            let urlCount = 0;
            let filteredImageCount = 0;
            let reclassifiedJsCount = 0;
            let reclassifiedCssCount = 0;

            let totalUrlMatches = 0;
            const maxUrlMatches = 500;

            while ((match = this.patterns.url.exec(processContent)) !== null) {
                totalUrlMatches++;


                if (totalUrlMatches > maxUrlMatches) {
                    console.warn(` [PatternExtractor] URL匹配次数过多(${totalUrlMatches})，停止匹配`);
                    break;
                }

                const url = match[0];
                if (url) {

                    if (this.isImageFile(url)) {
                        filteredImageCount++;



                        const imgDomain = this.extractDomainFromUrl(url);
                        if (imgDomain && !this.isDomainBlacklisted(imgDomain) && !this.isGarbageDomain(imgDomain)) {
                            results.domains.add(imgDomain);
                        }
                        continue;
                    }


                    if (this.isJsFile(url)) {
                        results.jsFiles.add(url);
                        reclassifiedJsCount++;



                        const jsDomain = this.extractDomainFromUrl(url);
                        if (jsDomain && !this.isDomainBlacklisted(jsDomain) && !this.isGarbageDomain(jsDomain)) {
                            results.domains.add(jsDomain);
                        }
                        continue;
                    }


                    if (this.isCssFile(url)) {
                        results.cssFiles.add(url);
                        reclassifiedCssCount++;



                        const cssDomain = this.extractDomainFromUrl(url);
                        if (cssDomain && !this.isDomainBlacklisted(cssDomain) && !this.isGarbageDomain(cssDomain)) {
                            results.domains.add(cssDomain);
                        }
                        continue;
                    }


                    if (!this.containsFilteredContentType(url)) {
                        results.urls.add(url);
                        urlCount++;



                        const extractedDomain = this.extractDomainFromUrl(url);
                        if (extractedDomain) {
                            const isBlacklisted = this.isDomainBlacklisted(extractedDomain);
                            const isGarbage = this.isGarbageDomain(extractedDomain);

                            if (!isBlacklisted && !isGarbage) {
                                results.domains.add(extractedDomain);

                            }
                        }
                    }
                }
            }

        }


        this.extractVueFiles(processContent, results);


        this.extractSourceMapFiles(processContent, results);


    }


    extractVueFiles(content, results) {
        if (!content) return;


        const vuePatterns = [

            /import\s+(?:\w+|\{[^}]+\})\s+from\s+['"]([^'"]+\.vue)['"]/gi,

            /require\s*\(\s*['"]([^'"]+\.vue)['"]\s*\)/gi,

            /import\s*\(\s*['"]([^'"]+\.vue)['"]\s*\)/gi,

            /webpackChunkName:\s*['"][^'"]+['"]\s*\*\/\s*['"]([^'"]+\.vue)['"]/gi,

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


    extractSourceMapFiles(content, results) {
        if (!content) return;


        if (!results.sourceMapFiles) {
            results.sourceMapFiles = new Set();
        }


        const sourceMapPatterns = [

            /\/\/[#@]\s*sourceMappingURL=([^\s\n]+)/g,
            /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//g,

            /['"]([^'"]+\.map)['"]/gi,

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


    extractDomainFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        try {

            let domain = url.replace(/^https?:\/\//, '');


            domain = domain.replace(/^www\./, '');


            domain = domain.split('/')[0];
            domain = domain.split('?')[0];
            domain = domain.split('#')[0];
            domain = domain.split(':')[0];


            domain = domain.toLowerCase().trim();


            if (!domain || domain.length < 3 || !domain.includes('.')) {
                return null;
            }


            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
                return null;
            }

            return domain;
        } catch (error) {
            return null;
        }
    }


    async extractDynamicCustomPatterns(content, results) {
        try {




            const customPatternKeys = Object.keys(this.patterns).filter(key => key.startsWith('custom_'));

            if (customPatternKeys.length === 0) {

                return;
            }


            const storageResult = { customRegexConfigs: null };

            if (!storageResult.customRegexConfigs) {

                return;
            }



            let configsToProcess = [];


            if (Array.isArray(storageResult.customRegexConfigs)) {

                configsToProcess = storageResult.customRegexConfigs;

            } else if (typeof storageResult.customRegexConfigs === 'object') {

                configsToProcess = Object.entries(storageResult.customRegexConfigs).map(([key, config]) => ({
                    key: `custom_${key}`,
                    name: config.name,
                    pattern: config.pattern,
                    createdAt: config.createdAt
                }));

            }

            if (configsToProcess.length === 0) {

                return;
            }


            const processContent = content;




            configsToProcess.forEach((config, index) => {
                try {
                    if (!config.key || !config.pattern || !config.name) {
                        console.warn(` [PatternExtractor] 跳过无效的自定义正则配置 ${index + 1}:`, config);
                        return;
                    }





                    const regex = new RegExp(config.pattern, 'g');


                    if (!results[config.key]) {
                        results[config.key] = new Set();

                    }





                    const testContent = processContent.substring(0, 1000);

                    const testRegex = new RegExp(config.pattern, 'g');
                    let testMatch;
                    let testCount = 0;
                    while ((testMatch = testRegex.exec(testContent)) !== null && testCount < 5) {

                        testCount++;
                    }



                    let match;
                    let matchCount = 0;
                    regex.lastIndex = 0;


                    while ((match = regex.exec(processContent)) !== null) {
                        const matchedText = match[0];
                        if (matchedText && matchedText.trim()) {
                            results[config.key].add(matchedText.trim());
                            matchCount++;

                        }


                        if (matchCount > 1000) {
                            console.warn(` [PatternExtractor] 自定义正则 ${config.key} 匹配次数过多，停止匹配`);
                            break;
                        }


                        if (regex.lastIndex === match.index) {
                            console.warn(` [PatternExtractor] 自定义正则 ${config.key} 检测到无限循环，停止匹配`);
                            break;
                        }
                    }





                    if (results[config.key].size > 0) {


                    } else {



                    }

                } catch (error) {
                    console.error(` [PatternExtractor] 自定义正则配置 ${index + 1} 处理失败:`, error, config);

                    if (!results[config.key]) {
                        results[config.key] = new Set();

                    }
                }
            });



        } catch (error) {
            console.error(' [PatternExtractor] 提取动态自定义正则模式失败:', error);
        }
    }


    async extractPatterns(content, sourceUrl = '') {
        try {


            if (!this.customPatternsLoaded && Object.keys(this.patterns).length === 0) {
                await this.ensureCustomPatternsLoaded();
            }


            const MAX_CONTENT_SIZE = 500000;
            const processContent = content.length > MAX_CONTENT_SIZE ?
                content.substring(0, MAX_CONTENT_SIZE) : content;

            if (content.length > MAX_CONTENT_SIZE) {
                console.log(` [PatternExtractor] 内容过大(${Math.round(content.length/1024)}KB)，截取前500KB处理`);
            }


            const results = {

                absoluteApis: new Set(),
                relativeApis: new Set(),


                jsFiles: new Set(),
                cssFiles: new Set(),
                images: new Set(),
                urls: new Set(),


                domains: new Set(),
                emails: new Set(),
                phoneNumbers: new Set(),
                credentials: new Set(),
                ipAddresses: new Set(),
                paths: new Set(),
                jwts: new Set(),
                githubUrls: new Set(),
                vueFiles: new Set(),
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





            this.extractAPIs(processContent, results);


            this.extractOtherResources(processContent, results, sourceUrl);


            const patternMappings = {
                domain: 'domains',
                email: 'emails',
                phone: 'phoneNumbers',
                credentials: 'credentials',
                ip: 'ipAddresses',
                paths: 'paths',
                jwt: 'jwts',
                github: 'githubUrls',
                vue: 'vueFiles',
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



            Object.entries(patternMappings).forEach(([patternKey, resultKey]) => {
                if (this.patterns[patternKey]) {




                    const regex = this.patterns[patternKey];
                    const regexSource = regex.source;
                    const hasLookbehind = regexSource.includes('(?<!') || regexSource.includes('(?<=');
                    const hasLookahead = regexSource.includes('(?!') || regexSource.includes('(?=');

                    if (hasLookbehind || hasLookahead) {



                        try {
                            const matches = [...processContent.matchAll(regex)];


                            matches.forEach((match, index) => {
                                const matchedText = match[1] || match[0];
                                if (matchedText && matchedText.trim()) {
                                    const trimmedText = matchedText.trim();


                                    if (patternKey === 'absoluteApi' && (trimmedText.includes('http://') || trimmedText.includes('https://'))) {

                                        return;
                                    }


                                    if (patternKey === 'absoluteApi' && this.isStaticFile(trimmedText)) {

                                        return;
                                    }


                                    if (patternKey === 'domain') {
                                        if (this.isDomainBlacklisted(trimmedText)) {
                                            return;
                                        }
                                        if (this.isGarbageDomain(trimmedText)) {
                                            return;
                                        }
                                    }


                                    if (patternKey === 'vue' && !this.isValidVueFilePath(trimmedText)) {
                                        return;
                                    }


                                    if (patternKey === 'absoluteApi' && this.isGarbageAbsolutePath(trimmedText)) {
                                        return;
                                    }


                                    if (this.containsFilteredContentType(trimmedText)) {

                                        return;
                                    }


                                    if (patternKey === 'credentials' && this.isCssStyleCode(trimmedText)) {

                                        return;
                                    }


                                    if (patternKey === 'credentials' && this.isJunkCredentialValue(trimmedText)) {
                                        return;
                                    }


                                    if (patternKey === 'comments' && trimmedText.length > 1000) {
                                        return;
                                    }


                                    if (patternKey === 'comments' && this.isEmptyComment(trimmedText)) {

                                        return;
                                    }


                                    let finalText = trimmedText;
                                    if (patternKey === 'vue') {
                                        finalText = trimmedText.replace(/^["']|["']$/g, '');
                                    }
                                    results[resultKey].add(finalText);

                                }
                            });


                        } catch (error) {
                            console.error(` [PatternExtractor] ${patternKey} matchAll失败，回退到exec方法:`, error);

                            this.executeRegexWithExec(regex, processContent, results, resultKey, patternKey);
                        }
                    } else {

                        this.executeRegexWithExec(regex, processContent, results, resultKey, patternKey);
                    }
                } else {

                }
            });







            const customPatternKeys = Object.keys(this.patterns).filter(key => key.startsWith('custom_'));







            if (customPatternKeys.length > 0) {
                customPatternKeys.forEach(patternKey => {
                    try {


                        const regex = this.patterns[patternKey];
                        if (!regex) {
                            console.warn(` [PatternExtractor] 自定义正则 ${patternKey} 未找到对应的正则表达式`);
                            return;
                        }


                        if (!results[patternKey]) {
                            results[patternKey] = new Set();

                        }





                        regex.lastIndex = 0;

                        let match;
                        let matchCount = 0;

                        while ((match = regex.exec(processContent)) !== null) {
                            const matchedText = match[0];
                            if (matchedText && matchedText.trim()) {
                                const trimmedText = matchedText.trim();


                                if (!this.containsFilteredContentType(trimmedText)) {
                                    results[patternKey].add(trimmedText);
                                    matchCount++;

                                } else {

                                }
                            }


                            if (matchCount > 1000) {
                                console.warn(` [PatternExtractor] 自定义正则 ${patternKey} 匹配次数过多，停止匹配`);
                                break;
                            }


                            if (regex.lastIndex === match.index) {
                                console.warn(` [PatternExtractor] 自定义正则 ${patternKey} 检测到无限循环，停止匹配`);
                                break;
                            }
                        }




                        if (results[patternKey].size > 0) {

                        } else {

                        }

                    } catch (error) {
                        console.error(` [PatternExtractor] 自定义正则 ${patternKey} 处理失败:`, error);

                        if (!results[patternKey]) {
                            results[patternKey] = new Set();

                        }
                    }
                });
            } else {

            }




            if (results.idCards.size > 0) {

                const validatedIdCards = this.validateIdCards(Array.from(results.idCards));
                results.idCards = new Set(validatedIdCards);

            }


            const finalResults = {};




            for (const [key, value] of Object.entries(results)) {
                if (value instanceof Set) {

                    finalResults[key] = [...value].map(item => {

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


                    if (finalResults[key].length > 0) {


                        if (key.startsWith('custom_')) {

                        }
                    } else if (key.startsWith('custom_')) {


                    }
                } else if (value) {

                    if (Array.isArray(value)) {
                        finalResults[key] = value.map(item => {

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

                } else {

                    finalResults[key] = [];
                }
            }


            const customKeys = Object.keys(results).filter(key => key.startsWith('custom_'));
            if (customKeys.length > 0) {

                customKeys.forEach(key => {

                });
            } else {

            }




            return finalResults;

        } catch (error) {
            console.error(' [PatternExtractor] 提取模式失败:', error);
            return {};
        }
    }


    isEmptyComment(comment) {
        if (!comment || typeof comment !== 'string') {
            return true;
        }


        const cleanedComment = comment
            .replace(/^\/\*+|\*+\/$/g, '')
            .replace(/^\/\/+/g, '')
            .replace(/^<!--+|--+>$/g, '')
            .replace(/^\*+/g, '')
            .trim();


        return cleanedComment.length === 0 || /^\s*$/.test(cleanedComment);
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExtractor;
} else if (typeof window !== 'undefined') {
    window.PatternExtractor = PatternExtractor;
}
