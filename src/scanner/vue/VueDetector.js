/**
 * VueDetector - Vue 框架检测与路由分析主类
 * 
 * 负责协调 Vue 检测和分析流程，包括：
 * - Vue 实例检测
 * - Vue Router 定位
 * - 路由信息提取
 * - 守卫清除和鉴权修改
 * 
 * @requires VueFinder
 * @requires RouterAnalyzer
 * @requires GuardPatcher
 */

(function() {
    'use strict';

    /**
     * VueDetector 主类
     */
    class VueDetector {
        /**
         * 构造函数
         * @param {Object} options - 配置选项
         * @param {boolean} options.enabled - 是否启用检测，默认 true
         * @param {number} options.timeout - 检测超时时间（毫秒），默认 3000
         * @param {boolean} options.enableGuardPatch - 是否启用守卫清除，默认 true
         * @param {boolean} options.enableAuthPatch - 是否启用鉴权修改，默认 true
         * @param {number} options.maxDepth - DOM 遍历最大深度，默认 1000
         */
        constructor(options = {}) {
            this.enabled = options.enabled !== false;
            this.timeout = options.timeout || 3000;
            this.enableGuardPatch = options.enableGuardPatch !== false;
            this.enableAuthPatch = options.enableAuthPatch !== false;
            this.maxDepth = options.maxDepth || 1000;
            
            // 内部状态
            this._vueRoot = null;
            this._router = null;
            this._detectionResult = null;
        }

        /**
         * 检测 Vue 框架
         * @returns {VueDetectionResult} 检测结果
         */
        detect() {
            if (!this.enabled) {
                return {
                    detected: false,
                    method: 'Detection disabled',
                    vueVersion: null,
                    vueType: null,
                    timestamp: Date.now()
                };
            }

            try {
                // 使用 VueFinder 查找 Vue 根实例
                if (typeof window.VueFinder !== 'undefined') {
                    this._vueRoot = window.VueFinder.findVueRoot(document.body, this.maxDepth);
                } else {
                    // 内联简单检测逻辑作为后备
                    this._vueRoot = this._findVueRootFallback(document.body);
                }

                if (!this._vueRoot) {
                    return {
                        detected: false,
                        method: 'No Vue instance found',
                        vueVersion: null,
                        vueType: null,
                        timestamp: Date.now()
                    };
                }

                // 获取 Vue 版本和类型
                let vueVersion = null;
                let vueType = null;

                if (typeof window.VueFinder !== 'undefined') {
                    vueVersion = window.VueFinder.getVueVersion(this._vueRoot);
                    vueType = window.VueFinder.detectVueType(this._vueRoot);
                } else {
                    // 后备检测
                    if (this._vueRoot.__vue_app__) {
                        vueType = 'vue3';
                        vueVersion = this._vueRoot.__vue_app__.version || 'unknown';
                    } else if (this._vueRoot.__vue__) {
                        vueType = 'vue2';
                        vueVersion = this._vueRoot.__vue__.$root?.$options?._base?.version || 'unknown';
                    }
                }

                this._detectionResult = {
                    detected: true,
                    method: 'DOM traversal',
                    vueVersion: vueVersion,
                    vueType: vueType,
                    timestamp: Date.now()
                };

                return this._detectionResult;

            } catch (error) {
                console.error('[VueDetector] Detection error:', error);
                return {
                    detected: false,
                    method: 'Error: ' + error.message,
                    vueVersion: null,
                    vueType: null,
                    timestamp: Date.now(),
                    error: error.message
                };
            }
        }

        /**
         * 分析 Vue Router
         * @returns {RouterAnalysisResult} 路由分析结果
         */
        analyzeRouter() {
            const result = {
                routerDetected: false,
                routerBase: '',
                allRoutes: [],
                modifiedRoutes: [],
                logs: []
            };

            try {
                // 确保已检测到 Vue
                if (!this._vueRoot) {
                    this.detect();
                }

                if (!this._vueRoot) {
                    result.logs.push({ type: 'error', message: 'No Vue instance found' });
                    return result;
                }

                // 使用 RouterAnalyzer 定位 Router
                if (typeof window.RouterAnalyzer !== 'undefined') {
                    this._router = window.RouterAnalyzer.findVueRouter(this._vueRoot);
                } else {
                    this._router = this._findRouterFallback(this._vueRoot);
                }

                if (!this._router) {
                    result.logs.push({ type: 'warn', message: 'No Vue Router found' });
                    return result;
                }

                result.routerDetected = true;

                // 提取路由基础路径
                if (typeof window.RouterAnalyzer !== 'undefined') {
                    result.routerBase = window.RouterAnalyzer.extractRouterBase(this._router);
                    result.allRoutes = window.RouterAnalyzer.listAllRoutes(this._router);
                } else {
                    result.routerBase = this._extractRouterBaseFallback(this._router);
                    result.allRoutes = this._listAllRoutesFallback(this._router);
                }

                result.logs.push({ 
                    type: 'log', 
                    message: `Found ${result.allRoutes.length} routes` 
                });

                return result;

            } catch (error) {
                console.error('[VueDetector] Router analysis error:', error);
                result.logs.push({ type: 'error', message: error.message });
                return result;
            }
        }

        /**
         * 执行完整分析
         * @returns {FullAnalysisResult} 完整分析结果
         */
        performFullAnalysis() {
            const result = {
                vueDetected: false,
                vueVersion: null,
                routerDetected: false,
                routerBase: '',
                allRoutes: [],
                modifiedRoutes: [],
                guardsCleared: false,
                pageAnalysis: {
                    detectedBasePath: '',
                    commonPrefixes: []
                },
                currentPath: window.location.pathname,
                logs: [],
                errors: []
            };

            try {
                // 1. 检测 Vue
                const detection = this.detect();
                result.vueDetected = detection.detected;
                result.vueVersion = detection.vueVersion;

                if (!detection.detected) {
                    result.logs.push({ type: 'warn', message: 'Vue not detected' });
                    return result;
                }

                result.logs.push({ 
                    type: 'log', 
                    message: `Vue ${detection.vueVersion} (${detection.vueType}) detected` 
                });

                // 2. 分析 Router
                const routerAnalysis = this.analyzeRouter();
                result.routerDetected = routerAnalysis.routerDetected;
                result.routerBase = routerAnalysis.routerBase;
                result.allRoutes = routerAnalysis.allRoutes;
                result.logs = result.logs.concat(routerAnalysis.logs);

                if (!routerAnalysis.routerDetected) {
                    return result;
                }

                // 3. 清除守卫（如果启用）
                if (this.enableGuardPatch && this._router) {
                    try {
                        if (typeof window.GuardPatcher !== 'undefined') {
                            window.GuardPatcher.patchRouterGuards(this._router);
                        } else {
                            this._patchGuardsFallback(this._router);
                        }
                        result.guardsCleared = true;
                        result.logs.push({ type: 'log', message: 'Router guards cleared' });
                    } catch (e) {
                        result.errors.push(e.message);
                        result.logs.push({ type: 'error', message: 'Failed to clear guards: ' + e.message });
                    }
                }

                // 4. 修改鉴权字段（如果启用）
                if (this.enableAuthPatch && this._router) {
                    try {
                        if (typeof window.GuardPatcher !== 'undefined') {
                            result.modifiedRoutes = window.GuardPatcher.patchAllRouteAuth(this._router);
                        } else {
                            result.modifiedRoutes = this._patchAuthFallback(this._router);
                        }
                        result.logs.push({ 
                            type: 'log', 
                            message: `Modified ${result.modifiedRoutes.length} routes` 
                        });
                    } catch (e) {
                        result.errors.push(e.message);
                        result.logs.push({ type: 'error', message: 'Failed to patch auth: ' + e.message });
                    }
                }

                // 5. 分析页面链接
                result.pageAnalysis = this._analyzePageLinks();

                return result;

            } catch (error) {
                console.error('[VueDetector] Full analysis error:', error);
                result.errors.push(error.message);
                return result;
            }
        }

        // ========== 后备方法（当模块未加载时使用）==========

        /**
         * 后备：查找 Vue 根实例
         * @private
         */
        _findVueRootFallback(root) {
            const queue = [{ node: root, depth: 0 }];
            while (queue.length) {
                const { node, depth } = queue.shift();
                if (depth > this.maxDepth) break;

                if (node.__vue_app__ || node.__vue__ || node._vnode) {
                    return node;
                }

                if (node.nodeType === 1 && node.childNodes) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        queue.push({ node: node.childNodes[i], depth: depth + 1 });
                    }
                }
            }
            return null;
        }

        /**
         * 后备：查找 Vue Router
         * @private
         */
        _findRouterFallback(vueRoot) {
            try {
                if (vueRoot.__vue_app__) {
                    const app = vueRoot.__vue_app__;
                    if (app.config?.globalProperties?.$router) {
                        return app.config.globalProperties.$router;
                    }
                }

                if (vueRoot.__vue__) {
                    const vue = vueRoot.__vue__;
                    return vue.$router || vue.$root?.$router;
                }
            } catch (e) {
                console.warn('[VueDetector] Router fallback error:', e);
            }
            return null;
        }

        /**
         * 后备：提取 Router 基础路径
         * @private
         */
        _extractRouterBaseFallback(router) {
            try {
                return router.options?.base || router.history?.base || '';
            } catch (e) {
                return '';
            }
        }

        /**
         * 后备：列出所有路由
         * @private
         */
        _listAllRoutesFallback(router) {
            const list = [];
            try {
                if (typeof router.getRoutes === 'function') {
                    router.getRoutes().forEach(r => {
                        list.push({ name: r.name, path: r.path, meta: r.meta });
                    });
                } else if (router.options?.routes) {
                    this._traverseRoutes(router.options.routes, '', list);
                }
            } catch (e) {
                console.warn('[VueDetector] List routes fallback error:', e);
            }
            return list;
        }

        /**
         * 递归遍历路由
         * @private
         */
        _traverseRoutes(routes, basePath, list) {
            if (!Array.isArray(routes)) return;
            routes.forEach(r => {
                const fullPath = this._joinPath(basePath, r.path);
                list.push({ name: r.name, path: fullPath, meta: r.meta });
                if (Array.isArray(r.children)) {
                    this._traverseRoutes(r.children, fullPath, list);
                }
            });
        }

        /**
         * 路径拼接
         * @private
         */
        _joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        }

        /**
         * 后备：清除守卫
         * @private
         */
        _patchGuardsFallback(router) {
            ['beforeEach', 'beforeResolve', 'afterEach'].forEach(hook => {
                if (typeof router[hook] === 'function') {
                    router[hook] = () => {};
                }
            });

            const guardProps = [
                'beforeGuards', 'beforeResolveGuards', 'afterGuards',
                'beforeHooks', 'resolveHooks', 'afterHooks'
            ];

            guardProps.forEach(prop => {
                if (Array.isArray(router[prop])) {
                    router[prop].length = 0;
                }
            });
        }

        /**
         * 后备：修改鉴权字段
         * @private
         */
        _patchAuthFallback(router) {
            const modified = [];
            const isAuthTrue = (val) => val === true || val === 'true' || val === 1 || val === '1';

            const patchMeta = (route) => {
                if (route.meta && typeof route.meta === 'object') {
                    Object.keys(route.meta).forEach(key => {
                        if (key.toLowerCase().includes('auth') && isAuthTrue(route.meta[key])) {
                            route.meta[key] = false;
                            modified.push({ path: route.path, name: route.name });
                        }
                    });
                }
            };

            try {
                if (typeof router.getRoutes === 'function') {
                    router.getRoutes().forEach(patchMeta);
                } else if (router.options?.routes) {
                    this._walkRoutes(router.options.routes, patchMeta);
                }
            } catch (e) {
                console.warn('[VueDetector] Patch auth fallback error:', e);
            }

            return modified;
        }

        /**
         * 遍历路由树
         * @private
         */
        _walkRoutes(routes, callback) {
            if (!Array.isArray(routes)) return;
            routes.forEach(route => {
                callback(route);
                if (Array.isArray(route.children)) {
                    this._walkRoutes(route.children, callback);
                }
            });
        }

        /**
         * 分析页面链接
         * @private
         */
        _analyzePageLinks() {
            const result = {
                detectedBasePath: '',
                commonPrefixes: []
            };

            try {
                const links = Array.from(document.querySelectorAll('a[href]'))
                    .map(a => a.getAttribute('href'))
                    .filter(href =>
                        href &&
                        href.startsWith('/') &&
                        !href.startsWith('//') &&
                        !href.includes('.')
                    );

                if (links.length < 3) return result;

                const pathSegments = links.map(link => link.split('/').filter(Boolean));
                const firstSegments = {};

                pathSegments.forEach(segments => {
                    if (segments.length > 0) {
                        const first = segments[0];
                        firstSegments[first] = (firstSegments[first] || 0) + 1;
                    }
                });

                const sortedPrefixes = Object.entries(firstSegments)
                    .sort((a, b) => b[1] - a[1])
                    .map(entry => ({ prefix: entry[0], count: entry[1] }));

                result.commonPrefixes = sortedPrefixes;

                if (sortedPrefixes.length > 0 &&
                    sortedPrefixes[0].count / links.length > 0.6) {
                    result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
                }
            } catch (e) {
                console.warn('[VueDetector] Analyze page links error:', e);
            }

            return result;
        }

        /**
         * 延迟检测（用于处理异步加载的 Vue 应用）
         * @param {number} delay - 初始延迟时间（毫秒）
         * @param {number} maxRetries - 最大重试次数
         * @returns {Promise<Object>} 检测结果
         */
        delayedDetect(delay = 300, maxRetries = 3) {
            return new Promise((resolve) => {
                let retryCount = 0;

                const tryDetect = () => {
                    const result = this.detect();
                    
                    if (result.detected) {
                        resolve(result);
                        return;
                    }

                    retryCount++;
                    if (retryCount >= maxRetries) {
                        resolve({
                            detected: false,
                            method: `Max retry limit reached (${maxRetries} attempts)`,
                            vueVersion: null,
                            vueType: null,
                            timestamp: Date.now()
                        });
                        return;
                    }

                    // 递增延迟时间
                    setTimeout(tryDetect, delay * retryCount);
                };

                // 首次立即尝试
                const immediate = this.detect();
                if (immediate.detected) {
                    resolve(immediate);
                } else {
                    setTimeout(tryDetect, delay);
                }
            });
        }

        /**
         * 延迟执行完整分析
         * @param {number} delay - 初始延迟时间（毫秒）
         * @param {number} maxRetries - 最大重试次数
         * @returns {Promise<Object>} 完整分析结果
         */
        async delayedFullAnalysis(delay = 300, maxRetries = 3) {
            const detection = await this.delayedDetect(delay, maxRetries);
            
            if (!detection.detected) {
                return {
                    vueDetected: false,
                    vueVersion: null,
                    routerDetected: false,
                    routerBase: '',
                    allRoutes: [],
                    modifiedRoutes: [],
                    guardsCleared: false,
                    pageAnalysis: { detectedBasePath: '', commonPrefixes: [] },
                    currentPath: window.location.pathname,
                    logs: [{ type: 'warn', message: detection.method }],
                    errors: []
                };
            }

            return this.performFullAnalysis();
        }

        /**
         * 重置检测器状态
         */
        reset() {
            this._vueRoot = null;
            this._router = null;
            this._detectionResult = null;
        }

        /**
         * 获取当前检测状态
         * @returns {Object} 当前状态
         */
        getState() {
            return {
                hasVueRoot: this._vueRoot !== null,
                hasRouter: this._router !== null,
                lastDetection: this._detectionResult,
                options: {
                    enabled: this.enabled,
                    timeout: this.timeout,
                    enableGuardPatch: this.enableGuardPatch,
                    enableAuthPatch: this.enableAuthPatch,
                    maxDepth: this.maxDepth
                }
            };
        }
    }

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.VueDetector = VueDetector;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueDetector;
    }

})();
