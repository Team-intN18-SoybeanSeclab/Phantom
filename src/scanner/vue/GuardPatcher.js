/**
 * GuardPatcher - 路由守卫修改模块
 * 
 * 负责清除路由守卫和修改鉴权字段，用于安全测试：
 * - 清除 beforeEach、beforeResolve、afterEach 钩子
 * - 清除内部守卫数组
 * - 修改路由 meta 中的鉴权字段
 */

(function() {
    'use strict';

    const GuardPatcher = {
        /**
         * 清除路由守卫
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Object} 清除结果
         */
        patchRouterGuards(router) {
            const result = {
                success: false,
                clearedHooks: [],
                clearedArrays: [],
                errors: []
            };

            if (!router) {
                result.errors.push('Router instance is null');
                return result;
            }

            try {
                // 清除导航钩子函数
                const hooks = ['beforeEach', 'beforeResolve', 'afterEach'];
                
                hooks.forEach(hook => {
                    try {
                        if (typeof router[hook] === 'function') {
                            // 替换为空函数
                            router[hook] = () => {};
                            result.clearedHooks.push(hook);
                        }
                    } catch (e) {
                        result.errors.push(`Failed to clear ${hook}: ${e.message}`);
                    }
                });

                // 清除内部守卫数组
                const guardArrays = [
                    'beforeGuards',
                    'beforeResolveGuards', 
                    'afterGuards',
                    'beforeHooks',
                    'resolveHooks',
                    'afterHooks',
                    // Vue Router 4 内部属性
                    'guards'
                ];

                guardArrays.forEach(prop => {
                    try {
                        if (Array.isArray(router[prop])) {
                            const originalLength = router[prop].length;
                            router[prop].length = 0;
                            if (originalLength > 0) {
                                result.clearedArrays.push({
                                    name: prop,
                                    count: originalLength
                                });
                            }
                        }
                    } catch (e) {
                        result.errors.push(`Failed to clear ${prop}: ${e.message}`);
                    }
                });

                // 尝试清除 Vue Router 4 的 beforeGuards Set
                if (router.beforeGuards instanceof Set) {
                    const size = router.beforeGuards.size;
                    router.beforeGuards.clear();
                    if (size > 0) {
                        result.clearedArrays.push({
                            name: 'beforeGuards (Set)',
                            count: size
                        });
                    }
                }

                result.success = true;
                console.log('✅ [GuardPatcher] Router guards cleared:', result);

            } catch (e) {
                result.errors.push(`General error: ${e.message}`);
                console.error('[GuardPatcher] Error clearing guards:', e);
            }

            return result;
        },

        /**
         * 修改所有路由的鉴权字段
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Array} 被修改的路由列表
         */
        patchAllRouteAuth(router) {
            const modified = [];

            if (!router) {
                return modified;
            }

            const patchMeta = (route) => {
                if (route.meta && typeof route.meta === 'object') {
                    Object.keys(route.meta).forEach(key => {
                        if (this.isAuthField(key, route.meta[key])) {
                            const originalValue = route.meta[key];
                            route.meta[key] = false;
                            modified.push({
                                path: route.path,
                                name: route.name,
                                field: key,
                                originalValue: originalValue,
                                newValue: false
                            });
                        }
                    });
                }
            };

            try {
                // Vue Router 4: 使用 getRoutes()
                if (typeof router.getRoutes === 'function') {
                    router.getRoutes().forEach(patchMeta);
                }
                // Vue Router 2/3: 从 options.routes 获取
                else if (router.options?.routes) {
                    this._walkRoutes(router.options.routes, patchMeta);
                }
                // 从 matcher 获取
                else if (router.matcher) {
                    if (typeof router.matcher.getRoutes === 'function') {
                        router.matcher.getRoutes().forEach(patchMeta);
                    } else if (router.history?.current?.matched) {
                        router.history.current.matched.forEach(patchMeta);
                    }
                }
                else {
                    console.warn('[GuardPatcher] Unknown Vue Router version, skipping auth patch');
                }

                if (modified.length > 0) {
                    console.log('🚀 [GuardPatcher] Modified routes auth meta:', modified);
                } else {
                    console.log('ℹ️ [GuardPatcher] No auth fields to modify');
                }

            } catch (e) {
                console.error('[GuardPatcher] Error patching auth:', e);
            }

            return modified;
        },

        /**
         * 判断是否为鉴权字段
         * 
         * @param {string} key - 字段名
         * @param {*} value - 字段值
         * @returns {boolean} 是否为需要修改的鉴权字段
         */
        isAuthField(key, value) {
            // 检查字段名是否包含鉴权相关关键词
            const authKeywords = [
                'auth',
                'login',
                'permission',
                'role',
                'require',
                'protected',
                'private',
                'secure',
                'guard',
                'access'
            ];

            const keyLower = key.toLowerCase();
            const isAuthKey = authKeywords.some(keyword => keyLower.includes(keyword));

            if (!isAuthKey) {
                return false;
            }

            // 检查值是否表示"需要鉴权"
            return this._isAuthTrue(value);
        },

        /**
         * 恢复路由守卫（如果之前保存了原始守卫）
         * 
         * @param {Object} router - Vue Router 实例
         * @param {Object} originalGuards - 原始守卫备份
         * @returns {boolean} 是否恢复成功
         */
        restoreGuards(router, originalGuards) {
            if (!router || !originalGuards) {
                return false;
            }

            try {
                Object.keys(originalGuards).forEach(key => {
                    if (Array.isArray(originalGuards[key])) {
                        router[key] = [...originalGuards[key]];
                    } else if (typeof originalGuards[key] === 'function') {
                        router[key] = originalGuards[key];
                    }
                });
                return true;
            } catch (e) {
                console.error('[GuardPatcher] Error restoring guards:', e);
                return false;
            }
        },

        /**
         * 备份当前守卫
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Object} 守卫备份
         */
        backupGuards(router) {
            const backup = {};

            if (!router) {
                return backup;
            }

            try {
                const guardArrays = [
                    'beforeGuards',
                    'beforeResolveGuards',
                    'afterGuards',
                    'beforeHooks',
                    'resolveHooks',
                    'afterHooks'
                ];

                guardArrays.forEach(prop => {
                    if (Array.isArray(router[prop])) {
                        backup[prop] = [...router[prop]];
                    }
                });

            } catch (e) {
                console.error('[GuardPatcher] Error backing up guards:', e);
            }

            return backup;
        },

        /**
         * 获取守卫统计信息
         * 
         * @param {Object} router - Vue Router 实例
         * @returns {Object} 守卫统计
         */
        getGuardStats(router) {
            const stats = {
                beforeEach: 0,
                beforeResolve: 0,
                afterEach: 0,
                total: 0
            };

            if (!router) {
                return stats;
            }

            try {
                // 检查各种守卫数组
                if (Array.isArray(router.beforeGuards)) {
                    stats.beforeEach = router.beforeGuards.length;
                }
                if (Array.isArray(router.beforeResolveGuards)) {
                    stats.beforeResolve = router.beforeResolveGuards.length;
                }
                if (Array.isArray(router.afterGuards)) {
                    stats.afterEach = router.afterGuards.length;
                }

                // Vue Router 3 的属性名
                if (Array.isArray(router.beforeHooks)) {
                    stats.beforeEach += router.beforeHooks.length;
                }
                if (Array.isArray(router.resolveHooks)) {
                    stats.beforeResolve += router.resolveHooks.length;
                }
                if (Array.isArray(router.afterHooks)) {
                    stats.afterEach += router.afterHooks.length;
                }

                stats.total = stats.beforeEach + stats.beforeResolve + stats.afterEach;

            } catch (e) {
                console.error('[GuardPatcher] Error getting guard stats:', e);
            }

            return stats;
        },

        // ========== 私有方法 ==========

        /**
         * 遍历路由树
         * @private
         */
        _walkRoutes(routes, callback) {
            if (!Array.isArray(routes)) {
                return;
            }

            routes.forEach(route => {
                callback(route);
                if (Array.isArray(route.children) && route.children.length > 0) {
                    this._walkRoutes(route.children, callback);
                }
            });
        },

        /**
         * 判断值是否表示"需要鉴权"
         * @private
         */
        _isAuthTrue(val) {
            // 布尔值 true
            if (val === true) return true;
            
            // 字符串 'true'
            if (val === 'true' || val === 'True' || val === 'TRUE') return true;
            
            // 数字 1
            if (val === 1 || val === '1') return true;
            
            // 非空数组（表示需要某些角色/权限）
            if (Array.isArray(val) && val.length > 0) return true;
            
            // 非空对象（表示有权限配置）
            if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
                return true;
            }

            return false;
        }
    };

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.GuardPatcher = GuardPatcher;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GuardPatcher;
    }

})();
