/**
 * AST 访问器基类
 * 定义访问器的通用接口和基础功能
 */
class ASTVisitor {
    constructor(options = {}) {
        // 访问器名称
        this.name = options.name || 'base';
        
        // 感兴趣的节点类型
        this.nodeTypes = options.nodeTypes || [];
        
        // 是否启用
        this.enabled = options.enabled !== false;
    }
    
    /**
     * 访问节点时调用
     * @param {Object} node - AST 节点
     * @param {Object} context - 上下文信息
     * @returns {Array} 检测结果数组
     */
    visit(node, context) {
        // 子类需要实现此方法
        return [];
    }
    
    /**
     * 离开节点时调用（可选）
     * @param {Object} node - AST 节点
     * @param {Object} context - 上下文信息
     */
    leave(node, context) {
        // 子类可选实现此方法
    }
    
    /**
     * 检查节点类型是否匹配
     * @param {Object} node - AST 节点
     * @returns {boolean} 是否匹配
     */
    matches(node) {
        if (!node || !node.type) {
            return false;
        }
        return this.nodeTypes.includes(node.type);
    }
    
    /**
     * 获取节点的位置信息
     * @param {Object} node - AST 节点
     * @returns {Object} 位置信息
     */
    getLocation(node) {
        if (!node) {
            return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
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
     * 从源代码中提取上下文
     * @param {string} code - 源代码
     * @param {Object} location - 位置信息
     * @param {number} contextLines - 上下文行数
     * @returns {string} 上下文代码
     */
    extractContext(code, location, contextLines = 2) {
        if (!code || !location) return '';
        
        const lines = code.split('\n');
        const startLine = Math.max(0, (location.start?.line || 1) - 1 - contextLines);
        const endLine = Math.min(lines.length, (location.end?.line || location.start?.line || 1) + contextLines);
        
        return lines.slice(startLine, endLine).join('\n');
    }
    
    /**
     * 获取标识符名称
     * @param {Object} node - AST 节点
     * @returns {string|null} 标识符名称
     */
    getIdentifierName(node) {
        if (!node) return null;
        
        if (node.type === 'Identifier') {
            return node.name;
        }
        if (node.type === 'Literal') {
            return String(node.value);
        }
        if (node.type === 'MemberExpression') {
            const obj = this.getIdentifierName(node.object);
            const prop = this.getIdentifierName(node.property);
            return obj && prop ? `${obj}.${prop}` : null;
        }
        return null;
    }
    
    /**
     * 获取字符串字面量值
     * @param {Object} node - AST 节点
     * @returns {string|null} 字符串值
     */
    getStringValue(node) {
        if (!node) return null;
        
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        if (node.type === 'TemplateLiteral') {
            // 只提取静态部分
            return node.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');
        }
        return null;
    }
    
    /**
     * 创建检测结果对象
     * @param {Object} params - 检测参数
     * @returns {Object} 检测结果
     */
    createDetection(params) {
        const {
            type,
            value,
            confidence = 0.5,
            location,
            context = {},
            sourceUrl = ''
        } = params;
        
        return {
            type: type || this.name,
            value: value || '',
            confidence: Math.max(0, Math.min(1, confidence)),
            location: location || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            context: {
                code: context.code || '',
                functionName: context.functionName || null,
                objectPath: context.objectPath || null,
                declarationType: context.declarationType || null,
                ...context
            },
            sourceUrl,
            extractedAt: new Date().toISOString()
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTVisitor;
}

if (typeof window !== 'undefined') {
    window.ASTVisitor = ASTVisitor;
}
