class ASTExtractor {
    constructor(options = {}) {
        this.visitors = [];
        this.cache = new Map();
        this.timeout = options.timeout || 5000;
        this.enabled = options.enabled !== false;
        this.cacheMaxSize = options.cacheMaxSize || 100;
        this.contextLines = options.contextLines || 2;


        this.maxFileSize = options.maxFileSize || 1024 * 1024;
        this.skipLargeFiles = options.skipLargeFiles !== false;


        this.stats = {
            parseCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            skippedLargeFiles: 0
        };
    }


    isFileTooLarge(code) {
        if (!code || !this.skipLargeFiles) return false;
        return code.length > this.maxFileSize;
    }


    _getParser() {

        if (typeof window !== 'undefined' && window.ASTParser) {
            return window.ASTParser;
        }


        if (typeof require !== 'undefined') {
            try {
                return require('./parser');
            } catch (e) {
                console.warn(' [ASTExtractor] parser.js not found');
            }
        }

        return null;
    }


    _getHashUtils() {

        if (typeof window !== 'undefined' && window.ASTUtils) {
            return window.ASTUtils;
        }


        if (typeof require !== 'undefined') {
            try {
                return require('./utils/hash');
            } catch (e) {
                console.warn(' [ASTExtractor] hash.js not found');
            }
        }

        return null;
    }


    _getContextUtils() {

        if (typeof window !== 'undefined' && window.ASTUtils) {
            return window.ASTUtils;
        }


        if (typeof require !== 'undefined') {
            try {
                return require('./utils/context');
            } catch (e) {
                console.warn(' [ASTExtractor] context.js not found');
            }
        }

        return null;
    }


    parse(code, options = {}) {
        if (!code || typeof code !== 'string') {
            return null;
        }

        const parser = this._getParser();
        if (!parser) {
            console.error(' [ASTExtractor] Parser not available');
            return null;
        }


        const hashUtils = this._getHashUtils();
        let cacheKey = null;

        if (hashUtils && hashUtils.hashCode) {
            cacheKey = hashUtils.hashCode(code);

            if (this.cache.has(cacheKey)) {
                this.stats.cacheHits++;
                return this.cache.get(cacheKey);
            }
            this.stats.cacheMisses++;
        }


        this.stats.parseCount++;
        const result = parser.tryParse(code, options);

        if (result.error) {
            this.stats.errors++;


            return null;
        }


        if (cacheKey && result.ast) {
            this._addToCache(cacheKey, result.ast);
        }

        return result.ast;
    }


