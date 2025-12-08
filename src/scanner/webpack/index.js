/**
 * Webpack 扫描器模块入口
 * 
 * 提供 Webpack 应用检测和扫描功能
 */

// 初始化 Webpack 扫描器
async function initWebpackScanner() {
    console.log('[WebpackScanner] 初始化 Webpack 扫描器...');
    
    try {
        // 检查核心依赖是否已加载
        const dependencies = [
            { name: 'WebpackDetector', loaded: typeof WebpackDetector !== 'undefined' },
            { name: 'ChunkAnalyzer', loaded: typeof ChunkAnalyzer !== 'undefined' },
            { name: 'SourceMapParser', loaded: typeof SourceMapParser !== 'undefined' },
            { name: 'RuntimeAnalyzer', loaded: typeof RuntimeAnalyzer !== 'undefined' },
            { name: 'ModuleAnalyzer', loaded: typeof ModuleAnalyzer !== 'undefined' },
            { name: 'WebpackScannerBridge', loaded: typeof WebpackScannerBridge !== 'undefined' }
        ];
        
        const missingDeps = dependencies.filter(d => !d.loaded);
        if (missingDeps.length > 0) {
            console.warn('[WebpackScanner] 缺少依赖:', missingDeps.map(d => d.name).join(', '));
            return false;
        }
        
        // 创建全局实例
        if (!window.webpackDetector) {
            window.webpackDetector = new WebpackDetector({ debug: false });
        }
        
        if (!window.webpackScannerBridge) {
            window.webpackScannerBridge = new WebpackScannerBridge({ debug: false });
            await window.webpackScannerBridge.init();
        }
        
        console.log('[WebpackScanner] Webpack 扫描器初始化完成');
        return true;
        
    } catch (error) {
        console.error('[WebpackScanner] 初始化失败:', error);
        return false;
    }
}

/**
 * 执行 Webpack 检测
 * @returns {Object} 检测结果
 */
async function detectWebpack() {
    try {
        if (!window.webpackDetector) {
            await initWebpackScanner();
        }
        
        if (!window.webpackDetector) {
            return { detected: false, error: 'WebpackDetector 未初始化' };
        }
        
        return window.webpackDetector.detect();
        
    } catch (error) {
        console.error('[WebpackScanner] 检测失败:', error);
        return { detected: false, error: error.message };
    }
}

/**
 * 执行完整 Webpack 扫描
 * @param {boolean} deepScan - 是否进行深度扫描（分析外部脚本内容）
 * @returns {Object} 扫描结果
 */
async function scanWebpack(deepScan = false) {
    try {
        if (!window.webpackScannerBridge) {
            await initWebpackScanner();
        }
        
        if (!window.webpackScannerBridge) {
            return { detected: false, error: 'WebpackScannerBridge 未初始化' };
        }
        
        return await window.webpackScannerBridge.scan(deepScan);
        
    } catch (error) {
        console.error('[WebpackScanner] 扫描失败:', error);
        return { detected: false, error: error.message };
    }
}

/**
 * 执行深度 Webpack 扫描（分析外部脚本内容）
 * 参考 Webpack_Insight 的 analyzeExternalScripts 功能
 * @returns {Object} 扫描结果
 */
async function deepScanWebpack() {
    return await scanWebpack(true);
}

/**
 * 获取 Webpack 扫描器状态
 * @returns {Object} 状态信息
 */
function getWebpackScannerStatus() {
    return {
        initialized: !!window.webpackScannerBridge?.initialized,
        detectorLoaded: typeof WebpackDetector !== 'undefined',
        chunkAnalyzerLoaded: typeof ChunkAnalyzer !== 'undefined',
        sourceMapParserLoaded: typeof SourceMapParser !== 'undefined',
        runtimeAnalyzerLoaded: typeof RuntimeAnalyzer !== 'undefined',
        moduleAnalyzerLoaded: typeof ModuleAnalyzer !== 'undefined',
        bridgeLoaded: typeof WebpackScannerBridge !== 'undefined'
    };
}

/**
 * 获取扫描结果摘要
 * @returns {Object} 摘要信息
 */
function getWebpackScanSummary() {
    if (!window.webpackScannerBridge) {
        return { detected: false };
    }
    return window.webpackScannerBridge.getSummary();
}

/**
 * 检测 Vue + Webpack 组合
 * @returns {Object} 检测结果
 */
async function detectVueWebpack() {
    const result = {
        vue: { detected: false },
        webpack: { detected: false },
        isVueWebpack: false
    };
    
    try {
        // 检测 Webpack
        const webpackResult = await detectWebpack();
        result.webpack = {
            detected: webpackResult.detected,
            version: webpackResult.version,
            buildMode: webpackResult.buildMode
        };
        
        // 检测 Vue
        if (typeof window.VueDetectorBridge !== 'undefined') {
            const vueBridge = new window.VueDetectorBridge();
            const vueResult = await vueBridge.detect();
            result.vue = {
                detected: vueResult.detected,
                version: vueResult.framework?.version,
                hasRouter: vueResult.framework?.hasRouter,
                routeCount: vueResult.routes?.length || 0
            };
        } else {
            // 简单检测 Vue
            result.vue.detected = !!(window.Vue || window.__VUE__ || 
                document.querySelector('[data-v-]') ||
                document.querySelector('#app[data-server-rendered]'));
        }
        
        // 判断是否为 Vue + Webpack 组合
        result.isVueWebpack = result.vue.detected && result.webpack.detected;
        
        if (result.isVueWebpack) {
            console.log('[WebpackScanner] 检测到 Vue + Webpack 组合');
        }
        
    } catch (error) {
        console.error('[WebpackScanner] Vue + Webpack 检测失败:', error);
    }
    
    return result;
}

/**
 * 执行完整的框架扫描（Vue + Webpack）
 * @returns {Object} 扫描结果
 */
async function scanFrameworks() {
    const result = {
        vue: null,
        webpack: null,
        isVueWebpack: false,
        combined: {}
    };
    
    try {
        // 执行 Webpack 扫描
        result.webpack = await scanWebpack();
        
        // 执行 Vue 检测
        if (typeof window.VueDetectorBridge !== 'undefined') {
            const vueBridge = new window.VueDetectorBridge();
            result.vue = await vueBridge.detect();
        }
        
        // 判断组合
        result.isVueWebpack = (result.vue?.detected || false) && 
                              (result.webpack?.detection?.detected || false);
        
        // 合并结果
        if (result.isVueWebpack) {
            result.combined = {
                framework: 'Vue + Webpack',
                vueVersion: result.vue?.framework?.version || 'unknown',
                webpackVersion: result.webpack?.detection?.version || 'unknown',
                routes: result.vue?.routes || [],
                chunks: result.webpack?.chunks || [],
                sourceMaps: result.webpack?.sourceMaps || [],
                lazyRoutes: result.vue?.routes?.filter(r => r.lazyLoaded)?.length || 0
            };
        }
        
    } catch (error) {
        console.error('[WebpackScanner] 框架扫描失败:', error);
    }
    
    return result;
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.initWebpackScanner = initWebpackScanner;
    window.detectWebpack = detectWebpack;
    window.scanWebpack = scanWebpack;
    window.deepScanWebpack = deepScanWebpack;
    window.getWebpackScannerStatus = getWebpackScannerStatus;
    window.getWebpackScanSummary = getWebpackScanSummary;
    window.detectVueWebpack = detectVueWebpack;
    window.scanFrameworks = scanFrameworks;
}
