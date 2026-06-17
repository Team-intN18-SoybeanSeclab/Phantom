(function() {
    'use strict';

    const RouterAnalyzer = {

        findVueRouter(vueRoot) {
            if (!vueRoot) {
                return null;
            }

            try {

                if (vueRoot.__vue_app__) {
                    const app = vueRoot.__vue_app__;


                    if (app.config?.globalProperties?.$router) {
                        return app.config.globalProperties.$router;
                    }


                    const instance = app._instance;
                    if (instance?.appContext?.config?.globalProperties?.$router) {
                        return instance.appContext.config.globalProperties.$router;
                    }


                    if (instance?.ctx?.$router) {
                        return instance.ctx.$router;
                    }


                    if (instance?.provides) {

                        for (const key of Object.getOwnPropertySymbols(instance.provides)) {
                            const value = instance.provides[key];
                            if (value && typeof value.push === 'function' && value.options) {
                                return value;
                            }
                        }
                    }
                }


                if (vueRoot.__vue__) {
                    const vue = vueRoot.__vue__;


                    if (vue.$router) {
                        return vue.$router;
                    }


                    if (vue.$root?.$router) {
                        return vue.$root.$router;
                    }


                    if (vue.$root?.$options?.router) {
                        return vue.$root.$options.router;
                    }


                    if (vue._router) {
                        return vue._router;
                    }
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error finding Vue Router:', e);
            }

            return null;
        },


        extractRouterBase(router) {
            if (!router) {
                return '';
            }

            try {

                if (router.options?.history?.base) {
                    return router.options.history.base;
                }


                if (router.options?.base) {
                    return router.options.base;
                }


                if (router.history?.base) {
                    return router.history.base;
                }


                if (router.options?.history?._base) {
                    return router.options.history._base;
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error extracting router base:', e);
            }

            return '';
        },


        listAllRoutes(router) {
            const list = [];

            if (!router) {
                return list;
            }

            try {

                if (typeof router.getRoutes === 'function') {
                    const routes = router.getRoutes();
                    routes.forEach(r => {
                        list.push({
                            name: r.name || '',
                            path: r.path || '',
                            fullPath: r.path || '',
                            meta: r.meta || {},
                            hasAuth: this._hasAuthMeta(r.meta),
                            redirect: r.redirect || null,
                            alias: r.alias || null
                        });
                    });
                    return list;
                }


                if (router.options?.routes) {
                    this._traverseRoutes(router.options.routes, '', list);
                    return list;
                }


                if (router.matcher?.getRoutes) {
                    const routes = router.matcher.getRoutes();
                    routes.forEach(r => {
                        list.push({
                            name: r.name || '',
                            path: r.path || '',
                            fullPath: r.path || '',
                            meta: r.meta || {},
                            hasAuth: this._hasAuthMeta(r.meta)
                        });
                    });
                    return list;
                }


                if (router.history?.current?.matched) {
                    router.history.current.matched.forEach(r => {
                        list.push({
                            name: r.name || '',
                            path: r.path || '',
                            fullPath: r.path || '',
                            meta: r.meta || {},
                            hasAuth: this._hasAuthMeta(r.meta)
                        });
                    });
                    return list;
                }

                console.warn('[RouterAnalyzer] Unable to list routes - unknown router version');

            } catch (e) {
                console.warn('[RouterAnalyzer] Error listing routes:', e);
            }

            return list;
        },


        walkRoutes(routes, callback) {
            if (!Array.isArray(routes)) {
                return;
            }

            routes.forEach(route => {
                callback(route);
                if (Array.isArray(route.children) && route.children.length > 0) {
                    this.walkRoutes(route.children, callback);
                }
            });
        },


        getRouterVersion(router) {
            const info = {
                version: 'unknown',
                type: 'unknown'
            };

            if (!router) {
                return info;
            }

            try {

                if (typeof router.getRoutes === 'function' &&
                    typeof router.addRoute === 'function' &&
                    typeof router.removeRoute === 'function') {
                    info.type = 'vue-router-4';
                    info.version = '4.x';
                    return info;
                }


                if (router.matcher && router.history && router.options) {
                    info.type = 'vue-router-3';
                    info.version = '3.x';
                    return info;
                }


                if (router.match && router.history && !router.matcher) {
                    info.type = 'vue-router-2';
                    info.version = '2.x';
                    return info;
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error getting router version:', e);
            }

            return info;
        },


        getCurrentRoute(router) {
            if (!router) {
                return null;
            }

            try {

                if (router.currentRoute?.value) {
                    const route = router.currentRoute.value;
                    return {
                        path: route.path,
                        name: route.name,
                        fullPath: route.fullPath,
                        query: route.query,
                        params: route.params,
                        meta: route.meta,
                        hash: route.hash
                    };
                }


                if (router.currentRoute) {
                    const route = router.currentRoute;
                    return {
                        path: route.path,
                        name: route.name,
                        fullPath: route.fullPath,
                        query: route.query,
                        params: route.params,
                        meta: route.meta,
                        hash: route.hash
                    };
                }


                if (router.history?.current) {
                    const route = router.history.current;
                    return {
                        path: route.path,
                        name: route.name,
                        fullPath: route.fullPath,
                        query: route.query,
                        params: route.params,
                        meta: route.meta,
                        hash: route.hash
                    };
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error getting current route:', e);
            }

            return null;
        },


        findRoutesByKeywords(router, keywords = ['admin', 'manage', 'dashboard', 'system', 'config', 'setting']) {
            const routes = this.listAllRoutes(router);
            const matches = [];

            routes.forEach(route => {
                const pathLower = (route.path || '').toLowerCase();
                const nameLower = (route.name || '').toLowerCase();

                for (const keyword of keywords) {
                    if (pathLower.includes(keyword) || nameLower.includes(keyword)) {
                        matches.push({
                            ...route,
                            matchedKeyword: keyword
                        });
                        break;
                    }
                }
            });

            return matches;
        },




        _traverseRoutes(routes, basePath, list) {
            if (!Array.isArray(routes)) {
                return;
            }

            routes.forEach(route => {
                const fullPath = this._joinPath(basePath, route.path);

                list.push({
                    name: route.name || '',
                    path: route.path || '',
                    fullPath: fullPath,
                    meta: route.meta || {},
                    hasAuth: this._hasAuthMeta(route.meta),
                    redirect: route.redirect || null,
                    alias: route.alias || null
                });


                if (Array.isArray(route.children) && route.children.length > 0) {
                    this._traverseRoutes(route.children, fullPath, list);
                }
            });
        },


        _joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        },


        _hasAuthMeta(meta) {
            if (!meta || typeof meta !== 'object') {
                return false;
            }

            const authKeys = ['auth', 'requireAuth', 'requiresAuth', 'authenticated', 'login', 'permission', 'role'];

            for (const key of Object.keys(meta)) {
                const keyLower = key.toLowerCase();
                for (const authKey of authKeys) {
                    if (keyLower.includes(authKey)) {
                        return true;
                    }
                }
            }

            return false;
        },


        extractRoutesFromCode(jsContent, baseUrl = '') {
            const routes = [];

            if (!jsContent || typeof jsContent !== 'string') {
                return routes;
            }

            try {

                const patterns = [

                    /path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /routes\s*:\s*\[\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /createRouter\s*\(\s*\{[\s\S]*?routes\s*:\s*\[[\s\S]*?path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /new\s+VueRouter\s*\(\s*\{[\s\S]*?routes\s*:\s*\[[\s\S]*?path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /router\.addRoute\s*\(\s*['"`]?[^,]*['"`]?\s*,?\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /\$?router\.push\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
                    /\$?router\.push\s*\(\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,

                    /to\s*=\s*['"`]([^'"`]+)['"`]/g,
                    /:to\s*=\s*['"`]\s*['"`]([^'"`]+)['"`]\s*['"`]/g,

                    /href\s*=\s*['"`]#([^'"`]+)['"`]/g
                ];

                const foundPaths = new Set();

                for (const pattern of patterns) {
                    let match;
                    pattern.lastIndex = 0;

                    while ((match = pattern.exec(jsContent)) !== null) {
                        const path = match[1];


                        if (!path || path.length < 1) continue;
                        if (path.includes('{{') || path.includes('${')) continue;
                        if (path.match(/^[a-z]+:\/\//i)) continue;
                        if (path.match(/\.(js|css|png|jpg|svg|ico|woff|ttf)$/i)) continue;


                        let normalizedPath = path;
                        if (!normalizedPath.startsWith('/') && !normalizedPath.startsWith('#')) {
                            normalizedPath = '/' + normalizedPath;
                        }

                        foundPaths.add(normalizedPath);
                    }
                }


                foundPaths.forEach(path => {

                    let fullUrl = '';
                    if (baseUrl) {
                        try {
                            const urlObj = new URL(baseUrl);


                            let basePath = urlObj.pathname;


                            if (/\.(js|html|css|json|vue)(\?.*)?$/i.test(basePath)) {

                                basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
                            }


                            const assetDirs = ['assets', 'dist', 'js', 'css', 'static', 'build', 'public'];
                            const pathParts = basePath.split('/').filter(Boolean);


                            while (pathParts.length > 0) {
                                const lastPart = pathParts[pathParts.length - 1].toLowerCase();
                                if (assetDirs.includes(lastPart)) {
                                    pathParts.pop();
                                } else {
                                    break;
                                }
                            }


                            basePath = '/' + pathParts.join('/');
                            if (!basePath.endsWith('/')) {
                                basePath += '/';
                            }

                            if (path.startsWith('#')) {

                                fullUrl = `${urlObj.origin}${basePath}${path}`;
                            } else {

                                fullUrl = `${urlObj.origin}${basePath}#${path}`;
                            }
                        } catch (e) {
                            fullUrl = path;
                        }
                    }

                    routes.push({
                        path: path,
                        fullPath: path,
                        fullUrl: fullUrl,
                        name: this._extractRouteName(path),
                        meta: {},
                        hasAuth: this._isLikelySensitivePath(path),
                        source: 'static-analysis'
                    });
                });

                console.log(`[RouterAnalyzer] 从代码中提取到 ${routes.length} 个路由`);

            } catch (e) {
                console.warn('[RouterAnalyzer] Error extracting routes from code:', e);
            }

            return routes;
        },


        _extractRouteName(path) {
            if (!path) return '';


            let cleanPath = path.replace(/^[#/]+/, '');


            const segments = cleanPath.split('/').filter(Boolean);
            if (segments.length === 0) return 'home';


            const lastSegment = segments[segments.length - 1].replace(/^:/, '');

            return lastSegment || 'index';
        },


        _isLikelySensitivePath(path) {
            if (!path) return false;

            const sensitiveKeywords = [
                'admin', 'manage', 'dashboard', 'system', 'config', 'setting',
                'user', 'account', 'profile', 'password', 'secret', 'api',
                'upload', 'file', 'download', 'export', 'import', 'backup',
                'log', 'audit', 'monitor', 'debug', 'test', 'dev'
            ];

            const pathLower = path.toLowerCase();

            for (const keyword of sensitiveKeywords) {
                if (pathLower.includes(keyword)) {
                    return true;
                }
            }

            return false;
        }
    };


    if (typeof window !== 'undefined') {
        window.RouterAnalyzer = RouterAnalyzer;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RouterAnalyzer;
    }

})();
