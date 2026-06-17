function hashString(str) {
    if (!str || typeof str !== 'string') {
        return '0';
    }

    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }


    return (hash >>> 0).toString(16);
}


function hashCode(code) {
    if (!code || typeof code !== 'string') {
        return 'empty';
    }


    if (code.length > 10000) {
        const start = hashString(code.substring(0, 5000));
        const middle = hashString(code.substring(code.length / 2 - 2500, code.length / 2 + 2500));
        const end = hashString(code.substring(code.length - 5000));
        const length = code.length.toString(16);
        return `${start}-${middle}-${end}-${length}`;
    }

    return hashString(code);
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hashString,
        hashCode
    };
}


if (typeof window !== 'undefined') {
    window.ASTUtils = window.ASTUtils || {};
    window.ASTUtils.hashString = hashString;
    window.ASTUtils.hashCode = hashCode;
}