    _addToCache(key, ast) {

        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, ast);
    }


    extract(code, sourceUrl = '', options = {}) {
        const startTime = Date.now();
        const result = {
            success: false,
            parseTime: 0,
            extractTime: 0,
            detections: [],
            errors: [],
            metadata: {
                nodeCount: 0,
                visitedCount: 0,
                cacheHit: false,
                fallbackUsed: false
            }
        };

        if (!this.enabled) {
            result.errors.push(new Error('ASTExtractor is disabled'));
            return result;
        }

        if (!code || typeof code !== 'string') {
            result.errors.push(new Error('Invalid code input'));
            return result;
        }


        if (this.isFileTooLarge(code)) {
            this.stats.skippedLargeFiles++;
            result.errors.push(new Error(`File too large (${(code.length / 1024).toFixed(1)}KB > ${(this.maxFileSize / 1024).toFixed(1)}KB)`));
            result.metadata.fallbackUsed = true;
            result.metadata.skippedDueToSize = true;
            return result;
        }


        const parseStart = Date.now();
        const ast = this.parse(code);
        result.parseTime = Date.now() - parseStart;

        if (!ast) {

            result.errors.push(new Error('Failed to parse code - fallback to regex recommended'));
            result.metadata.fallbackUsed = true;
            return result;
        }


        const extractStart = Date.now();
        try {
            const context = {
                code,
                sourceUrl,
                ancestors: []
            };

            const traverseResult = this.traverse(ast, this.visitors, context);
            result.detections = traverseResult.detections;
            result.metadata.nodeCount = traverseResult.nodeCount;
            result.metadata.visitedCount = traverseResult.visitedCount;
            result.success = true;
        } catch (error) {
            result.errors.push(error);
            result.metadata.fallbackUsed = true;
        }

        result.extractTime = Date.now() - extractStart;

        return result;
    }


    async extractWithTimeout(code, sourceUrl = '', options = {}) {
        const timeout = options.timeout || this.timeout;

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve({
                    success: false,
                    parseTime: timeout,
                    extractTime: 0,
                    detections: [],
                    errors: [new Error(`Parse timeout after ${timeout}ms`)],
                    metadata: {
                        nodeCount: 0,
                        visitedCount: 0,
                        cacheHit: false,
                        fallbackUsed: true,
                        timedOut: true
                    }
                });
            }, timeout);

            try {
                const result = this.extract(code, sourceUrl, options);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                resolve({
                    success: false,
                    parseTime: 0,
                    extractTime: 0,
                    detections: [],
                    errors: [error],
                    metadata: {
                        nodeCount: 0,
                        visitedCount: 0,
                        cacheHit: false,
                        fallbackUsed: true
                    }
                });
            }
        });
    }


    safeExtract(code, sourceUrl = '', options = {}) {
        try {
            return this.extract(code, sourceUrl, options);
        } catch (error) {
            console.error(' [ASTExtractor] Unexpected error in safeExtract:', error);
            return {
                success: false,
                parseTime: 0,
                extractTime: 0,
                detections: [],
                errors: [error],
                metadata: {
                    nodeCount: 0,
                    visitedCount: 0,
                    cacheHit: false,
                    fallbackUsed: true
                }
            };
        }
    }


    registerVisitor(visitor) {
        if (!visitor || typeof visitor !== 'object') {
            console.error(' [ASTExtractor] Invalid visitor:', visitor);
            return;
        }

        if (!visitor.name || !visitor.nodeTypes || !visitor.visit) {
            console.error(' [ASTExtractor] Visitor missing required properties:', visitor);
            return;
        }


        const existingIndex = this.visitors.findIndex(v => v.name === visitor.name);
        if (existingIndex >= 0) {
            this.visitors[existingIndex] = visitor;

        } else {
            this.visitors.push(visitor);

        }
    }


    traverse(ast, visitors = this.visitors, context = {}) {
        const detections = [];
        let nodeCount = 0;
        let visitedCount = 0;

        if (!ast || !visitors || visitors.length === 0) {
            return { detections, nodeCount, visitedCount };
        }


        const visitorMap = new Map();
        for (const visitor of visitors) {
            for (const nodeType of visitor.nodeTypes) {
                if (!visitorMap.has(nodeType)) {
                    visitorMap.set(nodeType, []);
                }
                visitorMap.get(nodeType).push(visitor);
            }
        }


        const ancestors = context.ancestors || [];

        const visit = (node) => {
            if (!node || typeof node !== 'object') {
                return;
            }

            nodeCount++;


            if (node.type && visitorMap.has(node.type)) {
                visitedCount++;
                const matchedVisitors = visitorMap.get(node.type);

                for (const visitor of matchedVisitors) {
                    try {
                        const nodeContext = {
                            ...context,
                            ancestors: [...ancestors],
                            node
                        };

                        const results = visitor.visit(node, nodeContext);
                        if (Array.isArray(results)) {
                            detections.push(...results);
                        }
                    } catch (error) {
                        console.error(` [ASTExtractor] Visitor ${visitor.name} error:`, error);
                    }
                }
            }


            ancestors.push(node);

            for (const key in node) {
                if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') {
                    continue;
                }

                const child = node[key];

                if (Array.isArray(child)) {
                    for (const item of child) {
                        if (item && typeof item === 'object' && item.type) {
                            visit(item);
                        }
                    }
                } else if (child && typeof child === 'object' && child.type) {
                    visit(child);
                }
            }

            ancestors.pop();


            if (node.type && visitorMap.has(node.type)) {
                const matchedVisitors = visitorMap.get(node.type);
                for (const visitor of matchedVisitors) {
                    if (typeof visitor.leave === 'function') {
                        try {
                            visitor.leave(node, context);
                        } catch (error) {
                            console.error(` [ASTExtractor] Visitor ${visitor.name} leave error:`, error);
                        }
                    }
                }
            }
        };

        visit(ast);

        return { detections, nodeCount, visitedCount };
    }


    getVisitors() {
        return [...this.visitors];
    }


    removeVisitor(name) {
        const index = this.visitors.findIndex(v => v.name === name);
        if (index >= 0) {
            this.visitors.splice(index, 1);
            console.log(` [ASTExtractor] Removed visitor: ${name}`);
            return true;
        }
        return false;
    }


    clearCache() {
        this.cache.clear();
        console.log(' [ASTExtractor] Cache cleared');
    }


    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheMaxSize,
            hits: this.stats.cacheHits,
            misses: this.stats.cacheMisses,
            hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
                ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%'
                : '0%'
        };
    }


    getStats() {
        return {
            ...this.stats,
            visitorCount: this.visitors.length,
            cacheSize: this.cache.size
        };
    }


    resetStats() {
        this.stats = {
            parseCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
    }


    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`${enabled ? '' : ''} [ASTExtractor] ${enabled ? 'Enabled' : 'Disabled'}`);
    }


    isAvailable() {
        const parser = this._getParser();
        return parser !== null && parser.isParserAvailable && parser.isParserAvailable();
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTExtractor;
}


if (typeof window !== 'undefined') {
    window.ASTExtractor = ASTExtractor;
}
