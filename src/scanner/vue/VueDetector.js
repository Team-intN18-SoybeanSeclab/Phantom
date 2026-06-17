(function() {
    'use strict';


    class VueDetector {

        constructor(options = {}) {
            this.enabled = options.enabled !== false;
            this.timeout = options.timeout || 3000;
            this.enableGuardPatch = options.enableGuardPatch !== false;
            this.enableAuthPatch = options.enableAuthPatch !== false;
            this.maxDepth = options.maxDepth || 1000;


            this._vueRoot = null;
            this._router = null;
            this._detectionResult = null;
        }


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

                if (typeof window.VueFinder !== 'undefined') {
                    this._vueRoot = window.VueFinder.findVueRoot(document.body, this.maxDepth);
                } else {

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


                let vueVersion = null;
                let vueType = null;

                if (typeof window.VueFinder !== 'undefined') {
                    vueVersion = window.VueFinder.getVueVersion(this._vueRoot);
                    vueType = window.VueFinder.detectVueType(this._vueRoot);
                } else {

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


        analyzeRouter() {
            const result = {
                routerDetected: false,
                routerBase: '',
                allRoutes: [],
                modifiedRoutes: [],
                logs: []
            };

            try {

                if (!this._vueRoot) {
                    this.detect();
                }

                if (!this._vueRoot) {
                    result.logs.push({ type: 'error', message: 'No Vue instance found' });
                    return result;
                }


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


                const routerAnalysis = this.analyzeRouter();
                result.routerDetected = routerAnalysis.routerDetected;
                result.routerBase = routerAnalysis.routerBase;
                result.allRoutes = routerAnalysis.allRoutes;
                result.logs = result.logs.concat(routerAnalysis.logs);

                if (!routerAnalysis.routerDetected) {
                    return result;
                }


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


                result.pageAnalysis = this._analyzePageLinks();

                return result;

            } catch (error) {
                console.error('[VueDetector] Full analysis error:', error);
                result.errors.push(error.message);
                return result;
            }
        }




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


        _extractRouterBaseFallback(router) {
            try {
                return router.options?.base || router.history?.base || '';
            } catch (e) {
                return '';
            }
        }


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


        _joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        }


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


        _walkRoutes(routes, callback) {
            if (!Array.isArray(routes)) return;
            routes.forEach(route => {
                callback(route);
                if (Array.isArray(route.children)) {
                    this._walkRoutes(route.children, callback);
                }
            });
        }


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


                    setTimeout(tryDetect, delay * retryCount);
                };


                const immediate = this.detect();
                if (immediate.detected) {
                    resolve(immediate);
                } else {
                    setTimeout(tryDetect, delay);
                }
            });
        }


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


        reset() {
            this._vueRoot = null;
            this._router = null;
            this._detectionResult = null;
        }


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


    if (typeof window !== 'undefined') {
        window.VueDetector = VueDetector;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueDetector;
    }

})();
