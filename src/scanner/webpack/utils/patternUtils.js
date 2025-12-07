/**
 * 模式匹配工具函数
 * 用于 Webpack 代码模式识别
 */

const WebpackPatternUtils = {
    /**
     * Webpack Runtime 代码模式
     */
    patterns: {
        // publicPath 提取模式
        publicPath: [
            /__webpack_require__\.p\s*=\s*["']([^"']+)["']/,
            /publicPath:\s*["']([^"']+)["']/,
            /\.p\s*=\s*["']([^"']+)["']/
        ],
        
        // chunk 加载模式
        chunkLoading: [
            /\.e\s*=\s*function\s*\(\s*\w+\s*\)/,
            /__webpack_require__\.e\s*\(/,
            /installedChunks\s*\[/
        ],
        
        // 模块定义模式
        moduleDefinition: [
            /\(\s*function\s*\(\s*module\s*,\s*exports\s*,\s*__webpack_require__\s*\)/,
            /\(\s*function\s*\(\s*module\s*,\s*__webpack_exports__\s*,\s*__webpack_require__\s*\)/,
            /\(\s*\(\s*__unused_webpack_module\s*,\s*__webpack_exports__\s*,\s*__webpack_require__\s*\)/
        ],
        
        // DefinePlugin 注入模式
        definePlugin: [
            /process\.env\.(\w+)/g,
            /"process\.env\.(\w+)":\s*["']([^"']+)["']/g,
            /\bNODE_ENV\b/
        ],
        
        // Source Map URL 模式
        sourceMapUrl: [
            /\/\/[#@]\s*sourceMappingURL=([^\s]+)/,
            /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//
        ],
        
        // 动态导入模式
        dynamicImport: [
            /import\s*\(\s*["']([^"']+)["']\s*\)/g,
            /__webpack_require__\.e\s*\(\s*["']?(\d+)["']?\s*\)/g,
            /Promise\.all\s*\(\s*\[([^\]]+)\]\s*\)/g
        ],
        
        // chunk 文件名模式
        chunkFileName: [
            /chunkFilename:\s*["']([^"']+)["']/,
            /\.u\s*=\s*function\s*\(\s*\w+\s*\)\s*\{[^}]*return\s*["']([^"']+)["']/
        ]
    },

    /**
     * 提取 publicPath
     * @param {string} code - 代码内容
     * @returns {string|null} publicPath 值
     */
    extractPublicPath(code) {
        for (const pattern of this.patterns.publicPath) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    },

    /**
     * 提取 Source Map URL
     * @param {string} code - 代码内容
     * @returns {string|null} Source Map URL
     */
    extractSourceMapUrl(code) {
        for (const pattern of this.patterns.sourceMapUrl) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    },

    /**
     * 提取动态导入路径
     * @param {string} code - 代码内容
     * @returns {string[]} 导入路径列表
     */
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

    /**
     * 提取 DefinePlugin 常量
     * @param {string} code - 代码内容
     * @returns {Object[]} 常量列表
     */
    extractDefineConstants(code) {
        const constants = [];
        
        // 提取 process.env.XXX 模式
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

    /**
     * 检测是否为 Webpack Runtime 代码
     * @param {string} code - 代码内容
     * @returns {boolean}
     */
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
        
        // 至少匹配 2 个特征
        return matchCount >= 2;
    },

    /**
     * 检测是否为配置模块
     * @param {string} code - 代码内容
     * @returns {boolean}
     */
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

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackPatternUtils = WebpackPatternUtils;
}
