/**
 * pathUtils.js - 路径处理工具
 * 
 * 提供路径相关的工具函数，包括：
 * - URL 清理
 * - 路径拼接
 * - 页面链接分析
 */

(function() {
    'use strict';

    const PathUtils = {
        /**
         * 清理 URL，移除多余的斜杠
         * @param {string} url - 要清理的 URL
         * @returns {string} 清理后的 URL
         */
        cleanUrl(url) {
            if (!url || typeof url !== 'string') {
                return '';
            }
            return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
        },

        /**
         * 拼接路径
         * @param {string} base - 基础路径
         * @param {string} path - 要拼接的路径
         * @returns {string} 拼接后的完整路径
         */
        joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        },

        /**
         * 规范化路径
         * @param {string} path - 要规范化的路径
         * @returns {string} 规范化后的路径
         */
        normalizePath(path) {
            if (!path || typeof path !== 'string') {
                return '/';
            }

            // 确保以 / 开头
            if (!path.startsWith('/')) {
                path = '/' + path;
            }

            // 移除末尾的 /（除非是根路径）
            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }

            // 处理 // 为 /
            path = path.replace(/\/+/g, '/');

            return path;
        },

        /**
         * 分析页面中的链接
         * @returns {Object} 分析结果
         */
        analyzePageLinks() {
            const result = {
                detectedBasePath: '',
                commonPrefixes: [],
                totalLinks: 0
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

                result.totalLinks = links.length;

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

                // 如果某个前缀占比超过 60%，认为是基础路径
                if (sortedPrefixes.length > 0 &&
                    sortedPrefixes[0].count / links.length > 0.6) {
                    result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
                }
            } catch (e) {
                console.warn('[PathUtils] Analyze page links error:', e);
            }

            return result;
        },

        /**
         * 从 URL 中提取路径部分
         * @param {string} url - 完整 URL
         * @returns {string} 路径部分
         */
        extractPath(url) {
            if (!url || typeof url !== 'string') {
                return '';
            }

            try {
                // 如果是相对路径，直接返回
                if (url.startsWith('/') && !url.startsWith('//')) {
                    return url.split('?')[0].split('#')[0];
                }

                // 尝试解析为 URL
                const parsed = new URL(url, window.location.origin);
                return parsed.pathname;
            } catch (e) {
                // 解析失败，尝试简单提取
                const match = url.match(/^(?:https?:\/\/[^\/]+)?(\/?[^?#]*)/);
                return match ? match[1] : '';
            }
        },

        /**
         * 检查路径是否匹配模式
         * @param {string} path - 要检查的路径
         * @param {string} pattern - 模式（支持 * 通配符）
         * @returns {boolean} 是否匹配
         */
        matchPath(path, pattern) {
            if (!path || !pattern) {
                return false;
            }

            // 将模式转换为正则表达式
            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // 转义特殊字符
                .replace(/\*/g, '.*')                    // * 转换为 .*
                .replace(/\/:([^/]+)/g, '/([^/]+)');     // :param 转换为捕获组

            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        },

        /**
         * 获取路径的父路径
         * @param {string} path - 路径
         * @returns {string} 父路径
         */
        getParentPath(path) {
            if (!path || path === '/') {
                return '/';
            }

            const normalized = this.normalizePath(path);
            const lastSlash = normalized.lastIndexOf('/');

            if (lastSlash <= 0) {
                return '/';
            }

            return normalized.substring(0, lastSlash);
        },

        /**
         * 获取路径的最后一段
         * @param {string} path - 路径
         * @returns {string} 最后一段
         */
        getLastSegment(path) {
            if (!path) {
                return '';
            }

            const normalized = this.normalizePath(path);
            const segments = normalized.split('/').filter(Boolean);

            return segments.length > 0 ? segments[segments.length - 1] : '';
        }
    };

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.VuePathUtils = PathUtils;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PathUtils;
    }

})();
