class CredentialVisitor {
    constructor(options = {}) {
        this.name = 'credential';
        this.nodeTypes = ['VariableDeclarator', 'AssignmentExpression', 'Property'];
        this.enabled = options.enabled !== false;


        this.sensitiveKeywords = [
            'password', 'passwd', 'pwd', 'pass',
            'secret', 'secrets',
            'key', 'apikey', 'api_key', 'apiKey',
            'token', 'accesstoken', 'access_token', 'accessToken',
            'auth', 'authorization', 'authenticate',
            'credential', 'credentials',
            'private', 'privatekey', 'private_key', 'privateKey',
            'cert', 'certificate',
            'encryption', 'encrypt',
            'salt', 'hash',
            'bearer', 'jwt',
            'oauth', 'client_secret', 'clientSecret',
            'appkey', 'app_key', 'appKey',
            'appid', 'app_id', 'appId',
            'secretkey', 'secret_key', 'secretKey'
        ];


        this.valuePatterns = [
            /^[A-Za-z0-9+/]{20,}={0,2}$/,
            /^[a-f0-9]{32,}$/i,
            /^sk_[a-zA-Z0-9]{20,}$/,
            /^pk_[a-zA-Z0-9]{20,}$/,
            /^ghp_[a-zA-Z0-9]{36}$/,
            /^gho_[a-zA-Z0-9]{36}$/,
            /^AKIA[0-9A-Z]{16}$/,
            /^AIza[0-9A-Za-z_-]{35}$/,
            /^xox[baprs]-[0-9a-zA-Z-]+$/,
        ];
    }


    visit(node, context) {
        if (!this.enabled) return [];

        const detections = [];

        switch (node.type) {
            case 'VariableDeclarator':
                this._checkVariableDeclarator(node, context, detections);
                break;
            case 'AssignmentExpression':
                this._checkAssignmentExpression(node, context, detections);
                break;
            case 'Property':
                this._checkProperty(node, context, detections);
                break;
        }

        return detections;
    }


    _checkVariableDeclarator(node, context, detections) {
        if (!node.id || !node.init) return;

        const varName = node.id.name;
        const value = this._getStringValue(node.init);

        if (!varName || !value) return;

        if (this._isSensitiveName(varName) || this._isSensitiveValue(value)) {
            detections.push(this._createDetection(node, context, {
                variableName: varName,
                value: value,
                declarationType: this._getDeclarationType(context)
            }));
        }
    }


    _checkAssignmentExpression(node, context, detections) {
        const leftName = this._getIdentifierName(node.left);
        const value = this._getStringValue(node.right);

        if (!leftName || !value) return;

        if (this._isSensitiveName(leftName) || this._isSensitiveValue(value)) {
            detections.push(this._createDetection(node, context, {
                variableName: leftName,
                value: value,
                declarationType: 'assignment'
            }));
        }
    }


    _checkProperty(node, context, detections) {
        const keyName = this._getKeyName(node.key);
        const value = this._getStringValue(node.value);

        if (!keyName || !value) return;

        if (this._isSensitiveName(keyName) || this._isSensitiveValue(value)) {
            detections.push(this._createDetection(node, context, {
                variableName: keyName,
                value: value,
                declarationType: 'property',
                objectPath: this._buildObjectPath(context.ancestors)
            }));
        }
    }


    _isSensitiveName(name) {
        if (!name) return false;
        const lowerName = name.toLowerCase();
        return this.sensitiveKeywords.some(keyword => lowerName.includes(keyword));
    }


    _isSensitiveValue(value) {
        if (!value || typeof value !== 'string') return false;
        if (value.length < 8) return false;
        return this.valuePatterns.some(pattern => pattern.test(value));
    }


    _getStringValue(node) {
        if (!node) return null;
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
            return node.quasis[0].value.cooked || node.quasis[0].value.raw;
        }
        return null;
    }


    _getIdentifierName(node) {
        if (!node) return null;
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'MemberExpression') {
            const obj = this._getIdentifierName(node.object);
            const prop = this._getIdentifierName(node.property);
            return obj && prop ? `${obj}.${prop}` : prop;
        }
        return null;
    }


    _getKeyName(node) {
        if (!node) return null;
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'Literal') return String(node.value);
        return null;
    }


    _getDeclarationType(context) {
        const ancestors = context.ancestors || [];
        for (let i = ancestors.length - 1; i >= 0; i--) {
            if (ancestors[i].type === 'VariableDeclaration') {
                return ancestors[i].kind;
            }
        }
        return 'unknown';
    }


    _buildObjectPath(ancestors) {
        if (!ancestors) return '';
        const parts = [];
        for (const ancestor of ancestors) {
            if (ancestor.type === 'Property' && ancestor.key) {
                const name = this._getKeyName(ancestor.key);
                if (name) parts.push(name);
            }
        }
        return parts.join('.');
    }


    _createDetection(node, context, extra) {
        return {
            type: 'credential',
            value: extra.value,
            confidence: this._isSensitiveValue(extra.value) ? 0.9 : 0.7,
            location: {
                start: { line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 },
                end: { line: node.loc?.end?.line || 0, column: node.loc?.end?.column || 0 }
            },
            context: {
                code: this._extractContext(context.code, node),
                variableName: extra.variableName,
                declarationType: extra.declarationType,
                objectPath: extra.objectPath || null
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
    module.exports = CredentialVisitor;
}
if (typeof window !== 'undefined') {
    window.CredentialVisitor = CredentialVisitor;
}
