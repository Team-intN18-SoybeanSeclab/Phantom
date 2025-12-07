/**
 * 敏感函数调用访问器
 * 检测处理敏感操作的函数调用
 */
class SensitiveFunctionVisitor {
    constructor(options = {}) {
        this.name = 'sensitive_function';
        this.nodeTypes = ['CallExpression', 'MemberExpression'];
        this.enabled = options.enabled !== false;
        
        // 敏感函数列表
        this.sensitiveFunctions = {
            // 代码执行
            'eval': { category: 'code_execution', severity: 'high' },
            'Function': { category: 'code_execution', severity: 'high' },
            'setTimeout': { category: 'code_execution', severity: 'medium' },
            'setInterval': { category: 'code_execution', severity: 'medium' },
            
            // 存储操作
            'localStorage.setItem': { category: 'storage', severity: 'medium' },
            'localStorage.getItem': { category: 'storage', severity: 'low' },
            'sessionStorage.setItem': { category: 'storage', severity: 'medium' },
            'sessionStorage.getItem': { category: 'storage', severity: 'low' },
            
            // Cookie 操作
            'document.cookie': { category: 'cookie', severity: 'high' },
            
            // 加密相关
            'crypto.subtle.encrypt': { category: 'crypto', severity: 'medium' },
            'crypto.subtle.decrypt': { category: 'crypto', severity: 'medium' },
            'crypto.subtle.sign': { category: 'crypto', severity: 'medium' },
            'crypto.subtle.generateKey': { category: 'crypto', severity: 'medium' },
            'CryptoJS.AES.encrypt': { category: 'crypto', severity: 'medium' },
            'CryptoJS.AES.decrypt': { category: 'crypto', severity: 'medium' },
            'CryptoJS.MD5': { category: 'crypto', severity: 'low' },
            'CryptoJS.SHA256': { category: 'crypto', severity: 'low' },
            
            // 认证相关
            'btoa': { category: 'encoding', severity: 'low' },
            'atob': { category: 'encoding', severity: 'low' },
            
            // 网络请求
            'XMLHttpRequest': { category: 'network', severity: 'medium' },
            'WebSocket': { category: 'network', severity: 'medium' },
            
            // DOM 操作
            'document.write': { category: 'dom', severity: 'high' },
            'innerHTML': { category: 'dom', severity: 'medium' },
            'outerHTML': { category: 'dom', severity: 'medium' }
        };
    }
    
    visit(node, context) {
        if (!this.enabled) return [];
        
        const detections = [];
        
        if (node.type === 'CallExpression') {
            this._checkCallExpression(node, context, detections);
        } else if (node.type === 'MemberExpression') {
            this._checkMemberExpression(node, context, detections);
        }
        
        return detections;
    }
    
