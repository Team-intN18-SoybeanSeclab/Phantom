(function() {
    'use strict';

    class VueDetectorBridge {

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


        async init() {
            if (this.initialized) {
                return true;
            }

            try {

                await this._loadUserConfig();


                if (typeof window.VueDetector === 'undefined') {
                    console.warn('[VueDetectorBridge] VueDetector not loaded');
                    return false;
                }


                this.detector = new window.VueDetector(this.options);
                this.initialized = true;

                console.log(' [VueDetectorBridge] Initialized with options:', this.options);
                return true;

            } catch (e) {
                console.error('[VueDetectorBridge] Init error:', e);
                return false;
            }
        }


        async _loadUserConfig() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    const result = await chrome.storage.local.get(['vueDetectorSettings']);
                    const settings = result.vueDetectorSettings || {};


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


        async saveUserConfig(settings) {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ vueDetectorSettings: settings });


                    this.options = { ...this.options, ...settings };


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


        async detect() {
            if (!this.initialized) {
                await this.init();
            }

            if (!this.detector) {
                return this._createEmptyResult('Detector not initialized');
            }

            try {

                const result = await this.detector.delayedFullAnalysis();


                this._lastResult = this.convertToPhantomFormat(result);

                return this._lastResult;

            } catch (e) {
                console.error('[VueDetectorBridge] Detect error:', e);
                return this._createEmptyResult(e.message);
            }
        }


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


            const baseUrl = window.location.origin;
            const routerBase = vueResult.routerBase || '';

            const isHashMode = window.location.hash.startsWith('#/') ||
                              (vueResult.routerMode === 'hash') ||
                              document.querySelector('a[href^="#/"]') !== null;


            if (vueResult.allRoutes && Array.isArray(vueResult.allRoutes)) {
                phantomResult.routes = vueResult.allRoutes.map(route => {
                    const routePath = route.path || route.fullPath || '';


                    let fullUrl = '';
                    if (routePath.startsWith('http://') || routePath.startsWith('https://')) {

                        fullUrl = routePath;
                    } else if (isHashMode) {

                        fullUrl = baseUrl + routerBase + '/#' + routePath;
                    } else {

                        fullUrl = baseUrl + routerBase + routePath;
                    }

                    return {
                        path: routePath,
                        fullUrl: fullUrl,
                        value: fullUrl,
                        name: route.name || '',
                        type: 'vue-route',
                        hasAuth: route.hasAuth || false,
                        meta: route.meta || {},
                        source: 'vue-router',
                        sourceUrl: window.location.href,
                        extractedAt: new Date().toISOString()
                    };
                });


                phantomResult.sensitiveRoutes = this._identifySensitiveRoutes(phantomResult.routes);
            }

            return phantomResult;
        }


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


        mergeWithPatternResult(patternResult, vueResult) {
            if (!patternResult) {
                patternResult = {};
            }

            const merged = { ...patternResult };


            merged.vueDetection = {
                detected: vueResult?.detected || false,
                framework: vueResult?.framework || null,
                routeCount: vueResult?.routes?.length || 0
            };


            if (vueResult?.routes && Array.isArray(vueResult.routes)) {
                if (!merged.endpoints) {
                    merged.endpoints = [];
                }


                vueResult.routes.forEach(route => {

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


            if (vueResult?.sensitiveRoutes && vueResult.sensitiveRoutes.length > 0) {
                if (!merged.sensitiveRoutes) {
                    merged.sensitiveRoutes = [];
                }
                merged.sensitiveRoutes = merged.sensitiveRoutes.concat(vueResult.sensitiveRoutes);
            }


            merged.vueRoutes = vueResult?.routes || [];

            return merged;
        }


        getLastResult() {
            return this._lastResult;
        }


        reset() {
            if (this.detector) {
                this.detector.reset();
            }
            this._lastResult = null;
        }


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


                for (const keyword of sensitiveKeywords) {
                    if (pathLower.includes(keyword) || nameLower.includes(keyword)) {
                        return true;
                    }
                }


                if (route.hasAuth) {
                    return true;
                }

                return false;
            }).map(route => ({
                ...route,
                reason: this._getSensitiveReason(route)
            }));
        }


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


    if (typeof window !== 'undefined') {
        window.VueDetectorBridge = VueDetectorBridge;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueDetectorBridge;
    }

})();
