class APIFilter {
    constructor() {
        this.regexCache = this.initRegexCache();
        this.config = this.initConfig();
        // 初始化域名和手机号过滤器（安全检查，避免 DomainPhoneFilter 未定义的错误）
        this.domainPhoneFilter = window.domainPhoneFilter || (typeof DomainPhoneFilter !== 'undefined' ? new DomainPhoneFilter() : null);
    }
    
    initRegexCache() {
        return {
            // 基础模式缓存
            coordPattern: /^coord/,
            valuePattern: /^\/|true|false|register|signUp|name|basic|http/i,
            chinesePattern: /^[\u4e00-\u9fa5]+$/,
            keywordPattern: /^func|variable|input|true|false|newline|null|http|unexpected|error|data|object|brac|beare|str|self|void|num|atom|opts|token|params|result|con|text|stor|sup|pun|emp|this|key|com|ent|met|opera|return|case|pare|ident|reg|invalid/i,
            camelCasePattern: /\b[_a-z]+(?:[A-Z][a-z]+)+\b/,
            
            // 文件类型模式
            fontPattern: /\.(woff|woff2|ttf|eot|otf)(\?.*)?$/i,
            imagePattern: /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp|tiff)(\?.*)?$/i,
            jsPattern: /\.(js|jsx|ts|tsx|vue|mjs|cjs)(\?.*)?$/i,
            cssPattern: /\.(css|scss|sass|less|styl)(\?.*)?$/i,
            docPattern: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md)(\?.*)?$/i,
            audioPattern: /\.(mp3|wav|ogg|m4a|aac|flac|wma)(\?.*)?$/i,
            videoPattern: /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)(\?.*)?$/i,
            
            // API识别模式
            apiPathPattern: /^\/(?:api|admin|manage|backend|service|rest|graphql|v\d+)\//,
            dynamicApiPattern: /\.(php|asp|aspx|jsp|do|action)(\?.*)?$/i,
            queryApiPattern: /\?[^#\s]+/,
            
            // 模块路径模式
            relativeModulePattern: /^\.{1,2}\//,
            nodeModulePattern: /node_modules/,
            
            // 过滤模式
            staticResourcePattern: /^(audio|blots|core|ace|icon|css|formats|image|js|modules|text|themes|ui|video|static|attributors|application)/,
            shortPathPattern: /^.{1,4}$/,
            invalidCharsPattern: /[A-Z\.\/\#\+\?23]/,
            
            // 增强的域名和手机号模式
            domainPattern: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?/i,
            cnMobilePattern: /(?<!\d)(?:1(3([0-35-9]\d|4[1-8])|4[14-9]\d|5(\d\d|7[1-79])|66\d|7[2-35-8]\d|8\d{2}|9[89]\d)\d{7})(?!\d)/,
            intlMobilePattern: /(?<!\d)(?:\+\d{1,3}[\s-]?)?\d{6,14}(?!\d)/,
            emailPattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        };
    }
    
    initConfig() {
        return {
            // 被过滤的内容类型
            filteredContentTypes: [
                'text/css', 'text/javascript', 'application/javascript',
                'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml',
                'font/woff', 'font/woff2', 'application/font-woff',
                'audio/mpeg', 'video/mp4', 'application/octet-stream'
            ],
            
            // 最小路径长度
            minPathLength: 2,
            maxPathLength: 500,
            
            // API关键词
            apiKeywords: [
                'api', 'admin', 'manage', 'backend', 'service', 'rest', 
                'graphql', 'ajax', 'json', 'xml', 'data', 'query',
                'search', 'upload', 'download', 'export', 'import'
            ],
            
            // 排除的路径前缀
            excludedPrefixes: [
                'chrome-extension://', 'moz-extension://', 'about:',
                'data:', 'javascript:', 'mailto:', 'tel:', 'ftp:'
            ],
            
            // 无效的域名后缀（通常是资源文件扩展名）
            invalidDomainSuffixes: new Set([
                'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'woff', 'woff2', 
                'ttf', 'eot', 'mp3', 'mp4', 'webm', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 
                'pptx', 'zip', 'rar', 'tar', 'gz', '7z', 'exe', 'dll', 'bin', 'iso', 'dmg', 'apk',
                'ts', 'jsx', 'vue', 'scss', 'less', 'sass', 'json', 'xml', 'csv', 'md', 'txt',
                'log', 'bak', 'tmp', 'temp', 'swf', 'flv', 'avi', 'mov', 'wmv', 'mkv'
            ])
        };
    }
    
    /**
     * 主要的API过滤函数
     * @param {string} match - 匹配到的路径
     * @param {Object} resultsSet - 结果集合
     * @returns {boolean} - 是否应该保留此路径
     */
    filterAPI(match, resultsSet) {
        // 移除引号
        const cleanPath = this.cleanPath(match);
        if (!cleanPath) return false;
        
        // 基础验证
        if (!this.isValidPath(cleanPath)) return false;
        
        // 字体文件过滤
        if (this.regexCache.fontPattern.test(cleanPath)) {
            return false;
        }
        
        // 文件类型分类
        if (this.classifyFileType(cleanPath, resultsSet)) {
            return true;
        }
        
        // 内容类型过滤
        if (this.isFilteredContentType(cleanPath)) {
            return false;
        }
        
        // 路径分类和处理
        return this.classifyAndProcessPath(cleanPath, resultsSet);
    }
    
    /**
     * 清理路径字符串
     */
    cleanPath(path) {
        if (!path || typeof path !== 'string') return null;
        
        // 移除首尾引号
        let cleaned = path.replace(/^['"`]|['"`]$/g, '');
        
        // 检查排除的前缀
        if (this.config.excludedPrefixes.some(prefix => cleaned.startsWith(prefix))) {
            return null;
        }
        
        // 长度检查
        if (cleaned.length < this.config.minPathLength || 
            cleaned.length > this.config.maxPathLength) {
            return null;
        }
        
        return cleaned;
    }
    
    /**
     * 验证路径有效性
     */
    isValidPath(path) {
        // 空路径检查
        if (!path || path.trim() === '') return false;
        
        // 特殊字符检查（针对短路径）
        if (path.length <= 4 && this.regexCache.invalidCharsPattern.test(path.slice(1))) {
            return false;
        }
        
        // 静态资源前缀检查
        if (this.regexCache.staticResourcePattern.test(path)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 文件类型分类
     */
    classifyFileType(path, resultsSet) {
        const classifications = [
            { pattern: this.regexCache.imagePattern, set: 'imageFiles' },
            { pattern: this.regexCache.jsPattern, set: 'jsFiles' },
            { pattern: this.regexCache.cssPattern, set: 'cssFiles' },
            { pattern: this.regexCache.docPattern, set: 'docFiles' },
            { pattern: this.regexCache.audioPattern, set: 'audioFiles' },
            { pattern: this.regexCache.videoPattern, set: 'videoFiles' }
        ];
        
        for (const { pattern, set } of classifications) {
            if (pattern.test(path)) {
                resultsSet?.[set]?.add(path);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 是否为静态资源（根据扩展名判断）
     */
    isStaticResource(path) {
        return this.regexCache.imagePattern.test(path) ||
               this.regexCache.jsPattern.test(path) ||
               this.regexCache.cssPattern.test(path) ||
               this.regexCache.docPattern.test(path) ||
               this.regexCache.audioPattern.test(path) ||
               this.regexCache.videoPattern.test(path) ||
               this.regexCache.fontPattern.test(path);
    }
    
    /**
     * 检查是否为被过滤的内容类型
     */
    isFilteredContentType(path) {
        const lowerPath = path.toLowerCase();
        return this.config.filteredContentTypes.some(type => 
            lowerPath.includes(type.toLowerCase())
        );
    }
    
    /**
     * 路径分类和处理
     */
    classifyAndProcessPath(path, resultsSet) {
        // Vue文件特殊处理
        if (path.endsWith('.vue')) {
            resultsSet?.vueFiles?.add(path);
            return true;
        }
        
        // 模块路径处理
        if (this.isModulePath(path)) {
            resultsSet?.moduleFiles?.add(path);
            return true;
        }
        
        // 绝对路径处理
        if (path.startsWith('/')) {
            return this.processAbsolutePath(path, resultsSet);
        }
        
        // 相对路径处理
        return this.processRelativePath(path, resultsSet);
    }
    
    /**
     * 模块路径检查
     */
    isModulePath(path) {
        return this.regexCache.relativeModulePattern.test(path) ||
               this.regexCache.nodeModulePattern.test(path);
    }
    
    /**
     * 处理绝对路径
     */
    processAbsolutePath(path, resultsSet) {
        // 短路径过滤
        if (path.length <= 4 && this.regexCache.invalidCharsPattern.test(path.slice(1))) {
            return false;
        }
        
        // 静态资源直接分类为文件，不进入API集合
        if (this.isStaticResource(path)) {
            this.classifyFileType(path, resultsSet);
            return true;
        }
        
        // API路径识别
        if (this.isAPIPath(path)) {
            resultsSet?.absoluteApis?.add(path);
            return true;
        }
        
        // 动态文件识别
        if (this.regexCache.dynamicApiPattern.test(path) || 
            this.regexCache.queryApiPattern.test(path)) {
            resultsSet?.absoluteApis?.add(path);
            return true;
        }
        
        // 其他绝对路径
        resultsSet?.absolutePaths?.add(path);
        return true;
    }
    
    /**
     * 处理相对路径
     */
    processRelativePath(path, resultsSet) {
        // 短路径过滤
        if (path.length <= 4) return false;
        
        // 静态资源前缀过滤
        if (this.regexCache.staticResourcePattern.test(path)) {
            return false;
        }
        
        // 静态资源直接分类为文件，不进入API集合
        if (this.isStaticResource(path)) {
            this.classifyFileType(path, resultsSet);
            return true;
        }
        
        // API路径识别
        if (this.isAPIPath(path)) {
            resultsSet?.relativeApis?.add(path);
            return true;
        }
        
        // 动态文件识别
        if (this.regexCache.dynamicApiPattern.test(path) || 
            this.regexCache.queryApiPattern.test(path)) {
            resultsSet?.relativeApis?.add(path);
            return true;
        }
        
        // 其他相对路径
        resultsSet?.relativePaths?.add(path);
        return true;
    }
    
    /**
     * API路径识别
     */
    isAPIPath(path) {
        // 静态资源不视为API
        if (this.isStaticResource(path)) {
            return false;
        }
        // 直接API路径模式匹配
        if (this.regexCache.apiPathPattern.test(path)) {
            return true;
        }
        
        // 关键词匹配
        const lowerPath = path.toLowerCase();
        return this.config.apiKeywords.some(keyword => 
            lowerPath.includes(`/${keyword}/`) || 
            lowerPath.includes(`${keyword}.`) ||
            lowerPath.startsWith(`${keyword}/`)
        );
    }
    
    /**
     * 批量过滤API路径
     * @param {Array} paths - 路径数组
     * @param {Object} resultsSet - 结果集合
     * @returns {Object} - 分类结果
     */
    batchFilter(paths, resultsSet = null) {
        if (!resultsSet) {
            resultsSet = this.createEmptyResultSet();
        }
        
        let processed = 0;
        let filtered = 0;
        
        paths.forEach(path => {
            processed++;
            if (this.filterAPI(path, resultsSet)) {
                // 路径被保留
            } else {
                filtered++;
            }
        });
        
        return {
            processed,
            filtered,
            results: this.convertSetsToArrays(resultsSet)
        };
    }
    
    /**
     * 创建空的结果集
     */
    createEmptyResultSet() {
        return {
            absoluteApis: new Set(),
            relativeApis: new Set(),
            absolutePaths: new Set(),
            relativePaths: new Set(),
            moduleFiles: new Set(),
            jsFiles: new Set(),
            cssFiles: new Set(),
            imageFiles: new Set(),
            audioFiles: new Set(),
            videoFiles: new Set(),
            docFiles: new Set(),
            vueFiles: new Set(),
            // 新增域名和手机号相关集合
            domains: new Set(),
            phoneNumbers: new Set(),
            emails: new Set()
        };
    }
    
    /**
     * 将Set转换为Array
     */
    convertSetsToArrays(resultsSet) {
        const result = {};
        Object.keys(resultsSet).forEach(key => {
            if (resultsSet[key] instanceof Set) {
                result[key] = Array.from(resultsSet[key]);
            } else {
                result[key] = resultsSet[key];
            }
        });
        return result;
    }
    
    /**
     * 获取统计信息
     */
    getStats(resultsSet) {
        const stats = {};
        Object.keys(resultsSet).forEach(key => {
            if (resultsSet[key] instanceof Set) {
                stats[key] = resultsSet[key].size;
            } else if (Array.isArray(resultsSet[key])) {
                stats[key] = resultsSet[key].length;
            }
        });
        return stats;
    }
    
    /**
     * 从文本中提取域名、手机号和邮箱
     * @param {string} text - 要分析的文本
     * @param {Object} resultsSet - 结果集合
     * @returns {Object} - 包含域名、手机号和邮箱的结果对象
     */
    extractSensitiveInfo(text, resultsSet = null) {
        if (!resultsSet) {
            resultsSet = this.createEmptyResultSet();
        }
        
        if (!text || typeof text !== 'string') {
            return this.convertSetsToArrays(resultsSet);
        }
        
        try {
            // 使用域名和手机号过滤器提取信息
            if (this.domainPhoneFilter) {
                // 提取域名
                const domainMatches = this.extractDomainsFromText(text);
                if (domainMatches && domainMatches.length > 0) {
                    // 使用增强的域名过滤器过滤有效域名
                    const validDomains = this.domainPhoneFilter.filterDomains(domainMatches);
                    validDomains.forEach(domain => resultsSet.domains.add(domain));
                }
                
                // 提取手机号（仅保留中国大陆）
                const phoneMatches = this.extractPhonesFromText(text);
                if (phoneMatches && phoneMatches.length > 0) {
                    // 使用增强的手机号过滤器，仅保留中国大陆手机号
                    const validPhones = this.domainPhoneFilter.filterPhones(phoneMatches, true);
                    validPhones.forEach(phone => resultsSet.phoneNumbers.add(phone));
                }
                
                // 提取邮箱
                const emailMatches = this.extractEmailsFromText(text);
                if (emailMatches && emailMatches.length > 0) {
                    // 使用增强的邮箱过滤器过滤有效邮箱
                    const validEmails = this.domainPhoneFilter.filterEmails(emailMatches);
                    validEmails.forEach(email => resultsSet.emails.add(email));
                }
            } else {
                // 如果域名和手机号过滤器不可用，使用内置的正则表达式
                this.extractDomainsWithRegex(text, resultsSet);
                this.extractPhonesWithRegex(text, resultsSet);
                this.extractEmailsWithRegex(text, resultsSet);
            }
        } catch (error) {
            console.error('Error extracting sensitive info:', error);
        }
        
        return this.convertSetsToArrays(resultsSet);
    }
    
    /**
     * 从文本中提取域名
     */
    extractDomainsFromText(text) {
        const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?/gi;
        const matches = [];
        let match;
        
        while ((match = domainRegex.exec(text)) !== null) {
            // 提取域名部分（不包括路径和查询参数）
            let domain = match[1] || match[0];
            domain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
            domain = domain.split('/')[0].split('?')[0].split('#')[0];
            
            if (domain && domain.includes('.')) {
                matches.push(domain);
            }
        }
        
        return matches;
    }
    
    /**
     * 从文本中提取手机号
     */
    extractPhonesFromText(text) {
        const matches = [];
        
        // 中国手机号模式：1开头的11位数字
        const cnPhoneRegex = /(?<!\d)(?:1(3([0-35-9]\d|4[1-8])|4[14-9]\d|5(\d\d|7[1-79])|66\d|7[2-35-8]\d|8\d{2}|9[89]\d)\d{7})(?!\d)/g;
        let cnMatch;
        while ((cnMatch = cnPhoneRegex.exec(text)) !== null) {
            matches.push(cnMatch[0]);
        }
        
        // 国际手机号模式：可能带有国家代码的6-15位数字
        const intlPhoneRegex = /(?<!\d)(?:\+\d{1,3}[\s-]?)?\d{6,15}(?!\d)/g;
        let intlMatch;
        while ((intlMatch = intlPhoneRegex.exec(text)) !== null) {
            // 避免与中国手机号重复
            if (!matches.includes(intlMatch[0])) {
                matches.push(intlMatch[0]);
            }
        }
        
        return matches;
    }
    
    /**
     * 从文本中提取邮箱
     */
    extractEmailsFromText(text) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = [];
        let match;
        
        while ((match = emailRegex.exec(text)) !== null) {
            matches.push(match[0]);
        }
        
        return matches;
    }
    
    /**
     * 使用正则表达式提取域名
     */
    extractDomainsWithRegex(text, resultsSet) {
        const matches = text.match(this.regexCache.domainPattern) || [];
        
        for (let match of matches) {
            // 清理匹配结果
            match = match.trim();
            
            // 移除协议前缀
            match = match.replace(/^https?:\/\//i, '');
            
            // 移除路径和查询参数
            match = match.split('/')[0].split('?')[0].split('#')[0];
            
            // 检查是否是有效域名
            if (this.isValidDomainName(match)) {
                resultsSet.domains.add(match);
            }
        }
    }
    
    /**
     * 检查是否是有效域名
     */
    isValidDomainName(domain) {
        if (!domain || typeof domain !== 'string') return false;
        
        // 长度检查
        if (domain.length < 4 || domain.length > 253) {
            return false;
        }
        
        // 检查是否包含至少一个点
        if (!domain.includes('.')) return false;
        
        // 检查顶级域名是否有效
        const parts = domain.split('.');
        const tld = parts[parts.length - 1].toLowerCase();
        
        // 检查是否是无效的文件扩展名
        if (this.config.invalidDomainSuffixes.has(tld)) {
            return false;
        }
        
        // 检查域名格式
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 使用正则表达式提取手机号（仅中国大陆）
     */
    extractPhonesWithRegex(text, resultsSet) {
        // 仅匹配中国手机号
        const cnMatches = text.match(this.regexCache.cnMobilePattern) || [];
        for (let match of cnMatches) {
            if (this.isValidChinesePhoneNumber(match)) {
                resultsSet.phoneNumbers.add(match);
            }
        }
    }
    
    /**
     * 检查是否是有效的中国手机号
     */
    isValidChinesePhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        // 移除所有非数字字符
        const cleaned = phone.replace(/\D/g, '');
        
        // 中国手机号必须是11位，且以1开头
        if (cleaned.length !== 11 || !cleaned.startsWith('1')) {
            return false;
        }
        
        // 第二位必须是3-9
        const secondDigit = parseInt(cleaned.charAt(1));
        if (secondDigit < 3 || secondDigit > 9) {
            return false;
        }
        
        // 检查是否是纯数字序列，例如 12345678901
        if (/^1(?:0{10}|1{10}|2{10}|3{10}|4{10}|5{10}|6{10}|7{10}|8{10}|9{10})$/.test(cleaned)) {
            return false;
        }
        
        // 检查是否是递增或递减序列
        if (/^1(?:0123456789|9876543210)$/.test(cleaned)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 检查是否是有效的国际手机号
     */
    isValidInternationalPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        // 移除所有空格、破折号等
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        
        // 长度检查
        if (cleaned.length < 10 || cleaned.length > 15) {
            return false;
        }
        
        // 检查是否全是相同的数字
        if (/^(\+?)\d*(\d)\2{8,}$/.test(cleaned)) {
            return false;
        }
        
        // 检查是否是简单的递增或递减序列
        if (/^(\+?)\d*(?:0123456789|9876543210)/.test(cleaned)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 使用正则表达式提取邮箱
     */
    extractEmailsWithRegex(text, resultsSet) {
        const matches = text.match(this.regexCache.emailPattern) || [];
        
        for (let match of matches) {
            if (this.isValidEmailAddress(match)) {
                resultsSet.emails.add(match);
            }
        }
    }
    
    /**
     * 检查是否是有效的邮箱地址
     */
    isValidEmailAddress(email) {
        if (!email || typeof email !== 'string') return false;
        
        // 基本格式检查
        if (!this.regexCache.emailPattern.test(email)) {
            return false;
        }
        
        // 分解邮箱地址
        const [localPart, domain] = email.split('@');
        
        // 本地部分检查
        if (localPart.length > 64) {
            return false;
        }
        
        // 域名部分检查
        if (!this.isValidDomainName(domain)) {
            return false;
        }
        
        return true;
    }
}

// 导出API过滤器
window.APIFilter = APIFilter;

// 创建全局实例
window.apiFilter = new APIFilter();

// 兼容SnowEyes的接口
window.SCANNER_FILTER = window.SCANNER_FILTER || {};
window.SCANNER_FILTER.api = function(match, resultsSet) {
    return window.apiFilter.filterAPI(match, resultsSet);
};

// 添加敏感信息提取接口
window.SCANNER_FILTER.extractSensitiveInfo = function(text, resultsSet) {
    return window.apiFilter.extractSensitiveInfo(text, resultsSet);
};