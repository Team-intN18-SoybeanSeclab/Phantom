class WebpackDetector {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.timeout = options.timeout || 3000;
        this.debug = options.debug || false;
    }


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

            result.features = this._detectFeatures(targetWindow);


            result.detected = this._hasWebpackFeatures(result.features);

            if (result.detected) {

                result.version = this.detectVersion(targetWindow);


                result.buildMode = this.detectBuildMode(targetWindow);


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



    _detectFeatures(targetWindow) {
        const features = {
            hasWebpackJsonp: false,
            hasWebpackChunk: false,
            hasWebpackRequire: false,
            hasWebpackModules: false,
            hasSourceMap: false
        };

        try {

            features.hasWebpackJsonp = this._checkWebpackJsonp(targetWindow);


            features.hasWebpackChunk = this._checkWebpackChunk(targetWindow);


            features.hasWebpackRequire = this._checkWebpackRequire(targetWindow);


            features.hasWebpackModules = this._checkWebpackModules(targetWindow);


            features.hasSourceMap = this._checkSourceMap();

        } catch (error) {
            console.warn('[WebpackDetector] 特征检测部分失败:', error);
        }

        return features;
    }


    _checkWebpackJsonp(targetWindow) {
        try {

            const jsonpNames = ['webpackJsonp', 'webpackJsonpCallback'];

            for (const name of jsonpNames) {
                if (targetWindow[name] && Array.isArray(targetWindow[name])) {
                    return true;
                }
            }


            for (const key of Object.keys(targetWindow)) {
                if (key.includes('webpackJsonp') && Array.isArray(targetWindow[key])) {
                    return true;
                }
            }
        } catch (e) {

        }
        return false;
    }


    _checkWebpackChunk(targetWindow) {
        try {

            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') && Array.isArray(targetWindow[key])) {
                    return true;
                }
            }
        } catch (e) {

        }
        return false;
    }


    _checkWebpackRequire(targetWindow) {
        try {

            if (typeof targetWindow.__webpack_require__ === 'function') {
                return true;
            }


            for (const key of Object.keys(targetWindow)) {
                if ((key.includes('webpackJsonp') || key.startsWith('webpackChunk')) &&
                    Array.isArray(targetWindow[key])) {
                    const arr = targetWindow[key];

                    if (arr.push && arr.push.toString().includes('webpackJsonpCallback')) {
                        return true;
                    }
                }
            }
        } catch (e) {

        }
        return false;
    }


    _checkWebpackModules(targetWindow) {
        try {
            if (targetWindow.__webpack_modules__ &&
                typeof targetWindow.__webpack_modules__ === 'object') {
                return true;
            }
        } catch (e) {

        }
        return false;
    }


    _checkSourceMap() {
        try {
            const scripts = document.querySelectorAll('script[src]');
            for (const script of scripts) {
                const src = script.src;
                if (src && (src.endsWith('.js.map') || src.includes('sourceMappingURL'))) {
                    return true;
                }
            }


            const inlineScripts = document.querySelectorAll('script:not([src])');
            for (const script of inlineScripts) {
                if (script.textContent && script.textContent.includes('sourceMappingURL')) {
                    return true;
                }
            }
        } catch (e) {

        }
        return false;
    }



    _hasWebpackFeatures(features) {
        return features.hasWebpackJsonp ||
               features.hasWebpackChunk ||
               features.hasWebpackRequire ||
               features.hasWebpackModules;
    }


    detectVersion(targetWindow = window) {
        try {

            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') && Array.isArray(targetWindow[key])) {
                    return '5';
                }
            }


            for (const key of Object.keys(targetWindow)) {
                if (key.includes('webpackJsonp') && Array.isArray(targetWindow[key])) {
                    return '4';
                }
            }


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


    detectBuildMode(targetWindow = window) {
        try {

            if (typeof targetWindow.process !== 'undefined' &&
                targetWindow.process.env &&
                targetWindow.process.env.NODE_ENV) {
                return targetWindow.process.env.NODE_ENV;
            }


            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent || '';


                if (content.includes('development') &&
                    (content.includes('__webpack_require__') || content.includes('webpackJsonp'))) {
                    return 'development';
                }


                if (content.includes('__webpack_require__') &&
                    content.includes('// ') &&
                    content.length > 10000) {
                    return 'development';
                }
            }


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


    getWebpackRuntime(targetWindow = window) {
        try {
            const runtime = {
                chunkArrayName: null,
                chunkArray: null,
                requireFunction: null,
                modules: null,
                publicPath: null
            };


            for (const key of Object.keys(targetWindow)) {
                if (key.startsWith('webpackChunk') || key.includes('webpackJsonp')) {
                    if (Array.isArray(targetWindow[key])) {
                        runtime.chunkArrayName = key;
                        runtime.chunkArray = targetWindow[key];
                        break;
                    }
                }
            }


            if (typeof targetWindow.__webpack_require__ === 'function') {
                runtime.requireFunction = targetWindow.__webpack_require__;


                if (runtime.requireFunction.p) {
                    runtime.publicPath = runtime.requireFunction.p;
                }


                if (runtime.requireFunction.m) {
                    runtime.modules = runtime.requireFunction.m;
                }
            }


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


if (typeof window !== 'undefined') {
    window.WebpackDetector = WebpackDetector;
}
