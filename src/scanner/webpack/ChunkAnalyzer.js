/**
 * ChunkAnalyzer - Webpack Chunk 分析器
 * 负责发现和分析 Webpack chunk 文件
 * 
 * @class ChunkAnalyzer
 */
class ChunkAnalyzer {
    constructor(options = {}) {
        this.publicPath = options.publicPath || '';
        this.maxEnumeration = options.maxEnumeration || 100;
        this.baseUrl = options.baseUrl || '';
        this.debug = options.debug || false;
        
        // 存储发现的 chunk
        this.chunks = new Map();
        
        // chunk 命名模式
        this.chunkPatterns = [];
    }

    /**
     * 从代码中提取 chunk 引用
     * @param {string} code - 代码内容
     * @param {string} sourceUrl - 源文件 URL
     * @returns {ChunkReference[]} chunk 引用列表
     */
    extractChunkReferences(code, sourceUrl) {
        const references = [];
        
        try {
            // 从 HTML script 标签提取
            references.push(...this._extractFromHtml(code, sourceUrl));
            
            // 从 JS 代码中提取
            references.push(...this._extractFromJs(code, sourceUrl));
            
            // 从 Webpack Runtime 提取
            references.push(...this._extractFromRuntime(code, sourceUrl));
            
            // 去重
            const uniqueRefs = this._deduplicateReferences(references);
            
            // 存储到 chunks Map
            for (const ref of uniqueRefs) {
                if (!this.chunks.has(ref.url)) {
                    this.chunks.set(ref.url, ref);
                }
            }
            
            if (this.debug) {
                console.log('[ChunkAnalyzer] 提取到 chunk 引用:', uniqueRefs.length);
            }
            
            return uniqueRefs;
            
        } catch (error) {
            console.error('[ChunkAnalyzer] 提取 chunk 引用失败:', error);
            return references;
        }
    }


    /**
     * 从 HTML 中提取 chunk 引用
     * @private
     */
    _extractFromHtml(code, sourceUrl) {
        const references = [];
        
        // 匹配 script 标签的 src 属性
        const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        
        while ((match = scriptPattern.exec(code)) !== null) {
            const src = match[1];
            if (this._isChunkFile(src)) {
                references.push(this._createReference(src, sourceUrl, 'html', 'initial'));
            }
        }
        
        // 匹配 link 标签的 preload/prefetch
        const linkPattern = /<link[^>]+href=["']([^"']+\.js)["'][^>]*>/gi;
        while ((match = linkPattern.exec(code)) !== null) {
            const href = match[1];
            if (this._isChunkFile(href)) {
                references.push(this._createReference(href, sourceUrl, 'html', 'preload'));
            }
        }
        
        return references;
    }

    /**
     * 从 JS 代码中提取 chunk 引用
     * @private
     */
    _extractFromJs(code, sourceUrl) {
        const references = [];
        
        // 匹配字符串中的 chunk 文件路径
        const patterns = [
            // 常见的 chunk 文件名模式
            /["']([^"']*\/?\d+\.[a-f0-9]+\.js)["']/gi,
            /["']([^"']*\/?\d+\.bundle\.js)["']/gi,
            /["']([^"']*\/chunk\.[a-f0-9]+\.js)["']/gi,
            /["']([^"']*\/vendors~[^"']+\.js)["']/gi,
            /["']([^"']*\/commons~[^"']+\.js)["']/gi,
            // Webpack 5 chunk 模式
            /["']([^"']*\/[a-z]+\.[a-f0-9]+\.chunk\.js)["']/gi
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const path = match[1];
                references.push(this._createReference(path, sourceUrl, 'js', 'async'));
            }
        }
        
