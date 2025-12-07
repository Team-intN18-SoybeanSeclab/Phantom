/**
 * RuntimeAnalyzer - Webpack Runtime 分析器
 * 负责分析 Webpack Runtime 代码，提取模块信息和配置数据
 * 
 * @class RuntimeAnalyzer
 */
class RuntimeAnalyzer {
    constructor(options = {}) {
        this.moduleMap = new Map();
        this.debug = options.debug || false;
    }

    /**
     * 提取 publicPath
     * @param {Object} runtime - Webpack Runtime 对象
     * @returns {string} publicPath 值
     */
    extractPublicPath(runtime) {
        try {
            // 从 runtime 对象直接获取
            if (runtime && runtime.publicPath) {
                return runtime.publicPath;
            }
            
            // 从 __webpack_require__.p 获取
            if (runtime && runtime.requireFunction && runtime.requireFunction.p) {
                return runtime.requireFunction.p;
            }
            
            // 从全局 __webpack_require__ 获取
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

    /**
     * 从代码中提取 publicPath
     * @param {string} code - Runtime 代码
     * @returns {string|null} publicPath 值
     */
    extractPublicPathFromCode(code) {
        if (!code) return null;
        
        const patterns = [
            // __webpack_require__.p = "xxx"
            /__webpack_require__\.p\s*=\s*["']([^"']+)["']/,
            // .p = "xxx"
            /\.p\s*=\s*["']([^"']+)["']/,
            // publicPath: "xxx"
            /publicPath:\s*["']([^"']+)["']/,
            // __webpack_public_path__ = "xxx"
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


    /**
     * 提取模块映射
     * @param {Object} runtime - Webpack Runtime 对象
     * @returns {Map<string, ModuleInfo>} 模块映射
     */
    extractModuleMap(runtime) {
        this.moduleMap.clear();
        
        try {
            let modules = null;
            
            // 从 runtime 对象获取模块
            if (runtime && runtime.modules) {
                modules = runtime.modules;
            }
            
            // 从 __webpack_require__.m 获取
            if (!modules && runtime && runtime.requireFunction && runtime.requireFunction.m) {
                modules = runtime.requireFunction.m;
            }
            
            // 从全局获取
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

    /**
     * 解析模块对象
     * @private
     */
    _parseModules(modules) {
        if (Array.isArray(modules)) {
            // 数组形式的模块
            modules.forEach((module, index) => {
                if (module) {
                    this.moduleMap.set(index.toString(), this._createModuleInfo(index, module));
                }
            });
        } else if (typeof modules === 'object') {
            // 对象形式的模块
            for (const [id, module] of Object.entries(modules)) {
                if (module) {
                    this.moduleMap.set(id, this._createModuleInfo(id, module));
                }
            }
        }
    }

    /**
     * 创建模块信息对象
     * @private
     */
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
            // 忽略解析错误
        }
        
        return info;
    }

    /**
     * 提取模块依赖
     * @private
     */
    _extractDependencies(code) {
        const deps = [];
        
        // 匹配 __webpack_require__(xxx)
        const requirePattern = /__webpack_require__\(\s*["']?(\d+|[a-zA-Z0-9_./]+)["']?\s*\)/g;
        let match;
        
        while ((match = requirePattern.exec(code)) !== null) {
            if (match[1] && !deps.includes(match[1])) {
                deps.push(match[1]);
            }
        }
        
        return deps;
    }

    /**
     * 判断是否为配置模块
     * @private
     */
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

    /**
     * 分析 chunk 加载逻辑
     * @param {Object} runtime - Webpack Runtime 对象
     * @returns {ChunkLoadingInfo} chunk 加载信息
     */
    analyzeChunkLoading(runtime) {
        const info = {
            hasAsyncLoading: false,
            chunkIds: [],
            loadingFunction: null,
            installedChunks: {}
        };
        
        try {
            // 检查 __webpack_require__.e
            if (runtime && runtime.requireFunction && runtime.requireFunction.e) {
                info.hasAsyncLoading = true;
                info.loadingFunction = runtime.requireFunction.e;
            }
            
            // 从全局检查
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


    /**
     * 从代码中分析 chunk 加载逻辑
     * @param {string} code - Runtime 代码
     * @returns {ChunkLoadingInfo} chunk 加载信息
     */
    analyzeChunkLoadingFromCode(code) {
        const info = {
            hasAsyncLoading: false,
            chunkIds: [],
            chunkMap: {},
            chunkNamingPattern: null
        };
        
        if (!code) return info;
        
        try {
            // 检测异步加载函数
            if (code.includes('__webpack_require__.e') || 
                code.includes('.e=function') ||
                code.includes('installedChunks')) {
                info.hasAsyncLoading = true;
            }
            
            // 提取 chunk ID 映射
            // 模式: {0: "hash1", 1: "hash2", ...}
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
            
            // 提取 chunk 命名模式
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

    /**
     * 提取 chunk 命名规则
     * @param {Object} runtime - Webpack Runtime 对象
     * @returns {string|null} chunk 命名模式
     */
    extractChunkNamingPattern(runtime) {
        try {
            // 从 __webpack_require__.u 获取
            if (runtime && runtime.requireFunction && runtime.requireFunction.u) {
                const fn = runtime.requireFunction.u;
                if (typeof fn === 'function') {
                    // 尝试调用函数获取模式
                    const testResult = fn(0);
                    if (testResult && typeof testResult === 'string') {
                        // 从结果推断模式
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

    /**
     * 从文件名推断命名模式
     * @private
     */
    _inferPattern(filename) {
        // 0.abc123.js -> [id].[hash].js
        if (/^\d+\.[a-f0-9]+\.js$/.test(filename)) {
            return '[id].[hash].js';
        }
        
        // chunk.0.abc123.js -> chunk.[id].[hash].js
        if (/^chunk\.\d+\.[a-f0-9]+\.js$/.test(filename)) {
            return 'chunk.[id].[hash].js';
        }
        
        // main.abc123.chunk.js -> [name].[hash].chunk.js
        if (/^[a-z]+\.[a-f0-9]+\.chunk\.js$/i.test(filename)) {
            return '[name].[hash].chunk.js';
        }
        
        return null;
    }

    /**
     * 获取所有模块信息
     * @returns {ModuleInfo[]} 模块信息列表
     */
    getAllModules() {
        return Array.from(this.moduleMap.values());
    }

    /**
     * 获取配置模块
     * @returns {ModuleInfo[]} 配置模块列表
     */
    getConfigModules() {
        return this.getAllModules().filter(m => m.isConfig);
    }

    /**
     * 清空缓存
     */
    clear() {
        this.moduleMap.clear();
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.RuntimeAnalyzer = RuntimeAnalyzer;
}
