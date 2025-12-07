/**
 * Vue 检测系统
 * 入口文件 - 导出所有模块
 * 
 * 该模块提供 Vue 框架检测与路由分析功能，包括：
 * - Vue 实例检测（Vue 2/3）
 * - Vue Router 定位和分析
 * - 路由守卫清除
 * - 鉴权字段修改
 */

(function() {
    'use strict';

    // 在浏览器环境中，确保所有模块都已加载
    if (typeof window !== 'undefined') {
        /**
         * 初始化 Vue 检测系统
         * @param {Object} options - 配置选项
         * @returns {VueDetector} Vue 检测器实例
         */
        window.initVueDetector = function(options = {}) {
            // 检查依赖
            const missing = [];

            if (!window.VueDetector) {
                missing.push('VueDetector.js');
            }

            if (missing.length > 0) {
                console.warn('⚠️ [Vue] Missing dependencies:', missing.join(', '));
                console.warn('   Please ensure all required scripts are loaded before using VueDetector');
                return null;
            }

            // 创建默认实例
            if (!window.vueDetector) {
                window.vueDetector = new window.VueDetector({
                    enabled: options.enabled !== false,
                    timeout: options.timeout || 3000,
                    enableGuardPatch: options.enableGuardPatch !== false,
                    enableAuthPatch: options.enableAuthPatch !== false,
                    maxDepth: options.maxDepth || 1000
                });

                console.log('✅ [Vue] VueDetector initialized');
            }

            return window.vueDetector;
        };

        /**
         * 执行 Vue 检测
         * @param {Object} options - 配置选项
         * @returns {Object} 检测结果
         */
        window.detectVue = function(options = {}) {
            const detector = window.initVueDetector(options);
            if (!detector) {
                return {
                    vueDetected: false,
                    error: 'VueDetector not initialized'
                };
            }

            return detector.performFullAnalysis();
        };

        // 导出模块引用
        window.Vue = window.Vue || {};
        window.VueDetection = {
            Detector: window.VueDetector,
            Finder: window.VueFinder,
            RouterAnalyzer: window.RouterAnalyzer,
            GuardPatcher: window.GuardPatcher,
            Bridge: window.VueDetectorBridge,
            Utils: {
                Serializer: window.VueSerializer,
                PathUtils: window.VuePathUtils
            },
            init: window.initVueDetector,
            detect: window.detectVue
        };
    }

    // Node.js 环境
    if (typeof module !== 'undefined' && module.exports) {
        const VueDetector = require('./VueDetector');
        const VueFinder = require('./VueFinder');
        const RouterAnalyzer = require('./RouterAnalyzer');
        const GuardPatcher = require('./GuardPatcher');
        const VueDetectorBridge = require('./VueDetectorBridge');
        const Serializer = require('./utils/serializer');
        const PathUtils = require('./utils/pathUtils');

        module.exports = {
            VueDetector,
            VueFinder,
            RouterAnalyzer,
            GuardPatcher,
            VueDetectorBridge,
            Utils: {
                Serializer,
                PathUtils
            }
        };
    }

})();