        return references;
    }

    /**
     * 从 Webpack Runtime 中提取 chunk 引用
     * @private
     */
    _extractFromRuntime(code, sourceUrl) {
        const references = [];
        
        // 检测是否为 Webpack Runtime 代码
        if (!code.includes('__webpack_require__') && !code.includes('webpackJsonp')) {
            return references;
        }
        
        // 提取 chunk 映射对象
        // 模式: {0: "chunk-hash", 1: "chunk-hash2", ...}
        const chunkMapPattern = /\{(\s*\d+\s*:\s*["'][a-f0-9]+["']\s*,?\s*)+\}/g;
        let match;
        
        while ((match = chunkMapPattern.exec(code)) !== null) {
            const mapStr = match[0];
            // 解析映射
            const itemPattern = /(\d+)\s*:\s*["']([a-f0-9]+)["']/g;
            let itemMatch;
            
            while ((itemMatch = itemPattern.exec(mapStr)) !== null) {
                const chunkId = itemMatch[1];
                const hash = itemMatch[2];
                
                // 尝试构建 chunk URL
                const chunkUrl = this._buildChunkUrl(chunkId, hash);
                if (chunkUrl) {
                    references.push(this._createReference(chunkUrl, sourceUrl, 'runtime', 'async', chunkId));
                }
            }
        }
        
        // 提取 chunkFilename 模式
        const filenamePattern = /chunkFilename:\s*["']([^"']+)["']/;
        const filenameMatch = code.match(filenamePattern);
        if (filenameMatch) {
            this.chunkPatterns.push(filenameMatch[1]);
        }
        
        return references;
    }

    /**
     * 创建 chunk 引用对象
     * @private
     */
    _createReference(path, sourceUrl, source, type, chunkId = null) {
        const url = this._resolveUrl(path, sourceUrl);
        
        return {
            url: url,
            originalPath: path,
            type: type,
            chunkId: chunkId || this._extractChunkId(path),
            source: source,
            pattern: this._detectPattern(path),
            discovered: Date.now()
        };
    }

    /**
     * 解析 URL
     * @private
     */
    _resolveUrl(path, baseUrl) {
        try {
            if (!path) return null;
            
            // 已经是绝对路径
            if (path.startsWith('http://') || path.startsWith('https://')) {
                return path;
            }
            
            // 协议相对路径
            if (path.startsWith('//')) {
                const protocol = new URL(baseUrl || this.baseUrl).protocol;
                return protocol + path;
            }
            
            // 使用 publicPath
            if (this.publicPath && !path.startsWith('/')) {
                return new URL(this.publicPath + path, baseUrl || this.baseUrl).href;
            }
            
            return new URL(path, baseUrl || this.baseUrl).href;
        } catch (error) {
            return path;
        }
    }

    /**
     * 判断是否为 chunk 文件
     * @private
     */
    _isChunkFile(path) {
        if (!path) return false;
        
        const fileName = path.split('/').pop().toLowerCase();
        
        // 排除明显的非 chunk 文件
        if (fileName.includes('vendor') && !fileName.includes('vendors~')) {
            return false;
        }
        
        // chunk 文件特征
        const chunkPatterns = [
            /^\d+\.[a-f0-9]+\.js$/,
            /^chunk\.\d+\.[a-f0-9]+\.js$/,
            /^[a-z]+\.[a-f0-9]+\.chunk\.js$/,
            /^vendors~.*\.js$/,
            /^commons~.*\.js$/,
            /^\d+\.bundle\.js$/,
            /^chunk-[a-f0-9]+\.js$/
        ];
        
        return chunkPatterns.some(pattern => pattern.test(fileName));
    }

    /**
     * 提取 chunk ID
     * @private
     */
    _extractChunkId(path) {
        const fileName = path.split('/').pop();
        
        // 数字 ID
        const numMatch = fileName.match(/^(\d+)\./);
        if (numMatch) {
            return parseInt(numMatch[1], 10);
        }
        
        // 命名 chunk
        const namedMatch = fileName.match(/^([a-z]+(?:~[a-z]+)*)\./i);
        if (namedMatch) {
            return namedMatch[1];
        }
        
        return null;
    }

    /**
     * 检测命名模式
     * @private
     */
    _detectPattern(path) {
        const fileName = path.split('/').pop();
        
        if (/^\d+\.[a-f0-9]+\.js$/.test(fileName)) {
            return '[id].[hash].js';
        }
        if (/^[a-z]+\.[a-f0-9]+\.chunk\.js$/i.test(fileName)) {
            return '[name].[hash].chunk.js';
        }
        if (/^vendors~.*\.js$/.test(fileName)) {
            return 'vendors~[name].js';
        }
        
        return null;
    }

    /**
     * 构建 chunk URL
     * @private
     */
    _buildChunkUrl(chunkId, hash) {
        // 使用检测到的模式或默认模式
        const pattern = this.chunkPatterns[0] || '[id].[hash].js';
        
        let url = pattern
            .replace('[id]', chunkId)
            .replace('[chunkhash]', hash)
            .replace('[hash]', hash)
            .replace('[contenthash]', hash);
        
        return this.publicPath + url;
    }

    /**
     * 去重引用
     * @private
     */
    _deduplicateReferences(references) {
        const seen = new Set();
        return references.filter(ref => {
            if (seen.has(ref.url)) {
                return false;
            }
            seen.add(ref.url);
            return true;
        });
    }


    /**
     * 枚举可能的 chunk 文件
     * @param {string} pattern - 命名模式
     * @param {Object} range - 枚举范围 {start, end}
     * @returns {string[]} 可能的 chunk URL 列表
     */
    enumerateChunks(pattern, range = { start: 0, end: 20 }) {
        const urls = [];
        
        try {
            const { start, end } = range;
            const limit = Math.min(end - start, this.maxEnumeration);
            
            for (let i = start; i < start + limit; i++) {
                // 替换模式中的占位符
                let url = pattern
                    .replace('[id]', i.toString())
                    .replace('[name]', i.toString());
                
                // 如果模式包含 hash，使用通配符或跳过
                if (url.includes('[hash]') || url.includes('[chunkhash]')) {
                    // 无法枚举带 hash 的文件
                    continue;
                }
                
                urls.push(this._resolveUrl(url, this.baseUrl));
            }
            
            if (this.debug) {
                console.log('[ChunkAnalyzer] 枚举 chunk:', urls.length);
            }
            
        } catch (error) {
            console.error('[ChunkAnalyzer] 枚举 chunk 失败:', error);
        }
        
        return urls;
    }

    /**
     * 分析动态导入
     * @param {Object} ast - AST 对象
     * @returns {DynamicImport[]} 动态导入列表
     */
    analyzeDynamicImports(ast) {
        const imports = [];
        
        try {
            // 简单的 AST 遍历查找 import() 调用
            this._walkAst(ast, (node) => {
                // import() 表达式
                if (node.type === 'ImportExpression' || 
                    (node.type === 'CallExpression' && node.callee && node.callee.type === 'Import')) {
                    const source = node.source;
                    if (source && source.type === 'Literal' && source.value) {
                        imports.push({
                            path: source.value,
                            type: 'dynamic',
                            location: node.loc
                        });
                    }
                }
                
                // __webpack_require__.e() 调用
                if (node.type === 'CallExpression' && 
                    node.callee && 
                    node.callee.type === 'MemberExpression') {
                    const callee = node.callee;
                    if (callee.object && 
                        callee.object.name === '__webpack_require__' && 
                        callee.property && 
                        callee.property.name === 'e') {
                        const arg = node.arguments[0];
                        if (arg) {
                            imports.push({
                                chunkId: arg.value || arg.name,
                                type: 'webpack_require_e',
                                location: node.loc
                            });
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('[ChunkAnalyzer] 分析动态导入失败:', error);
        }
        
        return imports;
    }

    /**
     * 简单的 AST 遍历
     * @private
     */
    _walkAst(node, callback) {
        if (!node || typeof node !== 'object') return;
        
        callback(node);
        
        for (const key of Object.keys(node)) {
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child) {
                    this._walkAst(item, callback);
                }
            } else if (child && typeof child === 'object') {
                this._walkAst(child, callback);
            }
        }
    }

    /**
     * 获取所有 chunk URL
     * @returns {string[]} chunk URL 列表
     */
    getAllChunkUrls() {
        return Array.from(this.chunks.keys());
    }

    /**
     * 获取所有 chunk 引用
     * @returns {ChunkReference[]} chunk 引用列表
     */
    getAllChunkReferences() {
        return Array.from(this.chunks.values());
    }

    /**
     * 清空缓存
     */
    clear() {
        this.chunks.clear();
        this.chunkPatterns = [];
    }

    /**
     * 设置 publicPath
     * @param {string} publicPath - publicPath 值
     */
    setPublicPath(publicPath) {
        this.publicPath = publicPath || '';
    }

    /**
     * 设置基础 URL
     * @param {string} baseUrl - 基础 URL
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl || '';
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.ChunkAnalyzer = ChunkAnalyzer;
}
