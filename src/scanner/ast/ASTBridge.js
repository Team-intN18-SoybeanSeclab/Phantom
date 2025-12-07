/**
 * AST 桥接器
 * 将 ASTExtractor 与现有的 PatternExtractor 集成
 */
class ASTBridge {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.extractor = null;
        this.merger = null;
        this.initialized = false;
    }
    
    /**
     * 初始化 AST 提取器
     */
    async init() {
        if (this.initialized) return true;
        
        try {
            // 检查 acorn 是否可用
            if (typeof window !== 'undefined' && !window.acorn) {
                // 尝试加载 acorn
                if (window.AcornLoader) {
                    await window.AcornLoader.loadAcorn();
                }
            }
            
            // 创建提取器实例
            if (typeof window !== 'undefined' && window.ASTExtractor) {
                this.extractor = new window.ASTExtractor({
                    timeout: 5000,
                    cacheMaxSize: 50
                });
                
                // 注册所有访问器
                this._registerVisitors();
                
                // 创建结果合并器
                if (window.ResultMerger) {
                    this.merger = new window.ResultMerger();
                }
                
                this.initialized = true;
                // console.log('✅ [ASTBridge] Initialized successfully');
                return true;
            }
        } catch (error) {
            console.error('❌ [ASTBridge] Initialization failed:', error);
        }
        
        return false;
    }
    
    /**
     * 注册所有访问器
     */
    _registerVisitors() {
        if (!this.extractor) return;
        
        const visitors = [
            window.CredentialVisitor,
            window.APIEndpointVisitor,
            window.SensitiveFunctionVisitor,
            window.ConfigObjectVisitor,
            window.EncodedStringVisitor
        ];
        
        for (const Visitor of visitors) {
            if (Visitor) {
                try {
                    this.extractor.registerVisitor(new Visitor());
                } catch (e) {
                    console.warn('⚠️ [ASTBridge] Failed to register visitor:', e);
                }
            }
        }
    }
    
    /**
     * 提取敏感信息
     * @param {string} code - JavaScript 代码
     * @param {string} sourceUrl - 源 URL
     * @returns {Object} 提取结果
     */
    extract(code, sourceUrl = '') {
        if (!this.enabled || !this.extractor) {
            return { success: false, detections: [], fallbackUsed: true };
        }
        
        return this.extractor.safeExtract(code, sourceUrl);
    }
    
    /**
     * 与正则结果合并
     * @param {Array} astResults - AST 提取结果
     * @param {Object} regexResults - 正则提取结果
     * @returns {Object} 合并后的结果
     */
    mergeWithRegex(astResults, regexResults) {
        if (!this.merger) {
            return { ast: astResults, regex: regexResults };
        }
        
        // 将正则结果转换为统一格式
        const normalizedRegex = this._normalizeRegexResults(regexResults);
        
        // 合并结果
        const merged = this.merger.merge(astResults, normalizedRegex);
        
        return {
            merged,
            astCount: astResults?.length || 0,
            regexCount: normalizedRegex.length,
            mergedCount: merged.length
        };
    }
    
    /**
     * 标准化正则结果
     */
    _normalizeRegexResults(regexResults) {
        if (!regexResults) return [];
        
        const normalized = [];
        
        // 处理各种类型的正则结果
        const typeMap = {
            absoluteApis: 'api_endpoint',
            relativeApis: 'api_endpoint',
            domains: 'domain',
            emails: 'email',
            phones: 'phone',
            credentials: 'credential',
            ips: 'ip',
            jwts: 'jwt',
            idCards: 'id_card'
        };
        
        for (const [key, type] of Object.entries(typeMap)) {
            const items = regexResults[key];
            if (Array.isArray(items)) {
                for (const item of items) {
                    normalized.push({
                        type,
                        value: typeof item === 'string' ? item : item.value || String(item),
                        confidence: 0.6,
                        location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
                        context: { source: 'regex' },
                        sourceUrl: regexResults.sourceUrl || '',
                        extractedAt: new Date().toISOString()
                    });
                }
            }
        }
        
        return normalized;
    }
    
    /**
     * 检查是否可用
     */
    isAvailable() {
        return this.initialized && this.extractor?.isAvailable();
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        if (!this.extractor) return null;
        return this.extractor.getStats();
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        if (this.extractor) {
            this.extractor.clearCache();
        }
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.ASTBridge = ASTBridge;
    window.astBridge = new ASTBridge();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTBridge;
}
