/**
 * AST 解析器包装器
 * 封装 acorn 解析库，提供统一的解析接口
 * 
 * 注意：需要在使用前加载 acorn 库
 * 可以通过 CDN 或本地文件引入：
 * - CDN: https://cdn.jsdelivr.net/npm/acorn/dist/acorn.min.js
 * - 本地: libs/acorn.min.js
 */

/**
 * 默认解析选项
 * 支持 ES2020+ 语法
 */
const DEFAULT_PARSE_OPTIONS = {
    ecmaVersion: 'latest',      // 支持最新 ECMAScript 版本
    sourceType: 'module',       // 默认作为模块解析
    locations: true,            // 包含位置信息
    ranges: true,               // 包含范围信息
    allowHashBang: true,        // 允许 #! 开头
    allowAwaitOutsideFunction: true,  // 允许顶层 await
    allowImportExportEverywhere: true, // 允许任意位置的 import/export
    allowReserved: true,        // 允许保留字作为标识符
    allowReturnOutsideFunction: true  // 允许函数外的 return
};

/**
 * 预处理代码
 * 移除 BOM、处理特殊字符、JSX 容错等
 * @param {string} code - 原始代码
 * @param {Object} options - 预处理选项
 * @returns {string} 预处理后的代码
 */
function preprocessCode(code, options = {}) {
    if (!code || typeof code !== 'string') {
        return '';
    }
    
    // 移除 BOM (Byte Order Mark)
    if (code.charCodeAt(0) === 0xFEFF) {
        code = code.slice(1);
    }
    
    // 移除 UTF-8 BOM
    if (code.startsWith('\uFEFF')) {
        code = code.slice(1);
    }
    
    // 处理 Windows 换行符
    code = code.replace(/\r\n/g, '\n');
    
    // 移除零宽字符
    code = code.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // JSX 容错处理：将 JSX 标签替换为占位符
    if (options.stripJSX !== false) {
        code = stripJSXSyntax(code);
    }
    
    // 移除 TypeScript 类型注解（简单处理）
    if (options.stripTypes !== false) {
        code = stripTypeAnnotations(code);
    }
    
    return code;
}

/**
 * 移除 JSX 语法（简单容错处理）
 * 将 JSX 标签替换为字符串，保持代码可解析
 * @param {string} code - 原始代码
 * @returns {string} 处理后的代码
 */
function stripJSXSyntax(code) {
    if (!code) return code;
    
    // 检测是否包含 JSX 语法
    // 匹配 <Component ... /> 或 <Component>...</Component> 模式
    const jsxPattern = /<([A-Z][a-zA-Z0-9]*|[a-z]+(?:-[a-z]+)*)[^>]*(?:\/>|>[\s\S]*?<\/\1>)/g;
    
    // 如果没有 JSX，直接返回
    if (!jsxPattern.test(code)) {
        return code;
    }
    
    // 重置正则
    jsxPattern.lastIndex = 0;
    
    // 将 JSX 替换为字符串字面量（保持位置信息）
    return code.replace(jsxPattern, (match) => {
        // 用等长的字符串替换，保持位置信息
        return '"' + '_'.repeat(Math.max(0, match.length - 2)) + '"';
    });
}

/**
 * 移除 TypeScript 类型注解（简单处理）
 * @param {string} code - 原始代码
 * @returns {string} 处理后的代码
 */
function stripTypeAnnotations(code) {
    if (!code) return code;
    
    // 移除简单的类型注解 : Type
    // 例如: const x: string = "hello" -> const x = "hello"
    // 注意：这是简化处理，复杂的 TypeScript 代码可能需要专门的解析器
    
    // 移除变量类型注解
    code = code.replace(/:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[=;,)\]])/g, '');
    
    // 移除函数参数类型注解
    code = code.replace(/(\w+)\s*:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[,)])/g, '$1');
    
    // 移除函数返回类型注解
    code = code.replace(/\)\s*:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[{=>])/g, ')');
    
    // 移除 interface 和 type 声明（整行）
    code = code.replace(/^\s*(export\s+)?(interface|type)\s+\w+[\s\S]*?(?=\n\s*(export|const|let|var|function|class|import|$))/gm, '');
    
    return code;
}

/**
 * 获取 acorn 解析器
 * @returns {Object|null} acorn 解析器或 null
 */
function getAcorn() {
    // 浏览器环境
    if (typeof window !== 'undefined' && window.acorn) {
        return window.acorn;
    }
    
    // Node.js 环境
    if (typeof require !== 'undefined') {
        try {
            return require('acorn');
        } catch (e) {
            console.warn('⚠️ [ASTParser] acorn not found in Node.js environment');
        }
    }
    
    return null;
}

/**
 * 解析 JavaScript 代码为 AST
 * @param {string} code - JavaScript 源代码
 * @param {Object} options - 解析选项
 * @returns {Object|null} AST 对象或 null（解析失败时）
 */
