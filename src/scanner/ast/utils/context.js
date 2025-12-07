/**
 * 上下文工具函数
 * 用于提取和处理代码上下文信息
 */

/**
 * 从源代码中提取指定位置周围的上下文
 * @param {string} code - 源代码
 * @param {Object} location - 位置信息 { start: { line, column }, end: { line, column } }
 * @param {number} contextLines - 上下文行数（前后各多少行）
 * @returns {string} 上下文代码
 */
function extractContext(code, location, contextLines = 2) {
    if (!code || !location) {
        return '';
    }
    
    const lines = code.split('\n');
    const startLine = Math.max(0, (location.start?.line || 1) - 1 - contextLines);
    const endLine = Math.min(lines.length, (location.end?.line || location.start?.line || 1) + contextLines);
    
    return lines.slice(startLine, endLine).join('\n');
}

/**
 * 获取节点的位置信息
 * @param {Object} node - AST 节点
 * @returns {Object} 位置信息
 */
function getNodeLocation(node) {
    if (!node) {
        return {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 }
        };
    }
    
    return {
        start: {
            line: node.loc?.start?.line || 0,
            column: node.loc?.start?.column || 0
        },
        end: {
            line: node.loc?.end?.line || 0,
            column: node.loc?.end?.column || 0
        }
    };
}

/**
 * 构建对象属性路径
 * @param {Object} node - AST 节点
 * @param {Array} ancestors - 祖先节点数组
 * @returns {string} 属性路径（如 "config.api.key"）
 */
function buildObjectPath(node, ancestors = []) {
    const parts = [];
    
    // 从祖先节点中提取路径
    for (const ancestor of ancestors) {
        if (ancestor.type === 'MemberExpression') {
            if (ancestor.property) {
                if (ancestor.property.type === 'Identifier') {
                    parts.push(ancestor.property.name);
                } else if (ancestor.property.type === 'Literal') {
                    parts.push(String(ancestor.property.value));
                }
            }
        } else if (ancestor.type === 'Property') {
            if (ancestor.key) {
                if (ancestor.key.type === 'Identifier') {
                    parts.push(ancestor.key.name);
                } else if (ancestor.key.type === 'Literal') {
                    parts.push(String(ancestor.key.value));
                }
            }
        }
    }
    
    return parts.join('.');
}

/**
 * 获取函数名称
 * @param {Object} node - 函数节点或其父节点
 * @returns {string|null} 函数名称
 */
function getFunctionName(node) {
    if (!node) {
        return null;
    }
    
    // 函数声明
    if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
    }
    
    // 函数表达式赋值给变量
    if (node.type === 'VariableDeclarator' && node.id) {
        return node.id.name;
    }
    
    // 对象方法
    if (node.type === 'Property' && node.key) {
        if (node.key.type === 'Identifier') {
            return node.key.name;
        }
        if (node.key.type === 'Literal') {
            return String(node.key.value);
        }
    }
    
    // 类方法
    if (node.type === 'MethodDefinition' && node.key) {
        if (node.key.type === 'Identifier') {
            return node.key.name;
        }
    }
    
    return null;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractContext,
        getNodeLocation,
        buildObjectPath,
        getFunctionName
    };
}

// 浏览器环境下挂载到 window
if (typeof window !== 'undefined') {
    window.ASTUtils = window.ASTUtils || {};
    window.ASTUtils.extractContext = extractContext;
    window.ASTUtils.getNodeLocation = getNodeLocation;
    window.ASTUtils.buildObjectPath = buildObjectPath;
    window.ASTUtils.getFunctionName = getFunctionName;
}
