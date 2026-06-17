(function() {
    'use strict';


    if (typeof window !== 'undefined') {

        window.initVueDetector = function(options = {}) {

            const missing = [];

            if (!window.VueDetector) {
                missing.push('VueDetector.js');
            }

            if (missing.length > 0) {
                console.warn(' [Vue] Missing dependencies:', missing.join(', '));
                console.warn('   Please ensure all required scripts are loaded before using VueDetector');
                return null;
            }


            if (!window.vueDetector) {
                window.vueDetector = new window.VueDetector({
                    enabled: options.enabled !== false,
                    timeout: options.timeout || 3000,
                    enableGuardPatch: options.enableGuardPatch !== false,
                    enableAuthPatch: options.enableAuthPatch !== false,
                    maxDepth: options.maxDepth || 1000
                });

                console.log(' [Vue] VueDetector initialized');
            }

            return window.vueDetector;
        };


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
