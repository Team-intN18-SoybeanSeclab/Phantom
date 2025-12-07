/**
 * 内容提取器 - 负责从页面内容中提取各种信息
 * 优化版本 - 提高性能
 */
class ContentExtractor {
    
    async extractSensitiveInfo(targetUrl) {
        try {
            // 确保在顶层窗口执行
            if (window !== window.top) {
                //console.log('跳过iframe扫描，只扫描顶层页面');
                return this.getEmptyResults();
            }
            
            // 验证当前页面URL是否匹配目标URL
            if (targetUrl && window.location.href !== targetUrl) {
                //console.log('页面URL不匹配，跳过扫描');
                return this.getEmptyResults();
            }
            
            //console.log('🔍 开始扫描顶层页面:', window.location.href);
            
            const results = {
                absoluteApis: new Set(),
                relativeApis: new Set(),
                modulePaths: new Set(),
                domains: new Set(),
                urls: new Set(),
                images: new Set(),
                audios: new Set(),
                videos: new Set(),
                jsFiles: new Set(),
                cssFiles: new Set(),
                emails: new Set(),
                phoneNumbers: new Set(),
                ipAddresses: new Set(),
                sensitiveKeywords: new Set(),
                comments: new Set(),
                subdomains: new Set(),
                ports: new Set(),
                paths: new Set(),
                parameters: new Set(),
                credentials: new Set(),
                cookies: new Set(),
                idKeys: new Set(),
                idcards: new Set(),
                companies: new Set(),
                jwts: new Set(),
                githubUrls: new Set(),
                vueFiles: new Set(),
                // 新增的敏感信息类型
                bearerTokens: new Set(),
                basicAuth: new Set(),
                authHeaders: new Set(),
                wechatAppIds: new Set(),
                awsKeys: new Set(),
                googleApiKeys: new Set(),
                githubTokens: new Set(),
                gitlabTokens: new Set(),
                webhookUrls: new Set(),
                idCards: new Set(),
                cryptoUsage: new Set()
            };
            
            // 获取页面内容 - 使用更高效的方法
            const pageContent = this.getPageContent();
            
            // 获取脚本和样式内容 - 使用更高效的方法
            const scriptContent = this.getAllScripts();
            const styleContent = this.getAllStyles();
            
            // 获取所有链接和资源 - 使用更高效的方法
            const linkContent = this.getAllLinks();
            
            // 获取存储内容
            const storageContent = this.getStorageContent();
            
            // 🔥 性能优化：合并所有非脚本内容，一次性处理正则提取
            // 这样可以避免多次调用 performMultiLayerScan 导致的重复配置加载
            const combinedNonScriptContent = [pageContent, styleContent, linkContent].filter(c => c && c.length > 0).join('\n');
            
            // 🔥 性能优化：只调用两次 performMultiLayerScan
            // 1. 非脚本内容（不使用 AST）
            if (combinedNonScriptContent.length > 0) {
                await this.performMultiLayerScan(combinedNonScriptContent, results, false);
            }
            
            // 2. 脚本内容（使用 AST）- 合并脚本和存储内容
            const combinedScriptContent = [scriptContent, storageContent].filter(c => c && c.length > 0).join('\n');
            if (combinedScriptContent.length > 0) {
                await this.performMultiLayerScan(combinedScriptContent, results, true);
            }
            
            // 转换Set为Array并过滤 - 修复：包含所有动态创建的键，确保每个项目都有sourceUrl
            const finalResults = {};
            
            // 🔥 全局去重：记录所有已添加的值
            const globalSeenValues = new Set();
            
            // 辅助函数：处理并去重数组
            const processAndDedupe = (items, key) => {
                const seen = new Set();
                return items.filter(item => {
                    const value = typeof item === 'object' ? item.value : item;
                    if (!value || value.length === 0) return false;
                    if (seen.has(value)) return false;
                    seen.add(value);
                    return true;
                }).map(item => {
                    if (typeof item === 'object' && item !== null && item.hasOwnProperty('value')) {
                        return {
                            value: item.value,
                            sourceUrl: item.sourceUrl || window.location.href,
                            extractedAt: item.extractedAt || new Date().toISOString(),
                            pageTitle: item.pageTitle || document.title || 'Unknown Page'
                        };
                    } else {
                        return {
                            value: item,
                            sourceUrl: window.location.href,
                            extractedAt: new Date().toISOString(),
                            pageTitle: document.title || 'Unknown Page'
                        };
                    }
                });
            };
            
            // 处理所有键，包括动态创建的自定义正则键
            for (const [key, value] of Object.entries(results)) {
                if (value instanceof Set) {
                    finalResults[key] = processAndDedupe(Array.from(value), key);
                } else if (Array.isArray(value)) {
                    finalResults[key] = processAndDedupe(value, key);
                } else if (value) {
                    const items = [value];
                    finalResults[key] = processAndDedupe(items, key);
                } else {
                    finalResults[key] = [];
                }
            }
            
            // 🔥 跨类别去重：从 relativeApis 中移除与 absoluteApis 完全相同的值
            if (finalResults.absoluteApis && finalResults.relativeApis) {
                const absoluteValues = new Set(finalResults.absoluteApis.map(item => item.value));
                finalResults.relativeApis = finalResults.relativeApis.filter(item => {
                    // 只有完全相同才去重
                    return !absoluteValues.has(item.value);
                });
            }
            
            // 🔥 增强：从所有可能包含 URL 的数组中提取域名
            const urlContainingKeys = [
                'urls',           // 完整 URL
                'absoluteApis',   // 绝对路径 API（可能包含完整 URL）
                'jsFiles',        // JS 文件 URL
                'cssFiles',       // CSS 文件 URL
                'images',         // 图片 URL
                'githubUrls',     // GitHub URL
                'webhookUrls'     // Webhook URL
            ];
            
            const existingDomains = new Set((finalResults.domains || []).map(d => d.value));
            if (!finalResults.domains) {
                finalResults.domains = [];
            }
            
            urlContainingKeys.forEach(key => {
                if (finalResults[key] && finalResults[key].length > 0) {
                    finalResults[key].forEach(urlItem => {
                        const url = urlItem.value || urlItem.fullUrl || urlItem;
                        if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
                            const domain = this.extractDomainFromUrl(url);
                            if (domain && !existingDomains.has(domain)) {
                                existingDomains.add(domain);
                                finalResults.domains.push({
                                    value: domain,
                                    sourceUrl: urlItem.sourceUrl || window.location.href,
                                    extractedAt: new Date().toISOString(),
                                    pageTitle: document.title || 'Unknown Page',
                                    extractedFrom: key // 记录来源类型
                                });
                                console.log(`✅ [ContentExtractor] 从 ${key} 提取域名: ${domain}`);
                            }
                        }
                    });
                }
            });
            
            //console.log('🔍 ContentExtractor最终结果转换完成，包含的键:', Object.keys(finalResults));
            const customKeys = Object.keys(finalResults).filter(key => key.startsWith('custom_'));
            if (customKeys.length > 0) {
                //console.log(`✅ ContentExtractor最终结果包含 ${customKeys.length} 个自定义正则键:`, customKeys);
            }
            
            //console.log('✅ 扫描完成，结果统计:');
            Object.keys(finalResults).forEach(key => {
                if (finalResults[key].length > 0) {
                    //console.log(`  ${key}: ${finalResults[key].length} 个`);
                }
            });
            
            return finalResults;
            
        } catch (error) {
            console.error('❌ 扫描过程中出错:', error);
            return this.getEmptyResults();
        }
    }
    
    // 获取页面内容 - 优化版本
    getPageContent() {
        try {
            // 获取完整的HTML内容，但移除 script 标签内容避免重复提取
            // 因为脚本内容会在 getAllScripts 中单独处理
            let html = document.documentElement.outerHTML;
            // 移除 script 标签内的内容，保留标签本身（用于提取 src 属性）
            html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
                // 保留带 src 的 script 标签
                if (match.includes(' src=') || match.includes(' src =')) {
                    return match.replace(/>[\s\S]*?<\/script>/i, '></script>');
                }
                // 移除内联脚本的内容
                return match.replace(/>[\s\S]*?<\/script>/i, '></script>');
            });
            return html;
        } catch (e) {
            return '';
        }
    }
    
    // 获取所有脚本内容 - 优化版本
    getAllScripts() {
        const scripts = [];
        
        // 内联脚本 - 处理所有脚本，不限制数量和大小
        const inlineScripts = document.querySelectorAll('script:not([src])');
        
        for (let i = 0; i < inlineScripts.length; i++) {
            const script = inlineScripts[i];
            if (script.textContent) {
                // 处理完整的脚本内容，不截断
                scripts.push(script.textContent);
            }
        }
        
        // 外部脚本URL
        document.querySelectorAll('script[src]').forEach(script => {
            if (script.src) {
                scripts.push(`// External script: ${script.src}`);
            }
        });
        
        return scripts.join('\n');
    }
    
    // 获取所有样式内容 - 优化版本
    getAllStyles() {
        const styles = [];
        
        // 内联样式 - 处理所有样式，不限制数量
        const styleElements = document.querySelectorAll('style');
        
        for (let i = 0; i < styleElements.length; i++) {
            const style = styleElements[i];
            if (style.textContent) {
                styles.push(style.textContent);
            }
        }
        
        // 外部样式表URL
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (link.href) {
                styles.push(`/* External stylesheet: ${link.href} */`);
            }
        });
        
        return styles.join('\n');
    }
    
    // 获取所有链接 - 优化版本
    getAllLinks() {
        const links = new Set();
        
        // 处理所有链接，不限制数量
        const allLinks = document.querySelectorAll('a[href]');
        
        for (let i = 0; i < allLinks.length; i++) {
            links.add(allLinks[i].href);
        }
        
        return Array.from(links).join('\n');
    }
    
    // 获取存储内容 - 优化版本
    getStorageContent() {
        const storage = [];
        
        try {
            // localStorage - 处理所有存储项，不限制数量和大小
            
            // localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                if (value) {
                    storage.push(`localStorage.${key}=${value}`);
                }
            }
            
            // sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                if (value) {
                    storage.push(`sessionStorage.${key}=${value}`);
                }
            }
        } catch (e) {
            //console.log('无法访问存储内容:', e);
        }
        
        return storage.join('\n');
    }
    
    // 分批处理内容扫描 - 优化版本
    async performMultiLayerScan(content, results, useAST = false) {
        if (!content || content.length === 0) return;
        
        // 移除内容大小限制，处理完整内容
        const processContent = content;
        
        // 使用PatternExtractor统一化系统来提取信息
        if (window.patternExtractor && typeof window.patternExtractor.extractPatterns === 'function') {
            try {
                //console.log('🔍🔍🔍 ContentExtractor找到PatternExtractor，准备调用extractPatterns方法');
                //console.log('📊 ContentExtractor处理内容长度:', processContent.length);
                
                // 🔥 性能优化：只在配置未加载时才加载，避免重复加载
                if (!window.patternExtractor.customPatternsLoaded) {
                    await window.patternExtractor.loadCustomPatterns();
                }
                
                //console.log('📊 ContentExtractor当前可用的正则模式:', Object.keys(window.patternExtractor.patterns));
                //console.log('🚀🚀🚀 ContentExtractor即将调用PatternExtractor.extractPatterns方法！');
                
                let extractedData = await window.patternExtractor.extractPatterns(processContent, window.location.href);
                
                // 🔥 AST 增强提取：只在指定时对 JavaScript 内容使用 AST 分析
                if (useAST) {
                    extractedData = await this.enhanceWithAST(processContent, extractedData, window.location.href);
                }
                
                //console.log('✅✅✅ ContentExtractor调用PatternExtractor.extractPatterns完成，返回数据:', extractedData);
                
                // 将提取的数据合并到results中，包括动态自定义正则结果
                // 🔥 修复：保持PatternExtractor返回的完整对象结构（包含sourceUrl）
                if (extractedData) {
                    // 辅助函数：检查 Set 中是否已存在相同值的对象
                    const hasValue = (set, value) => {
                        for (const item of set) {
                            const itemValue = typeof item === 'object' ? item.value : item;
                            if (itemValue === value) return true;
                        }
                        return false;
                    };
                    
                    Object.keys(extractedData).forEach(key => {
                        // 处理预定义的结果键
                        if (results[key] && Array.isArray(extractedData[key])) {
                            extractedData[key].forEach(itemObj => {
                                const value = typeof itemObj === 'object' ? itemObj.value : itemObj;
                                
                                // 🔥 去重：检查是否已存在相同值
                                if (hasValue(results[key], value)) return;
                                
                                // 🔥 修复：确保每个项目都有完整的源URL信息
                                if (typeof itemObj === 'object' && itemObj !== null && itemObj.hasOwnProperty('value')) {
                                    results[key].add({
                                        value: itemObj.value,
                                        sourceUrl: itemObj.sourceUrl || window.location.href,
                                        extractedAt: itemObj.extractedAt || new Date().toISOString(),
                                        pageTitle: itemObj.pageTitle || document.title || 'Unknown Page'
                                    });
                                } else {
                                    results[key].add({
                                        value: itemObj,
                                        sourceUrl: window.location.href,
                                        extractedAt: new Date().toISOString(),
                                        pageTitle: document.title || 'Unknown Page'
                                    });
                                }
                            });
                        }
                        // 处理动态自定义正则结果
                        else if (key.startsWith('custom_') && Array.isArray(extractedData[key])) {
                            if (!results[key]) {
                                results[key] = new Set();
                            }
                            extractedData[key].forEach(itemObj => {
                                const value = typeof itemObj === 'object' ? itemObj.value : itemObj;
                                
                                // 🔥 去重：检查是否已存在相同值
                                if (hasValue(results[key], value)) return;
                                
                                if (typeof itemObj === 'object' && itemObj !== null && itemObj.hasOwnProperty('value')) {
                                    results[key].add({
                                        value: itemObj.value,
                                        sourceUrl: itemObj.sourceUrl || window.location.href,
                                        extractedAt: itemObj.extractedAt || new Date().toISOString(),
                                        pageTitle: itemObj.pageTitle || document.title || 'Unknown Page'
                                    });
                                } else {
                                    results[key].add({
                                        value: itemObj,
                                        sourceUrl: window.location.href,
                                        extractedAt: new Date().toISOString(),
                                        pageTitle: document.title || 'Unknown Page'
                                    });
                                }
                            });
                        }
                    });
                    
                    // 验证自定义正则结果是否正确添加
                    const customKeys = Object.keys(extractedData).filter(key => key.startsWith('custom_'));
                    if (customKeys.length > 0) {
                        //console.log(`✅ ContentExtractor处理了 ${customKeys.length} 个自定义正则结果:`, customKeys);
                    }
                }
                
                //console.log('✅ ContentExtractor统一化系统提取完成');
            } catch (error) {
                console.error('❌ ContentExtractor统一化系统提取失败:', error);
                // 统一化版本：不使用降级方案
                //console.log('⚠️ ContentExtractor统一化版本：不使用降级方案');
            }
        } else {
            console.warn('⚠️ ContentExtractor统一化版本：PatternExtractor未找到或extractPatterns方法不存在，跳过提取');
        }
    }
    
    // 🔥 AST 增强提取方法
    async enhanceWithAST(content, regexResults, sourceUrl) {
        // 检查 AST 系统是否可用
        if (!window.astBridge) {
            return regexResults;
        }
        
        // 确保 AST 系统已初始化
        if (!window.astBridge.initialized) {
            try {
                await window.astBridge.init();
            } catch (e) {
                console.warn('⚠️ [ContentExtractor] AST 初始化失败:', e.message);
                return regexResults;
            }
        }
        
        if (!window.astBridge.isAvailable()) {
            return regexResults;
        }
        
        // 检查内容是否可能是 JavaScript
        const isJsContent = this.isJavaScriptContent(content);
        
        // 🔥 性能优化：只对明确的 JS 内容进行 AST 解析
        // 移除对非 JS 内容的尝试解析，避免无效的解析开销
        if (!isJsContent) {
            return regexResults;
        }
        
        // 🔥 性能优化：限制 AST 解析的内容大小为 200KB
        if (content.length > 200000) {
            // console.log('⚠️ [AST] 内容过大，跳过 AST 解析:', content.length);
            return regexResults;
        }
        
        try {
            // console.log('🔍 [AST] ContentExtractor 尝试 AST 提取...');
            
            const astResult = window.astBridge.extract(content, sourceUrl);
            
            if (astResult.success && astResult.detections && astResult.detections.length > 0) {
                console.log('✅ [AST] ContentExtractor AST 提取成功，检测到', astResult.detections.length, '个敏感信息');
                
                // 合并 AST 结果到正则结果
                return this.mergeASTResults(regexResults, astResult.detections, sourceUrl);
            }
        } catch (error) {
            // 对于非 JS 内容的解析失败，静默处理
            if (isJsContent) {
                console.warn('⚠️ [AST] ContentExtractor AST 提取失败:', error.message);
            }
        }
        
        return regexResults;
    }
    
    // 检查内容是否可能是 JavaScript
    // 🔥 性能优化：只检查内容的前 5000 个字符
    isJavaScriptContent(content) {
        if (!content || typeof content !== 'string') return false;
        
        // 🔥 性能优化：只检查前 5000 个字符，避免对大内容进行全文搜索
        const sampleContent = content.length > 5000 ? content.substring(0, 5000) : content;
        const trimmedContent = sampleContent.trim();
        
        // 检查是否以常见 JS 模式开头（快速检查）
        if (trimmedContent.startsWith('(function') ||
            trimmedContent.startsWith('function') ||
            trimmedContent.startsWith('!function') ||
            trimmedContent.startsWith('var ') ||
            trimmedContent.startsWith('const ') ||
            trimmedContent.startsWith('let ') ||
            trimmedContent.startsWith('"use strict"') ||
            trimmedContent.startsWith("'use strict'")) {
            return true;
        }
        
        // 检查常见的 JavaScript 特征
        const jsIndicators = [
            'function ', 'const ', 'let ', 'var ',
            '=>', 'async ', 'await ', 'class ',
            'import ', 'export ', 'require(',
            '.then(', '.catch(', 'Promise',
            'document.', 'window.', 'console.'
        ];
        
        // 检查是否包含多个 JS 特征
        let indicatorCount = 0;
        for (const indicator of jsIndicators) {
            if (sampleContent.includes(indicator)) {
                indicatorCount++;
                if (indicatorCount >= 3) return true;
            }
        }
        
        return false;
    }
    
    // 合并 AST 提取结果到正则结果
    mergeASTResults(regexResults, astDetections, sourceUrl) {
        const merged = { ...regexResults };
        
        // 🔥 收集所有已存在的值，用于跨类别去重
        const allExistingValues = new Set();
        Object.values(merged).forEach(arr => {
            if (Array.isArray(arr)) {
                arr.forEach(item => {
                    const v = typeof item === 'object' ? item.value : item;
                    if (v) allExistingValues.add(v);
                });
            }
        });
        
        for (const detection of astDetections) {
            // 根据检测类型和值确定结果键
            let resultKey = 'credentials';
            
            if (detection.type === 'api_endpoint') {
                const value = detection.value || '';
                // 判断是绝对路径还是相对路径
                if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
                    resultKey = 'absoluteApis';
                } else if (value.startsWith('/')) {
                    resultKey = 'relativeApis';
                } else {
                    resultKey = 'absoluteApis';
                }
            } else if (detection.type === 'credential') {
                resultKey = 'credentials';
            } else if (detection.type === 'sensitive_function') {
                resultKey = 'credentials';
            } else if (detection.type === 'config_object') {
                resultKey = 'credentials';
            } else if (detection.type === 'encoded_string') {
                resultKey = 'credentials';
            }
            
            if (!merged[resultKey]) {
                merged[resultKey] = [];
            }
            
            const value = detection.value;
            
            // 🔥 跨类别去重：检查值是否已在任何类别中存在
            if (!value || allExistingValues.has(value)) {
                continue;
            }
            
            // 检查是否已存在于当前类别
            const exists = merged[resultKey].some(item => {
                const itemValue = typeof item === 'object' ? item.value : item;
                return itemValue === value;
            });
            
            if (!exists) {
                merged[resultKey].push({
                    value: value,
                    sourceUrl: sourceUrl,
                    extractedAt: new Date().toISOString(),
                    pageTitle: document.title || 'Unknown Page',
                    confidence: detection.confidence || 0.8,
                    context: detection.context,
                    source: 'ast'
                });
                allExistingValues.add(value);
            }
        }
        
        return merged;
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
            // 必须以 http:// 或 https:// 开头
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return null;
            }
            
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
            
            // 🔥 过滤掉常见的框架文档域名
            const blacklist = ['w3.org', 'w3schools.com', 'mozilla.org', 'github.com', 
                              'stackoverflow.com', 'vuejs.org', 'reactjs.org', 'angular.io'];
            if (blacklist.some(b => domain.includes(b))) {
                return null;
            }
            
            return domain;
        } catch (error) {
            return null;
        }
    }
    
    // 获取空结果 - 增强版本，支持所有新的敏感信息类型
    getEmptyResults() {
        return {
            absoluteApis: [],
            relativeApis: [],
            modulePaths: [],
            domains: [],
            urls: [],
            images: [],
            audios: [],
            videos: [],
            jsFiles: [],
            cssFiles: [],
            emails: [],
            phoneNumbers: [],
            ipAddresses: [],
            sensitiveKeywords: [],
            comments: [],
            subdomains: [],
            ports: [],
            paths: [],
            parameters: [],
            credentials: [],
            cookies: [],
            idKeys: [],
            idcards: [],
            companies: [],
            jwts: [],
            githubUrls: [],
            vueFiles: [],
            // 新增的敏感信息类型
            bearerTokens: [],
            basicAuth: [],
            authHeaders: [],
            wechatAppIds: [],
            awsKeys: [],
            googleApiKeys: [],
            githubTokens: [],
            gitlabTokens: [],
            webhookUrls: [],
            idCards: [],
            cryptoUsage: []
        };
    }
}