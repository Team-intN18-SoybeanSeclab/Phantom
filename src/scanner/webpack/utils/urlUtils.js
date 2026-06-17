const WebpackUrlUtils = {

    resolveUrl(relativePath, baseUrl) {
        try {
            if (!relativePath) return null;


            if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
                return relativePath;
            }


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


    getFileName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return pathname.split('/').pop() || '';
        } catch (error) {
            return url.split('/').pop() || '';
        }
    },


    isJsFile(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.js') || cleanUrl.endsWith('.mjs');
    },


    isSourceMapFile(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.map') || cleanUrl.endsWith('.js.map');
    },


    isChunkFile(url) {
        if (!url) return false;
        const fileName = this.getFileName(url).toLowerCase();


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
    },


    extractChunkId(url) {
        const fileName = this.getFileName(url);


        const numMatch = fileName.match(/^(\d+)\./);
        if (numMatch) {
            return parseInt(numMatch[1], 10);
        }


        const namedMatch = fileName.match(/^([a-z]+(?:~[a-z]+)*)\./i);
        if (namedMatch) {
            return namedMatch[1];
        }

        return null;
    },


    generateSourceMapUrl(jsUrl) {
        if (!jsUrl) return null;
        const cleanUrl = jsUrl.split('?')[0].split('#')[0];
        return cleanUrl + '.map';
    },


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


if (typeof window !== 'undefined') {
    window.WebpackUrlUtils = WebpackUrlUtils;
}
