/**
 * SourceMapParser - Source Map 解析器
 * 负责解析 Source Map 文件并提取原始源代码
 * 
 * @class SourceMapParser
 */
class SourceMapParser {
    constructor(options = {}) {
        this.cache = new Map();
        this.debug = options.debug || false;
        this.maxCacheSize = options.maxCacheSize || 50;
    }

    /**
     * 从 JS 代码中提取 Source Map URL
     * @param {string} code - JS 代码内容
     * @returns {string|null} Source Map URL
     */
    extractSourceMapUrl(code) {
        if (!code) return null;
        
        try {
            // 匹配 //# sourceMappingURL=xxx
            const singleLinePattern = /\/\/[#@]\s*sourceMappingURL=([^\s]+)/;
            let match = code.match(singleLinePattern);
            if (match && match[1]) {
                return match[1];
            }
            
            // 匹配 /*# sourceMappingURL=xxx */
            const multiLinePattern = /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//;
            match = code.match(multiLinePattern);
            if (match && match[1]) {
                return match[1];
            }
            
            return null;
        } catch (error) {
            console.error('[SourceMapParser] 提取 Source Map URL 失败:', error);
            return null;
        }
    }

    /**
     * 判断是否为内联 Source Map
     * @param {string} url - Source Map URL
     * @returns {boolean}
     */
    isInlineSourceMap(url) {
        return url && url.startsWith('data:');
    }


    /**
     * 解析内联 Source Map
     * @param {string} dataUrl - data: URL
     * @returns {SourceMapData|null} 解析后的 Source Map 数据
     */
    parseInlineSourceMap(dataUrl) {
        try {
            // 格式: data:application/json;base64,xxx
            // 或: data:application/json;charset=utf-8,xxx
            const match = dataUrl.match(/^data:([^;,]+)(;[^,]+)?,(.+)$/);
            if (!match) return null;
            
            const encoding = match[2] || '';
            const data = match[3];
            
            let jsonStr;
            if (encoding.includes('base64')) {
                // Base64 解码
                jsonStr = atob(data);
            } else {
                // URL 解码
                jsonStr = decodeURIComponent(data);
            }
            
            return this.parseSourceMap(jsonStr);
        } catch (error) {
            console.error('[SourceMapParser] 解析内联 Source Map 失败:', error);
            return null;
        }
    }

    /**
     * 解析 Source Map 文件内容
     * @param {string} sourceMapContent - Source Map JSON 字符串
     * @returns {SourceMapData|null} 解析后的 Source Map 数据
     */
    parseSourceMap(sourceMapContent) {
        try {
            const sourceMap = typeof sourceMapContent === 'string' 
                ? JSON.parse(sourceMapContent) 
                : sourceMapContent;
            
            // 验证 Source Map 格式
            if (!sourceMap || sourceMap.version !== 3) {
                console.warn('[SourceMapParser] 不支持的 Source Map 版本');
                return null;
            }
            
            const result = {
                version: sourceMap.version,
                file: sourceMap.file || '',
                sourceRoot: sourceMap.sourceRoot || '',
                sources: sourceMap.sources || [],
                sourcesContent: sourceMap.sourcesContent || [],
                names: sourceMap.names || [],
                mappings: sourceMap.mappings || '',
                // 额外信息
                sourceCount: (sourceMap.sources || []).length,
                hasSourcesContent: !!(sourceMap.sourcesContent && sourceMap.sourcesContent.length > 0)
            };
            
            if (this.debug) {
                console.log('[SourceMapParser] 解析成功，源文件数:', result.sourceCount);
            }
            
            return result;
        } catch (error) {
            console.error('[SourceMapParser] 解析 Source Map 失败:', error);
            return null;
        }
    }

    /**
     * 提取原始源文件列表
     * @param {SourceMapData} sourceMap - 解析后的 Source Map 数据
     * @returns {SourceFile[]} 源文件列表
     */
    extractSourceFiles(sourceMap) {
        if (!sourceMap || !sourceMap.sources) {
            return [];
        }
        
        const files = [];
        const sourceRoot = sourceMap.sourceRoot || '';
        
        for (let i = 0; i < sourceMap.sources.length; i++) {
            const sourcePath = sourceMap.sources[i];
            const content = sourceMap.sourcesContent ? sourceMap.sourcesContent[i] : null;
            
            files.push({
                index: i,
                path: sourcePath,
                fullPath: this._resolvePath(sourceRoot, sourcePath),
                hasContent: content !== null && content !== undefined,
                content: content,
                size: content ? content.length : 0
            });
        }
        
        return files;
    }

    /**
     * 获取指定文件的原始代码
     * @param {SourceMapData} sourceMap - 解析后的 Source Map 数据
     * @param {string} fileName - 文件名
     * @returns {string|null} 原始代码
     */
    getOriginalSource(sourceMap, fileName) {
        if (!sourceMap || !sourceMap.sources || !sourceMap.sourcesContent) {
            return null;
        }
        
        // 查找文件索引
        const index = sourceMap.sources.findIndex(source => {
            return source === fileName || 
                   source.endsWith('/' + fileName) ||
                   source.includes(fileName);
        });
        
        if (index === -1) {
            return null;
        }
        
        return sourceMap.sourcesContent[index] || null;
    }

    /**
     * 解析路径
     * @private
     */
    _resolvePath(sourceRoot, sourcePath) {
        if (!sourcePath) return '';
        
        // 已经是绝对路径
        if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
            return sourcePath;
        }
        
        // webpack:// 协议
        if (sourcePath.startsWith('webpack://')) {
            return sourcePath;
        }
        
        // 拼接 sourceRoot
        if (sourceRoot) {
            if (sourceRoot.endsWith('/')) {
                return sourceRoot + sourcePath;
            }
            return sourceRoot + '/' + sourcePath;
        }
        
        return sourcePath;
    }


