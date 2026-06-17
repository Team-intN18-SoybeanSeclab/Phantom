class WebpackScannerBridge {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.timeout = options.timeout || 5000;


        this.detector = null;
        this.chunkAnalyzer = null;
        this.sourceMapParser = null;
        this.runtimeAnalyzer = null;
        this.moduleAnalyzer = null;


        this.scanResult = null;


        this.initialized = false;
    }


    async init() {
        try {

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



    async scan(deepScan = false) {
        if (!this.initialized) {
            await this.init();
        }

        const result = {
            detection: null,
            chunks: [],
            loadedFiles: [],
            unloadedFiles: [],
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
                modulesAnalyzed: 0,
                deepScan: deepScan
            }
        };

        const startTime = Date.now();

        try {

            console.log('[WebpackScannerBridge] 开始 Webpack 检测...');
            result.detection = this.detector.detect();

            if (!result.detection.detected) {
                console.log('[WebpackScannerBridge] 未检测到 Webpack');
                result.metadata.scanTime = Date.now() - startTime;
                this.scanResult = result;
                return result;
            }

            console.log('[WebpackScannerBridge] 检测到 Webpack', result.detection.version);


            if (result.detection.runtime && result.detection.runtime.publicPath) {
                this.chunkAnalyzer.setPublicPath(result.detection.runtime.publicPath);
            }
            this.chunkAnalyzer.setBaseUrl(window.location.origin);


            console.log('[WebpackScannerBridge] 提取 chunk 引用...');
            const pageContent = document.documentElement.outerHTML;
            result.chunks = this.chunkAnalyzer.extractChunkReferences(pageContent, window.location.href);


            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.length > 100) {
                    const refs = this.chunkAnalyzer.extractChunkReferences(content, window.location.href);
                    result.chunks.push(...refs);
                }
            }


            if (deepScan) {
                console.log('[WebpackScannerBridge] 开始深度扫描外部脚本...');
                const externalScriptSrcs = document.querySelectorAll('script[src]');
                const scriptUrls = Array.from(externalScriptSrcs)
                    .map(s => s.src)
                    .filter(src => src && src.includes('.js'));

                for (const scriptUrl of scriptUrls) {
                    try {
                        const scriptContent = await this._fetchWithTimeout(scriptUrl);
                        if (scriptContent && scriptContent.length > 100) {
                            const refs = this.chunkAnalyzer.extractChunkReferences(scriptContent, scriptUrl);
                            result.chunks.push(...refs);
                        }
                    } catch (e) {

                    }
                }
            }


            result.chunks = this._deduplicateChunks(result.chunks);
            result.metadata.chunksScanned = result.chunks.length;


            result.loadedFiles = this.chunkAnalyzer.getLoadedFiles();
            result.unloadedFiles = this.chunkAnalyzer.getUnloadedFiles();

            console.log('[WebpackScannerBridge] 发现 chunks:', result.chunks.length,
                        '已加载:', result.loadedFiles.length,
                        '未加载:', result.unloadedFiles.length);


            console.log('[WebpackScannerBridge] 分析 Runtime...');
            if (result.detection.runtime) {
                const moduleMap = this.runtimeAnalyzer.extractModuleMap(result.detection.runtime);
                result.modules = this.runtimeAnalyzer.getAllModules();
                result.metadata.modulesAnalyzed = result.modules.length;
            }


            console.log('[WebpackScannerBridge] 检测 Source Map...');
            const externalScripts = document.querySelectorAll('script[src]');
            for (const script of externalScripts) {
                try {

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


                            try {
                                let sourceMapData = null;

                                if (isInline) {

                                    sourceMapData = this.sourceMapParser.parseInlineSourceMap(sourceMapUrl);
                                } else {

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


                                    if (sourceMapData.sourcesContent && sourceMapData.sourcesContent.length > 0) {
                                        for (let i = 0; i < sourceMapData.sourcesContent.length; i++) {
                                            const sourceContent = sourceMapData.sourcesContent[i];
                                            const sourcePath = sourceMapData.sources?.[i] || `source_${i}`;

                                            if (sourceContent && sourceContent.length > 50) {

                                                const constants = this.moduleAnalyzer.extractDefinePluginConstants(sourceContent);
                                                if (constants.length > 0) {
                                                    sourceMapInfo.sensitiveFindings.push(...constants.map(c => ({
                                                        ...c,
                                                        sourceFile: sourcePath
                                                    })));
                                                }


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

                }
            }


            console.log('[WebpackScannerBridge] 提取敏感配置...');
            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.length > 100) {

                    const constants = this.moduleAnalyzer.extractDefinePluginConstants(content);
                    result.defineConstants.push(...constants);


                    const apiConfigs = this.moduleAnalyzer.extractApiConfig(content);
                    result.apiEndpoints.push(...apiConfigs.map(c => c.url));
                }
            }


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



    integrateWithBasicScanner(results) {
        if (!this.scanResult) {
            return;
        }

        try {

            results.webpackDetection = {
                detected: this.scanResult.detection?.detected || false,
                version: this.scanResult.detection?.version || null,
                buildMode: this.scanResult.detection?.buildMode || 'unknown',
                features: this.scanResult.detection?.features || {},

                isVueWebpack: this._detectVueWebpackCombo(results)
            };


            results.webpackChunks = this.scanResult.chunks.map(chunk => ({
                value: chunk.url,
                type: chunk.type,
                source: 'webpack'
            }));


            results.webpackSourceMaps = this.scanResult.sourceMaps.map(sm => ({
                value: sm.sourceMapUrl,
                jsFile: sm.jsFile,
                source: 'webpack'
            }));


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


            results.webpackDefineConstants = this.scanResult.defineConstants;


            if (results.webpackDetection.isVueWebpack && results.vueRoutes) {
                this._enhanceVueRoutesWithWebpack(results);
            }

            console.log('[WebpackScannerBridge] 已集成到 BasicScanner 结果');

        } catch (error) {
            console.error('[WebpackScannerBridge] 集成失败:', error);
        }
    }


    _detectVueWebpackCombo(results) {

        const hasVue = results.vueDetection?.detected ||
                       (typeof window !== 'undefined' && (window.Vue || window.__VUE__));


        const hasWebpack = this.scanResult?.detection?.detected;

        return hasVue && hasWebpack;
    }


    _enhanceVueRoutesWithWebpack(results) {
        try {

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


    _extractRouteChunkMapping() {
        const mapping = new Map();

        if (!this.scanResult?.chunks) return mapping;


        for (const chunk of this.scanResult.chunks) {
            const fileName = chunk.url?.split('/').pop() || '';



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


    integrateWithDeepScanner(scanner) {
        if (!this.scanResult || !scanner) {
            return;
        }

        try {

            const chunkUrls = this.scanResult.chunks
                .filter(chunk => chunk.url && !chunk.url.startsWith('data:'))
                .map(chunk => chunk.url);

            if (chunkUrls.length > 0) {
                console.log('[WebpackScannerBridge] 添加', chunkUrls.length, '个 chunk 到深度扫描队列');


                if (scanner.srcMiner && scanner.srcMiner.pendingUrls) {
                    for (const url of chunkUrls) {
                        scanner.srcMiner.pendingUrls.add(url);
                    }
                }
            }




        } catch (error) {
            console.error('[WebpackScannerBridge] DeepScanner 集成失败:', error);
        }
    }


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


    clear() {
        this.scanResult = null;
        if (this.chunkAnalyzer) this.chunkAnalyzer.clear();
        if (this.sourceMapParser) this.sourceMapParser.clearCache();
        if (this.runtimeAnalyzer) this.runtimeAnalyzer.clear();
        if (this.moduleAnalyzer) this.moduleAnalyzer.clear();
    }
}


if (typeof window !== 'undefined') {
    window.WebpackScannerBridge = WebpackScannerBridge;
}
