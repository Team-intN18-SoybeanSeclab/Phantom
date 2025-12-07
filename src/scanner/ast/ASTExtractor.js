/**
 * AST 敏感信息提取器
 * 使用 AST 解析 JavaScript 代码来识别和提取敏感信息
 * 
 * @requires acorn - JavaScript 解析库
 * @requires parser.js - 解析器包装器
 * @requires utils/hash.js - 哈希工具
 * @requires utils/context.js - 上下文工具
 */
class ASTExtractor {
    constructor(options = {}) {
        this.visitors = [];           // 节点访问器列表
        this.cache = new Map();       // AST 缓存
        this.timeout = options.timeout || 5000;
        this.enabled = options.enabled !== false;
        this.cacheMaxSize = options.cacheMaxSize || 100;
        this.contextLines = options.contextLines || 2;
        
        // 大文件处理配置
        this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB
        this.skipLargeFiles = options.skipLargeFiles !== false;
        
        // 统计信息
        this.stats = {
            parseCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            skippedLargeFiles: 0
        };
    }
    
    /**
     * 检查文件大小是否超过限制
     * @param {string} code - 代码内容
     * @returns {boolean} 是否超过限制
     */
    isFileTooLarge(code) {
        if (!code || !this.skipLargeFiles) return false;
        return code.length > this.maxFileSize;
    }
    
    /**
     * 获取解析器
     * @private
     * @returns {Object|null} 解析器对象
     */
    _getParser() {
        // 浏览器环境
        if (typeof window !== 'undefined' && window.ASTParser) {
            return window.ASTParser;
        }
        
        // Node.js 环境
        if (typeof require !== 'undefined') {
            try {
                return require('./parser');
            } catch (e) {
                console.warn('⚠️ [ASTExtractor] parser.js not found');
            }
        }
        
        return null;
    }
    
    /**
     * 获取哈希工具
     * @private
     * @returns {Object|null} 哈希工具对象
     */
    _getHashUtils() {
        // 浏览器环境
        if (typeof window !== 'undefined' && window.ASTUtils) {
            return window.ASTUtils;
        }
        
        // Node.js 环境
        if (typeof require !== 'undefined') {
            try {
                return require('./utils/hash');
            } catch (e) {
                console.warn('⚠️ [ASTExtractor] hash.js not found');
            }
        }
        
        return null;
    }
    
    /**
     * 获取上下文工具
     * @private
     * @returns {Object|null} 上下文工具对象
     */
    _getContextUtils() {
        // 浏览器环境
        if (typeof window !== 'undefined' && window.ASTUtils) {
            return window.ASTUtils;
        }
        
        // Node.js 环境
        if (typeof require !== 'undefined') {
            try {
                return require('./utils/context');
            } catch (e) {
                console.warn('⚠️ [ASTExtractor] context.js not found');
            }
        }
        
        return null;
    }
    
    /**
     * 解析 JavaScript 代码为 AST
     * @param {string} code - JavaScript 源代码
     * @param {Object} options - 解析选项
     * @returns {Object|null} AST 对象或 null（解析失败时）
     */
    parse(code, options = {}) {
        if (!code || typeof code !== 'string') {
            return null;
        }
        
        const parser = this._getParser();
        if (!parser) {
            console.error('❌ [ASTExtractor] Parser not available');
            return null;
        }
        
        // 检查缓存
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
        
        // 解析代码
        this.stats.parseCount++;
        const result = parser.tryParse(code, options);
        
        if (result.error) {
            this.stats.errors++;
            // 静默处理解析错误，不输出警告（非 JS 内容解析失败是正常的）
            // console.warn('⚠️ [ASTExtractor] Parse error:', result.error.message);
            return null;
        }
        
        // 缓存结果
        if (cacheKey && result.ast) {
            this._addToCache(cacheKey, result.ast);
        }
        
        return result.ast;
    }
    
