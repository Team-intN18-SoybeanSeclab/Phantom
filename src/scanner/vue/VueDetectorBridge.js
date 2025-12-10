/**
 * VueDetectorBridge - Vue 检测结果整合桥接器
 * 
 * 负责将 Vue 检测结果整合到 Phantom 扫描系统中：
 * - 初始化和配置加载
 * - 结果格式转换
 * - 与 PatternExtractor 结果合并
 */

(function() {
    'use strict';

    class VueDetectorBridge {
        /**
         * 构造函数
         * @param {Object} options - 配置选项
         */
        constructor(options = {}) {
            this.detector = null;
            this.initialized = false;
            this.options = {
                enabled: options.enabled !== false,
                timeout: options.timeout || 3000,
                enableGuardPatch: options.enableGuardPatch !== false,
                enableAuthPatch: options.enableAuthPatch !== false,
                maxDepth: options.maxDepth || 1000,
                autoDetect: options.autoDetect !== false
            };
            this._lastResult = null;
        }

        /**
         * 初始化桥接器
         * @returns {boolean} 是否初始化成功
         */
        async init() {
            if (this.initialized) {
                return true;
            }

            try {
                // 加载用户配置
                await this._loadUserConfig();

                // 检查 VueDetector 是否可用
                if (typeof window.VueDetector === 'undefined') {
                    console.warn('[VueDetectorBridge] VueDetector not loaded');
                    return false;
                }

                // 创建检测器实例
                this.detector = new window.VueDetector(this.options);
                this.initialized = true;

                console.log('✅ [VueDetectorBridge] Initialized with options:', this.options);
                return true;

            } catch (e) {
                console.error('[VueDetectorBridge] Init error:', e);
                return false;
            }
        }

        /**
         * 从 chrome.storage 加载用户配置
         * @private
         */
        async _loadUserConfig() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    const result = await chrome.storage.local.get(['vueDetectorSettings']);
                    const settings = result.vueDetectorSettings || {};

                    // 合并用户配置
                    this.options = {
                        ...this.options,
                        enabled: settings.enabled !== false,
                        enableGuardPatch: settings.enableGuardPatch !== false,
                        enableAuthPatch: settings.enableAuthPatch !== false,
                        timeout: settings.timeout || this.options.timeout,
                        maxDepth: settings.maxDepth || this.options.maxDepth
                    };

                    console.log('[VueDetectorBridge] Loaded user config:', this.options);
                }
            } catch (e) {
                console.warn('[VueDetectorBridge] Failed to load user config:', e);
            }
        }

        /**
         * 保存用户配置到 chrome.storage
         * @param {Object} settings - 配置对象
         */
        async saveUserConfig(settings) {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ vueDetectorSettings: settings });
                    
                    // 更新当前选项
                    this.options = { ...this.options, ...settings };
                    
                    // 更新检测器配置
                    if (this.detector) {
                        this.detector.enabled = this.options.enabled;
                        this.detector.enableGuardPatch = this.options.enableGuardPatch;
                        this.detector.enableAuthPatch = this.options.enableAuthPatch;
                        this.detector.timeout = this.options.timeout;
                        this.detector.maxDepth = this.options.maxDepth;
                    }

                    console.log('[VueDetectorBridge] Saved user config:', settings);
                    return true;
                }
            } catch (e) {
                console.error('[VueDetectorBridge] Failed to save user config:', e);
            }
            return false;
        }

        /**
         * 执行检测并返回整合结果
         * @returns {Object} 整合后的检测结果
         */
        async detect() {
            if (!this.initialized) {
                await this.init();
            }

            if (!this.detector) {
                return this._createEmptyResult('Detector not initialized');
            }

            try {
                // 执行完整分析
                const result = await this.detector.delayedFullAnalysis();
                
                // 转换为 Phantom 格式
                this._lastResult = this.convertToPhantomFormat(result);
                
                return this._lastResult;

            } catch (e) {
                console.error('[VueDetectorBridge] Detect error:', e);
                return this._createEmptyResult(e.message);
            }
        }

        /**
         * 将 Vue 检测结果转换为 Phantom 格式
         * @param {Object} vueResult - Vue 检测结果
         * @returns {Object} Phantom 格式的结果
         */
        convertToPhantomFormat(vueResult) {
            const phantomResult = {
                type: 'vue',
                detected: vueResult.vueDetected || false,
                framework: {
                    name: 'Vue.js',
                    version: vueResult.vueVersion || 'unknown',
                    hasRouter: vueResult.routerDetected || false
                },
                routes: [],
                sensitiveRoutes: [],
                modifiedRoutes: vueResult.modifiedRoutes || [],
                metadata: {
                    routerBase: vueResult.routerBase || '',
                    guardsCleared: vueResult.guardsCleared || false,
                    currentPath: vueResult.currentPath || '',
                    pageAnalysis: vueResult.pageAnalysis || {},
                    timestamp: Date.now()
                },
                logs: vueResult.logs || [],
                errors: vueResult.errors || []
            };

            // 🔥 获取当前页面的基础 URL 用于构建完整路由 URL
            const baseUrl = window.location.origin;
            const routerBase = vueResult.routerBase || '';
            // 检测是否使用 hash 模式（Vue Router 默认）
            const isHashMode = window.location.hash.startsWith('#/') || 
                              (vueResult.routerMode === 'hash') ||
                              document.querySelector('a[href^="#/"]') !== null;

            // 转换路由为 Phantom 格式
            if (vueResult.allRoutes && Array.isArray(vueResult.allRoutes)) {
                phantomResult.routes = vueResult.allRoutes.map(route => {
                    const routePath = route.path || route.fullPath || '';
                    
                    // 🔥 构建完整的 URL
                    let fullUrl = '';
                    if (routePath.startsWith('http://') || routePath.startsWith('https://')) {
                        // 已经是完整 URL
                        fullUrl = routePath;
                    } else if (isHashMode) {
                        // Hash 模式: https://example.com/#/path
                        fullUrl = baseUrl + routerBase + '/#' + routePath;
                    } else {
                        // History 模式: https://example.com/path
                        fullUrl = baseUrl + routerBase + routePath;
                    }
                    
                    return {
                        path: routePath,
                        fullUrl: fullUrl,
                        value: fullUrl, // 🔥 添加 value 字段用于显示和复制
                        name: route.name || '',
                        type: 'vue-route',
                        hasAuth: route.hasAuth || false,
                        meta: route.meta || {},
                        source: 'vue-router',
                        sourceUrl: window.location.href,
                        extractedAt: new Date().toISOString()
                    };
                });

                // 识别敏感路由
                phantomResult.sensitiveRoutes = this._identifySensitiveRoutes(phantomResult.routes);
            }

            return phantomResult;
        }

        /**
         * 将路由转换为 Phantom 路由格式
         * @param {Array} routes - Vue 路由数组
         * @returns {Array} Phantom 格式的路由
         */
        convertRoutesToPhantomFormat(routes) {
            if (!Array.isArray(routes)) {
                return [];
            }

            return routes.map(route => ({
                path: route.path || route.fullPath || '',
                name: route.name || '',
                type: 'vue-route',
                hasAuth: route.hasAuth || this._hasAuthMeta(route.meta),
                meta: route.meta || {},
                source: 'vue-router'
            }));
        }

        /**
         * 与 PatternExtractor 结果合并
         * @param {Object} patternResult - PatternExtractor 的结果
         * @param {Object} vueResult - Vue 检测结果
         * @returns {Object} 合并后的结果
         */
        mergeWithPatternResult(patternResult, vueResult) {
            if (!patternResult) {
                patternResult = {};
            }

            const merged = { ...patternResult };

            // 添加 Vue 检测信息
            merged.vueDetection = {
                detected: vueResult?.detected || false,
                framework: vueResult?.framework || null,
                routeCount: vueResult?.routes?.length || 0
            };

            // 合并路由到 endpoints
            if (vueResult?.routes && Array.isArray(vueResult.routes)) {
                if (!merged.endpoints) {
                    merged.endpoints = [];
                }

                // 将 Vue 路由添加为 endpoints
                vueResult.routes.forEach(route => {
                    // 检查是否已存在
                    const exists = merged.endpoints.some(ep => 
                        ep.path === route.path || ep.url === route.path
                    );

                    if (!exists) {
                        merged.endpoints.push({
                            url: route.path,
                            path: route.path,
                            name: route.name,
                            type: 'vue-route',
                            source: 'vue-router',
                            hasAuth: route.hasAuth,
                            meta: route.meta
                        });
                    }
                });
            }

            // 添加敏感路由
            if (vueResult?.sensitiveRoutes && vueResult.sensitiveRoutes.length > 0) {
                if (!merged.sensitiveRoutes) {
                    merged.sensitiveRoutes = [];
                }
                merged.sensitiveRoutes = merged.sensitiveRoutes.concat(vueResult.sensitiveRoutes);
            }

            // 添加 Vue 路由专用字段
            merged.vueRoutes = vueResult?.routes || [];

            return merged;
        }

        /**
         * 获取上次检测结果
         * @returns {Object|null} 上次检测结果
         */
        getLastResult() {
            return this._lastResult;
        }

        /**
         * 重置桥接器
         */
        reset() {
            if (this.detector) {
                this.detector.reset();
            }
            this._lastResult = null;
        }

        /**
         * 更新配置
         * @param {Object} newOptions - 新配置
         */
        updateOptions(newOptions) {
            this.options = { ...this.options, ...newOptions };
            
            if (this.detector) {
                this.detector.enabled = this.options.enabled;
                this.detector.timeout = this.options.timeout;
                this.detector.enableGuardPatch = this.options.enableGuardPatch;
                this.detector.enableAuthPatch = this.options.enableAuthPatch;
                this.detector.maxDepth = this.options.maxDepth;
            }
        }

        // ========== 私有方法 ==========

        /**
         * 创建空结果
         * @private
         */
        _createEmptyResult(error = null) {
            return {
                type: 'vue',
                detected: false,
                framework: null,
                routes: [],
                sensitiveRoutes: [],
                modifiedRoutes: [],
                metadata: {
                    timestamp: Date.now()
                },
                logs: [],
                errors: error ? [error] : []
            };
        }

        /**
         * 识别敏感路由
         * @private
         */
        _identifySensitiveRoutes(routes) {
            const sensitiveKeywords = [
                'admin', 'manage', 'dashboard', 'system', 'config', 'setting',
                'user', 'account', 'profile', 'password', 'secret', 'api',
                'upload', 'file', 'download', 'export', 'import', 'backup',
                'log', 'audit', 'monitor', 'debug', 'test', 'dev'
            ];

            return routes.filter(route => {
                const pathLower = (route.path || '').toLowerCase();
                const nameLower = (route.name || '').toLowerCase();

                // 检查是否包含敏感关键词
                for (const keyword of sensitiveKeywords) {
                    if (pathLower.includes(keyword) || nameLower.includes(keyword)) {
                        return true;
                    }
                }

                // 检查是否有鉴权要求
                if (route.hasAuth) {
                    return true;
                }

                return false;
            }).map(route => ({
                ...route,
                reason: this._getSensitiveReason(route)
            }));
        }

        /**
         * 获取敏感原因
         * @private
         */
        _getSensitiveReason(route) {
            const reasons = [];
            const pathLower = (route.path || '').toLowerCase();

            if (pathLower.includes('admin')) reasons.push('admin path');
            if (pathLower.includes('manage')) reasons.push('management path');
            if (pathLower.includes('system')) reasons.push('system path');
            if (pathLower.includes('config')) reasons.push('config path');
            if (pathLower.includes('api')) reasons.push('API path');
            if (route.hasAuth) reasons.push('requires auth');

            return reasons.join(', ') || 'potential sensitive';
        }

        /**
         * 检查 meta 是否包含鉴权字段
         * @private
         */
        _hasAuthMeta(meta) {
            if (!meta || typeof meta !== 'object') {
                return false;
            }

            const authKeys = ['auth', 'requireAuth', 'requiresAuth', 'authenticated', 'login', 'permission'];
            
            for (const key of Object.keys(meta)) {
                const keyLower = key.toLowerCase();
                for (const authKey of authKeys) {
                    if (keyLower.includes(authKey)) {
                        return true;
                    }
                }
            }

            return false;
        }
    }

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.VueDetectorBridge = VueDetectorBridge;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueDetectorBridge;
    }

})();
