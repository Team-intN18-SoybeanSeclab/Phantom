class ASTVisitor {
    constructor(options = {}) {

        this.name = options.name || 'base';


        this.nodeTypes = options.nodeTypes || [];


        this.enabled = options.enabled !== false;
    }


    visit(node, context) {

        return [];
    }


    leave(node, context) {

    }


    matches(node) {
        if (!node || !node.type) {
            return false;
        }
        return this.nodeTypes.includes(node.type);
    }


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


    extractContext(code, location, contextLines = 2) {
        if (!code || !location) return '';

        const lines = code.split('\n');
        const startLine = Math.max(0, (location.start?.line || 1) - 1 - contextLines);
        const endLine = Math.min(lines.length, (location.end?.line || location.start?.line || 1) + contextLines);

        return lines.slice(startLine, endLine).join('\n');
    }


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


    getStringValue(node) {
        if (!node) return null;

        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }
        if (node.type === 'TemplateLiteral') {

            return node.quasis.map(q => q.value.cooked || q.value.raw).join('${...}');
        }
        return null;
    }


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


if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTVisitor;
}

if (typeof window !== 'undefined') {
    window.ASTVisitor = ASTVisitor;
}