function parseCode(code, options = {}) {
    const acorn = getAcorn();
    
    if (!acorn) {
        console.error('❌ [ASTParser] acorn parser not available');
        return null;
    }
    
    // 预处理代码
    const processedCode = preprocessCode(code);
    
    if (!processedCode) {
        return null;
    }
    
    // 合并选项
    const parseOptions = {
        ...DEFAULT_PARSE_OPTIONS,
        ...options
    };
    
    // 尝试多种解析模式
    const modes = [
        { sourceType: 'module' },
        { sourceType: 'script' }
    ];
    
    for (const mode of modes) {
        try {
            const ast = acorn.parse(processedCode, {
                ...parseOptions,
                ...mode
            });
            return ast;
        } catch (error) {
            // 继续尝试下一种模式
            continue;
        }
    }
    
    // 所有模式都失败，返回 null
    return null;
}

/**
 * 尝试解析代码，带有详细错误信息
 * @param {string} code - JavaScript 源代码
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果 { ast, error, mode, preprocessed }
 */
function tryParse(code, options = {}) {
    const acorn = getAcorn();
    
    if (!acorn) {
        return {
            ast: null,
            error: new Error('acorn parser not available'),
            mode: null,
            preprocessed: false
        };
    }
    
    // 预处理代码
    const processedCode = preprocessCode(code, options);
    
    if (!processedCode) {
        return {
            ast: null,
            error: new Error('Empty or invalid code'),
            mode: null,
            preprocessed: false
        };
    }
    
    // 合并选项
    const parseOptions = {
        ...DEFAULT_PARSE_OPTIONS,
        ...options
    };
    
    // 删除非 acorn 选项
    delete parseOptions.stripJSX;
    delete parseOptions.stripTypes;
    
    // 尝试多种解析模式
    const modes = [
        { sourceType: 'module', name: 'module' },
        { sourceType: 'script', name: 'script' }
    ];
    
    let lastError = null;
    
    for (const mode of modes) {
        try {
            const ast = acorn.parse(processedCode, {
                ...parseOptions,
                sourceType: mode.sourceType
            });
            return {
                ast,
                error: null,
                mode: mode.name,
                preprocessed: code !== processedCode
            };
        } catch (error) {
            lastError = error;
            continue;
        }
    }
    
    // 如果标准解析失败，尝试宽松模式
    try {
        const ast = acorn.parse(processedCode, {
            ...parseOptions,
            sourceType: 'script',
            allowReserved: true,
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
            allowAwaitOutsideFunction: true
        });
        return {
            ast,
            error: null,
            mode: 'loose',
            preprocessed: code !== processedCode
        };
    } catch (error) {
        // 忽略，使用之前的错误
    }
    
    return {
        ast: null,
        error: lastError,
        mode: null,
        preprocessed: code !== processedCode
    };
}

/**
 * 解析代码并提取错误位置信息
 * @param {string} code - JavaScript 源代码
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果，包含详细错误信息
 */
function parseWithErrorInfo(code, options = {}) {
    const result = tryParse(code, options);
    
    if (result.error) {
        // 提取错误位置信息
        const errorInfo = {
            message: result.error.message,
            line: null,
            column: null,
            pos: null
        };
        
        // acorn 错误通常包含位置信息
        if (result.error.loc) {
            errorInfo.line = result.error.loc.line;
            errorInfo.column = result.error.loc.column;
        }
        if (result.error.pos !== undefined) {
            errorInfo.pos = result.error.pos;
        }
        
        // 尝试从错误消息中提取位置
        const posMatch = result.error.message.match(/\((\d+):(\d+)\)/);
        if (posMatch && !errorInfo.line) {
            errorInfo.line = parseInt(posMatch[1], 10);
            errorInfo.column = parseInt(posMatch[2], 10);
        }
        
        result.errorInfo = errorInfo;
    }
    
    return result;
}

/**
 * 检查 acorn 是否可用
 * @returns {boolean} 是否可用
 */
function isParserAvailable() {
    return getAcorn() !== null;
}

/**
 * 获取解析器版本
 * @returns {string|null} 版本号或 null
 */
function getParserVersion() {
    const acorn = getAcorn();
    return acorn ? acorn.version : null;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseCode,
        tryParse,
        parseWithErrorInfo,
        preprocessCode,
        stripJSXSyntax,
        stripTypeAnnotations,
        isParserAvailable,
        getParserVersion,
        DEFAULT_PARSE_OPTIONS
    };
}

// 浏览器环境下挂载到 window
if (typeof window !== 'undefined') {
    window.ASTParser = {
        parseCode,
        tryParse,
        parseWithErrorInfo,
        preprocessCode,
        stripJSXSyntax,
        stripTypeAnnotations,
        isParserAvailable,
        getParserVersion,
        DEFAULT_PARSE_OPTIONS
    };
}
