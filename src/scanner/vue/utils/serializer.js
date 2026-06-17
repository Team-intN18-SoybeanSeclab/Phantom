(function() {
    'use strict';

    const Serializer = {

        sanitizeForPostMessage(obj) {
            if (obj === null || obj === undefined) {
                return obj;
            }

            if (typeof obj === 'function') {
                return '[Function]';
            }

            if (obj instanceof Promise) {
                return '[Promise]';
            }

            if (typeof obj === 'object') {

                if (obj.constructor && obj.constructor.name &&
                    !['Object', 'Array'].includes(obj.constructor.name)) {
                    return `[${obj.constructor.name}]`;
                }

                const sanitized = Array.isArray(obj) ? [] : {};

                try {
                    for (const key in obj) {
                        if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                            const value = obj[key];


                            if (key === 'allRoutes' && Array.isArray(value)) {
                                sanitized[key] = value.map(route => {
                                    if (typeof route === 'object' && route !== null) {
                                        return {
                                            name: route.name || '',
                                            path: route.path || '',
                                            meta: route.meta ? this.sanitizeRouteObject(route.meta) : {}
                                        };
                                    }
                                    return route;
                                });
                                continue;
                            }


                            if (key.startsWith('_') || key.startsWith('$') ||
                                key === 'parent' || key === 'router' || key === 'matched') {
                                continue;
                            }

                            if (typeof value === 'function') {
                                sanitized[key] = '[Function]';
                            } else if (value instanceof Promise) {
                                sanitized[key] = '[Promise]';
                            } else if (Array.isArray(value)) {

                                if (value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].path !== undefined) {

                                    sanitized[key] = value.map(item => {
                                        if (typeof item === 'object' && item !== null) {
                                            return {
                                                name: item.name || '',
                                                path: item.path || '',
                                                meta: item.meta ? this.sanitizeRouteObject(item.meta) : {}
                                            };
                                        }
                                        return item;
                                    });
                                } else {

                                    sanitized[key] = value.map(item => {
                                        if (typeof item === 'object' && item !== null) {
                                            return this.sanitizeRouteObject(item);
                                        }
                                        return item;
                                    });
                                }
                            } else if (typeof value === 'object' && value !== null) {

                                if (key === 'meta' || key === 'query' || key === 'params') {
                                    sanitized[key] = this.sanitizeRouteObject(value);
                                } else {
                                    sanitized[key] = '[Object]';
                                }
                            } else {
                                sanitized[key] = value;
                            }
                        }
                    }
                } catch (e) {
                    return '[Object - Serialization Error]';
                }

                return sanitized;
            }

            return obj;
        },


        sanitizeRouteObject(obj) {
            if (!obj || typeof obj !== 'object') {
                return obj;
            }

            const sanitized = {};

            try {
                for (const key in obj) {
                    if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                        const value = obj[key];

                        if (typeof value === 'function') {
                            sanitized[key] = '[Function]';
                        } else if (value instanceof Promise) {
                            sanitized[key] = '[Promise]';
                        } else if (typeof value === 'object' && value !== null) {

                            sanitized[key] = '[Object]';
                        } else {
                            sanitized[key] = value;
                        }
                    }
                }
            } catch (e) {
                return '[Route Object - Serialization Error]';
            }

            return sanitized;
        },


        safeClone(obj, maxDepth = 10) {
            return this._cloneWithDepth(obj, 0, maxDepth, new WeakSet());
        },


        _cloneWithDepth(obj, currentDepth, maxDepth, seen) {
            if (currentDepth > maxDepth) {
                return '[Max Depth Exceeded]';
            }

            if (obj === null || obj === undefined) {
                return obj;
            }

            if (typeof obj !== 'object') {
                return obj;
            }


            if (seen.has(obj)) {
                return '[Circular Reference]';
            }

            seen.add(obj);

            if (Array.isArray(obj)) {
                return obj.map(item => this._cloneWithDepth(item, currentDepth + 1, maxDepth, seen));
            }

            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                    cloned[key] = this._cloneWithDepth(obj[key], currentDepth + 1, maxDepth, seen);
                }
            }

            return cloned;
        }
    };


    if (typeof window !== 'undefined') {
        window.VueSerializer = Serializer;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Serializer;
    }

})();
