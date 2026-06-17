(function() {
    'use strict';

    const PathUtils = {

        cleanUrl(url) {
            if (!url || typeof url !== 'string') {
                return '';
            }
            return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
        },


        joinPath(base, path) {
            if (!path) return base || '/';
            if (path.startsWith('/')) return path;
            if (!base || base === '/') return '/' + path;
            return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
        },


        normalizePath(path) {
            if (!path || typeof path !== 'string') {
                return '/';
            }


            if (!path.startsWith('/')) {
                path = '/' + path;
            }


            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }


            path = path.replace(/\/+/g, '/');

            return path;
        },


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


                if (sortedPrefixes.length > 0 &&
                    sortedPrefixes[0].count / links.length > 0.6) {
                    result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
                }
            } catch (e) {
                console.warn('[PathUtils] Analyze page links error:', e);
            }

            return result;
        },


        extractPath(url) {
            if (!url || typeof url !== 'string') {
                return '';
            }

            try {

                if (url.startsWith('/') && !url.startsWith('//')) {
                    return url.split('?')[0].split('#')[0];
                }


                const parsed = new URL(url, window.location.origin);
                return parsed.pathname;
            } catch (e) {

                const match = url.match(/^(?:https?:\/\/[^\/]+)?(\/?[^?#]*)/);
                return match ? match[1] : '';
            }
        },


        matchPath(path, pattern) {
            if (!path || !pattern) {
                return false;
            }


            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\/:([^/]+)/g, '/([^/]+)');

            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        },


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


        getLastSegment(path) {
            if (!path) {
                return '';
            }

            const normalized = this.normalizePath(path);
            const segments = normalized.split('/').filter(Boolean);

            return segments.length > 0 ? segments[segments.length - 1] : '';
        }
    };


    if (typeof window !== 'undefined') {
        window.VuePathUtils = PathUtils;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PathUtils;
    }

})();