    /**
     * 检查函数调用
     */
    _checkCallExpression(node, context, detections) {
        const calleeName = this._getCalleeName(node.callee);
        if (!calleeName) return;
        
        // 检查是否是敏感函数
        const funcInfo = this._getSensitiveFunctionInfo(calleeName);
        if (funcInfo) {
            detections.push(this._createDetection(node, context, {
                functionName: calleeName,
                category: funcInfo.category,
                severity: funcInfo.severity,
                arguments: this._extractArguments(node.arguments)
            }));
        }
        
        // 检查 new Function() 构造
        if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
            detections.push(this._createDetection(node, context, {
                functionName: 'new Function',
                category: 'code_execution',
                severity: 'high',
                arguments: this._extractArguments(node.arguments)
            }));
        }
    }
    
    /**
     * 检查成员表达式（如 document.cookie 访问）
     */
    _checkMemberExpression(node, context, detections) {
        const memberName = this._getMemberName(node);
        if (!memberName) return;
        
        // 检查 document.cookie 访问
        if (memberName === 'document.cookie') {
            // 检查是否是赋值操作
            const parent = context.ancestors?.[context.ancestors.length - 1];
            const isAssignment = parent?.type === 'AssignmentExpression' && parent.left === node;
            
            detections.push(this._createDetection(node, context, {
                functionName: memberName,
                category: 'cookie',
                severity: 'high',
                isWrite: isAssignment
            }));
        }
        
        // 检查 innerHTML/outerHTML 赋值
        if (memberName.endsWith('.innerHTML') || memberName.endsWith('.outerHTML')) {
            const parent = context.ancestors?.[context.ancestors.length - 1];
            if (parent?.type === 'AssignmentExpression' && parent.left === node) {
                detections.push(this._createDetection(node, context, {
                    functionName: memberName,
                    category: 'dom',
                    severity: 'medium',
                    isWrite: true
                }));
            }
        }
    }
    
    /**
     * 获取调用者名称
     */
    _getCalleeName(callee) {
        if (!callee) return null;
        if (callee.type === 'Identifier') return callee.name;
        if (callee.type === 'MemberExpression') {
            return this._getMemberName(callee);
        }
        return null;
    }
    
    /**
     * 获取成员表达式名称
     */
    _getMemberName(node) {
        if (!node || node.type !== 'MemberExpression') return null;
        
        const parts = [];
        let current = node;
        
        while (current) {
            if (current.type === 'MemberExpression') {
                if (current.property) {
                    if (current.property.type === 'Identifier') {
                        parts.unshift(current.property.name);
                    } else if (current.property.type === 'Literal') {
                        parts.unshift(String(current.property.value));
                    }
                }
                current = current.object;
            } else if (current.type === 'Identifier') {
                parts.unshift(current.name);
                break;
            } else {
                break;
            }
        }
        
        return parts.join('.');
    }
    
    /**
     * 获取敏感函数信息
     */
    _getSensitiveFunctionInfo(name) {
        if (!name) return null;
        
        // 精确匹配
        if (this.sensitiveFunctions[name]) {
            return this.sensitiveFunctions[name];
        }
        
        // 部分匹配（如 xxx.localStorage.setItem）
        for (const [key, info] of Object.entries(this.sensitiveFunctions)) {
            if (name.endsWith(key) || name.endsWith('.' + key)) {
                return info;
            }
        }
        
        return null;
    }
    
    /**
     * 提取参数信息
     */
    _extractArguments(args) {
        if (!args || !Array.isArray(args)) return [];
        
        return args.slice(0, 3).map(arg => {
            if (arg.type === 'Literal') {
                return { type: 'literal', value: String(arg.value).substring(0, 100) };
            }
            if (arg.type === 'Identifier') {
                return { type: 'identifier', name: arg.name };
            }
            if (arg.type === 'TemplateLiteral') {
                const value = arg.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');
                return { type: 'template', value: value.substring(0, 100) };
            }
            return { type: arg.type };
        });
    }
    
    /**
     * 创建检测结果
     */
    _createDetection(node, context, extra) {
        const severityToConfidence = { high: 0.9, medium: 0.7, low: 0.5 };
        
        return {
            type: 'sensitive_function',
            value: extra.functionName,
            confidence: severityToConfidence[extra.severity] || 0.5,
            location: {
                start: { line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 },
                end: { line: node.loc?.end?.line || 0, column: node.loc?.end?.column || 0 }
            },
            context: {
                code: this._extractContext(context.code, node),
                category: extra.category,
                severity: extra.severity,
                arguments: extra.arguments,
                isWrite: extra.isWrite
            },
            sourceUrl: context.sourceUrl || '',
            extractedAt: new Date().toISOString()
        };
    }
    
    _extractContext(code, node, lines = 2) {
        if (!code || !node.loc) return '';
        const codeLines = code.split('\n');
        const start = Math.max(0, (node.loc.start?.line || 1) - 1 - lines);
        const end = Math.min(codeLines.length, (node.loc.end?.line || 1) + lines);
        return codeLines.slice(start, end).join('\n');
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensitiveFunctionVisitor;
}
if (typeof window !== 'undefined') {
    window.SensitiveFunctionVisitor = SensitiveFunctionVisitor;
}
