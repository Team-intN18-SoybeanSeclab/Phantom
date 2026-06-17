class SourceMapParser {
    constructor(options = {}) {
        this.cache = new Map();
        this.debug = options.debug || false;
        this.maxCacheSize = options.maxCacheSize || 50;
    }


    extractSourceMapUrl(code) {
        if (!code) return null;

        try {

            const singleLinePattern = /\/\/[#@]\s*sourceMappingURL=([^\s]+)/;
            let match = code.match(singleLinePattern);
            if (match && match[1]) {
                return match[1];
            }


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


    isInlineSourceMap(url) {
        return url && url.startsWith('data:');
    }



    parseInlineSourceMap(dataUrl) {
        try {


            const match = dataUrl.match(/^data:([^;,]+)(;[^,]+)?,(.+)$/);
            if (!match) return null;

            const encoding = match[2] || '';
            const data = match[3];

            let jsonStr;
            if (encoding.includes('base64')) {

                jsonStr = atob(data);
            } else {

                jsonStr = decodeURIComponent(data);
            }

            return this.parseSourceMap(jsonStr);
        } catch (error) {
            console.error('[SourceMapParser] 解析内联 Source Map 失败:', error);
            return null;
        }
    }


    parseSourceMap(sourceMapContent) {
        try {
            const sourceMap = typeof sourceMapContent === 'string'
                ? JSON.parse(sourceMapContent)
                : sourceMapContent;


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


    getOriginalSource(sourceMap, fileName) {
        if (!sourceMap || !sourceMap.sources || !sourceMap.sourcesContent) {
            return null;
        }


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


    _resolvePath(sourceRoot, sourcePath) {
        if (!sourcePath) return '';


        if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
            return sourcePath;
        }


        if (sourcePath.startsWith('webpack://')) {
            return sourcePath;
        }


        if (sourceRoot) {
            if (sourceRoot.endsWith('/')) {
                return sourceRoot + sourcePath;
            }
            return sourceRoot + '/' + sourcePath;
        }

        return sourcePath;
    }



    cacheSourceMap(url, data) {

        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(url, {
            data: data,
            timestamp: Date.now()
        });
    }


    getCachedSourceMap(url) {
        const cached = this.cache.get(url);
        return cached ? cached.data : null;
    }


    clearCache() {
        this.cache.clear();
    }


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


    getStatistics(sourceMap) {
        if (!sourceMap) {
            return { totalFiles: 0, totalSize: 0, fileTypes: {} };
        }

        const files = this.extractSourceFiles(sourceMap);
        const fileTypes = {};
        let totalSize = 0;

        for (const file of files) {
            totalSize += file.size || 0;


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


    _getExtension(path) {
        if (!path) return 'unknown';
        const match = path.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : 'unknown';
    }


    resolveSourceMapUrl(sourceMapUrl, jsFileUrl) {
        if (!sourceMapUrl) return null;


        if (this.isInlineSourceMap(sourceMapUrl)) {
            return sourceMapUrl;
        }


        if (sourceMapUrl.startsWith('http://') || sourceMapUrl.startsWith('https://')) {
            return sourceMapUrl;
        }


        try {
            return new URL(sourceMapUrl, jsFileUrl).href;
        } catch (error) {
            return sourceMapUrl;
        }
    }
}


if (typeof window !== 'undefined') {
    window.SourceMapParser = SourceMapParser;
}
