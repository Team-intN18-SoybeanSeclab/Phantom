class ConfigObjectVisitor {
    constructor(options = {}) {
        this.name = 'config_object';
        this.nodeTypes = ['ObjectExpression', 'AssignmentExpression', 'ExportDefaultDeclaration'];
        this.enabled = options.enabled !== false;


        this.sensitiveKeys = [
            'apiKey', 'api_key', 'apikey',
            'secret', 'secretKey', 'secret_key',
            'password', 'passwd', 'pwd',
            'token', 'accessToken', 'access_token',
            'privateKey', 'private_key',
            'credentials', 'auth', 'authorization',
            'database', 'db', 'mongodb', 'mysql', 'postgres',
            'redis', 'elasticsearch',
            'aws', 'azure', 'gcp', 'cloud',
            'smtp', 'email', 'mail',
            'stripe', 'paypal', 'payment',
            'oauth', 'jwt', 'session',
            'encryption', 'cipher',
            'host', 'port', 'url', 'endpoint',
            'username', 'user', 'admin'
        ];


        this.configPatterns = [
            'config', 'configuration', 'settings', 'options',
            'env', 'environment', 'constants',
            'credentials', 'secrets'
        ];
    }

    visit(node, context) {
        if (!this.enabled) return [];

        const detections = [];

        switch (node.type) {
            case 'ObjectExpression':
                this._checkObjectExpression(node, context, detections);
                break;
            case 'AssignmentExpression':
                this._checkAssignmentExpression(node, context, detections);
                break;
            case 'ExportDefaultDeclaration':
                this._checkExportDefault(node, context, detections);
                break;
        }

        return detections;
    }


    _checkObjectExpression(node, context, detections) {
        if (!node.properties || node.properties.length === 0) return;


        const isConfig = this._isConfigObject(context);


        for (const prop of node.properties) {
            if (prop.type !== 'Property') continue;

            const keyName = this._getKeyName(prop.key);
            if (!keyName) continue;


            if (this._isSensitiveKey(keyName)) {
                const value = this._extractValue(prop.value);
                if (value !== null) {
                    detections.push(this._createDetection(prop, context, {
                        key: keyName,
                        value: value,
                        isConfig: isConfig,
                        hasDefault: this._hasDefaultValue(prop.value)
                    }));
                }
            }


            if (this._isProcessEnvRef(prop.value)) {
                const envVar = this._getEnvVarName(prop.value);
                detections.push(this._createDetection(prop, context, {
                    key: keyName,
                    value: `process.env.${envVar}`,
                    isEnvRef: true,
                    envVarName: envVar
                }));
            }
        }
    }


    _checkAssignmentExpression(node, context, detections) {

        if (this._isModuleExports(node.left)) {
            if (node.right?.type === 'ObjectExpression') {

                const configDetections = [];
                this._checkObjectExpression(node.right, { ...context, isModuleExports: true }, configDetections);


                for (const detection of configDetections) {
                    detection.confidence = Math.min(1, detection.confidence + 0.1);
                    detection.context.isModuleExports = true;
                }

                detections.push(...configDetections);
            }
        }
    }


    _checkExportDefault(node, context, detections) {
        if (node.declaration?.type === 'ObjectExpression') {
            const configDetections = [];
            this._checkObjectExpression(node.declaration, { ...context, isExportDefault: true }, configDetections);

            for (const detection of configDetections) {
                detection.confidence = Math.min(1, detection.confidence + 0.1);
                detection.context.isExportDefault = true;
            }

            detections.push(...configDetections);
        }
    }


    _isConfigObject(context) {
        const ancestors = context.ancestors || [];

        for (let i = ancestors.length - 1; i >= 0; i--) {
            const ancestor = ancestors[i];


            if (ancestor.type === 'VariableDeclarator' && ancestor.id?.name) {
                const name = ancestor.id.name.toLowerCase();
                if (this.configPatterns.some(p => name.includes(p))) {
                    return true;
                }
            }


            if (ancestor.type === 'Property' && ancestor.key) {
                const keyName = this._getKeyName(ancestor.key)?.toLowerCase();
                if (keyName && this.configPatterns.some(p => keyName.includes(p))) {
                    return true;
                }
            }
        }

        return context.isModuleExports || context.isExportDefault || false;
    }


    _isSensitiveKey(keyName) {
        if (!keyName) return false;
        const lowerKey = keyName.toLowerCase();
        return this.sensitiveKeys.some(k => lowerKey.includes(k.toLowerCase()));
    }


    _isModuleExports(node) {
        if (node?.type !== 'MemberExpression') return false;
        return node.object?.name === 'module' && node.property?.name === 'exports';
    }


    _isProcessEnvRef(node) {
        if (!node) return false;
        if (node.type === 'MemberExpression') {
            if (node.object?.type === 'MemberExpression') {
                return node.object.object?.name === 'process' &&
                       node.object.property?.name === 'env';
            }
        }
        return false;
    }


    _getEnvVarName(node) {
        if (node?.type === 'MemberExpression' && node.property) {
            if (node.property.type === 'Identifier') return node.property.name;
            if (node.property.type === 'Literal') return String(node.property.value);
        }
        return null;
    }


    _hasDefaultValue(node) {
        if (!node) return false;

        if (node.type === 'LogicalExpression' && node.operator === '||') {
            return this._isProcessEnvRef(node.left) && node.right?.type === 'Literal';
        }
        return false;
    }


    _getKeyName(node) {
        if (!node) return null;
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'Literal') return String(node.value);
        return null;
    }


    _extractValue(node) {
        if (!node) return null;

        if (node.type === 'Literal') {
            return typeof node.value === 'string' ? node.value : String(node.value);
        }

        if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
            return node.quasis[0]?.value?.cooked || node.quasis[0]?.value?.raw;
        }


        if (node.type === 'LogicalExpression' && node.operator === '||') {
            if (node.right?.type === 'Literal') {
                return String(node.right.value);
            }
        }

        return null;
    }


    _createDetection(node, context, extra) {
        return {
            type: 'config_object',
            value: extra.value,
            confidence: extra.isConfig ? 0.85 : 0.7,
            location: {
                start: { line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 },
                end: { line: node.loc?.end?.line || 0, column: node.loc?.end?.column || 0 }
            },
            context: {
                code: this._extractContext(context.code, node),
                key: extra.key,
                isConfig: extra.isConfig,
                isEnvRef: extra.isEnvRef || false,
                envVarName: extra.envVarName || null,
                hasDefault: extra.hasDefault || false
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
    module.exports = ConfigObjectVisitor;
}
if (typeof window !== 'undefined') {
    window.ConfigObjectVisitor = ConfigObjectVisitor;
}
