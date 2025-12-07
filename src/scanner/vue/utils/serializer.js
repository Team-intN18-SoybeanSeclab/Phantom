/**
 * serializer.js - 安全序列化工具
 * 
 * 提供安全的对象序列化功能，处理循环引用和特殊对象类型
 * 用于将 Vue 检测结果安全地通过 postMessage 传递
 */

(function() {
    'use strict';

    const Serializer = {
        /**
         * 安全序列化对象用于 postMessage
         * @param {*} obj - 要序列化的对象
         * @returns {*} 序列化后的对象
         */
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
                // 检查是否为特殊对象类型
                if (obj.constructor && obj.constructor.name &&
                    !['Object', 'Array'].includes(obj.constructor.name)) {
                    return `[${obj.constructor.name}]`;
                }

                const sanitized = Array.isArray(obj) ? [] : {};

                try {
                    for (const key in obj) {
                        if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                            const value = obj[key];

                            // 特殊处理 allRoutes 数组
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

                            // 跳过可能导致循环引用的属性
                            if (key.startsWith('_') || key.startsWith('$') ||
                                key === 'parent' || key === 'router' || key === 'matched') {
                                continue;
                            }

                            if (typeof value === 'function') {
                                sanitized[key] = '[Function]';
                            } else if (value instanceof Promise) {
                                sanitized[key] = '[Promise]';
                            } else if (Array.isArray(value)) {
                                // 处理数组
                                if (value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].path !== undefined) {
                                    // 路由数组
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
                                    // 普通数组
                                    sanitized[key] = value.map(item => {
                                        if (typeof item === 'object' && item !== null) {
                                            return this.sanitizeRouteObject(item);
                                        }
                                        return item;
                                    });
                                }
                            } else if (typeof value === 'object' && value !== null) {
                                // 简单对象递归处理
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

        /**
         * 专门处理路由对象的序列化
         * @param {Object} obj - 路由对象
         * @returns {Object} 序列化后的对象
         */
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
                            // 避免深度递归
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

        /**
         * 深度克隆对象（安全版本）
         * @param {*} obj - 要克隆的对象
         * @param {number} maxDepth - 最大深度
         * @returns {*} 克隆后的对象
         */
        safeClone(obj, maxDepth = 10) {
            return this._cloneWithDepth(obj, 0, maxDepth, new WeakSet());
        },

        /**
         * 带深度限制的克隆
         * @private
         */
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

            // 检测循环引用
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

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.VueSerializer = Serializer;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Serializer;
    }

})();
