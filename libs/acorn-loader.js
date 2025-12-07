/**
 * Acorn 加载器
 * 用于在 Chrome 扩展中加载 acorn 解析库
 * 
 * 使用方法：
 * 1. 下载 acorn.min.js 到 libs/ 目录
 *    - 从 https://cdn.jsdelivr.net/npm/acorn/dist/acorn.min.js 下载
 *    - 或使用 npm: npm pack acorn && tar -xf acorn-*.tgz
 * 2. 在 manifest.json 中添加到 web_accessible_resources
 * 3. 在需要使用的地方调用 loadAcorn()
 */

/**
 * 加载 acorn 库
 * @returns {Promise<Object>} acorn 对象
 */
async function loadAcorn() {
    // 如果已经加载，直接返回
    if (typeof window !== 'undefined' && window.acorn) {
        return window.acorn;
    }
    
    // 尝试从本地加载
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('libs/acorn.min.js');
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        if (window.acorn) {
            console.log('✅ [AcornLoader] acorn loaded from local file');
            return window.acorn;
        }
    } catch (error) {
        console.warn('⚠️ [AcornLoader] Failed to load acorn from local file:', error);
    }
    
    // 本地加载失败，提示用户
    console.error('❌ [AcornLoader] acorn not available. Please download acorn.min.js to libs/ directory');
    console.error('   Download from: https://cdn.jsdelivr.net/npm/acorn/dist/acorn.min.js');
    
    return null;
}

/**
 * 检查 acorn 是否已加载
 * @returns {boolean} 是否已加载
 */
function isAcornLoaded() {
    return typeof window !== 'undefined' && window.acorn !== undefined;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAcorn,
        isAcornLoaded
    };
}

// 浏览器环境下挂载到 window
if (typeof window !== 'undefined') {
    window.AcornLoader = {
        loadAcorn,
        isAcornLoaded
    };
}
