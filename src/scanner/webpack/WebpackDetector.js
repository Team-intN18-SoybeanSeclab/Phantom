/**
 * WebpackDetector - Webpack 应用检测器
 * 负责检测页面是否使用 Webpack 打包
 * 
 * @class WebpackDetector
 */
class WebpackDetector {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.timeout = options.timeout || 3000;
        this.debug = options.debug || false;
    }

    /**
     * 检测 Webpack 应用
     * @param {Window} targetWindow - 目标窗口对象，默认为当前窗口
     * @returns {WebpackDetectionResult} 检测结果
     */
    detect(targetWindow = window) {
        const result = {
            detected: false,
            version: null,
            buildMode: 'unknown',
            features: {
                hasWebpackJsonp: false,
                hasWebpackChunk: false,
                hasWebpackRequire: false,
                hasWebpackModules: false,
                hasSourceMap: false
            },
            runtime: null,
            timestamp: Date.now()
        };

        if (!this.enabled) {
            return result;
        }

        try {
            // 检测 Webpack 特征
            result.features = this._detectFeatures(targetWindow);
            
            // 判断是否为 Webpack 应用
            result.detected = this._hasWebpackFeatures(result.features);
            
            if (result.detected) {
                // 检测版本
                result.version = this.detectVersion(targetWindow);
                
                // 检测打包模式
                result.buildMode = this.detectBuildMode(targetWindow);
                
                // 获取 Runtime 信息
                result.runtime = this.getWebpackRuntime(targetWindow);
            }

            if (this.debug) {
                console.log('[WebpackDetector] 检测结果:', result);
            }

        } catch (error) {
            console.error('[WebpackDetector] 检测过程中发生错误:', error);
            result.error = error.message;
        }

        return result;
    }


    /**
     * 检测 Webpack 特征
     * @private
     * @param {Window} targetWindow - 目标窗口对象
     * @returns {Object} 特征检测结果
     */
    _detectFeatures(targetWindow) {
        const features = {
            hasWebpackJsonp: false,
            hasWebpackChunk: false,
            hasWebpackRequire: false,
            hasWebpackModules: false,
            hasSourceMap: false
        };

        try {
            // 检测 webpackJsonp (Webpack 4)
            features.hasWebpackJsonp = this._checkWebpackJsonp(targetWindow);

            // 检测 webpackChunk (Webpack 5)
            features.hasWebpackChunk = this._checkWebpackChunk(targetWindow);

            // 检测 __webpack_require__
            features.hasWebpackRequire = this._checkWebpackRequire(targetWindow);

            // 检测 __webpack_modules__
            features.hasWebpackModules = this._checkWebpackModules(targetWindow);

            // 检测 Source Map
            features.hasSourceMap = this._checkSourceMap();

        } catch (error) {
            console.warn('[WebpackDetector] 特征检测部分失败:', error);
        }

        return features;
    }

    /**
     * 检测 webpackJsonp (Webpack 4)
     * @private
     */
    _checkWebpackJsonp(targetWindow) {
        try {
            // 检查常见的 webpackJsonp 变量名
            const jsonpNames = ['webpackJsonp', 'webpackJsonpCallback'];
            
            for (const name of jsonpNames) {
                if (targetWindow[name] && Array.isArray(targetWindow[name])) {
                    return true;
                }
            }

            // 检查带有项目名前缀的 webpackJsonp
            for (const key of Object.keys(targetWindow)) {
                if (key.includes('webpackJsonp') && Array.isArray(targetWindow[key])) {
                    return true;
                }
            }
        } catch (e) {
            // 忽略访问错误
        }
        return false;
    }

    /**
     * 检测 webpackChunk (Webpack 5)
     * @private
     */
    _checkWebpackChunk(targetWindow) {
        try {
            // 检查带有项目名前缀的 webpackChunk
            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') && Array.isArray(targetWindow[key])) {
                    return true;
                }
            }
        } catch (e) {
            // 忽略访问错误
        }
        return false;
    }

    /**
     * 检测 __webpack_require__
     * @private
     */
    _checkWebpackRequire(targetWindow) {
        try {
            // 直接检查全局变量
            if (typeof targetWindow.__webpack_require__ === 'function') {
                return true;
            }

            // 检查 webpackJsonp/webpackChunk 中的 push 方法是否被重写
            for (const key of Object.keys(targetWindow)) {
                if ((key.includes('webpackJsonp') || key.startsWith('webpackChunk')) && 
                    Array.isArray(targetWindow[key])) {
                    const arr = targetWindow[key];
                    // Webpack 会重写 push 方法
                    if (arr.push && arr.push.toString().includes('webpackJsonpCallback')) {
                        return true;
                    }
                }
            }
        } catch (e) {
            // 忽略访问错误
        }
        return false;
    }

    /**
     * 检测 __webpack_modules__
     * @private
     */
    _checkWebpackModules(targetWindow) {
        try {
            if (targetWindow.__webpack_modules__ && 
                typeof targetWindow.__webpack_modules__ === 'object') {
                return true;
            }
        } catch (e) {
            // 忽略访问错误
        }
        return false;
    }

    /**
     * 检测页面中的 Source Map
     * @private
     */
    _checkSourceMap() {
        try {
            const scripts = document.querySelectorAll('script[src]');
            for (const script of scripts) {
                const src = script.src;
                if (src && (src.endsWith('.js.map') || src.includes('sourceMappingURL'))) {
                    return true;
                }
            }

            // 检查内联脚本中的 sourceMappingURL
            const inlineScripts = document.querySelectorAll('script:not([src])');
            for (const script of inlineScripts) {
                if (script.textContent && script.textContent.includes('sourceMappingURL')) {
                    return true;
                }
            }
        } catch (e) {
            // 忽略访问错误
        }
        return false;
    }


    /**
     * 判断是否具有 Webpack 特征
     * @private
     */
    _hasWebpackFeatures(features) {
        return features.hasWebpackJsonp || 
               features.hasWebpackChunk || 
               features.hasWebpackRequire ||
               features.hasWebpackModules;
    }

    /**
     * 检测 Webpack 版本
     * @param {Window} targetWindow - 目标窗口对象
     * @returns {string|null} Webpack 版本 ('4', '5', 'unknown', null)
     */
    detectVersion(targetWindow = window) {
        try {
            // Webpack 5 特征: webpackChunk 数组
            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') && Array.isArray(targetWindow[key])) {
                    return '5';
                }
            }

            // Webpack 4 特征: webpackJsonp 数组
            for (const key of Object.keys(targetWindow)) {
                if (key.includes('webpackJsonp') && Array.isArray(targetWindow[key])) {
                    return '4';
                }
            }

            // 检查 __webpack_require__.v 版本信息
            if (typeof targetWindow.__webpack_require__ === 'function') {
                const req = targetWindow.__webpack_require__;
                if (req.v) {
                    return req.v.startsWith('5') ? '5' : '4';
                }
            }

            return 'unknown';
        } catch (error) {
            console.warn('[WebpackDetector] 版本检测失败:', error);
            return null;
        }
    }

    /**
     * 检测打包模式
     * @param {Window} targetWindow - 目标窗口对象
     * @returns {string} 打包模式 ('development', 'production', 'unknown')
     */
    detectBuildMode(targetWindow = window) {
        try {
            // 检查 process.env.NODE_ENV
            if (typeof targetWindow.process !== 'undefined' && 
                targetWindow.process.env && 
                targetWindow.process.env.NODE_ENV) {
                return targetWindow.process.env.NODE_ENV;
            }

            // 检查代码特征判断模式
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent || '';
                
                // development 模式特征
                if (content.includes('development') && 
                    (content.includes('__webpack_require__') || content.includes('webpackJsonp'))) {
                    return 'development';
                }
                
                // 检查是否有未压缩的代码特征
                if (content.includes('__webpack_require__') && 
                    content.includes('// ') && 
                    content.length > 10000) {
                    return 'development';
                }
            }

            // 检查外部脚本是否有 .min.js 后缀
            const externalScripts = document.querySelectorAll('script[src]');
            let hasMinified = false;
            for (const script of externalScripts) {
                if (script.src.includes('.min.js') || script.src.includes('.prod.js')) {
                    hasMinified = true;
                    break;
                }
            }

            return hasMinified ? 'production' : 'unknown';
        } catch (error) {
            console.warn('[WebpackDetector] 模式检测失败:', error);
            return 'unknown';
        }
    }

    /**
     * 获取 Webpack Runtime 信息
     * @param {Window} targetWindow - 目标窗口对象
     * @returns {Object|null} Runtime 信息
     */
    getWebpackRuntime(targetWindow = window) {
        try {
            const runtime = {
                chunkArrayName: null,
                chunkArray: null,
                requireFunction: null,
                modules: null,
                publicPath: null
            };

            // 查找 chunk 数组
            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') || key.includes('webpackJsonp')) {
                    if (Array.isArray(targetWindow[key])) {
                        runtime.chunkArrayName = key;
                        runtime.chunkArray = targetWindow[key];
                        break;
                    }
                }
            }

            // 获取 __webpack_require__
            if (typeof targetWindow.__webpack_require__ === 'function') {
                runtime.requireFunction = targetWindow.__webpack_require__;
                
                // 尝试获取 publicPath
                if (runtime.requireFunction.p) {
                    runtime.publicPath = runtime.requireFunction.p;
                }
                
                // 尝试获取模块
                if (runtime.requireFunction.m) {
                    runtime.modules = runtime.requireFunction.m;
                }
            }

            // 获取 __webpack_modules__
            if (targetWindow.__webpack_modules__) {
                runtime.modules = targetWindow.__webpack_modules__;
            }

            return runtime;
        } catch (error) {
            console.warn('[WebpackDetector] Runtime 获取失败:', error);
            return null;
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackDetector = WebpackDetector;
}
