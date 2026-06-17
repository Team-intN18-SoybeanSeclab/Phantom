class ChunkAnalyzer {
    constructor(options = {}) {
        this.publicPath = options.publicPath || '';
        this.maxEnumeration = options.maxEnumeration || 100;
        this.baseUrl = options.baseUrl || '';
        this.debug = options.debug || false;
        this.chunks = new Map();
        this.loadedFiles = new Set();
        this.unloadedFiles = new Set();
        this.chunkPatterns = [];
        this.detectedBasePath = '';
    }


    extractChunkReferences(code, sourceUrl) {
        const references = [];

        try {
            references.push(...this._extractFromHtml(code, sourceUrl));
            references.push(...this._analyzeScriptContent(code, sourceUrl));
            references.push(...this._extractFromJs(code, sourceUrl));

            const uniqueRefs = this._deduplicateReferences(references);

            for (const ref of uniqueRefs) {
                if (ref.url && !this.chunks.has(ref.url)) {
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


    _analyzeScriptContent(content, sourceUrl) {
        const references = [];

        if (!content || content.length < 100) {
            return references;
        }

        try {

            const functionMatch = content.match(/([a-zA-Z]\.[a-zA-Z])\s*\+\s*["']([^"']+)["']/);
            let basePath = '';
            if (functionMatch) {
                basePath = functionMatch[2];
                this.detectedBasePath = basePath;
            }


            const chunkMapMatch = content.match(/return.*?\((\{\s*"[^}]+\})\s*.*?(\{\s*"[^}]+\})\[[a-zA-Z]\]\s*\+\s*"(.*?\.js)"/);
            if (chunkMapMatch) {
                let nameMap = chunkMapMatch[1];
                let hashMap = chunkMapMatch[2];
                let suffix = chunkMapMatch[3];

                const suffixToo = suffix.match(/\]\s*\+\s*"(.*?\.js)/);
                if (suffixToo) {
                    suffix = suffixToo[1];
                }

                const nameEntries = nameMap.match(/"[^"]+"\s*:\s*"[^"]+"/g) || [];
                const chunkNames = {};

                nameEntries.forEach(entry => {
                    const parts = entry.replace(/"/g, '').split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        chunkNames[parts[0]] = parts[1];
                    }
                });

                const hashEntries = hashMap.match(/"[^"]+"\s*:\s*"[^"]+"/g) || [];

                hashEntries.forEach(entry => {
                    const parts = entry.replace(/"/g, '').split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        const key = parts[0];
                        const hash = parts[1];
                        const chunkName = chunkNames[key] || key;
                        const jsPath = basePath + chunkName + '.' + hash + suffix;
                        const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                        if (fullUrl && !this.loadedFiles.has(fullUrl)) {
                            references.push(this._createReference(fullUrl, sourceUrl, 'runtime-map', 'async', key));
                        }
                    }
                });

                if (references.length > 0) return references;
            }


            const altMatch = content.match(/(\{\s*"[^}]+\})\[[a-zA-Z]\]\s*\+\s*"(.*?\.js)"/);
            if (altMatch) {
                const chunkEntries = altMatch[1].match(/"[^"]+"\s*:\s*"[^"]+"/g) || [];
                const fileSuffix = altMatch[2];

                chunkEntries.forEach(entry => {
                    const parts = entry.replace(/"/g, '').split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        const chunkName = parts[0];
                        const hash = parts[1];
                        const jsPath = basePath + chunkName + '.' + hash + fileSuffix;
                        const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                        if (fullUrl && !this.loadedFiles.has(fullUrl)) {
                            references.push(this._createReference(fullUrl, sourceUrl, 'runtime-alt', 'async', chunkName));
                        }
                    }
                });

                if (references.length > 0) return references;
            }


            const altMatch2 = content.match(/\+(\{[^}]+\})\[[a-zA-Z]\]\+"([^"]*\.js)"/);
            if (altMatch2) {
                const chunkEntries2 = altMatch2[1].match(/"?[\w]+?"?\s*:\s*"[^"]+"/g) || [];
                let fileSuffix2 = '.js';

                chunkEntries2.forEach(entry => {
                    const parts = entry.replace(/"/g, '').split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        const chunkName = parts[0];
                        const hash = parts[1];
                        const jsPath = basePath + chunkName + '.' + hash + fileSuffix2;
                        const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                        if (fullUrl && !this.loadedFiles.has(fullUrl)) {
                            references.push(this._createReference(fullUrl, sourceUrl, 'runtime-alt2', 'async', chunkName));
                        }
                    }
                });

                if (references.length > 0) return references;
            }


            const webpack5Pattern = /__webpack_require__\.u\s*=\s*function\s*\([^)]*\)\s*\{[^}]*return[^}]*(\{[^}]+\})/;
            const webpack5Match = content.match(webpack5Pattern);
            if (webpack5Match) {
                const hashMap5 = webpack5Match[1];
                const hashEntries5 = hashMap5.match(/(\d+|"[^"]+")\s*:\s*"([^"]+)"/g) || [];

                hashEntries5.forEach(entry => {
                    const match = entry.match(/(\d+|"[^"]+")\s*:\s*"([^"]+)"/);
                    if (match) {
                        const chunkId = match[1].replace(/"/g, '');
                        const hash = match[2];
                        const jsPath = basePath + chunkId + '.' + hash + '.js';
                        const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                        if (fullUrl && !this.loadedFiles.has(fullUrl)) {
                            references.push(this._createReference(fullUrl, sourceUrl, 'webpack5', 'async', chunkId));
                        }
                    }
                });
            }


            const simpleMapPattern = /\{(\s*\d+\s*:\s*"[a-f0-9]+"\s*,?\s*)+\}/g;
            let simpleMatch;
            while ((simpleMatch = simpleMapPattern.exec(content)) !== null) {
                const mapStr = simpleMatch[0];
                const itemPattern = /(\d+)\s*:\s*"([a-f0-9]+)"/g;
                let itemMatch;

                while ((itemMatch = itemPattern.exec(mapStr)) !== null) {
                    const chunkId = itemMatch[1];
                    const hash = itemMatch[2];
                    const jsPath = basePath + chunkId + '.' + hash + '.js';
                    const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                    if (fullUrl && !this.loadedFiles.has(fullUrl) && !this.chunks.has(fullUrl)) {
                        references.push(this._createReference(fullUrl, sourceUrl, 'simple-map', 'async', chunkId));
                    }
                }
            }


            const namedChunkPattern = /\{\s*"([a-zA-Z][\w-]*)"\s*:\s*"([a-f0-9]+)"/g;
            let namedMatch;
            while ((namedMatch = namedChunkPattern.exec(content)) !== null) {
                const chunkName = namedMatch[1];
                const hash = namedMatch[2];

                if (['id', 'name', 'type', 'hash', 'version', 'mode'].includes(chunkName.toLowerCase())) {
                    continue;
                }

                const jsPath = basePath + chunkName + '.' + hash + '.js';
                const fullUrl = this._buildFullUrl(jsPath, sourceUrl);

                if (fullUrl && !this.loadedFiles.has(fullUrl) && !this.chunks.has(fullUrl)) {
                    references.push(this._createReference(fullUrl, sourceUrl, 'named-chunk', 'async', chunkName));
                }
            }

        } catch (error) {
            console.warn('[ChunkAnalyzer] 分析脚本内容时出错:', error);
        }

        return references;
    }


    _buildFullUrl(path, sourceUrl) {
        try {
            if (!path) return null;

            if (path.startsWith('http://') || path.startsWith('https://')) {
                return path;
            }

            if (path.startsWith('//')) {
                const protocol = new URL(sourceUrl || this.baseUrl).protocol;
                return protocol + path;
            }

            const base = sourceUrl || this.baseUrl || window.location.origin;

            if (path.startsWith('/')) {
                return new URL(path, base).href;
            }

            if (this.publicPath) {
                return new URL(this.publicPath + path, base).href;
            }

            return new URL(path, base).href;
        } catch (error) {
            return null;
        }
    }



    _extractFromHtml(code, sourceUrl) {
        const references = [];

        const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;

        while ((match = scriptPattern.exec(code)) !== null) {
            const src = match[1];
            const fullUrl = this._buildFullUrl(src, sourceUrl);

            if (fullUrl) {
                this.loadedFiles.add(fullUrl);
            }

            if (this._isChunkFile(src)) {
                references.push(this._createReference(fullUrl || src, sourceUrl, 'html', 'initial'));
            }
        }

        const linkPattern = /<link[^>]+href=["']([^"']+\.js)["'][^>]*>/gi;
        while ((match = linkPattern.exec(code)) !== null) {
            const href = match[1];
            if (this._isChunkFile(href)) {
                const fullUrl = this._buildFullUrl(href, sourceUrl);
                references.push(this._createReference(fullUrl || href, sourceUrl, 'html', 'preload'));
            }
        }

        return references;
    }


    _extractFromJs(code, sourceUrl) {
        const references = [];

        const patterns = [
            /["']([^"']*\/?\d+\.[a-f0-9]{6,}\.js)["']/gi,
            /["']([^"']*\/?\d+\.bundle\.js)["']/gi,
            /["']([^"']*\/chunk\.[a-f0-9]+\.js)["']/gi,
            /["']([^"']*\/vendors~[^"']+\.js)["']/gi,
            /["']([^"']*\/commons~[^"']+\.js)["']/gi,
            /["']([^"']*\/[a-z]+\.[a-f0-9]+\.chunk\.js)["']/gi,
            /["']((?:static\/)?js\/\d+\.[a-f0-9]+\.js)["']/gi,
            /["']((?:assets\/)?js\/chunk-[a-f0-9]+\.js)["']/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const path = match[1];
                const fullUrl = this._buildFullUrl(path, sourceUrl);

                if (fullUrl && !this.loadedFiles.has(fullUrl) && !this.chunks.has(fullUrl)) {
                    references.push(this._createReference(fullUrl, sourceUrl, 'js-string', 'async'));
                }
            }
        }

        return references;
    }


    _createReference(url, sourceUrl, source, type, chunkId = null) {
        return {
            url: url,
            originalPath: url,
            type: type,
            chunkId: chunkId || this._extractChunkId(url),
            source: source,
            pattern: this._detectPattern(url),
            discovered: Date.now()
        };
    }


    _isChunkFile(path) {
        if (!path) return false;

        const fileName = path.split('/').pop().toLowerCase();

        const excludePatterns = [
            /^vendor\./,
            /^polyfill/,
            /^runtime/,
            /^manifest/,
            /\.min\.js$/,
            /jquery/i,
            /react\.production/,
            /vue\.runtime/
        ];

        for (const pattern of excludePatterns) {
            if (pattern.test(fileName)) {
                return false;
            }
        }

        const chunkPatterns = [
            /^\d+\.[a-f0-9]+\.js$/,
            /^\d+\.[a-f0-9]+\.chunk\.js$/,
            /^chunk\.\d+\.[a-f0-9]+\.js$/,
            /^chunk-[a-f0-9]+\.js$/,
            /^[a-z]+\.[a-f0-9]+\.chunk\.js$/,
            /^vendors~.*\.js$/,
            /^commons~.*\.js$/,
            /^\d+\.bundle\.js$/,
            /^[a-z]+-[a-f0-9]+\.js$/
        ];

        return chunkPatterns.some(pattern => pattern.test(fileName));
    }


    _extractChunkId(path) {
        if (!path) return null;

        const fileName = path.split('/').pop();

        const numMatch = fileName.match(/^(\d+)\./);
        if (numMatch) {
            return parseInt(numMatch[1], 10);
        }

        const chunkMatch = fileName.match(/^chunk[.-]([a-f0-9]+)/i);
        if (chunkMatch) {
            return chunkMatch[1];
        }

        const namedMatch = fileName.match(/^([a-z]+(?:~[a-z]+)*)\./i);
        if (namedMatch) {
            return namedMatch[1];
        }

        return null;
    }


    _detectPattern(path) {
        if (!path) return null;

        const fileName = path.split('/').pop();

        if (/^\d+\.[a-f0-9]+\.js$/.test(fileName)) {
            return '[id].[hash].js';
        }
        if (/^\d+\.[a-f0-9]+\.chunk\.js$/.test(fileName)) {
            return '[id].[hash].chunk.js';
        }
        if (/^[a-z]+\.[a-f0-9]+\.chunk\.js$/i.test(fileName)) {
            return '[name].[hash].chunk.js';
        }
        if (/^vendors~.*\.js$/.test(fileName)) {
            return 'vendors~[name].js';
        }
        if (/^chunk-[a-f0-9]+\.js$/.test(fileName)) {
            return 'chunk-[hash].js';
        }

        return null;
    }


    _deduplicateReferences(references) {
        const seen = new Set();
        return references.filter(ref => {
            if (!ref.url || seen.has(ref.url)) {
                return false;
            }
            seen.add(ref.url);
            return true;
        });
    }

    getAllChunkUrls() {
        return Array.from(this.chunks.keys());
    }

    getAllChunkReferences() {
        return Array.from(this.chunks.values());
    }

    getLoadedFiles() {
        return Array.from(this.loadedFiles);
    }

    getUnloadedFiles() {
        const unloaded = [];
        for (const url of this.chunks.keys()) {
            if (!this.loadedFiles.has(url)) {
                unloaded.push(url);
            }
        }
        return unloaded;
    }

    clear() {
        this.chunks.clear();
        this.loadedFiles.clear();
        this.unloadedFiles.clear();
        this.chunkPatterns = [];
        this.detectedBasePath = '';
    }

    setPublicPath(publicPath) {
        this.publicPath = publicPath || '';
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl || '';
    }
}


if (typeof window !== 'undefined') {
    window.ChunkAnalyzer = ChunkAnalyzer;
}
