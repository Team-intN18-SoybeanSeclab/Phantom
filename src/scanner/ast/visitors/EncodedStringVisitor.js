class EncodedStringVisitor {
    constructor(options = {}) {
        this.name = 'encoded_string';
        this.nodeTypes = ['Literal', 'BinaryExpression', 'CallExpression'];
        this.enabled = options.enabled !== false;


        this.base64Pattern = /^[A-Za-z0-9+/]{20,}={0,2}$/;


        this.hexPattern = /^(0x)?[a-fA-F0-9]{16,}$/;


        this.sensitiveKeywords = [
            'password', 'secret', 'key', 'token', 'api',
            'auth', 'credential', 'private', 'admin'
        ];
    }

    visit(node, context) {
        if (!this.enabled) return [];

        const detections = [];

        switch (node.type) {
            case 'Literal':
                this._checkLiteral(node, context, detections);
                break;
            case 'BinaryExpression':
                this._checkBinaryExpression(node, context, detections);
                break;
            case 'CallExpression':
                this._checkCallExpression(node, context, detections);
                break;
        }

        return detections;
    }


    _checkLiteral(node, context, detections) {
        if (typeof node.value !== 'string') return;

        const value = node.value;
        if (value.length < 16) return;


        if (this._isBase64(value)) {
            const decoded = this._decodeBase64(value);
            if (decoded && this._containsSensitiveContent(decoded)) {
                detections.push(this._createDetection(node, context, {
                    encodedValue: value,
                    decodedValue: decoded,
                    encoding: 'base64'
                }));
            }
        }


        if (this._isHex(value)) {
            const decoded = this._decodeHex(value);
            if (decoded && this._containsSensitiveContent(decoded)) {
                detections.push(this._createDetection(node, context, {
                    encodedValue: value,
                    decodedValue: decoded,
                    encoding: 'hex'
                }));
            }
        }
    }


    _checkBinaryExpression(node, context, detections) {
        if (node.operator !== '+') return;


        const reconstructed = this._reconstructString(node);
        if (!reconstructed || reconstructed.length < 16) return;


        if (this._containsSensitiveContent(reconstructed)) {
            detections.push(this._createDetection(node, context, {
                encodedValue: reconstructed,
                decodedValue: null,
                encoding: 'concatenation',
                isReconstructed: true
            }));
        }


        if (this._isBase64(reconstructed)) {
            const decoded = this._decodeBase64(reconstructed);
            if (decoded) {
                detections.push(this._createDetection(node, context, {
                    encodedValue: reconstructed,
                    decodedValue: decoded,
                    encoding: 'base64_concatenated',
                    isReconstructed: true
                }));
            }
        }
    }


    _checkCallExpression(node, context, detections) {

        if (this._isArrayJoin(node)) {
            const reconstructed = this._reconstructFromJoin(node);
            if (reconstructed && reconstructed.length >= 16) {
                if (this._containsSensitiveContent(reconstructed) || this._isBase64(reconstructed)) {
                    const decoded = this._isBase64(reconstructed) ? this._decodeBase64(reconstructed) : null;
                    detections.push(this._createDetection(node, context, {
                        encodedValue: reconstructed,
                        decodedValue: decoded,
                        encoding: 'array_join',
                        isReconstructed: true
                    }));
                }
            }
        }


        if (this._isAtobBtoa(node)) {
            const arg = node.arguments[0];
            if (arg?.type === 'Literal' && typeof arg.value === 'string') {
                const calleeName = node.callee?.name;
                if (calleeName === 'atob') {
                    const decoded = this._decodeBase64(arg.value);
                    if (decoded) {
                        detections.push(this._createDetection(node, context, {
                            encodedValue: arg.value,
                            decodedValue: decoded,
                            encoding: 'atob_call'
                        }));
                    }
                }
            }
        }


        if (this._isFromCharCode(node)) {
            const reconstructed = this._reconstructFromCharCode(node);
            if (reconstructed && reconstructed.length >= 8) {
                detections.push(this._createDetection(node, context, {
                    encodedValue: `String.fromCharCode(...)`,
                    decodedValue: reconstructed,
                    encoding: 'fromCharCode',
                    isReconstructed: true
                }));
            }
        }
    }


    _isBase64(str) {
        if (!str || typeof str !== 'string') return false;
        if (str.length < 16 || str.length % 4 !== 0) return false;
        return this.base64Pattern.test(str);
    }


    _isHex(str) {
        if (!str || typeof str !== 'string') return false;
        return this.hexPattern.test(str);
    }


    _decodeBase64(str) {
        try {
            if (typeof atob !== 'undefined') {
                return atob(str);
            }
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'base64').toString('utf-8');
            }
        } catch (e) {
            return null;
        }
        return null;
    }


    _decodeHex(str) {
        try {
            const hex = str.startsWith('0x') ? str.slice(2) : str;
            let result = '';
            for (let i = 0; i < hex.length; i += 2) {
                result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            }
            return result;
        } catch (e) {
            return null;
        }
    }


    _reconstructString(node) {
        if (!node) return null;

        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }

        if (node.type === 'BinaryExpression' && node.operator === '+') {
            const left = this._reconstructString(node.left);
            const right = this._reconstructString(node.right);
            if (left !== null && right !== null) {
                return left + right;
            }
        }

        return null;
    }


    _isArrayJoin(node) {
        if (node.callee?.type !== 'MemberExpression') return false;
        return node.callee.property?.name === 'join';
    }


    _reconstructFromJoin(node) {
        const array = node.callee?.object;
        if (array?.type !== 'ArrayExpression') return null;

        const separator = node.arguments[0]?.value ?? ',';
        const elements = array.elements
            .filter(e => e?.type === 'Literal' && typeof e.value === 'string')
            .map(e => e.value);

        if (elements.length === array.elements.length) {
            return elements.join(separator);
        }
        return null;
    }


    _isAtobBtoa(node) {
        const name = node.callee?.name;
        return name === 'atob' || name === 'btoa';
    }


    _isFromCharCode(node) {
        if (node.callee?.type !== 'MemberExpression') return false;
        return node.callee.object?.name === 'String' &&
               node.callee.property?.name === 'fromCharCode';
    }


    _reconstructFromCharCode(node) {
        const args = node.arguments;
        if (!args || args.length === 0) return null;

        const chars = args
            .filter(a => a?.type === 'Literal' && typeof a.value === 'number')
            .map(a => String.fromCharCode(a.value));

        if (chars.length === args.length) {
            return chars.join('');
        }
        return null;
    }


    _containsSensitiveContent(str) {
        if (!str || typeof str !== 'string') return false;
        const lower = str.toLowerCase();
        return this.sensitiveKeywords.some(k => lower.includes(k));
    }


    _createDetection(node, context, extra) {
        return {
            type: 'encoded_string',
            value: extra.decodedValue || extra.encodedValue,
            confidence: extra.decodedValue ? 0.85 : 0.7,
            location: {
                start: { line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 },
                end: { line: node.loc?.end?.line || 0, column: node.loc?.end?.column || 0 }
            },
            context: {
                code: this._extractContext(context.code, node),
                encoding: extra.encoding,
                encodedValue: extra.encodedValue,
                decodedValue: extra.decodedValue,
                isReconstructed: extra.isReconstructed || false
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
    module.exports = EncodedStringVisitor;
}
if (typeof window !== 'undefined') {
    window.EncodedStringVisitor = EncodedStringVisitor;
}
