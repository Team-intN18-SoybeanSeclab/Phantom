const DEFAULT_PARSE_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    ranges: true,
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowReserved: true,
    allowReturnOutsideFunction: true
};


function preprocessCode(code, options = {}) {
    if (!code || typeof code !== 'string') {
        return '';
    }


    if (code.charCodeAt(0) === 0xFEFF) {
        code = code.slice(1);
    }


    if (code.startsWith('\uFEFF')) {
        code = code.slice(1);
    }


    code = code.replace(/\r\n/g, '\n');


    code = code.replace(/[\u200B-\u200D\uFEFF]/g, '');


    if (options.stripJSX !== false) {
        code = stripJSXSyntax(code);
    }


    if (options.stripTypes !== false) {
        code = stripTypeAnnotations(code);
    }

    return code;
}


function stripJSXSyntax(code) {
    if (!code) return code;



    const jsxPattern = /<([A-Z][a-zA-Z0-9]*|[a-z]+(?:-[a-z]+)*)[^>]*(?:\/>|>[\s\S]*?<\/\1>)/g;


    if (!jsxPattern.test(code)) {
        return code;
    }


    jsxPattern.lastIndex = 0;


    return code.replace(jsxPattern, (match) => {

        return '"' + '_'.repeat(Math.max(0, match.length - 2)) + '"';
    });
}


function stripTypeAnnotations(code) {
    if (!code) return code;






    code = code.replace(/:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[=;,)\]])/g, '');


    code = code.replace(/(\w+)\s*:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[,)])/g, '$1');


    code = code.replace(/\)\s*:\s*[A-Z][a-zA-Z0-9<>,\s\[\]|&]*(?=\s*[{=>])/g, ')');


    code = code.replace(/^\s*(export\s+)?(interface|type)\s+\w+[\s\S]*?(?=\n\s*(export|const|let|var|function|class|import|$))/gm, '');

    return code;
}


function getAcorn() {

    if (typeof window !== 'undefined' && window.acorn) {
        return window.acorn;
    }


    if (typeof require !== 'undefined') {
        try {
            return require('acorn');
        } catch (e) {
            console.warn(' [ASTParser] acorn not found in Node.js environment');
        }
    }

    return null;
}


function parseCode(code, options = {}) {
    const acorn = getAcorn();

    if (!acorn) {
        console.error(' [ASTParser] acorn parser not available');
        return null;
    }


    const processedCode = preprocessCode(code);

    if (!processedCode) {
        return null;
    }


    const parseOptions = {
        ...DEFAULT_PARSE_OPTIONS,
        ...options
    };


    const modes = [
        { sourceType: 'module' },
        { sourceType: 'script' }
    ];

    for (const mode of modes) {
        try {
            const ast = acorn.parse(processedCode, {
                ...parseOptions,
                ...mode
            });
            return ast;
        } catch (error) {

            continue;
        }
    }


    return null;
}


function tryParse(code, options = {}) {
    const acorn = getAcorn();

    if (!acorn) {
        return {
            ast: null,
            error: new Error('acorn parser not available'),
            mode: null,
            preprocessed: false
        };
    }


    const processedCode = preprocessCode(code, options);

    if (!processedCode) {
        return {
            ast: null,
            error: new Error('Empty or invalid code'),
            mode: null,
            preprocessed: false
        };
    }


    const parseOptions = {
        ...DEFAULT_PARSE_OPTIONS,
        ...options
    };


    delete parseOptions.stripJSX;
    delete parseOptions.stripTypes;


    const modes = [
        { sourceType: 'module', name: 'module' },
        { sourceType: 'script', name: 'script' }
    ];

    let lastError = null;

    for (const mode of modes) {
        try {
            const ast = acorn.parse(processedCode, {
                ...parseOptions,
                sourceType: mode.sourceType
            });
            return {
                ast,
                error: null,
                mode: mode.name,
                preprocessed: code !== processedCode
            };
        } catch (error) {
            lastError = error;
            continue;
        }
    }


    try {
        const ast = acorn.parse(processedCode, {
            ...parseOptions,
            sourceType: 'script',
            allowReserved: true,
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
            allowAwaitOutsideFunction: true
        });
        return {
            ast,
            error: null,
            mode: 'loose',
            preprocessed: code !== processedCode
        };
    } catch (error) {

    }

    return {
        ast: null,
        error: lastError,
        mode: null,
        preprocessed: code !== processedCode
    };
}


function parseWithErrorInfo(code, options = {}) {
    const result = tryParse(code, options);

    if (result.error) {

        const errorInfo = {
            message: result.error.message,
            line: null,
            column: null,
            pos: null
        };


        if (result.error.loc) {
            errorInfo.line = result.error.loc.line;
            errorInfo.column = result.error.loc.column;
        }
        if (result.error.pos !== undefined) {
            errorInfo.pos = result.error.pos;
        }


        const posMatch = result.error.message.match(/\((\d+):(\d+)\)/);
        if (posMatch && !errorInfo.line) {
            errorInfo.line = parseInt(posMatch[1], 10);
            errorInfo.column = parseInt(posMatch[2], 10);
        }

        result.errorInfo = errorInfo;
    }

    return result;
}


function isParserAvailable() {
    return getAcorn() !== null;
}


function getParserVersion() {
    const acorn = getAcorn();
    return acorn ? acorn.version : null;
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseCode,
        tryParse,
        parseWithErrorInfo,
        preprocessCode,
        stripJSXSyntax,
        stripTypeAnnotations,
        isParserAvailable,
        getParserVersion,
        DEFAULT_PARSE_OPTIONS
    };
}


if (typeof window !== 'undefined') {
    window.ASTParser = {
        parseCode,
        tryParse,
        parseWithErrorInfo,
        preprocessCode,
        stripJSXSyntax,
        stripTypeAnnotations,
        isParserAvailable,
        getParserVersion,
        DEFAULT_PARSE_OPTIONS
    };
}
