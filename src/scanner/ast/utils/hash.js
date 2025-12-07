/**
 * 哈希工具函数
 * 用于计算代码内容的哈希值，支持 AST 缓存
 */

/**
 * 计算字符串的简单哈希值
 * 使用 djb2 算法，快速且分布均匀
 * @param {string} str - 输入字符串
 * @returns {string} 哈希值（十六进制字符串）
 */
function hashString(str) {
    if (!str || typeof str !== 'string') {
        return '0';
    }
    
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // 转换为32位整数
    }
    
    // 转换为无符号整数并返回十六进制字符串
    return (hash >>> 0).toString(16);
}

/**
 * 计算代码内容的哈希值
 * 用于 AST 缓存的键
 * @param {string} code - JavaScript 代码
 * @returns {string} 哈希值
 */
function hashCode(code) {
    if (!code || typeof code !== 'string') {
        return 'empty';
    }
    
    // 对于较长的代码，使用多段哈希组合
    if (code.length > 10000) {
        const start = hashString(code.substring(0, 5000));
        const middle = hashString(code.substring(code.length / 2 - 2500, code.length / 2 + 2500));
        const end = hashString(code.substring(code.length - 5000));
        const length = code.length.toString(16);
        return `${start}-${middle}-${end}-${length}`;
    }
    
    return hashString(code);
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hashString,
        hashCode
    };
}

// 浏览器环境下挂载到 window
if (typeof window !== 'undefined') {
    window.ASTUtils = window.ASTUtils || {};
    window.ASTUtils.hashString = hashString;
    window.ASTUtils.hashCode = hashCode;
}
