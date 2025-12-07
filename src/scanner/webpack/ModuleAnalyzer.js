/**
 * ModuleAnalyzer - Webpack 模块分析器
 * 负责分析模块依赖关系和提取敏感配置
 * 
 * @class ModuleAnalyzer
 */
class ModuleAnalyzer {
    constructor(options = {}) {
        this.dependencies = new Map();
        this.configModules = [];
        this.defineConstants = [];
        this.apiConfigs = [];
        this.debug = options.debug || false;
    }

    /**
     * 分析模块依赖
     * @param {string} moduleCode - 模块代码
     * @param {string|number} moduleId - 模块 ID
     * @returns {Dependency[]} 依赖列表
     */
    analyzeDependencies(moduleCode, moduleId) {
        const deps = [];
        
        if (!moduleCode) return deps;
        
        try {
            // 匹配 __webpack_require__(xxx)
            const requirePattern = /__webpack_require__\(\s*["']?(\d+|[a-zA-Z0-9_./-]+)["']?\s*\)/g;
            let match;
            
            while ((match = requirePattern.exec(moduleCode)) !== null) {
                const depId = match[1];
                if (!deps.find(d => d.id === depId)) {
                    deps.push({
                        id: depId,
                        type: 'require',
                        location: match.index
                    });
                }
            }
            
            // 匹配 __webpack_require__.n(xxx)
            const nPattern = /__webpack_require__\.n\(\s*["']?(\d+|[a-zA-Z0-9_./-]+)["']?\s*\)/g;
            while ((match = nPattern.exec(moduleCode)) !== null) {
                const depId = match[1];
                if (!deps.find(d => d.id === depId)) {
                    deps.push({
                        id: depId,
                        type: 'require_n',
                        location: match.index
                    });
                }
            }
            
            // 存储依赖关系
            this.dependencies.set(moduleId, deps);
            
            if (this.debug) {
                console.log(`[ModuleAnalyzer] 模块 ${moduleId} 依赖数:`, deps.length);
            }
            
        } catch (error) {
            console.error('[ModuleAnalyzer] 分析依赖失败:', error);
        }
        
        return deps;
    }


    /**
     * 识别配置模块
     * @param {Object[]} modules - 模块列表
     * @returns {ConfigModule[]} 配置模块列表
     */
    identifyConfigModules(modules) {
        this.configModules = [];
        
        const configIndicators = [
            // API 配置
            { pattern: /apiUrl|API_URL|baseUrl|BASE_URL/i, weight: 3 },
            { pattern: /endpoint|ENDPOINT/i, weight: 2 },
            // 密钥配置
            { pattern: /apiKey|API_KEY|secretKey|SECRET_KEY/i, weight: 4 },
            { pattern: /token|TOKEN|accessToken|ACCESS_TOKEN/i, weight: 3 },
            // 环境配置
            { pattern: /config|CONFIG|settings|SETTINGS/i, weight: 2 },
            { pattern: /env|ENV|environment|ENVIRONMENT/i, weight: 2 },
            // 认证配置
            { pattern: /auth|AUTH|credential|CREDENTIAL/i, weight: 3 },
            { pattern: /password|PASSWORD|secret|SECRET/i, weight: 4 }
        ];
        
        for (const module of modules) {
            const code = typeof module === 'function' ? module.toString() : 
                        (module.code || module.toString());
            
            let score = 0;
            const matchedIndicators = [];
            
            for (const indicator of configIndicators) {
                if (indicator.pattern.test(code)) {
                    score += indicator.weight;
                    matchedIndicators.push(indicator.pattern.source);
                }
            }
            
            // 分数超过阈值认为是配置模块
            if (score >= 4) {
                this.configModules.push({
                    id: module.id,
                    score: score,
                    indicators: matchedIndicators,
                    priority: score >= 8 ? 'high' : (score >= 6 ? 'medium' : 'low')
                });
            }
        }
        
        // 按分数排序
        this.configModules.sort((a, b) => b.score - a.score);
        
        if (this.debug) {
            console.log('[ModuleAnalyzer] 发现配置模块:', this.configModules.length);
        }
        
        return this.configModules;
    }

    /**
     * 提取 DefinePlugin 常量
     * @param {string} code - 代码内容
     * @returns {DefineConstant[]} 常量列表
     */
    extractDefinePluginConstants(code) {
        const constants = [];
        
        if (!code) return constants;
        
        try {
            // 匹配 process.env.XXX 被替换的模式
            // 例如: "production" 替换 process.env.NODE_ENV
            const envPatterns = [
                // process.env.XXX
                /process\.env\.([A-Z_][A-Z0-9_]*)/g,
                // "process.env.XXX": "value"
                /"process\.env\.([A-Z_][A-Z0-9_]*)"\s*:\s*["']([^"']+)["']/g
            ];
            
            for (const pattern of envPatterns) {
                let match;
                while ((match = pattern.exec(code)) !== null) {
                    const name = match[1];
                    const value = match[2] || null;
                    
                    if (!constants.find(c => c.name === name)) {
                        constants.push({
                            name: `process.env.${name}`,
                            value: value,
                            type: 'env'
                        });
                    }
                }
            }
            
            // 匹配被直接替换的字符串
            // 例如: NODE_ENV 被替换为 "production"
            const replacedPatterns = [
                // 常见的环境变量名
                /\bNODE_ENV\b/g,
                /\bAPI_URL\b/g,
                /\bBASE_URL\b/g,
                /\bPUBLIC_URL\b/g
            ];
            
            for (const pattern of replacedPatterns) {
                if (pattern.test(code)) {
                    const name = pattern.source.replace(/\\b/g, '');
                    if (!constants.find(c => c.name === name)) {
                        constants.push({
                            name: name,
                            value: null,
                            type: 'define'
                        });
                    }
                }
            }
            
            this.defineConstants = constants;
            
        } catch (error) {
            console.error('[ModuleAnalyzer] 提取 DefinePlugin 常量失败:', error);
        }
        
        return constants;
    }


    /**
     * 提取 API 配置
     * @param {string} moduleCode - 模块代码
     * @returns {ApiConfig[]} API 配置列表
     */
    extractApiConfig(moduleCode) {
        const configs = [];
        
        if (!moduleCode) return configs;
        
        try {
            // 匹配 API URL 定义
            const urlPatterns = [
                // apiUrl: "xxx" 或 API_URL: "xxx"
                /(?:apiUrl|API_URL|baseUrl|BASE_URL|endpoint|ENDPOINT)\s*[:=]\s*["']([^"']+)["']/gi,
                // axios.defaults.baseURL = "xxx"
                /axios\.defaults\.baseURL\s*=\s*["']([^"']+)["']/gi,
                // baseURL: "xxx"
                /baseURL\s*:\s*["']([^"']+)["']/gi,
                // fetch("xxx")
                /fetch\s*\(\s*["'](https?:\/\/[^"']+)["']/gi
            ];
            
            for (const pattern of urlPatterns) {
                let match;
                while ((match = pattern.exec(moduleCode)) !== null) {
                    const url = match[1];
                    if (url && !configs.find(c => c.url === url)) {
                        configs.push({
                            url: url,
                            type: this._classifyApiUrl(url),
                            source: pattern.source.substring(0, 20)
                        });
                    }
                }
            }
            
            // 匹配 API 端点定义
            const endpointPatterns = [
                // "/api/xxx"
                /["'](\/api\/[^"']+)["']/g,
                // "/v1/xxx" 或 "/v2/xxx"
                /["'](\/v\d+\/[^"']+)["']/g
            ];
            
            for (const pattern of endpointPatterns) {
                let match;
                while ((match = pattern.exec(moduleCode)) !== null) {
                    const endpoint = match[1];
                    if (endpoint && !configs.find(c => c.url === endpoint)) {
                        configs.push({
                            url: endpoint,
                            type: 'endpoint',
                            source: 'string'
                        });
                    }
                }
            }
            
            this.apiConfigs = configs;
            
            if (this.debug) {
                console.log('[ModuleAnalyzer] 发现 API 配置:', configs.length);
            }
            
        } catch (error) {
            console.error('[ModuleAnalyzer] 提取 API 配置失败:', error);
        }
        
        return configs;
    }

    /**
     * 分类 API URL
     * @private
     */
    _classifyApiUrl(url) {
        if (!url) return 'unknown';
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return 'absolute';
        }
        if (url.startsWith('//')) {
            return 'protocol-relative';
        }
        if (url.startsWith('/')) {
            return 'root-relative';
        }
        return 'relative';
    }

    /**
     * 构建依赖图
     * @returns {Object} 依赖图
     */
    buildDependencyGraph() {
        const graph = {
            nodes: [],
            edges: []
        };
        
        for (const [moduleId, deps] of this.dependencies) {
            graph.nodes.push({
                id: moduleId,
                isConfig: this.configModules.some(c => c.id === moduleId)
            });
            
            for (const dep of deps) {
                graph.edges.push({
                    from: moduleId,
                    to: dep.id,
                    type: dep.type
                });
            }
        }
        
        return graph;
    }

    /**
     * 获取所有配置模块
     * @returns {ConfigModule[]}
     */
    getConfigModules() {
        return this.configModules;
    }

    /**
     * 获取所有 DefinePlugin 常量
     * @returns {DefineConstant[]}
     */
    getDefineConstants() {
        return this.defineConstants;
    }

    /**
     * 获取所有 API 配置
     * @returns {ApiConfig[]}
     */
    getApiConfigs() {
        return this.apiConfigs;
    }

    /**
     * 清空缓存
     */
    clear() {
        this.dependencies.clear();
        this.configModules = [];
        this.defineConstants = [];
        this.apiConfigs = [];
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.ModuleAnalyzer = ModuleAnalyzer;
}