    /**
     * 添加到缓存（带 LRU 策略）
     * @private
     * @param {string} key - 缓存键
     * @param {Object} ast - AST 对象
     */
    _addToCache(key, ast) {
        // 如果缓存已满，删除最旧的条目
        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, ast);
    }
    
    /**
     * 提取敏感信息
     * @param {string} code - JavaScript 源代码
     * @param {string} sourceUrl - 源文件 URL
     * @param {Object} options - 提取选项
     * @returns {Object} 提取结果
     */
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
        
        // 检查文件大小
        if (this.isFileTooLarge(code)) {
            this.stats.skippedLargeFiles++;
            result.errors.push(new Error(`File too large (${(code.length / 1024).toFixed(1)}KB > ${(this.maxFileSize / 1024).toFixed(1)}KB)`));
            result.metadata.fallbackUsed = true;
            result.metadata.skippedDueToSize = true;
            return result;
        }
        
        // 解析代码
        const parseStart = Date.now();
        const ast = this.parse(code);
        result.parseTime = Date.now() - parseStart;
        
        if (!ast) {
            // 解析失败，标记需要回退
            result.errors.push(new Error('Failed to parse code - fallback to regex recommended'));
            result.metadata.fallbackUsed = true;
            return result;
        }
        
        // 遍历 AST 并提取信息
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
    
    /**
     * 带超时的提取（异步）
     * @param {string} code - JavaScript 源代码
     * @param {string} sourceUrl - 源文件 URL
     * @param {Object} options - 提取选项
     * @returns {Promise<Object>} 提取结果
     */
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
    
    /**
     * 安全提取 - 捕获所有异常，永不抛出
     * @param {string} code - JavaScript 源代码
     * @param {string} sourceUrl - 源文件 URL
     * @param {Object} options - 提取选项
     * @returns {Object} 提取结果
     */
    safeExtract(code, sourceUrl = '', options = {}) {
        try {
            return this.extract(code, sourceUrl, options);
        } catch (error) {
            console.error('❌ [ASTExtractor] Unexpected error in safeExtract:', error);
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
    
    /**
     * 注册节点访问器
     * @param {Object} visitor - 访问器对象
     */
    registerVisitor(visitor) {
        if (!visitor || typeof visitor !== 'object') {
            console.error('❌ [ASTExtractor] Invalid visitor:', visitor);
            return;
        }
        
        if (!visitor.name || !visitor.nodeTypes || !visitor.visit) {
            console.error('❌ [ASTExtractor] Visitor missing required properties:', visitor);
            return;
        }
        
        // 检查是否已注册同名访问器
        const existingIndex = this.visitors.findIndex(v => v.name === visitor.name);
        if (existingIndex >= 0) {
            this.visitors[existingIndex] = visitor;
            // console.log(`🔄 [ASTExtractor] Updated visitor: ${visitor.name}`);
        } else {
            this.visitors.push(visitor);
            // console.log(`✅ [ASTExtractor] Registered visitor: ${visitor.name}`);
        }
    }
    
    /**
     * 遍历 AST
     * @param {Object} ast - AST 对象
     * @param {Array} visitors - 访问器列表
     * @param {Object} context - 上下文信息
     * @returns {Object} 遍历结果 { detections, nodeCount, visitedCount }
     */
    traverse(ast, visitors = this.visitors, context = {}) {
        const detections = [];
        let nodeCount = 0;
        let visitedCount = 0;
        
        if (!ast || !visitors || visitors.length === 0) {
            return { detections, nodeCount, visitedCount };
        }
        
        // 构建节点类型到访问器的映射
        const visitorMap = new Map();
        for (const visitor of visitors) {
            for (const nodeType of visitor.nodeTypes) {
                if (!visitorMap.has(nodeType)) {
                    visitorMap.set(nodeType, []);
                }
                visitorMap.get(nodeType).push(visitor);
            }
        }
        
        // 深度优先遍历
        const ancestors = context.ancestors || [];
        
        const visit = (node) => {
            if (!node || typeof node !== 'object') {
                return;
            }
            
            nodeCount++;
            
            // 检查是否有匹配的访问器
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
                        console.error(`❌ [ASTExtractor] Visitor ${visitor.name} error:`, error);
                    }
                }
            }
            
            // 递归遍历子节点
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
            
            // 调用 leave 方法
            if (node.type && visitorMap.has(node.type)) {
                const matchedVisitors = visitorMap.get(node.type);
                for (const visitor of matchedVisitors) {
                    if (typeof visitor.leave === 'function') {
                        try {
                            visitor.leave(node, context);
                        } catch (error) {
                            console.error(`❌ [ASTExtractor] Visitor ${visitor.name} leave error:`, error);
                        }
                    }
                }
            }
        };
        
        visit(ast);
        
        return { detections, nodeCount, visitedCount };
    }
    
    /**
     * 获取已注册的访问器列表
     * @returns {Array} 访问器列表
     */
    getVisitors() {
        return [...this.visitors];
    }
    
    /**
     * 移除访问器
     * @param {string} name - 访问器名称
     * @returns {boolean} 是否成功移除
     */
    removeVisitor(name) {
        const index = this.visitors.findIndex(v => v.name === name);
        if (index >= 0) {
            this.visitors.splice(index, 1);
            console.log(`🗑️ [ASTExtractor] Removed visitor: ${name}`);
            return true;
        }
        return false;
    }
    
    /**
     * 清除 AST 缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ [ASTExtractor] Cache cleared');
    }
    
    /**
     * 获取缓存统计信息
     * @returns {Object} 缓存统计
     */
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
    
    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            visitorCount: this.visitors.length,
            cacheSize: this.cache.size
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            parseCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
    }
    
    /**
     * 启用/禁用提取器
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`${enabled ? '✅' : '❌'} [ASTExtractor] ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * 检查提取器是否可用
     * @returns {boolean} 是否可用
     */
    isAvailable() {
        const parser = this._getParser();
        return parser !== null && parser.isParserAvailable && parser.isParserAvailable();
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTExtractor;
}

// 浏览器环境下挂载到 window
if (typeof window !== 'undefined') {
    window.ASTExtractor = ASTExtractor;
}
