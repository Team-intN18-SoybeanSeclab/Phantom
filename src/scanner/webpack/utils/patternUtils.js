const WebpackPatternUtils = {

    patterns: {

        publicPath: [
            /__webpack_require__\.p\s*=\s*["']([^"']+)["']/,
            /publicPath:\s*["']([^"']+)["']/,
            /\.p\s*=\s*["']([^"']+)["']/
        ],


        chunkLoading: [
            /\.e\s*=\s*function\s*\(\s*\w+\s*\)/,
            /__webpack_require__\.e\s*\(/,
            /installedChunks\s*\[/
        ],


        moduleDefinition: [
            /\(\s*function\s*\(\s*module\s*,\s*exports\s*,\s*__webpack_require__\s*\)/,
            /\(\s*function\s*\(\s*module\s*,\s*__webpack_exports__\s*,\s*__webpack_require__\s*\)/,
            /\(\s*\(\s*__unused_webpack_module\s*,\s*__webpack_exports__\s*,\s*__webpack_require__\s*\)/
        ],


        definePlugin: [
            /process\.env\.(\w+)/g,
            /"process\.env\.(\w+)":\s*["']([^"']+)["']/g,
            /\bNODE_ENV\b/
        ],


        sourceMapUrl: [
            /\/\/[#@]\s*sourceMappingURL=([^\s]+)/,
            /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//
        ],


        dynamicImport: [
            /import\s*\(\s*["']([^"']+)["']\s*\)/g,
            /__webpack_require__\.e\s*\(\s*["']?(\d+)["']?\s*\)/g,
            /Promise\.all\s*\(\s*\[([^\]]+)\]\s*\)/g
        ],


        chunkFileName: [
            /chunkFilename:\s*["']([^"']+)["']/,
            /\.u\s*=\s*function\s*\(\s*\w+\s*\)\s*\{[^}]*return\s*["']([^"']+)["']/
        ]
    },


    extractPublicPath(code) {
        for (const pattern of this.patterns.publicPath) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    },


    extractSourceMapUrl(code) {
        for (const pattern of this.patterns.sourceMapUrl) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    },


    extractDynamicImports(code) {
        const imports = new Set();

        for (const pattern of this.patterns.dynamicImport) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(code)) !== null) {
                if (match[1]) {
                    imports.add(match[1]);
                }
            }
        }

        return Array.from(imports);
    },


    extractDefineConstants(code) {
        const constants = [];


        const envPattern = /process\.env\.(\w+)/g;
        let match;
        while ((match = envPattern.exec(code)) !== null) {
            constants.push({
                name: `process.env.${match[1]}`,
                type: 'env'
            });
        }

        return constants;
    },


    isWebpackRuntime(code) {
        const runtimeIndicators = [
            '__webpack_require__',
            'webpackJsonpCallback',
            '__webpack_modules__',
            'installedChunks',
            '__webpack_exports__'
        ];

        let matchCount = 0;
        for (const indicator of runtimeIndicators) {
            if (code.includes(indicator)) {
                matchCount++;
            }
        }


        return matchCount >= 2;
    },


    isConfigModule(code) {
        const configIndicators = [
            'apiUrl',
            'baseUrl',
            'API_URL',
            'BASE_URL',
            'apiKey',
            'API_KEY',
            'config',
            'CONFIG',
            'endpoint',
            'ENDPOINT'
        ];

        let matchCount = 0;
        for (const indicator of configIndicators) {
            if (code.includes(indicator)) {
                matchCount++;
            }
        }

        return matchCount >= 2;
    }
};


if (typeof window !== 'undefined') {
    window.WebpackPatternUtils = WebpackPatternUtils;
}
