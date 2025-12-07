/**
 * URL 工具函数
 * 用于处理 Webpack chunk 和资源 URL
 */

const WebpackUrlUtils = {
    /**
     * 解析相对路径为绝对路径
     * @param {string} relativePath - 相对路径
     * @param {string} baseUrl - 基础 URL
     * @returns {string|null} 绝对路径
     */
    resolveUrl(relativePath, baseUrl) {
        try {
            if (!relativePath) return null;
            
            // 已经是绝对路径
            if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
                return relativePath;
            }
            
            // 协议相对路径
            if (relativePath.startsWith('//')) {
                const protocol = new URL(baseUrl).protocol;
                return protocol + relativePath;
            }
            
            return new URL(relativePath, baseUrl).href;
        } catch (error) {
            console.warn('[WebpackUrlUtils] URL 解析失败:', relativePath, error);
            return null;
        }
    },

    /**
     * 从 URL 中提取文件名
     * @param {string} url - URL
     * @returns {string} 文件名
     */
    getFileName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return pathname.split('/').pop() || '';
        } catch (error) {
            return url.split('/').pop() || '';
        }
    },

    /**
     * 判断是否为 JS 文件
     * @param {string} url - URL
     * @returns {boolean}
     */
    isJsFile(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.js') || cleanUrl.endsWith('.mjs');
    },

    /**
     * 判断是否为 Source Map 文件
     * @param {string} url - URL
     * @returns {boolean}
     */
    isSourceMapFile(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.map') || cleanUrl.endsWith('.js.map');
    },

    /**
     * 判断是否为 Webpack chunk 文件
     * @param {string} url - URL
     * @returns {boolean}
     */
    isChunkFile(url) {
        if (!url) return false;
        const fileName = this.getFileName(url).toLowerCase();
        
        // 常见的 chunk 命名模式
        const chunkPatterns = [
            /^\d+\.[a-f0-9]+\.js$/,           // 0.abc123.js
            /^chunk\.\d+\.[a-f0-9]+\.js$/,    // chunk.0.abc123.js
            /^[a-z]+\.[a-f0-9]+\.chunk\.js$/, // main.abc123.chunk.js
            /^vendors~.*\.js$/,                // vendors~main.js
            /^commons~.*\.js$/,                // commons~main.js
            /^\d+\.bundle\.js$/,               // 0.bundle.js
            /^chunk-[a-f0-9]+\.js$/            // chunk-abc123.js
        ];
        
        return chunkPatterns.some(pattern => pattern.test(fileName));
    },

    /**
     * 从 chunk 文件名中提取 chunk ID
     * @param {string} url - URL
     * @returns {string|number|null} chunk ID
     */
    extractChunkId(url) {
        const fileName = this.getFileName(url);
        
        // 尝试提取数字 ID
        const numMatch = fileName.match(/^(\d+)\./);
        if (numMatch) {
            return parseInt(numMatch[1], 10);
        }
        
        // 尝试提取命名 chunk
        const namedMatch = fileName.match(/^([a-z]+(?:~[a-z]+)*)\./i);
        if (namedMatch) {
            return namedMatch[1];
        }
        
        return null;
    },

    /**
     * 生成 Source Map URL
     * @param {string} jsUrl - JS 文件 URL
     * @returns {string} Source Map URL
     */
    generateSourceMapUrl(jsUrl) {
        if (!jsUrl) return null;
        const cleanUrl = jsUrl.split('?')[0].split('#')[0];
        return cleanUrl + '.map';
    },

    /**
     * 判断两个 URL 是否同源
     * @param {string} url1 - URL 1
     * @param {string} url2 - URL 2
     * @returns {boolean}
     */
    isSameOrigin(url1, url2) {
        try {
            const origin1 = new URL(url1).origin;
            const origin2 = new URL(url2).origin;
            return origin1 === origin2;
        } catch (error) {
            return false;
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackUrlUtils = WebpackUrlUtils;
}
