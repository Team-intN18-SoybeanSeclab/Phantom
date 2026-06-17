class APIEndpointVisitor {
    constructor(options = {}) {
        this.name = 'api_endpoint';
        this.nodeTypes = ['CallExpression', 'Literal', 'TemplateLiteral'];
        this.enabled = options.enabled !== false;


        this.httpMethods = ['fetch', 'axios', 'get', 'post', 'put', 'delete', 'patch', 'request', 'head', 'options'];


        this.httpClients = ['axios', 'http', 'https', 'request', 'superagent', 'got', 'ky', 'node-fetch'];


        this.xhrMethods = ['open', 'send'];


        this.routePatterns = ['route', 'router', 'get', 'post', 'put', 'delete', 'patch', 'use', 'all'];


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


    _checkCallExpression(node, context, detections) {
        const calleeName = this._getCalleeName(node.callee);


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


    _checkLiteral(node, context, detections) {
        if (typeof node.value !== 'string') return;

        const value = node.value;


        if (this.urlPattern.test(value) || this.apiPathPattern.test(value)) {

            const parent = context.ancestors?.[context.ancestors.length - 1];
            if (parent?.type === 'CallExpression') return;

            detections.push(this._createDetection(node, context, {
                url: value,
                method: 'literal',
                httpMethod: null
            }));
        }
    }


    _checkTemplateLiteral(node, context, detections) {
        const staticParts = node.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');



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


    _isApiLikePath(path) {
        if (!path || typeof path !== 'string') return false;


        if (path.startsWith('/')) {

            if (path.includes('${...}')) return true;


            const apiKeywords = ['/api/', '/v1/', '/v2/', '/v3/', '/rest/', '/graphql/', '/users/', '/data/', '/auth/', '/login/', '/register/', '/profile/', '/admin/', '/config/'];
            if (apiKeywords.some(kw => path.toLowerCase().includes(kw))) return true;


            const segments = path.split('/').filter(s => s && s !== '${...}');
            if (segments.length >= 2) return true;
        }

        return false;
    }


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


    _isAxiosCall(calleeName) {
        if (!calleeName) return false;
        const lower = calleeName.toLowerCase();
        return lower === 'axios' ||
               lower.startsWith('axios.') ||
               this.httpMethods.some(m => lower.endsWith(`.${m}`));
    }


    _isXHROpen(node) {
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return false;
        return callee.property?.name === 'open' && node.arguments.length >= 2;
    }


    _isRouteDefinition(calleeName) {
        if (!calleeName) return false;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        return this.routePatterns.includes(method);
    }


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


    _extractAxiosUrl(node, calleeName) {
        if (calleeName === 'axios' && node.arguments[0]?.type === 'ObjectExpression') {

            const urlProp = node.arguments[0].properties?.find(p =>
                (p.key?.name === 'url' || p.key?.value === 'url')
            );
            return urlProp ? this._extractUrl(urlProp.value) : null;
        }

        return this._extractUrl(node.arguments[0]);
    }


    _extractHttpMethod(optionsNode) {
        if (!optionsNode || optionsNode.type !== 'ObjectExpression') return 'GET';
        const methodProp = optionsNode.properties?.find(p =>
            (p.key?.name === 'method' || p.key?.value === 'method')
        );
        return methodProp ? this._getStringValue(methodProp.value)?.toUpperCase() : 'GET';
    }


    _extractAxiosMethod(calleeName) {
        if (!calleeName) return null;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        if (this.httpMethods.includes(method)) {
            return method.toUpperCase();
        }
        return null;
    }


    _extractRouteMethod(calleeName) {
        if (!calleeName) return null;
        const parts = calleeName.split('.');
        const method = parts[parts.length - 1].toLowerCase();
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            return method.toUpperCase();
        }
        return 'ALL';
    }


    _getStringValue(node) {
        if (!node) return null;
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        return null;
    }


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


if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIEndpointVisitor;
}
if (typeof window !== 'undefined') {
    window.APIEndpointVisitor = APIEndpointVisitor;
}
