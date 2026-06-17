function extractContext(code, location, contextLines = 2) {
    if (!code || !location) {
        return '';
    }

    const lines = code.split('\n');
    const startLine = Math.max(0, (location.start?.line || 1) - 1 - contextLines);
    const endLine = Math.min(lines.length, (location.end?.line || location.start?.line || 1) + contextLines);

    return lines.slice(startLine, endLine).join('\n');
}


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


function buildObjectPath(node, ancestors = []) {
    const parts = [];


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


function getFunctionName(node) {
    if (!node) {
        return null;
    }


    if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
    }


    if (node.type === 'VariableDeclarator' && node.id) {
        return node.id.name;
    }


    if (node.type === 'Property' && node.key) {
        if (node.key.type === 'Identifier') {
            return node.key.name;
        }
        if (node.key.type === 'Literal') {
            return String(node.key.value);
        }
    }


    if (node.type === 'MethodDefinition' && node.key) {
        if (node.key.type === 'Identifier') {
            return node.key.name;
        }
    }

    return null;
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractContext,
        getNodeLocation,
        buildObjectPath,
        getFunctionName
    };
}


if (typeof window !== 'undefined') {
    window.ASTUtils = window.ASTUtils || {};
    window.ASTUtils.extractContext = extractContext;
    window.ASTUtils.getNodeLocation = getNodeLocation;
    window.ASTUtils.buildObjectPath = buildObjectPath;
    window.ASTUtils.getFunctionName = getFunctionName;
}
