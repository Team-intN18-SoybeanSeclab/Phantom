class SRCMinerContent {
    constructor() {
        if (window !== window.top) {

            return;
        }

        this.isScanning = false;
        this.scanResults = {};
        this.lastScanTime = 0;
        this.scanCooldown = 3000;
        this.config = this.getConfig();



        this.init();
        this.loadCustomRegexConfig();
    }

    init() {


        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {


            if (window !== window.top) {

                return false;
            }

            switch (request.action) {
                case 'extractInfo':

                    this.performScan().then(results => {

                        sendResponse(results);
                    }).catch(error => {
                        console.error(' Content Script扫描失败:', error);
                        sendResponse(this.getEmptyResults());
                    });
                    return true;

                case 'getStatus':
                    sendResponse({
                        isScanning: this.isScanning,
                        url: window.location.href,
                        lastScan: this.lastScanTime
                    });
                    return true;


                case 'updateScanResults':
                case 'scanProgress':
                case 'scanComplete':
                case 'scanError':
                case 'stopDeepScan':
                    this.handleDeepScanMessage(request);
                    sendResponse({ success: true });
                    return true;

                case 'injectScript':

                    this.injectUserScript(request.code).then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        console.error(' 脚本注入失败:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                    return true;
            }
        });


        this.autoScan();


        this.observePageChanges();
    }


    async loadCustomRegexConfig() {

    }

    getConfig() {
        return {

            scanTimeout: 30000,
            maxResults: 1000,


            jsExtensions: ['js', 'jsx', 'ts', 'tsx', 'vue'],
            cssExtensions: ['css', 'scss', 'sass', 'less', 'styl'],
            imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'],
            audioExtensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
            videoExtensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],


            excludePatterns: [
                /chrome-extension:\/\//,
                /moz-extension:\/\//,
                /about:blank/,
                /data:image/,
                /javascript:void/,
                /mailto:/,
                /tel:/,
                /^#/,
                /\.(?:woff|woff2|ttf|eot|otf)$/i,
                /iframe\.js/,
                /window\.iframeStartup/,
                /devtools/,
                /wappalyzer/,
                /vue-devtools/
            ]
        };
    }

    _idle(fn, timeout = 2000) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout });
        } else {
            setTimeout(fn, 0);
        }
    }

    async autoScan() {
        if (document.readyState === 'complete') {
            setTimeout(() => this._idle(() => this.performScan(true)), 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => this._idle(() => this.performScan(true)), 2000);
            });
        }
    }

    observePageChanges() {
        let scanTimeout;
        const observer = new MutationObserver((mutations) => {
            const now = Date.now();
            if (now - this.lastScanTime < this.scanCooldown) return;

            const hasSignificantChange = mutations.some(mutation => {
                return mutation.addedNodes.length > 0 &&
                       Array.from(mutation.addedNodes).some(node =>
                           node.nodeType === Node.ELEMENT_NODE &&
                           (node.tagName === 'SCRIPT' ||
                            node.tagName === 'FORM' ||
                            node.hasAttribute('src') ||
                            node.hasAttribute('href'))
                       );
            });

            if (hasSignificantChange) {
                clearTimeout(scanTimeout);
                scanTimeout = setTimeout(() => {
                    this._idle(() => this.performScan(true));
                }, 3000);
            }
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    async performScan(silent = false) {
        if (this.isScanning) return this.scanResults;

        this.isScanning = true;
        this.lastScanTime = Date.now();

        if (!silent) {

        }

        try {
            const results = await this.extractAllInfo(!silent);
            this.scanResults = results;

            if (!silent) {
                this.logResults(results);
            }


            chrome.runtime.sendMessage({
                action: 'storeResults',
                data: results,
                url: window.location.href
            }).catch(() => {});

            return results;
        } catch (error) {
            console.error('扫描过程出错:', error);
            return this.getEmptyResults();
        } finally {
            this.isScanning = false;
        }
    }

    async extractAllInfo(fetchExternal = false) {



        if (typeof PatternExtractor !== 'undefined' && typeof ContentExtractor !== 'undefined') {



            await this.initASTSystem();


            if (!window.patternExtractor) {
                window.patternExtractor = new PatternExtractor();
            }


            if (!window.patternExtractor.customPatternsLoaded) {
                await window.patternExtractor.loadCustomPatterns();
            }

            const contentExtractor = new ContentExtractor();
            const results = await contentExtractor.extractSensitiveInfo(window.location.href, { fetchExternal });

            return results;
        } else {
            console.error(' Content Script统一化版本：PatternExtractor或ContentExtractor不可用');
            return this.getEmptyResults();
        }
    }


    async initASTSystem() {
        try {

            if (!window.acorn) {
                console.warn(' [Content] acorn 未加载，AST 功能不可用');
                return false;
            }


            if (window.astBridge && !window.astBridge.initialized) {
                const initResult = await window.astBridge.init();
                if (initResult && window.astBridge.isAvailable()) {

                    return true;
                }
            } else if (window.astBridge?.initialized) {
                return true;
            }


            if (typeof window.initASTExtractor === 'function' && !window.astExtractor) {
                await window.initASTExtractor();

                return true;
            }

            return false;
        } catch (error) {
            console.warn(' [Content] AST 初始化失败:', error.message);
            return false;
        }
    }

    logResults(results) {

        let totalItems = 0;
        const summary = {};

        Object.keys(results).forEach(key => {
            const value = results[key];
            let count = 0;

            if (Array.isArray(value)) {
                count = value.length;
            } else if (value instanceof Set) {
                count = value.size;
            } else if (value && typeof value === 'object') {
                count = Object.keys(value).length;
            }

            summary[key] = count;
            totalItems += count;
        });



        if (totalItems > 0) {

            Object.keys(summary).forEach(key => {
                if (summary[key] > 0) {

                }
            });


            if (summary.sensitiveKeywords > 0) {
                const keywords = Array.isArray(results.sensitiveKeywords) ?
                    results.sensitiveKeywords : Array.from(results.sensitiveKeywords);

            }
            if (summary.emails > 0) {
                const emails = Array.isArray(results.emails) ?
                    results.emails : Array.from(results.emails);

            }
            if (summary.absoluteApis > 0) {
                const apis = Array.isArray(results.absoluteApis) ?
                    results.absoluteApis : Array.from(results.absoluteApis);

            }
        } else {

        }
    }

    getEmptyResults() {
        return {
            absoluteApis: [],
            relativeApis: [],
            modulePaths: [],
            domains: [],
            urls: [],
            images: [],
            audios: [],
            videos: [],
            jsFiles: [],
            cssFiles: [],
            emails: [],
            phoneNumbers: [],
            ipAddresses: [],
            sensitiveKeywords: [],
            comments: [],
            subdomains: [],
            ports: [],
            paths: [],
            parameters: [],
            forms: [],
            inputFields: [],
            hiddenFields: [],

            credentials: [],
            jwts: [],
            bearerTokens: [],
            basicAuth: [],
            authHeaders: [],
            wechatAppIds: [],
            awsKeys: [],
            googleApiKeys: [],
            githubTokens: [],
            gitlabTokens: [],
            webhookUrls: [],
            idCards: [],
            cryptoUsage: [],
            githubUrls: [],
            vueFiles: [],
            companies: []
        };
    }

    handleDeepScanMessage(request) {


    }


    async injectUserScript(code) {
        try {



            const injectorUrl = chrome.runtime.getURL('src/core/injector.js');


            const injectorScript = document.createElement('script');
            injectorScript.src = injectorUrl;


            await new Promise((resolve, reject) => {
                injectorScript.onload = resolve;
                injectorScript.onerror = reject;
                document.head.appendChild(injectorScript);
            });


            if (window.PhantomInjector) {
                const result = await window.PhantomInjector.executeScript(code);

                return { success: true, result: result };
            } else {
                throw new Error('PhantomInjector未加载');
            }

        } catch (error) {
            console.error(' 脚本注入失败:', error);
            return { success: false, error: error.message };
        }
    }
}


if (window === window.top) {
    new SRCMinerContent();
}