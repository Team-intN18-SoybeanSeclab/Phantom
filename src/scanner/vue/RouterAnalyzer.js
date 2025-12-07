/**
 * RouterAnalyzer - Vue Router 分析模块
 * 
 * 负责定位和分析 Vue Router 配置，支持：
 * - Vue Router 2/3/4 多版本
 * - 路由信息提取
 * - 路由树遍历
 */

(function() {
    'use strict';

    const RouterAnalyzer = {
        /**
         * 定位 Vue Router 实例
         * 
         * @param {HTMLElement} vueRoot - Vue 根元素
         * @returns {Object|null} Vue Router 实例，未找到返回 null
         */
        findVueRouter(vueRoot) {
            if (!vueRoot) {
                return null;
            }

            try {
                // Vue 3 + Router 4
                if (vueRoot.__vue_app__) {
                    const app = vueRoot.__vue_app__;

                    // 方式 1: 从 globalProperties 获取
                    if (app.config?.globalProperties?.$router) {
                        return app.config.globalProperties.$router;
                    }

                    // 方式 2: 从 _instance 获取
                    const instance = app._instance;
                    if (instance?.appContext?.config?.globalProperties?.$router) {
                        return instance.appContext.config.globalProperties.$router;
                    }

                    // 方式 3: 从 ctx 获取
                    if (instance?.ctx?.$router) {
                        return instance.ctx.$router;
                    }

                    // 方式 4: 从 provides 获取
                    if (instance?.provides) {
                        // Vue Router 4 使用 Symbol 作为 key
                        for (const key of Object.getOwnPropertySymbols(instance.provides)) {
                            const value = instance.provides[key];
                            if (value && typeof value.push === 'function' && value.options) {
                                return value;
                            }
                        }
                    }
                }

                // Vue 2 + Router 2/3
                if (vueRoot.__vue__) {
                    const vue = vueRoot.__vue__;

                    // 方式 1: 直接从实例获取
                    if (vue.$router) {
                        return vue.$router;
                    }

                    // 方式 2: 从 $root 获取
                    if (vue.$root?.$router) {
                        return vue.$root.$router;
                    }

                    // 方式 3: 从 $root.$options 获取
                    if (vue.$root?.$options?.router) {
                        return vue.$root.$options.router;
                    }

                    // 方式 4: 从 _router 获取
                    if (vue._router) {
                        return vue._router;
                    }
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error finding Vue Router:', e);
            }

            return null;
        },

        /**
         * 提取 Router 基础路径
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {string} 基础路径
         */
        extractRouterBase(router) {
            if (!router) {
                return '';
            }

            try {
                // Vue Router 4
                if (router.options?.history?.base) {
                    return router.options.history.base;
                }

                // Vue Router 3
                if (router.options?.base) {
                    return router.options.base;
                }

                // 从 history 对象获取
                if (router.history?.base) {
                    return router.history.base;
                }

                // Vue Router 4 createWebHistory
                if (router.options?.history?._base) {
                    return router.options.history._base;
                }

            } catch (e) {
                console.warn('[RouterAnalyzer] Error extracting router base:', e);
            }

            return '';
        },

        /**
         * 列出所有路由
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Array} 路由列表
         */
        listAllRoutes(router) {
            const list = [];

            if (!router) {
                return list;
            }

            try {
                // Vue Router 4: 使用 getRoutes()
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

                // Vue Router 2/3: 从 options.routes 获取
                if (router.options?.routes) {
                    this._traverseRoutes(router.options.routes, '', list);
                    return list;
                }

                // 从 matcher 获取
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

                // 从历史记录获取（最后手段）
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

        /**
         * 遍历路由树（递归）
         * 
         * @param {Array} routes - 路由数组
         * @param {Function} callback - 回调函数
         */
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

        /**
         * 获取路由器版本信息
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Object} 版本信息
         */
        getRouterVersion(router) {
            const info = {
                version: 'unknown',
                type: 'unknown'
            };

            if (!router) {
                return info;
            }

            try {
                // Vue Router 4 特征
                if (typeof router.getRoutes === 'function' && 
                    typeof router.addRoute === 'function' &&
                    typeof router.removeRoute === 'function') {
                    info.type = 'vue-router-4';
                    info.version = '4.x';
                    return info;
                }

                // Vue Router 3 特征
                if (router.matcher && router.history && router.options) {
                    info.type = 'vue-router-3';
                    info.version = '3.x';
                    return info;
                }

                // Vue Router 2 特征
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

        /**
         * 获取当前路由信息
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Object} 当前路由信息
         */
        getCurrentRoute(router) {
            if (!router) {
                return null;
            }

            try {
                // Vue Router 4
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

                // Vue Router 3/2
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

                // 从 history 获取
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

        /**
         * 查找包含特定关键词的路由
         * 
         * @param {Object} router - Vue Router 实例
         * @param {Array<string>} keywords - 关键词列表
         * @returns {Array} 匹配的路由
         */
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

        // ========== 私有方法 ==========

        /**
         * 递归遍历路由并收集信息
         * @private
         */
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

                // 递归处理子路由
                if (Array.isArray(route.children) && route.children.length > 0) {
                    this._traverseRoutes(route.children, fullPath, list);
                }
            });
        },

        /**
         * 路径拼接
         * @private
         */
        _joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        },

        /**
         * 检查 meta 是否包含鉴权字段
         * @private
         */
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

        /**
         * 🔥 从 JavaScript 代码中静态分析提取 Vue 路由配置
         * 用于深度扫描时无法访问页面运行时的情况
         * 
         * @param {string} jsContent - JavaScript 代码内容
         * @param {string} baseUrl - 基础 URL
         * @returns {Array} 提取到的路由列表
         */
        extractRoutesFromCode(jsContent, baseUrl = '') {
            const routes = [];
            
            if (!jsContent || typeof jsContent !== 'string') {
                return routes;
            }

            try {
                // 正则模式：匹配 Vue Router 路由配置
                const patterns = [
                    // 匹配 path: '/xxx' 或 path: "/xxx" 格式
                    /path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 { path: '/xxx', ... } 格式
                    /\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 routes: [{ path: '/xxx' }] 格式
                    /routes\s*:\s*\[\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 createRouter 中的路由
                    /createRouter\s*\(\s*\{[\s\S]*?routes\s*:\s*\[[\s\S]*?path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 new VueRouter 中的路由
                    /new\s+VueRouter\s*\(\s*\{[\s\S]*?routes\s*:\s*\[[\s\S]*?path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 router.addRoute 动态添加的路由
                    /router\.addRoute\s*\(\s*['"`]?[^,]*['"`]?\s*,?\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 $router.push 或 router.push 的路由
                    /\$?router\.push\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
                    /\$?router\.push\s*\(\s*\{\s*path\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // 匹配 to="/xxx" 或 :to="'/xxx'" 格式（router-link）
                    /to\s*=\s*['"`]([^'"`]+)['"`]/g,
                    /:to\s*=\s*['"`]\s*['"`]([^'"`]+)['"`]\s*['"`]/g,
                    // 匹配 href="#/xxx" 格式（hash 路由）
                    /href\s*=\s*['"`]#([^'"`]+)['"`]/g
                ];

                const foundPaths = new Set();

                for (const pattern of patterns) {
                    let match;
                    pattern.lastIndex = 0;
                    
                    while ((match = pattern.exec(jsContent)) !== null) {
                        const path = match[1];
                        
                        // 过滤无效路径
                        if (!path || path.length < 1) continue;
                        if (path.includes('{{') || path.includes('${')) continue; // 模板字符串
                        if (path.match(/^[a-z]+:\/\//i)) continue; // 完整 URL
                        if (path.match(/\.(js|css|png|jpg|svg|ico|woff|ttf)$/i)) continue; // 静态文件
                        
                        // 标准化路径
                        let normalizedPath = path;
                        if (!normalizedPath.startsWith('/') && !normalizedPath.startsWith('#')) {
                            normalizedPath = '/' + normalizedPath;
                        }
                        
                        foundPaths.add(normalizedPath);
                    }
                }

                // 转换为路由对象
                foundPaths.forEach(path => {
                    // 构建完整 URL
                    let fullUrl = '';
                    if (baseUrl) {
                        try {
                            const urlObj = new URL(baseUrl);
                            
                            // 🔥 修复：获取应用基础路径（去掉文件名，如 .js/.html）
                            let basePath = urlObj.pathname;
                            
                            // 如果路径以 .js/.html/.css 等文件结尾，取其目录路径
                            if (/\.(js|html|css|json|vue)(\?.*)?$/i.test(basePath)) {
                                // 获取目录路径
                                basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
                            }
                            
                            // 🔥 进一步处理：如果是 assets/dist/js 等目录，向上查找应用根目录
                            const assetDirs = ['assets', 'dist', 'js', 'css', 'static', 'build', 'public'];
                            const pathParts = basePath.split('/').filter(Boolean);
                            
                            // 从后向前查找，移除资源目录
                            while (pathParts.length > 0) {
                                const lastPart = pathParts[pathParts.length - 1].toLowerCase();
                                if (assetDirs.includes(lastPart)) {
                                    pathParts.pop();
                                } else {
                                    break;
                                }
                            }
                            
                            // 重建基础路径
                            basePath = '/' + pathParts.join('/');
                            if (!basePath.endsWith('/')) {
                                basePath += '/';
                            }
                            
                            if (path.startsWith('#')) {
                                // Hash 路由：直接拼接
                                fullUrl = `${urlObj.origin}${basePath}${path}`;
                            } else {
                                // 🔥 默认使用 hash 路由格式，因为 Vue 路由通常是 SPA
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

        /**
         * 从路径中提取路由名称
         * @private
         */
        _extractRouteName(path) {
            if (!path) return '';
            
            // 移除开头的 / 或 #/
            let cleanPath = path.replace(/^[#/]+/, '');
            
            // 获取最后一个路径段
            const segments = cleanPath.split('/').filter(Boolean);
            if (segments.length === 0) return 'home';
            
            // 移除动态参数
            const lastSegment = segments[segments.length - 1].replace(/^:/, '');
            
            return lastSegment || 'index';
        },

        /**
         * 检查路径是否可能是敏感路径
         * @private
         */
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

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.RouterAnalyzer = RouterAnalyzer;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RouterAnalyzer;
    }

})();
