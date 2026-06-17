class RuntimeAnalyzer {
    constructor(options = {}) {
        this.moduleMap = new Map();
        this.debug = options.debug || false;
    }


    extractPublicPath(runtime) {
        try {

            if (runtime && runtime.publicPath) {
                return runtime.publicPath;
            }


            if (runtime && runtime.requireFunction && runtime.requireFunction.p) {
                return runtime.requireFunction.p;
            }


            if (typeof window !== 'undefined' &&
                typeof window.__webpack_require__ === 'function' &&
                window.__webpack_require__.p) {
                return window.__webpack_require__.p;
            }

            return '';
        } catch (error) {
            console.warn('[RuntimeAnalyzer] 提取 publicPath 失败:', error);
            return '';
        }
    }


    extractPublicPathFromCode(code) {
        if (!code) return null;

        const patterns = [

            /__webpack_require__\.p\s*=\s*["']([^"']+)["']/,

            /\.p\s*=\s*["']([^"']+)["']/,

            /publicPath:\s*["']([^"']+)["']/,

            /__webpack_public_path__\s*=\s*["']([^"']+)["']/
        ];

        for (const pattern of patterns) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }



    extractModuleMap(runtime) {
        this.moduleMap.clear();

        try {
            let modules = null;


            if (runtime && runtime.modules) {
                modules = runtime.modules;
            }


            if (!modules && runtime && runtime.requireFunction && runtime.requireFunction.m) {
                modules = runtime.requireFunction.m;
            }


            if (!modules && typeof window !== 'undefined') {
                if (window.__webpack_modules__) {
                    modules = window.__webpack_modules__;
                } else if (window.__webpack_require__ && window.__webpack_require__.m) {
                    modules = window.__webpack_require__.m;
                }
            }

            if (modules) {
                this._parseModules(modules);
            }

            if (this.debug) {
                console.log('[RuntimeAnalyzer] 提取模块数:', this.moduleMap.size);
            }

        } catch (error) {
            console.error('[RuntimeAnalyzer] 提取模块映射失败:', error);
        }

        return this.moduleMap;
    }


    _parseModules(modules) {
        if (Array.isArray(modules)) {

            modules.forEach((module, index) => {
                if (module) {
                    this.moduleMap.set(index.toString(), this._createModuleInfo(index, module));
                }
            });
        } else if (typeof modules === 'object') {

            for (const [id, module] of Object.entries(modules)) {
                if (module) {
                    this.moduleMap.set(id, this._createModuleInfo(id, module));
                }
            }
        }
    }


    _createModuleInfo(id, module) {
        const info = {
            id: id,
            path: null,
            dependencies: [],
            isConfig: false,
            exports: [],
            size: 0,
            type: 'unknown'
        };

        try {
            if (typeof module === 'function') {
                const code = module.toString();
                info.size = code.length;
                info.dependencies = this._extractDependencies(code);
                info.isConfig = this._isConfigModule(code);
                info.type = 'function';
            } else if (typeof module === 'object') {
                info.type = 'object';
            }
        } catch (e) {

        }

        return info;
    }


    _extractDependencies(code) {
        const deps = [];


        const requirePattern = /__webpack_require__\(\s*["']?(\d+|[a-zA-Z0-9_./]+)["']?\s*\)/g;
        let match;

        while ((match = requirePattern.exec(code)) !== null) {
            if (match[1] && !deps.includes(match[1])) {
                deps.push(match[1]);
            }
        }

        return deps;
    }


    _isConfigModule(code) {
        const configIndicators = [
            'apiUrl', 'API_URL', 'baseUrl', 'BASE_URL',
            'apiKey', 'API_KEY', 'secretKey', 'SECRET_KEY',
            'config', 'CONFIG', 'settings', 'SETTINGS',
            'endpoint', 'ENDPOINT', 'token', 'TOKEN'
        ];

        let matchCount = 0;
        for (const indicator of configIndicators) {
            if (code.includes(indicator)) {
                matchCount++;
            }
        }

        return matchCount >= 2;
    }


    analyzeChunkLoading(runtime) {
        const info = {
            hasAsyncLoading: false,
            chunkIds: [],
            loadingFunction: null,
            installedChunks: {}
        };

        try {

            if (runtime && runtime.requireFunction && runtime.requireFunction.e) {
                info.hasAsyncLoading = true;
                info.loadingFunction = runtime.requireFunction.e;
            }


            if (typeof window !== 'undefined' &&
                window.__webpack_require__ &&
                window.__webpack_require__.e) {
                info.hasAsyncLoading = true;
            }

        } catch (error) {
            console.warn('[RuntimeAnalyzer] 分析 chunk 加载失败:', error);
        }

        return info;
    }



    analyzeChunkLoadingFromCode(code) {
        const info = {
            hasAsyncLoading: false,
            chunkIds: [],
            chunkMap: {},
            chunkNamingPattern: null
        };

        if (!code) return info;

        try {

            if (code.includes('__webpack_require__.e') ||
                code.includes('.e=function') ||
                code.includes('installedChunks')) {
                info.hasAsyncLoading = true;
            }



            const chunkMapPattern = /\{(\s*\d+\s*:\s*["'][a-f0-9]+["']\s*,?\s*)+\}/g;
            let match;

            while ((match = chunkMapPattern.exec(code)) !== null) {
                const mapStr = match[0];
                const itemPattern = /(\d+)\s*:\s*["']([a-f0-9]+)["']/g;
                let itemMatch;

                while ((itemMatch = itemPattern.exec(mapStr)) !== null) {
                    const chunkId = itemMatch[1];
                    const hash = itemMatch[2];
                    info.chunkIds.push(chunkId);
                    info.chunkMap[chunkId] = hash;
                }
            }


            const namingPatterns = [
                /chunkFilename:\s*["']([^"']+)["']/,
                /\.u\s*=\s*function[^{]*\{[^}]*return\s*["']([^"']+)["']/
            ];

            for (const pattern of namingPatterns) {
                const patternMatch = code.match(pattern);
                if (patternMatch && patternMatch[1]) {
                    info.chunkNamingPattern = patternMatch[1];
                    break;
                }
            }

        } catch (error) {
            console.warn('[RuntimeAnalyzer] 分析 chunk 加载代码失败:', error);
        }

        return info;
    }


    extractChunkNamingPattern(runtime) {
        try {

            if (runtime && runtime.requireFunction && runtime.requireFunction.u) {
                const fn = runtime.requireFunction.u;
                if (typeof fn === 'function') {

                    const testResult = fn(0);
                    if (testResult && typeof testResult === 'string') {

                        return this._inferPattern(testResult);
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn('[RuntimeAnalyzer] 提取 chunk 命名规则失败:', error);
            return null;
        }
    }


    _inferPattern(filename) {

        if (/^\d+\.[a-f0-9]+\.js$/.test(filename)) {
            return '[id].[hash].js';
        }


        if (/^chunk\.\d+\.[a-f0-9]+\.js$/.test(filename)) {
            return 'chunk.[id].[hash].js';
        }


        if (/^[a-z]+\.[a-f0-9]+\.chunk\.js$/i.test(filename)) {
            return '[name].[hash].chunk.js';
        }

        return null;
    }


    getAllModules() {
        return Array.from(this.moduleMap.values());
    }


    getConfigModules() {
        return this.getAllModules().filter(m => m.isConfig);
    }


    clear() {
        this.moduleMap.clear();
    }
}


if (typeof window !== 'undefined') {
    window.RuntimeAnalyzer = RuntimeAnalyzer;
}
