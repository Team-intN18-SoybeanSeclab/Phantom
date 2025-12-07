/**
 * API 端点追踪访问器
 * 检测 API 端点定义和 HTTP 调用
 */
class APIEndpointVisitor {
    constructor(options = {}) {
        this.name = 'api_endpoint';
        this.nodeTypes = ['CallExpression', 'Literal', 'TemplateLiteral'];
        this.enabled = options.enabled !== false;
        
        // HTTP 方法调用模式
        this.httpMethods = ['fetch', 'axios', 'get', 'post', 'put', 'delete', 'patch', 'request', 'head', 'options'];
        
        // HTTP 客户端对象
        this.httpClients = ['axios', 'http', 'https', 'request', 'superagent', 'got', 'ky', 'node-fetch'];
        
        // XMLHttpRequest 方法
        this.xhrMethods = ['open', 'send'];
        
        // 路由定义模式
        this.routePatterns = ['route', 'router', 'get', 'post', 'put', 'delete', 'patch', 'use', 'all'];
        
        // URL 模式
        this.urlPattern = /^(https?:\/\/|\/\/|\/)[^\s'"<>]+/;
        this.apiPathPattern = /^\/api\/|^\/v\d+\/|^\/rest\//i;
    }
    
    visit(node, context) {
        if (!this.enabled) return [];
        
        const detections = [];
        
        switch (node.type) {
            case 'CallExpression':
                this._checkCallExpression(node, context, detections);
                break;
            case 'Literal':
                this._checkLiteral(node, context, detections);
                break;
            case 'TemplateLiteral':
                this._checkTemplateLiteral(node, context, detections);
                break;
        }
        
        return detections;
    }
    
    /**
     * 检查函数调用
     */
    _checkCallExpression(node, context, detections) {
        const calleeName = this._getCalleeName(node.callee);
        
        // 检查 fetch 调用
        if (calleeName === 'fetch' && node.arguments.length > 0) {
            const url = this._extractUrl(node.arguments[0]);
            if (url) {
                detections.push(this._createDetection(node, context, {
                    url,
                    method: 'fetch',
                    httpMethod: this._extractHttpMethod(node.arguments[1])
                }));
            }
        }
        
        // 检查 axios 调用
        if (this._isAxiosCall(calleeName)) {
            const url = this._extractAxiosUrl(node, calleeName);
            if (url) {
                detections.push(this._createDetection(node, context, {
                    url,
                    method: 'axios',
                    httpMethod: this._extractAxiosMethod(calleeName)
                }));
            }
        }
        
        // 检查 XMLHttpRequest.open
        if (this._isXHROpen(node)) {
            const url = this._extractUrl(node.arguments[1]);
            const method = this._getStringValue(node.arguments[0]);
            if (url) {
                detections.push(this._createDetection(node, context, {
                    url,
                    method: 'XMLHttpRequest',
                    httpMethod: method?.toUpperCase()
                }));
            }
        }
        
        // 检查路由定义
        if (this._isRouteDefinition(calleeName)) {
            const path = this._extractUrl(node.arguments[0]);
            if (path) {
                detections.push(this._createDetection(node, context, {
                    url: path,
                    method: 'route',
                    httpMethod: this._extractRouteMethod(calleeName)
                }));
            }
        }
    }
    
    /**
     * 检查字符串字面量
     */
    _checkLiteral(node, context, detections) {
        if (typeof node.value !== 'string') return;
        
        const value = node.value;
        
        // 检查是否是 URL 或 API 路径
        if (this.urlPattern.test(value) || this.apiPathPattern.test(value)) {
            // 避免重复检测（如果父节点是 CallExpression 已经处理过）
            const parent = context.ancestors?.[context.ancestors.length - 1];
            if (parent?.type === 'CallExpression') return;
            
            detections.push(this._createDetection(node, context, {
                url: value,
                method: 'literal',
                httpMethod: null
            }));
        }
    }
    
    /**
     * 检查模板字面量
     */
    _checkTemplateLiteral(node, context, detections) {
        const staticParts = node.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');
        
        // 检查是否是 URL 或 API 路径
        // 对于模板字符串，使用更宽松的匹配规则
        const isUrl = this.urlPattern.test(staticParts) || 
                      this.apiPathPattern.test(staticParts) ||
                      this._isApiLikePath(staticParts);
        
        if (isUrl) {
            const parent = context.ancestors?.[context.ancestors.length - 1];
            if (parent?.type === 'CallExpression') return;
            
            detections.push(this._createDetection(node, context, {
                url: staticParts,
                method: 'template',
                httpMethod: null,
                hasDynamicParts: node.expressions.length > 0
            }));
        }
    }
    
    /**
     * 检查是否是类似 API 的路径（更宽松的匹配）
     */
    _isApiLikePath(path) {
        if (!path || typeof path !== 'string') return false;
        
        // 以 / 开头，包含常见的 API 路径特征
        if (path.startsWith('/')) {
            // 包含动态参数占位符
            if (path.includes('${...}')) return true;
            
            // 包含常见的 API 路径关键词
            const apiKeywords = ['/api/', '/v1/', '/v2/', '/v3/', '/rest/', '/graphql/', '/users/', '/data/', '/auth/', '/login/', '/register/', '/profile/', '/admin/', '/config/'];
            if (apiKeywords.some(kw => path.toLowerCase().includes(kw))) return true;
            
            // 路径深度大于 1（如 /users/list）
            const segments = path.split('/').filter(s => s && s !== '${...}');
            if (segments.length >= 2) return true;
        }
        
        return false;
    }
    
    /**
     * 获取调用者名称
     */
    _getCalleeName(callee) {
        if (!callee) return null;
        if (callee.type === 'Identifier') return callee.name;
        if (callee.type === 'MemberExpression') {
            const obj = this._getCalleeName(callee.object);
            const prop = callee.property?.name || callee.property?.value;
            return obj && prop ? `${obj}.${prop}` : prop;
        }
        return null;
    }
    
    /**
     * 检查是否是 axios 调用
     */
    _isAxiosCall(calleeName) {
        if (!calleeName) return false;
        const lower = calleeName.toLowerCase();
        return lower === 'axios' || 
               lower.startsWith('axios.') ||
               this.httpMethods.some(m => lower.endsWith(`.${m}`));
    }
    
    /**
     * 检查是否是 XHR open 调用
     */
    _isXHROpen(node) {
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return false;
        return callee.property?.name === 'open' && node.arguments.length >= 2;
    }
    
    /**
     * 检查是否是路由定义
     */
    _isRouteDefinition(calleeName) {
        if (!calleeName) return false;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        return this.routePatterns.includes(method);
    }
    
    /**
     * 提取 URL
     */
    _extractUrl(node) {
        if (!node) return null;
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        if (node.type === 'TemplateLiteral') {
            return node.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');
        }
        return null;
    }
    
    /**
     * 提取 axios URL
     */
    _extractAxiosUrl(node, calleeName) {
        if (calleeName === 'axios' && node.arguments[0]?.type === 'ObjectExpression') {
            // axios({ url: '...' })
            const urlProp = node.arguments[0].properties?.find(p => 
                (p.key?.name === 'url' || p.key?.value === 'url')
            );
            return urlProp ? this._extractUrl(urlProp.value) : null;
        }
        // axios.get('/url') 或 axios('/url')
        return this._extractUrl(node.arguments[0]);
    }
    
    /**
     * 提取 HTTP 方法
     */
    _extractHttpMethod(optionsNode) {
        if (!optionsNode || optionsNode.type !== 'ObjectExpression') return 'GET';
        const methodProp = optionsNode.properties?.find(p => 
            (p.key?.name === 'method' || p.key?.value === 'method')
        );
        return methodProp ? this._getStringValue(methodProp.value)?.toUpperCase() : 'GET';
    }
    
    /**
     * 提取 axios 方法
     */
    _extractAxiosMethod(calleeName) {
        if (!calleeName) return null;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        if (this.httpMethods.includes(method)) {
            return method.toUpperCase();
        }
        return null;
    }
    
    /**
     * 提取路由方法
     */
    _extractRouteMethod(calleeName) {
        if (!calleeName) return null;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            return method.toUpperCase();
        }
        return 'ALL';
    }
    
    /**
     * 获取字符串值
     */
    _getStringValue(node) {
        if (!node) return null;
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        return null;
    }
    
    /**
     * 创建检测结果
     */
    _createDetection(node, context, extra) {
        return {
            type: 'api_endpoint',
            value: extra.url,
            confidence: extra.url.startsWith('http') ? 0.9 : 0.7,
            location: {
                start: { line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 },
                end: { line: node.loc?.end?.line || 0, column: node.loc?.end?.column || 0 }
            },
            context: {
                code: this._extractContext(context.code, node),
                method: extra.method,
                httpMethod: extra.httpMethod,
                hasDynamicParts: extra.hasDynamicParts || false
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
    module.exports = APIEndpointVisitor;
}
if (typeof window !== 'undefined') {
    window.APIEndpointVisitor = APIEndpointVisitor;
}