    /**
     * 缓存 Source Map
     * @param {string} url - Source Map URL
     * @param {SourceMapData} data - 解析后的数据
     */
    cacheSourceMap(url, data) {
        // 限制缓存大小
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(url, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * 从缓存获取 Source Map
     * @param {string} url - Source Map URL
     * @returns {SourceMapData|null}
     */
    getCachedSourceMap(url) {
        const cached = this.cache.get(url);
        return cached ? cached.data : null;
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 过滤敏感源文件
     * @param {SourceFile[]} files - 源文件列表
     * @returns {SourceFile[]} 可能包含敏感信息的文件
     */
    filterSensitiveFiles(files) {
        const sensitivePatterns = [
            /config/i,
            /env/i,
            /secret/i,
            /key/i,
            /api/i,
            /auth/i,
            /credential/i,
            /password/i,
            /token/i,
            /\.env/i
        ];
        
        return files.filter(file => {
            const path = file.path || '';
            return sensitivePatterns.some(pattern => pattern.test(path));
        });
    }

    /**
     * 获取源文件统计信息
     * @param {SourceMapData} sourceMap - Source Map 数据
     * @returns {Object} 统计信息
     */
    getStatistics(sourceMap) {
        if (!sourceMap) {
            return { totalFiles: 0, totalSize: 0, fileTypes: {} };
        }
        
        const files = this.extractSourceFiles(sourceMap);
        const fileTypes = {};
        let totalSize = 0;
        
        for (const file of files) {
            totalSize += file.size || 0;
            
            // 统计文件类型
            const ext = this._getExtension(file.path);
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
        
        return {
            totalFiles: files.length,
            totalSize: totalSize,
            fileTypes: fileTypes,
            hasSourcesContent: sourceMap.hasSourcesContent
        };
    }

    /**
     * 获取文件扩展名
     * @private
     */
    _getExtension(path) {
        if (!path) return 'unknown';
        const match = path.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    /**
     * 解析 Source Map URL 为绝对路径
     * @param {string} sourceMapUrl - Source Map URL
     * @param {string} jsFileUrl - JS 文件 URL
     * @returns {string} 绝对路径
     */
    resolveSourceMapUrl(sourceMapUrl, jsFileUrl) {
        if (!sourceMapUrl) return null;
        
        // 内联 Source Map
        if (this.isInlineSourceMap(sourceMapUrl)) {
            return sourceMapUrl;
        }
        
        // 已经是绝对路径
        if (sourceMapUrl.startsWith('http://') || sourceMapUrl.startsWith('https://')) {
            return sourceMapUrl;
        }
        
        // 相对路径，基于 JS 文件 URL 解析
        try {
            return new URL(sourceMapUrl, jsFileUrl).href;
        } catch (error) {
            return sourceMapUrl;
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.SourceMapParser = SourceMapParser;
}
