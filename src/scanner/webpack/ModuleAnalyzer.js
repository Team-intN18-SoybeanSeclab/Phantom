class ModuleAnalyzer {
    constructor(options = {}) {
        this.dependencies = new Map();
        this.configModules = [];
        this.defineConstants = [];
        this.apiConfigs = [];
        this.debug = options.debug || false;
    }


    analyzeDependencies(moduleCode, moduleId) {
        const deps = [];

        if (!moduleCode) return deps;

        try {

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


            this.dependencies.set(moduleId, deps);

            if (this.debug) {
                console.log(`[ModuleAnalyzer] 模块 ${moduleId} 依赖数:`, deps.length);
            }

        } catch (error) {
            console.error('[ModuleAnalyzer] 分析依赖失败:', error);
        }

        return deps;
    }



    identifyConfigModules(modules) {
        this.configModules = [];

        const configIndicators = [

            { pattern: /apiUrl|API_URL|baseUrl|BASE_URL/i, weight: 3 },
            { pattern: /endpoint|ENDPOINT/i, weight: 2 },

            { pattern: /apiKey|API_KEY|secretKey|SECRET_KEY/i, weight: 4 },
            { pattern: /token|TOKEN|accessToken|ACCESS_TOKEN/i, weight: 3 },

            { pattern: /config|CONFIG|settings|SETTINGS/i, weight: 2 },
            { pattern: /env|ENV|environment|ENVIRONMENT/i, weight: 2 },

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


            if (score >= 4) {
                this.configModules.push({
                    id: module.id,
                    score: score,
                    indicators: matchedIndicators,
                    priority: score >= 8 ? 'high' : (score >= 6 ? 'medium' : 'low')
                });
            }
        }


        this.configModules.sort((a, b) => b.score - a.score);

        if (this.debug) {
            console.log('[ModuleAnalyzer] 发现配置模块:', this.configModules.length);
        }

        return this.configModules;
    }


    extractDefinePluginConstants(code) {
        const constants = [];

        if (!code) return constants;

        try {


            const envPatterns = [

                /process\.env\.([A-Z_][A-Z0-9_]*)/g,

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



            const replacedPatterns = [

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



    extractApiConfig(moduleCode) {
        const configs = [];

        if (!moduleCode) return configs;

        try {

            const urlPatterns = [

                /(?:apiUrl|API_URL|baseUrl|BASE_URL|endpoint|ENDPOINT)\s*[:=]\s*["']([^"']+)["']/gi,

                /axios\.defaults\.baseURL\s*=\s*["']([^"']+)["']/gi,

                /baseURL\s*:\s*["']([^"']+)["']/gi,

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


            const endpointPatterns = [

                /["'](\/api\/[^"']+)["']/g,

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


    getConfigModules() {
        return this.configModules;
    }


    getDefineConstants() {
        return this.defineConstants;
    }


    getApiConfigs() {
        return this.apiConfigs;
    }


    clear() {
        this.dependencies.clear();
        this.configModules = [];
        this.defineConstants = [];
        this.apiConfigs = [];
    }
}


if (typeof window !== 'undefined') {
    window.ModuleAnalyzer = ModuleAnalyzer;
}
