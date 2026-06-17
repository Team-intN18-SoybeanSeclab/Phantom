(function() {
    'use strict';

    const GuardPatcher = {

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

                const hooks = ['beforeEach', 'beforeResolve', 'afterEach'];

                hooks.forEach(hook => {
                    try {
                        if (typeof router[hook] === 'function') {

                            router[hook] = () => {};
                            result.clearedHooks.push(hook);
                        }
                    } catch (e) {
                        result.errors.push(`Failed to clear ${hook}: ${e.message}`);
                    }
                });


                const guardArrays = [
                    'beforeGuards',
                    'beforeResolveGuards',
                    'afterGuards',
                    'beforeHooks',
                    'resolveHooks',
                    'afterHooks',

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
                console.log(' [GuardPatcher] Router guards cleared:', result);

            } catch (e) {
                result.errors.push(`General error: ${e.message}`);
                console.error('[GuardPatcher] Error clearing guards:', e);
            }

            return result;
        },


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

                if (typeof router.getRoutes === 'function') {
                    router.getRoutes().forEach(patchMeta);
                }

                else if (router.options?.routes) {
                    this._walkRoutes(router.options.routes, patchMeta);
                }

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
                    console.log(' [GuardPatcher] Modified routes auth meta:', modified);
                } else {
                    console.log(' [GuardPatcher] No auth fields to modify');
                }

            } catch (e) {
                console.error('[GuardPatcher] Error patching auth:', e);
            }

            return modified;
        },


        isAuthField(key, value) {

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


            return this._isAuthTrue(value);
        },


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

                if (Array.isArray(router.beforeGuards)) {
                    stats.beforeEach = router.beforeGuards.length;
                }
                if (Array.isArray(router.beforeResolveGuards)) {
                    stats.beforeResolve = router.beforeResolveGuards.length;
                }
                if (Array.isArray(router.afterGuards)) {
                    stats.afterEach = router.afterGuards.length;
                }


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


        _isAuthTrue(val) {

            if (val === true) return true;


            if (val === 'true' || val === 'True' || val === 'TRUE') return true;


            if (val === 1 || val === '1') return true;


            if (Array.isArray(val) && val.length > 0) return true;


            if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
                return true;
            }

            return false;
        }
    };


    if (typeof window !== 'undefined') {
        window.GuardPatcher = GuardPatcher;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GuardPatcher;
    }

})();
