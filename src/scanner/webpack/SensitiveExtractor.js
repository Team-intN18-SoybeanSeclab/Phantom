class SensitiveExtractor {
    constructor(options = {}) {
        this.debug = options.debug || false;


        this.sensitivePatterns = {

            apiKeys: [
                /['"]?(?:api[_-]?key|apikey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:secret[_-]?key|secretkey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:access[_-]?key|accesskey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],

            tokens: [
                /['"]?(?:auth[_-]?token|authtoken)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:access[_-]?token|accesstoken)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:bearer[_-]?token)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],

            passwords: [
                /['"]?(?:password|passwd|pwd)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:db[_-]?password|database[_-]?password)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],

            cloudKeys: [
                /AKIA[0-9A-Z]{16}/g,
                /['"]?(?:aws[_-]?secret)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /AIza[0-9A-Za-z_-]{35}/g,
                /sk-[a-zA-Z0-9]{48}/g
            ]
        };
    }


    rebuildSplitStrings(code) {
        const results = [];

        if (!code) return results;

        try {

            results.push(...this._rebuildConcatenation(code));


            results.push(...this._rebuildArrayJoin(code));


            results.push(...this._rebuildFromCharCode(code));


            results.push(...this._rebuildBase64(code));

        } catch (error) {
            console.error('[SensitiveExtractor] 字符串重建失败:', error);
        }

        return results;
    }



    _rebuildConcatenation(code) {
        const results = [];


        const pattern = /(['"])([^'"]*)\1\s*\+\s*(['"])([^'"]*)\3/g;
        let match;

        while ((match = pattern.exec(code)) !== null) {
            const combined = match[2] + match[4];
            if (combined.length > 5 && this._isSensitive(combined)) {
                results.push({
                    value: combined,
                    type: 'concatenation',
                    location: match.index
                });
            }
        }

        return results;
    }


    _rebuildArrayJoin(code) {
        const results = [];


        const pattern = /\[([^\]]+)\]\.join\s*\(\s*['"]([^'"]*)['"]\s*\)/g;
        let match;

        while ((match = pattern.exec(code)) !== null) {
            try {
                const arrayContent = match[1];
                const separator = match[2];


                const elements = arrayContent.match(/['"]([^'"]*)['"]/g);
                if (elements) {
                    const combined = elements
                        .map(e => e.replace(/['"]/g, ''))
                        .join(separator);

                    if (combined.length > 5 && this._isSensitive(combined)) {
                        results.push({
                            value: combined,
                            type: 'array_join',
                            location: match.index
                        });
                    }
                }
            } catch (e) {

            }
        }

        return results;
    }


    _rebuildFromCharCode(code) {
        const results = [];


        const pattern = /String\.fromCharCode\s*\(\s*([^)]+)\s*\)/g;
        let match;

        while ((match = pattern.exec(code)) !== null) {
            try {
                const charCodes = match[1].split(',').map(s => parseInt(s.trim(), 10));
                const combined = String.fromCharCode(...charCodes);

                if (combined.length > 3 && this._isSensitive(combined)) {
                    results.push({
                        value: combined,
                        type: 'fromCharCode',
                        location: match.index
                    });
                }
            } catch (e) {

            }
        }

        return results;
    }


    _rebuildBase64(code) {
        const results = [];


        const pattern = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;

        while ((match = pattern.exec(code)) !== null) {
            try {
                const decoded = atob(match[1]);

                if (decoded.length > 3 && this._isSensitive(decoded)) {
                    results.push({
                        value: decoded,
                        type: 'base64',
                        location: match.index
                    });
                }
            } catch (e) {

            }
        }

        return results;
    }


    _isSensitive(str) {
        if (!str || str.length < 5) return false;

        const sensitiveKeywords = [
            'key', 'token', 'secret', 'password', 'api', 'auth',
            'credential', 'private', 'access', 'bearer'
        ];

        const lowerStr = str.toLowerCase();
        return sensitiveKeywords.some(keyword => lowerStr.includes(keyword)) ||
               /^[a-zA-Z0-9_-]{20,}$/.test(str);
    }



    extractSensitiveConfigs(code) {
        const configs = [];

        if (!code) return configs;

        try {

            for (const [category, patterns] of Object.entries(this.sensitivePatterns)) {
                for (const pattern of patterns) {
                    const regex = new RegExp(pattern.source, pattern.flags);
                    let match;

                    while ((match = regex.exec(code)) !== null) {
                        const value = match[1] || match[0];


                        if (this._isPlaceholder(value)) continue;

                        configs.push({
                            category: category,
                            value: value,
                            location: match.index,
                            context: this._getContext(code, match.index)
                        });
                    }
                }
            }

        } catch (error) {
            console.error('[SensitiveExtractor] 提取敏感配置失败:', error);
        }

        return configs;
    }


    _isPlaceholder(value) {
        if (!value) return true;

        const placeholders = [
            'your_api_key', 'your_secret', 'xxx', 'placeholder',
            'example', 'test', 'demo', 'sample', 'your-',
            '${', '{{', '<', '>'
        ];

        const lowerValue = value.toLowerCase();
        return placeholders.some(p => lowerValue.includes(p));
    }


    _getContext(code, index, length = 50) {
        const start = Math.max(0, index - length);
        const end = Math.min(code.length, index + length);
        return code.substring(start, end);
    }


    extractDebugInfo(code) {
        const debugInfo = [];

        if (!code) return debugInfo;

        try {

            const commentPatterns = [
                /\/\/\s*(TODO|FIXME|HACK|XXX|DEBUG|NOTE):\s*(.+)/gi,
                /\/\*\s*(TODO|FIXME|HACK|XXX|DEBUG|NOTE):\s*([^*]+)\*\//gi
            ];

            for (const pattern of commentPatterns) {
                let match;
                while ((match = pattern.exec(code)) !== null) {
                    debugInfo.push({
                        type: match[1].toUpperCase(),
                        content: match[2].trim(),
                        location: match.index
                    });
                }
            }


            const consolePattern = /console\.(log|debug|info|warn|error)\s*\(\s*['"]([^'"]+)['"]/g;
            let match;
            while ((match = consolePattern.exec(code)) !== null) {
                debugInfo.push({
                    type: 'CONSOLE_' + match[1].toUpperCase(),
                    content: match[2],
                    location: match.index
                });
            }

        } catch (error) {
            console.error('[SensitiveExtractor] 提取调试信息失败:', error);
        }

        return debugInfo;
    }


    extract(code) {
        return {
            rebuiltStrings: this.rebuildSplitStrings(code),
            sensitiveConfigs: this.extractSensitiveConfigs(code),
            debugInfo: this.extractDebugInfo(code)
        };
    }
}


if (typeof window !== 'undefined') {
    window.SensitiveExtractor = SensitiveExtractor;
}
