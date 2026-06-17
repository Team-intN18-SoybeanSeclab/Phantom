class BasicScanner {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
    }

    async startScan(silent = false) {
        const loading = document.getElementById('loading');
        const scanBtn = document.getElementById('scanBtn');
        const scanBtnText = scanBtn.querySelector('.text');

        if (!silent) {
            loading.style.display = 'block';
            scanBtn.disabled = true;
            if (scanBtnText) {
                scanBtnText.textContent = '扫描中...';
            }
            scanBtn.classList.add('scanning');
        }

        try {

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });


            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('无法扫描系统页面');
            }


            this.srcMiner.updateCurrentDomain(tab.url);


            let results = null;
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractInfo', targetUrl: tab.url });
                if (response) {
                    results = response;
                }
            } catch (contentError) {

            }


            if (!results) {
                try {

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: false },
                        files: [

                            'src/scanner/PatternExtractor.js',
                            'src/scanner/ContentExtractor.js',

                            'libs/acorn.min.js',
                            'src/scanner/ast/parser.js',
                            'src/scanner/ast/utils/hash.js',
                            'src/scanner/ast/utils/context.js',
                            'src/scanner/ast/visitors/ASTVisitor.js',
                            'src/scanner/ast/visitors/CredentialVisitor.js',
                            'src/scanner/ast/visitors/APIEndpointVisitor.js',
                            'src/scanner/ast/visitors/SensitiveFunctionVisitor.js',
                            'src/scanner/ast/visitors/ConfigObjectVisitor.js',
                            'src/scanner/ast/visitors/EncodedStringVisitor.js',
                            'src/scanner/ast/ASTExtractor.js',
                            'src/scanner/ast/utils/ResultMerger.js',
                            'src/scanner/ast/ASTBridge.js',
                            'src/scanner/ast/index.js',

                            'src/scanner/vue/utils/serializer.js',
                            'src/scanner/vue/utils/pathUtils.js',
                            'src/scanner/vue/VueFinder.js',
                            'src/scanner/vue/RouterAnalyzer.js',
                            'src/scanner/vue/GuardPatcher.js',
                            'src/scanner/vue/VueDetector.js',
                            'src/scanner/vue/VueDetectorBridge.js',
                            'src/scanner/vue/index.js'
                        ]
                    });


                    const injectionResults = await chrome.scripting.executeScript({
                        target: {
                            tabId: tab.id,
                            allFrames: false
                        },
                        function: this.extractSensitiveInfo,
                        args: [tab.url]
                    });

                    if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                        results = injectionResults[0].result;
                    }
                } catch (injectionError) {
                    console.error('脚本注入失败:', injectionError);
                    throw new Error('无法访问页面内容，请刷新页面后重试');
                }
            }

            if (results) {
                this.srcMiner.results = results;
                this.srcMiner.saveResults();
                this.srcMiner.displayResults();
                if (!silent) {
                    this.showScanComplete();
                }
            } else {
                throw new Error('未能获取扫描结果');
            }

        } catch (error) {
            console.error('扫描失败:', error);
            if (!silent) {
                this.showError(error.message || '扫描失败，请刷新页面后重试');
            }
        } finally {
            if (!silent) {
                loading.style.display = 'none';
                scanBtn.disabled = false;
                if (scanBtnText) {
                    scanBtnText.textContent = '重新扫描';
                }
                scanBtn.classList.remove('scanning');
            }
        }
    }

    showScanComplete() {
        const scanBtn = document.getElementById('scanBtn');
        const originalText = scanBtn.textContent;
        scanBtn.textContent = ' 扫描完成';
        scanBtn.style.background = 'rgba(0, 212, 170, 0.3)';

        setTimeout(() => {
            scanBtn.textContent = originalText;
            scanBtn.style.background = '';
        }, 2000);
    }

    showError(message) {
        const scanBtn = document.getElementById('scanBtn');
        scanBtn.textContent = ' 扫描失败';
        scanBtn.style.background = 'rgba(239, 68, 68, 0.3)';


        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                <h3>扫描失败</h3>
                <p>${message}</p>
                <p style="font-size: 12px; margin-top: 10px;">
                    请尝试以下解决方案：<br>
                    1. 刷新页面后重试<br>
                    2. 确保页面完全加载<br>
                    3. 检查是否为系统页面
                </p>
            </div>
        `;

        setTimeout(() => {
            scanBtn.textContent = '重新扫描';
            scanBtn.style.background = '';
        }, 3000);
    }


    async extractSensitiveInfo(targetUrl) {
        try {





            if (window !== window.top) {

                return this.getEmptyResults();
            }


            if (targetUrl && window.location.href !== targetUrl) {

                return this.getEmptyResults();
            }




            if (typeof PatternExtractor !== 'undefined' && typeof ContentExtractor !== 'undefined') {

                try {



                    if (!window.patternExtractor) {

                        window.patternExtractor = new PatternExtractor();
                    }


                    if (window.astBridge && !window.astBridge.initialized) {
                        try {
                            await window.astBridge.init();
                            console.log(' [BasicScanner] AST 系统初始化成功');
                        } catch (astError) {
                            console.warn(' [BasicScanner] AST 初始化失败，将仅使用正则:', astError.message);
                        }
                    } else if (typeof window.initASTExtractor === 'function' && !window.astExtractor) {
                        try {
                            await window.initASTExtractor();
                            console.log(' [BasicScanner] ASTExtractor 初始化成功');
                        } catch (astError) {
                            console.warn(' [BasicScanner] ASTExtractor 初始化失败:', astError.message);
                        }
                    }


                    if (!window.patternExtractor.customPatternsLoaded) {
                        await window.patternExtractor.loadCustomPatterns();
                    }





                    const customKeys = Object.keys(window.patternExtractor.patterns).filter(key => key.startsWith('custom_'));
                    if (customKeys.length > 0) {

                    } else {
                        console.warn(' BasicScanner未发现任何自定义正则');
                    }


                    const contentExtractor = new ContentExtractor();
                    const results = await contentExtractor.extractSensitiveInfo(window.location.href);


                    if (typeof window.VueDetectorBridge !== 'undefined') {
                        try {
                            const vueBridge = new window.VueDetectorBridge();
                            const vueResult = await vueBridge.detect();

                            if (vueResult && vueResult.detected) {
                                console.log(' [BasicScanner] Vue 检测成功:', vueResult.framework);

                                results.vueRoutes = vueResult.routes || [];
                                results.vueDetection = {
                                    detected: true,
                                    framework: vueResult.framework,
                                    routeCount: vueResult.routes?.length || 0,
                                    sensitiveRoutes: vueResult.sensitiveRoutes || [],
                                    modifiedRoutes: vueResult.modifiedRoutes || []
                                };


                                if (vueResult.routes && vueResult.routes.length > 0) {
                                    if (!results.domains) {
                                        results.domains = [];
                                    }
                                    const existingDomains = new Set(results.domains.map(d => typeof d === 'object' ? d.value : d));

                                    vueResult.routes.forEach(route => {
                                        const routePath = route.path || route.fullPath || '';

                                        if (routePath.startsWith('http://') || routePath.startsWith('https://')) {
                                            const domain = this.extractDomainFromUrl(routePath);
                                            if (domain && !existingDomains.has(domain)) {
                                                existingDomains.add(domain);
                                                results.domains.push({
                                                    value: domain,
                                                    sourceUrl: window.location.href,
                                                    extractedAt: new Date().toISOString(),
                                                    extractedFrom: 'vueRoutes'
                                                });
                                                console.log(` [BasicScanner] 从 Vue 路由提取域名: ${domain}`);
                                            }
                                        }
                                    });
                                }
                            } else {
                                results.vueDetection = { detected: false };
                            }
                        } catch (vueError) {
                            console.warn(' [BasicScanner] Vue 检测失败:', vueError.message);
                            results.vueDetection = { detected: false, error: vueError.message };
                        }
                    }



                    return results;
                } catch (error) {
                    console.error(' BasicScanner统一化系统提取失败:', error);


                    return this.getEmptyResults();
                }
            }



            return this.getEmptyResults();

        } catch (error) {
            console.error(' BasicScanner扫描过程中出错:', error);
            return this.getEmptyResults();
        }
    }


    getEmptyResults() {
        const baseResults = {
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
            credentials: [],
            cookies: [],
            idKeys: [],
            idcards: [],
            companies: [],
            jwts: [],
            githubUrls: [],
            vueFiles: [],

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

            vueRoutes: [],
            vueDetection: { detected: false }
        };





        return baseResults;
    }


    extractDomainFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        try {

            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return null;
            }


            let domain = url.replace(/^https?:\/\//, '');


            domain = domain.replace(/^www\./, '');


            domain = domain.split('/')[0];
            domain = domain.split('?')[0];
            domain = domain.split('#')[0];
            domain = domain.split(':')[0];


            domain = domain.toLowerCase().trim();


            if (!domain || domain.length < 3 || !domain.includes('.')) {
                return null;
            }


            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
                return null;
            }


            const blacklist = ['w3.org', 'w3schools.com', 'mozilla.org', 'github.com',
                              'stackoverflow.com', 'vuejs.org', 'reactjs.org', 'angular.io'];
            if (blacklist.some(b => domain.includes(b))) {
                return null;
            }

            return domain;
        } catch (error) {
            return null;
        }
    }
}