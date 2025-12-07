/**
 * WebpackScannerBridge - Webpack 扫描器桥接类
 * 负责与现有扫描系统集成
 * 
 * @class WebpackScannerBridge
 */
class WebpackScannerBridge {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.timeout = options.timeout || 5000;
        
        // 初始化各个分析器
        this.detector = null;
        this.chunkAnalyzer = null;
        this.sourceMapParser = null;
        this.runtimeAnalyzer = null;
        this.moduleAnalyzer = null;
        
        // 扫描结果
        this.scanResult = null;
        
        // 初始化状态
        this.initialized = false;
    }

    /**
     * 初始化所有分析器
     */
    async init() {
        try {
            // 检查依赖是否已加载
            if (typeof WebpackDetector === 'undefined') {
                console.warn('[WebpackScannerBridge] WebpackDetector 未加载');
                return false;
            }
            
            this.detector = new WebpackDetector({ debug: this.debug });
            this.chunkAnalyzer = new ChunkAnalyzer({ debug: this.debug });
            this.sourceMapParser = new SourceMapParser({ debug: this.debug });
            this.runtimeAnalyzer = new RuntimeAnalyzer({ debug: this.debug });
            this.moduleAnalyzer = new ModuleAnalyzer({ debug: this.debug });
            
            this.initialized = true;
            console.log('[WebpackScannerBridge] 初始化完成');
            return true;
            
        } catch (error) {
            console.error('[WebpackScannerBridge] 初始化失败:', error);
            return false;
        }
    }


    /**
     * 执行完整扫描
     * @returns {WebpackScanResult} 扫描结果
     */
    async scan() {
        if (!this.initialized) {
            await this.init();
        }
        
        const result = {
            detection: null,
            chunks: [],
            sourceMaps: [],
            modules: [],
            configModules: [],
            defineConstants: [],
            apiEndpoints: [],
            sensitiveFindings: [],
            errors: [],
            metadata: {
                scanTime: 0,
                chunksScanned: 0,
                modulesAnalyzed: 0
            }
        };
        
        const startTime = Date.now();
        
        try {
            // 1. 检测 Webpack
            console.log('[WebpackScannerBridge] 开始 Webpack 检测...');
            result.detection = this.detector.detect();
            
            if (!result.detection.detected) {
                console.log('[WebpackScannerBridge] 未检测到 Webpack');
                result.metadata.scanTime = Date.now() - startTime;
                this.scanResult = result;
                return result;
            }
            
            console.log('[WebpackScannerBridge] 检测到 Webpack', result.detection.version);
            
            // 2. 设置 publicPath
            if (result.detection.runtime && result.detection.runtime.publicPath) {
                this.chunkAnalyzer.setPublicPath(result.detection.runtime.publicPath);
            }
            this.chunkAnalyzer.setBaseUrl(window.location.origin);
            
            // 3. 提取 chunk 引用
            console.log('[WebpackScannerBridge] 提取 chunk 引用...');
            const pageContent = document.documentElement.outerHTML;
            result.chunks = this.chunkAnalyzer.extractChunkReferences(pageContent, window.location.href);
            
            // 从内联脚本中提取
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.length > 100) {
                    const refs = this.chunkAnalyzer.extractChunkReferences(content, window.location.href);
                    result.chunks.push(...refs);
                }
            }
            
            // 去重
            result.chunks = this._deduplicateChunks(result.chunks);
            result.metadata.chunksScanned = result.chunks.length;
            
            // 4. 分析 Runtime
            console.log('[WebpackScannerBridge] 分析 Runtime...');
            if (result.detection.runtime) {
                const moduleMap = this.runtimeAnalyzer.extractModuleMap(result.detection.runtime);
                result.modules = this.runtimeAnalyzer.getAllModules();
                result.metadata.modulesAnalyzed = result.modules.length;
            }
            
            // 5. 提取 Source Map URL 并解析内容
            console.log('[WebpackScannerBridge] 检测 Source Map...');
            const externalScripts = document.querySelectorAll('script[src]');
            for (const script of externalScripts) {
                try {
                    // 尝试获取脚本内容检测 Source Map
                    const response = await this._fetchWithTimeout(script.src);
                    if (response) {
                        const sourceMapUrl = this.sourceMapParser.extractSourceMapUrl(response);
                        if (sourceMapUrl) {
                            const resolvedUrl = this.sourceMapParser.resolveSourceMapUrl(sourceMapUrl, script.src);
                            const isInline = this.sourceMapParser.isInlineSourceMap(sourceMapUrl);
                            
                            const sourceMapInfo = {
                                jsFile: script.src,
                                sourceMapUrl: resolvedUrl,
                                isInline: isInline,
                                parsed: false,
                                sourceFiles: [],
                                sensitiveFindings: []
                            };
                            
                            // 🔥 尝试解析 Source Map 内容
                            try {
                                let sourceMapData = null;
                                
                                if (isInline) {
                                    // 解析内联 Source Map
                                    sourceMapData = this.sourceMapParser.parseInlineSourceMap(sourceMapUrl);
                                } else {
                                    // 下载并解析外部 Source Map
                                    const mapContent = await this._fetchWithTimeout(resolvedUrl);
                                    if (mapContent) {
                                        sourceMapData = this.sourceMapParser.parseSourceMap(mapContent);
                                    }
                                }
                                
                                if (sourceMapData) {
                                    sourceMapInfo.parsed = true;
                                    sourceMapInfo.sourceFiles = this.sourceMapParser.extractSourceFiles(sourceMapData);
                                    sourceMapInfo.sourceCount = sourceMapData.sourceCount;
                                    
                                    console.log(`[WebpackScannerBridge] 解析 Source Map 成功: ${sourceMapData.sourceCount} 个源文件`);
                                    
                                    // 🔥 扫描源文件内容中的敏感信息
                                    if (sourceMapData.sourcesContent && sourceMapData.sourcesContent.length > 0) {
                                        for (let i = 0; i < sourceMapData.sourcesContent.length; i++) {
                                            const sourceContent = sourceMapData.sourcesContent[i];
                                            const sourcePath = sourceMapData.sources?.[i] || `source_${i}`;
                                            
                                            if (sourceContent && sourceContent.length > 50) {
                                                // 提取敏感配置
                                                const constants = this.moduleAnalyzer.extractDefinePluginConstants(sourceContent);
                                                if (constants.length > 0) {
                                                    sourceMapInfo.sensitiveFindings.push(...constants.map(c => ({
                                                        ...c,
                                                        sourceFile: sourcePath
                                                    })));
                                                }
                                                
                                                // 提取 API 配置
                                                const apiConfigs = this.moduleAnalyzer.extractApiConfig(sourceContent);
                                                if (apiConfigs.length > 0) {
                                                    result.apiEndpoints.push(...apiConfigs.map(c => c.url));
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (parseError) {
                                console.warn('[WebpackScannerBridge] Source Map 解析失败:', parseError.message);
                            }
                            
                            result.sourceMaps.push(sourceMapInfo);
                        }
                    }
                } catch (e) {
                    // 忽略获取失败
                }
            }
            
            // 6. 提取敏感配置
            console.log('[WebpackScannerBridge] 提取敏感配置...');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.length > 100) {
                    // DefinePlugin 常量
                    const constants = this.moduleAnalyzer.extractDefinePluginConstants(content);
                    result.defineConstants.push(...constants);
                    
                    // API 配置
                    const apiConfigs = this.moduleAnalyzer.extractApiConfig(content);
                    result.apiEndpoints.push(...apiConfigs.map(c => c.url));
                }
            }
            
            // 去重
            result.defineConstants = this._deduplicateByName(result.defineConstants);
            result.apiEndpoints = [...new Set(result.apiEndpoints)];
            
            result.metadata.scanTime = Date.now() - startTime;
            this.scanResult = result;
            
            console.log('[WebpackScannerBridge] 扫描完成:', {
                chunks: result.chunks.length,
                sourceMaps: result.sourceMaps.length,
                modules: result.modules.length,
                apiEndpoints: result.apiEndpoints.length
            });
            
        } catch (error) {
            console.error('[WebpackScannerBridge] 扫描失败:', error);
            result.errors.push(error.message);
            result.metadata.scanTime = Date.now() - startTime;
        }
        
        return result;
    }


    /**
     * 与 BasicScanner 集成
     * @param {Object} results - BasicScanner 的结果对象
     */
    integrateWithBasicScanner(results) {
        if (!this.scanResult) {
            return;
        }
        
        try {
            // 添加 Webpack 检测结果
            results.webpackDetection = {
                detected: this.scanResult.detection?.detected || false,
                version: this.scanResult.detection?.version || null,
                buildMode: this.scanResult.detection?.buildMode || 'unknown',
                features: this.scanResult.detection?.features || {},
                // 检测是否为 Vue + Webpack 组合
                isVueWebpack: this._detectVueWebpackCombo(results)
            };
            
            // 添加 chunk 信息
            results.webpackChunks = this.scanResult.chunks.map(chunk => ({
                value: chunk.url,
                type: chunk.type,
                source: 'webpack'
            }));
            
            // 添加 Source Map 信息
            results.webpackSourceMaps = this.scanResult.sourceMaps.map(sm => ({
                value: sm.sourceMapUrl,
                jsFile: sm.jsFile,
                source: 'webpack'
            }));
            
            // 合并 API 端点到现有结果
            if (this.scanResult.apiEndpoints && this.scanResult.apiEndpoints.length > 0) {
                if (!results.absoluteApis) results.absoluteApis = [];
                if (!results.relativeApis) results.relativeApis = [];
                
                for (const endpoint of this.scanResult.apiEndpoints) {
                    const item = { value: endpoint, source: 'webpack' };
                    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
                        if (!results.absoluteApis.find(a => a.value === endpoint)) {
                            results.absoluteApis.push(item);
                        }
                    } else {
                        if (!results.relativeApis.find(a => a.value === endpoint)) {
                            results.relativeApis.push(item);
                        }
                    }
                }
            }
            
            // 添加 DefinePlugin 常量
            results.webpackDefineConstants = this.scanResult.defineConstants;
            
            // 如果是 Vue + Webpack，增强 Vue 路由信息
            if (results.webpackDetection.isVueWebpack && results.vueRoutes) {
                this._enhanceVueRoutesWithWebpack(results);
            }
            
            console.log('[WebpackScannerBridge] 已集成到 BasicScanner 结果');
            
        } catch (error) {
            console.error('[WebpackScannerBridge] 集成失败:', error);
        }
    }
    
    /**
     * 检测是否为 Vue + Webpack 组合
     * @private
     */
    _detectVueWebpackCombo(results) {
        // 检查 Vue 检测结果
        const hasVue = results.vueDetection?.detected || 
                       (typeof window !== 'undefined' && (window.Vue || window.__VUE__));
        
        // 检查 Webpack 检测结果
        const hasWebpack = this.scanResult?.detection?.detected;
        
        return hasVue && hasWebpack;
    }
    
    /**
     * 使用 Webpack 信息增强 Vue 路由
     * @private
     */
    _enhanceVueRoutesWithWebpack(results) {
        try {
            // 从 Webpack chunks 中提取可能的路由组件
            const chunkRouteMap = this._extractRouteChunkMapping();
            
            if (results.vueRoutes && chunkRouteMap.size > 0) {
                results.vueRoutes = results.vueRoutes.map(route => {
                    const chunkInfo = chunkRouteMap.get(route.path);
                    if (chunkInfo) {
                        return {
                            ...route,
                            webpackChunk: chunkInfo.chunkUrl,
                            lazyLoaded: true
                        };
                    }
                    return route;
                });
            }
            
            // 添加 Vue + Webpack 组合信息
            results.vueWebpackInfo = {
                detected: true,
                lazyRoutes: results.vueRoutes?.filter(r => r.lazyLoaded)?.length || 0,
                totalChunks: this.scanResult.chunks?.length || 0,
                hasSourceMaps: (this.scanResult.sourceMaps?.length || 0) > 0
            };
            
        } catch (error) {
            console.warn('[WebpackScannerBridge] 增强 Vue 路由失败:', error);
        }
    }
    
    /**
     * 从 Webpack chunks 提取路由映射
     * @private
     */
    _extractRouteChunkMapping() {
        const mapping = new Map();
        
        if (!this.scanResult?.chunks) return mapping;
        
        // 分析 chunk 文件名，尝试匹配路由
        for (const chunk of this.scanResult.chunks) {
            const fileName = chunk.url?.split('/').pop() || '';
            
            // 常见的 Vue 路由 chunk 命名模式
            // 例如: about.abc123.js, views-home.abc123.js
            const routePatterns = [
                /^(views?[-_])?([a-z]+)[-_.]?[a-f0-9]*\.js$/i,
                /^([a-z]+)[-_]?chunk[-_.]?[a-f0-9]*\.js$/i
            ];
            
            for (const pattern of routePatterns) {
                const match = fileName.match(pattern);
                if (match) {
                    const routeName = match[2] || match[1];
                    if (routeName) {
                        mapping.set('/' + routeName.toLowerCase(), {
                            chunkUrl: chunk.url,
                            chunkId: chunk.chunkId
                        });
                    }
                }
            }
        }
        
        return mapping;
    }

    /**
     * 与 DeepScanner 集成
     * @param {Object} scanner - DeepScanner 实例
     */
    integrateWithDeepScanner(scanner) {
        if (!this.scanResult || !scanner) {
            return;
        }
        
        try {
            // 将发现的 chunk 文件添加到深度扫描队列
            const chunkUrls = this.scanResult.chunks
                .filter(chunk => chunk.url && !chunk.url.startsWith('data:'))
                .map(chunk => chunk.url);
            
            if (chunkUrls.length > 0) {
                console.log('[WebpackScannerBridge] 添加', chunkUrls.length, '个 chunk 到深度扫描队列');
                
                // 如果 scanner 有 pendingUrls，添加到队列
                if (scanner.srcMiner && scanner.srcMiner.pendingUrls) {
                    for (const url of chunkUrls) {
                        scanner.srcMiner.pendingUrls.add(url);
                    }
                }
            }
            
            // 将 Source Map 中的源文件添加到扫描目标
            // 注意：Source Map 内容需要单独处理
            
        } catch (error) {
            console.error('[WebpackScannerBridge] DeepScanner 集成失败:', error);
        }
    }

    /**
     * 获取扫描结果摘要
     * @returns {Object} 摘要信息
     */
    getSummary() {
        if (!this.scanResult) {
            return { detected: false };
        }
        
        return {
            detected: this.scanResult.detection?.detected || false,
            version: this.scanResult.detection?.version || null,
            buildMode: this.scanResult.detection?.buildMode || 'unknown',
            chunksFound: this.scanResult.chunks?.length || 0,
            sourceMapsFound: this.scanResult.sourceMaps?.length || 0,
            modulesAnalyzed: this.scanResult.metadata?.modulesAnalyzed || 0,
            apiEndpointsFound: this.scanResult.apiEndpoints?.length || 0,
            scanTime: this.scanResult.metadata?.scanTime || 0
        };
    }

    /**
     * 带超时的 fetch
     * @private
     */
    async _fetchWithTimeout(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.text();
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * chunk 去重
     * @private
     */
    _deduplicateChunks(chunks) {
        const seen = new Set();
        return chunks.filter(chunk => {
            if (seen.has(chunk.url)) {
                return false;
            }
            seen.add(chunk.url);
            return true;
        });
    }

    /**
     * 按名称去重
     * @private
     */
    _deduplicateByName(items) {
        const seen = new Set();
        return items.filter(item => {
            if (seen.has(item.name)) {
                return false;
            }
            seen.add(item.name);
            return true;
        });
    }

    /**
     * 清空缓存
     */
    clear() {
        this.scanResult = null;
        if (this.chunkAnalyzer) this.chunkAnalyzer.clear();
        if (this.sourceMapParser) this.sourceMapParser.clearCache();
        if (this.runtimeAnalyzer) this.runtimeAnalyzer.clear();
        if (this.moduleAnalyzer) this.moduleAnalyzer.clear();
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackScannerBridge = WebpackScannerBridge;
}
