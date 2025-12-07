/**
 * SensitiveExtractor - 敏感信息增强提取器
 * 针对 Webpack 打包代码的特点进行增强检测
 * 
 * @class SensitiveExtractor
 */
class SensitiveExtractor {
    constructor(options = {}) {
        this.debug = options.debug || false;
        
        // 敏感模式配置
        this.sensitivePatterns = {
            // API 密钥模式
            apiKeys: [
                /['"]?(?:api[_-]?key|apikey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:secret[_-]?key|secretkey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:access[_-]?key|accesskey)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],
            // Token 模式
            tokens: [
                /['"]?(?:auth[_-]?token|authtoken)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:access[_-]?token|accesstoken)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:bearer[_-]?token)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],
            // 密码模式
            passwords: [
                /['"]?(?:password|passwd|pwd)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /['"]?(?:db[_-]?password|database[_-]?password)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
            ],
            // 云服务密钥
            cloudKeys: [
                /AKIA[0-9A-Z]{16}/g,  // AWS Access Key
                /['"]?(?:aws[_-]?secret)['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
                /AIza[0-9A-Za-z_-]{35}/g,  // Google API Key
                /sk-[a-zA-Z0-9]{48}/g  // OpenAI API Key
            ]
        };
    }

    /**
     * 重建被拆分的字符串
     * @param {string} code - 代码内容
     * @returns {Object[]} 重建的字符串列表
     */
    rebuildSplitStrings(code) {
        const results = [];
        
        if (!code) return results;
        
        try {
            // 模式 1: "str1" + "str2" + "str3"
            results.push(...this._rebuildConcatenation(code));
            
            // 模式 2: ["s","t","r"].join("")
            results.push(...this._rebuildArrayJoin(code));
            
            // 模式 3: String.fromCharCode(...)
            results.push(...this._rebuildFromCharCode(code));
            
            // 模式 4: atob("base64")
            results.push(...this._rebuildBase64(code));
            
        } catch (error) {
            console.error('[SensitiveExtractor] 字符串重建失败:', error);
        }
        
        return results;
    }


    /**
     * 重建字符串拼接
     * @private
     */
    _rebuildConcatenation(code) {
        const results = [];
        
        // 匹配 "str1" + "str2" 模式
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

    /**
     * 重建数组 join
     * @private
     */
    _rebuildArrayJoin(code) {
        const results = [];
        
        // 匹配 ["a","b","c"].join("") 模式
        const pattern = /\[([^\]]+)\]\.join\s*\(\s*['"]([^'"]*)['"]\s*\)/g;
        let match;
        
        while ((match = pattern.exec(code)) !== null) {
            try {
                const arrayContent = match[1];
                const separator = match[2];
                
                // 提取数组元素
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
                // 忽略解析错误
            }
        }
        
        return results;
    }

    /**
     * 重建 fromCharCode
     * @private
     */
    _rebuildFromCharCode(code) {
        const results = [];
        
        // 匹配 String.fromCharCode(65, 66, 67) 模式
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
                // 忽略解析错误
            }
        }
        
        return results;
    }

    /**
     * 重建 Base64 编码
     * @private
     */
    _rebuildBase64(code) {
        const results = [];
        
        // 匹配 atob("xxx") 模式
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
                // 忽略解码错误
            }
        }
        
        return results;
    }

    /**
     * 判断字符串是否可能敏感
     * @private
     */
    _isSensitive(str) {
        if (!str || str.length < 5) return false;
        
        const sensitiveKeywords = [
            'key', 'token', 'secret', 'password', 'api', 'auth',
            'credential', 'private', 'access', 'bearer'
        ];
        
        const lowerStr = str.toLowerCase();
        return sensitiveKeywords.some(keyword => lowerStr.includes(keyword)) ||
               /^[a-zA-Z0-9_-]{20,}$/.test(str);  // 长随机字符串
    }


    /**
     * 提取配置对象中的敏感信息
     * @param {string} code - 代码内容
     * @returns {Object[]} 敏感配置列表
     */
    extractSensitiveConfigs(code) {
        const configs = [];
        
        if (!code) return configs;
        
        try {
            // 提取各类敏感信息
            for (const [category, patterns] of Object.entries(this.sensitivePatterns)) {
                for (const pattern of patterns) {
                    const regex = new RegExp(pattern.source, pattern.flags);
                    let match;
                    
                    while ((match = regex.exec(code)) !== null) {
                        const value = match[1] || match[0];
                        
                        // 过滤明显的占位符
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

    /**
     * 判断是否为占位符
     * @private
     */
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

    /**
     * 获取上下文
     * @private
     */
    _getContext(code, index, length = 50) {
        const start = Math.max(0, index - length);
        const end = Math.min(code.length, index + length);
        return code.substring(start, end);
    }

    /**
     * 提取调试信息
     * @param {string} code - 代码内容
     * @returns {Object[]} 调试信息列表
     */
    extractDebugInfo(code) {
        const debugInfo = [];
        
        if (!code) return debugInfo;
        
        try {
            // 提取注释中的调试信息
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
            
            // 提取 console.log 调用
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

    /**
     * 执行完整的敏感信息提取
     * @param {string} code - 代码内容
     * @returns {Object} 提取结果
     */
    extract(code) {
        return {
            rebuiltStrings: this.rebuildSplitStrings(code),
            sensitiveConfigs: this.extractSensitiveConfigs(code),
            debugInfo: this.extractDebugInfo(code)
        };
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.SensitiveExtractor = SensitiveExtractor;
}
