/**
 * AST 敏感信息提取系统
 * 入口文件 - 导出所有模块
 */

// 在浏览器环境中，确保所有模块都已加载
if (typeof window !== 'undefined') {
    // 检查依赖是否已加载
    const checkDependencies = () => {
        const missing = [];
        
        if (!window.acorn) {
            missing.push('acorn (libs/acorn.min.js)');
        }
        
        if (missing.length > 0) {
            console.warn('⚠️ [AST] Missing dependencies:', missing.join(', '));
            console.warn('   Please ensure all required scripts are loaded before using ASTExtractor');
        }
        
        return missing.length === 0;
    };
    
    // 初始化 AST 系统
    window.initASTExtractor = async function() {
        // 检查依赖
        if (!checkDependencies()) {
            // 尝试加载 acorn
            if (window.AcornLoader && window.AcornLoader.loadAcorn) {
                await window.AcornLoader.loadAcorn();
            }
        }
        
        // 创建默认实例
        if (window.ASTExtractor && !window.astExtractor) {
            window.astExtractor = new window.ASTExtractor({
                timeout: 5000,
                cacheMaxSize: 50,
                maxFileSize: 1024 * 1024 // 1MB
            });
            
            // 注册所有访问器
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
                        window.astExtractor.registerVisitor(new Visitor());
                    } catch (e) {
                        console.warn('⚠️ [AST] Failed to register visitor:', e);
                    }
                }
            }
            
            console.log('✅ [AST] ASTExtractor initialized with', window.astExtractor.getVisitors().length, 'visitors');
        }
        
        return window.astExtractor;
    };
    
    // 导出模块引用
    window.AST = {
        Extractor: window.ASTExtractor,
        Parser: window.ASTParser,
        Visitor: window.ASTVisitor,
        Utils: window.ASTUtils,
        Bridge: window.ASTBridge,
        ResultMerger: window.ResultMerger,
        Visitors: {
            Credential: window.CredentialVisitor,
            APIEndpoint: window.APIEndpointVisitor,
            SensitiveFunction: window.SensitiveFunctionVisitor,
            ConfigObject: window.ConfigObjectVisitor,
            EncodedString: window.EncodedStringVisitor
        },
        init: window.initASTExtractor
    };
}

// Node.js 环境
if (typeof module !== 'undefined' && module.exports) {
    const ASTExtractor = require('./ASTExtractor');
    const ASTParser = require('./parser');
    const ASTVisitor = require('./visitors/ASTVisitor');
    const CredentialVisitor = require('./visitors/CredentialVisitor');
    const APIEndpointVisitor = require('./visitors/APIEndpointVisitor');
    const SensitiveFunctionVisitor = require('./visitors/SensitiveFunctionVisitor');
    const ConfigObjectVisitor = require('./visitors/ConfigObjectVisitor');
    const EncodedStringVisitor = require('./visitors/EncodedStringVisitor');
    const ResultMerger = require('./utils/ResultMerger');
    const hashUtils = require('./utils/hash');
    const contextUtils = require('./utils/context');
    
    module.exports = {
        ASTExtractor,
        ASTParser,
        ASTVisitor,
        ResultMerger,
        Visitors: {
            Credential: CredentialVisitor,
            APIEndpoint: APIEndpointVisitor,
            SensitiveFunction: SensitiveFunctionVisitor,
            ConfigObject: ConfigObjectVisitor,
            EncodedString: EncodedStringVisitor
        },
        Utils: {
            ...hashUtils,
            ...contextUtils
        }
    };
}
