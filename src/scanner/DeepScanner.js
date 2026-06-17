class DeepScanner {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;

        this.urlContentCache = new Map();

        this.regexCache = {};

        this.timeout = 5000;

        this.filtersLoaded = false;



        this.contentHashCache = new Map();

        this.throttleConfig = {
            displayUpdateInterval: 2000,
            storageUpdateInterval: 5000,
            lastDisplayUpdate: 0,
            lastStorageUpdate: 0,
            pendingStorageUpdate: false
        };

        this.batchConfig = {
            maxBatchSize: 50,
            batchDelay: 10
        };
    }


    async loadEnhancedFilters() {
        if (this.filtersLoaded) {

            return;
        }



        try {

            if (typeof chrome !== 'undefined' && chrome.runtime) {

                if (!window.domainPhoneFilter) {
                    await this.loadFilterScript('filters/domainfilter.js');


                    if (typeof DomainPhoneFilter !== 'undefined') {
                        window.domainPhoneFilter = new DomainPhoneFilter();

                    }
                }


                if (!window.apiFilter) {
                    await this.loadFilterScript('filters/apifilter.js');

                }

                this.filtersLoaded = true;

            } else {
                console.warn(' 非扩展环境，无法加载过滤器');
            }
        } catch (error) {
            console.error(' 过滤器加载失败:', error);
        }
    }


    async loadFilterScript(scriptPath) {
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL(scriptPath);

                script.onload = () => {

                    resolve();
                };

                script.onerror = (error) => {
                    console.error(` 脚本加载失败: ${scriptPath}`, error);
                    reject(error);
                };

                document.head.appendChild(script);


                setTimeout(() => {
                    resolve();
                }, 3000);
            } catch (error) {
                console.warn(` 加载脚本失败: ${scriptPath}`, error);
                resolve();
            }
        });
    }


    toggleDeepScan() {
        const configDiv = document.getElementById('deepScanConfig');
        const deepScanBtn = document.getElementById('deepScanBtn');
        const deepScanBtnText = deepScanBtn.querySelector('.text');

        if (configDiv.style.display === 'none' || !configDiv.style.display) {

            configDiv.style.display = 'block';
            if (deepScanBtnText) {
                deepScanBtnText.textContent = ' 开始深度扫描';
            }
            deepScanBtn.style.background = 'rgba(0, 212, 170, 0.3)';
        } else {

            this.startDeepScanWindow();
        }
    }


    async startDeepScanWindow() {


        try {

            const maxDepthInput = document.getElementById('maxDepth');
            const concurrencyInput = document.getElementById('concurrency');
            const timeoutInput = document.getElementById('timeout');

            const maxDepth = parseInt(maxDepthInput?.value) || 2;
            const concurrency = parseInt(concurrencyInput?.value) || 8;
            const timeout = parseInt(timeoutInput?.value) || 5;


            if (!this.srcMiner.deepScanWindow) {

                await this.loadDeepScanWindow();
                this.srcMiner.deepScanWindow = new DeepScanWindow(this.srcMiner);
            }


            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                throw new Error('无法获取当前页面信息');
            }


            await this.srcMiner.deepScanWindow.createDeepScanWindow({
                maxDepth: maxDepth,
                concurrency: concurrency,
                timeout: timeout
            });


            this.showSuccessNotification(' 深度扫描已在新窗口中启动！请查看新打开的扫描页面。');


            const configDiv = document.getElementById('deepScanConfig');
            const deepScanBtn = document.getElementById('deepScanBtn');
            const deepScanBtnText = deepScanBtn?.querySelector('.text');

            if (configDiv) {
                configDiv.style.display = 'none';
            }

            if (deepScanBtnText) {
                deepScanBtnText.textContent = '深度递归扫描';
            }

            if (deepScanBtn) {
                deepScanBtn.style.background = '';
            }

        } catch (error) {
            console.error(' 启动深度扫描窗口失败:', error);
            this.showError('启动深度扫描窗口失败: ' + error.message);
        }
    }


    async loadDeepScanWindow() {
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('src/scanner/DeepScanWindow.js');

                script.onload = () => {

                    resolve();
                };

                script.onerror = (error) => {
                    console.error(' DeepScanWindow类加载失败:', error);
                    reject(error);
                };

                document.head.appendChild(script);


                setTimeout(() => {
                    if (typeof DeepScanWindow !== 'undefined') {
                        resolve();
                    } else {
                        reject(new Error('DeepScanWindow类加载超时'));
                    }
                }, 5000);
            } catch (error) {
                reject(error);
            }
        });
    }


    handleScanWindowMessage(message, sender, sendResponse) {
        if (!this.srcMiner.deepScanWindow) {
            sendResponse({ success: false, error: 'DeepScanWindow not initialized' });
            return;
        }

        return this.srcMiner.deepScanWindow.handleScanWindowMessage(message, sender, sendResponse);
    }


    async startDeepScan() {


        if (this.srcMiner.deepScanRunning) {

            return;
        }



        await this.loadEnhancedFilters();


        const maxDepthInput = document.getElementById('maxDepth');
        const concurrencyInput = document.getElementById('concurrency');
        const timeoutInput = document.getElementById('timeout');
        const scanJsFilesInput = document.getElementById('scanJsFiles');
        const scanHtmlFilesInput = document.getElementById('scanHtmlFiles');
        const scanApiFilesInput = document.getElementById('scanApiFiles');


        if (!maxDepthInput || !concurrencyInput) {
            console.error('深度扫描配置元素未找到');
            this.showError('深度扫描配置错误，请检查页面元素');
            return;
        }

        this.srcMiner.maxDepth = parseInt(maxDepthInput.value) || 2;
        this.srcMiner.concurrency = parseInt(concurrencyInput.value) || 8;


        if (timeoutInput) {
            this.timeout = parseInt(timeoutInput.value) * 1000;
        } else {
            this.timeout = 5000;
        }


        const scanJsFiles = scanJsFilesInput ? scanJsFilesInput.checked : true;
        const scanHtmlFiles = scanHtmlFilesInput ? scanHtmlFilesInput.checked : true;
        const scanApiFiles = scanApiFilesInput ? scanApiFilesInput.checked : true;

        console.log('深度扫描配置:', {
            maxDepth: this.srcMiner.maxDepth,
            concurrency: this.srcMiner.concurrency,
            timeout: this.timeout / 1000 + '秒',
            scanJsFiles,
            scanHtmlFiles,
            scanApiFiles
        });


        this.srcMiner.deepScanRunning = true;
        this.srcMiner.scannedUrls = new Set();
        this.srcMiner.pendingUrls = new Set();
        this.urlContentCache.clear();


        this.srcMiner.deepScanResults = {};
        Object.keys(this.srcMiner.results).forEach(key => {
            this.srcMiner.deepScanResults[key] = [...(this.srcMiner.results[key] || [])];
        });

        this.srcMiner.currentDepth = 0;

        const deepScanBtn = document.getElementById('deepScanBtn');
        const progressDiv = document.getElementById('deepScanProgress');
        const configDiv = document.getElementById('deepScanConfig');


        if (deepScanBtn) {
            const deepScanBtnText = deepScanBtn.querySelector('.text');
            if (deepScanBtnText) {
                deepScanBtnText.textContent = '⏹ 停止扫描';
            }
            deepScanBtn.style.background = 'rgba(239, 68, 68, 0.3)';
            deepScanBtn.style.color = '#fff';
        }

        if (progressDiv) {

        }


        if (configDiv) {
            configDiv.style.display = 'block';

            const configInputs = configDiv.querySelectorAll('input, select');
            configInputs.forEach(input => input.disabled = true);
        }

        try {

        if (window.astBridge && !window.astBridge.initialized) {
            try {
                await window.astBridge.init();
                console.log(' ASTBridge 初始化成功');
            } catch (e) {
                console.warn(' ASTBridge 初始化失败，将仅使用正则提取:', e.message);
            }
        }


        this.throttleConfig.lastDisplayUpdate = 0;
        this.throttleConfig.lastStorageUpdate = 0;
        this.throttleConfig.pendingStorageUpdate = false;


        this.contentHashCache.clear();


        if (this.srcMiner.patternExtractor) {

            this.srcMiner.patternExtractor.patterns = {};
            this.srcMiner.patternExtractor.customPatternsLoaded = false;


            await this.srcMiner.patternExtractor.loadCustomPatterns();
            if (typeof this.srcMiner.patternExtractor.ensureCustomPatternsLoaded === 'function') {
                await this.srcMiner.patternExtractor.ensureCustomPatternsLoaded();
            }




        } else {
            console.error(' 深度扫描统一化版本：未找到PatternExtractor实例，无法进行统一化提取');
        }


            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                throw new Error('无法获取当前页面URL');
            }

            const baseUrl = new URL(tab.url).origin;
            const currentUrl = tab.url;

            console.log(' 深度扫描目标:', {
                baseUrl,
                currentUrl,
                maxDepth: this.srcMiner.maxDepth
            });


            this.srcMiner.scannedUrls.add(currentUrl);


            const initialUrls = await this.collectInitialUrls(baseUrl, scanJsFiles, scanHtmlFiles, scanApiFiles);


            if (initialUrls.length === 0) {

                this.updateDeepScanProgress(0, 0, '没有找到可扫描的URL');
                return;
            }


            await this.performLayeredScan(baseUrl, initialUrls, {
                scanJsFiles,
                scanHtmlFiles,
                scanApiFiles
            });


            await this.flushPendingUpdates();


            this.srcMiner.results = this.srcMiner.deepScanResults;
            this.srcMiner.displayResults();
            this.srcMiner.saveResults();


            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (currentTab && currentTab.url) {
                const urlObj = new URL(currentTab.url);
                const fullUrl = `https://${urlObj.hostname}`;

                if (!window.indexedDBManager) {
                    window.indexedDBManager = new IndexedDBManager();
                }

                const deepState = {
                    running: false,
                    complete: true,
                    timestamp: Date.now(),
                    url: currentTab.url,
                    scannedUrls: Array.from(this.srcMiner.scannedUrls || []),
                    currentDepth: this.srcMiner.currentDepth,
                    maxDepth: this.srcMiner.maxDepth,
                    concurrency: this.srcMiner.concurrency
                };

                await window.indexedDBManager.saveDeepScanState(fullUrl, deepState);
            }

            this.showDeepScanComplete();

        } catch (error) {
            console.error(' 深度扫描失败:', error);
            this.showError('深度扫描失败: ' + error.message);
        } finally {

            this.srcMiner.deepScanRunning = false;


            this.srcMiner.saveResults();

            if (deepScanBtn) {
                const deepScanBtnText = deepScanBtn.querySelector('.text');
                if (deepScanBtnText) {
                    deepScanBtnText.textContent = '深度递归扫描';
                }
                deepScanBtn.style.background = '';
                deepScanBtn.style.color = '';
            }

            if (configDiv) {

                const configInputs = configDiv.querySelectorAll('input, select');
                configInputs.forEach(input => input.disabled = false);


                setTimeout(() => {
                    configDiv.style.display = 'none';
                }, 5000);
            }

            if (progressDiv) {

                setTimeout(() => {
                    if (progressDiv.style.display !== 'none') {
                        progressDiv.style.display = 'none';
                    }
                }, 5000);
            }


            this.urlContentCache.clear();


            const [completedTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (completedTab && completedTab.url) {
                const urlObj = new URL(completedTab.url);
                const fullUrl = `https://${urlObj.hostname}`;

                if (!window.indexedDBManager) {
                    window.indexedDBManager = new IndexedDBManager();
                }

                const finalState = {
                    running: false,
                    complete: true,
                    lastCompleted: Date.now(),
                    scannedUrls: Array.from(this.srcMiner.scannedUrls || []),
                    currentDepth: this.srcMiner.currentDepth,
                    maxDepth: this.srcMiner.maxDepth,
                    concurrency: this.srcMiner.concurrency
                };

                await window.indexedDBManager.saveDeepScanState(fullUrl, finalState);
            }
        }
    }


    async collectInitialUrls(baseUrl, scanJsFiles, scanHtmlFiles, scanApiFiles) {
        const urls = new Set();




        if (scanJsFiles && this.srcMiner.results.jsFiles) {
            for (const jsFile of this.srcMiner.results.jsFiles) {

                const url = typeof jsFile === 'object' ? jsFile.value : jsFile;
                const fullUrl = this.resolveUrl(url, baseUrl);
                if (fullUrl && await this.isSameDomain(fullUrl, baseUrl) && !this.srcMiner.scannedUrls.has(fullUrl)) {
                    urls.add(fullUrl);
                }
            }
        }


        if (scanHtmlFiles && this.srcMiner.results.urls) {
            for (const urlItem of this.srcMiner.results.urls) {

                const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                const fullUrl = this.resolveUrl(url, baseUrl);
                if (fullUrl && await this.isSameDomain(fullUrl, baseUrl) && !this.srcMiner.scannedUrls.has(fullUrl)) {

                    if (this.isPageUrl(fullUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
        }


        if (scanApiFiles) {

            if (this.srcMiner.results.absoluteApis) {
                for (const apiItem of this.srcMiner.results.absoluteApis) {

                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const fullUrl = this.resolveUrl(api, baseUrl);
                    if (fullUrl && await this.isSameDomain(fullUrl, baseUrl) && !this.srcMiner.scannedUrls.has(fullUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }


            if (this.srcMiner.results.relativeApis) {
                for (const apiItem of this.srcMiner.results.relativeApis) {

                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const fullUrl = this.resolveUrl(api, baseUrl);
                    if (fullUrl && await this.isSameDomain(fullUrl, baseUrl) && !this.srcMiner.scannedUrls.has(fullUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
        }

        const urlArray = Array.from(urls);

        return urlArray;
    }


    isPageUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();


            if (!this.regexCache.resourceExtensions) {
                this.regexCache.resourceExtensions = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|ttf|eot|woff2|map)$/i;
            }


            if (this.regexCache.resourceExtensions.test(pathname)) {
                return false;
            }


            return pathname === '/' ||
                   pathname.endsWith('/') ||
                   pathname.endsWith('.html') ||
                   pathname.endsWith('.htm') ||
                   pathname.includes('/page') ||
                   pathname.includes('/view') ||
                   !pathname.includes('.');
        } catch (e) {
            return false;
        }
    }


    async performLayeredScan(baseUrl, initialUrls, options) {
        let currentUrls = [...initialUrls];

        for (let depth = 1; depth <= this.srcMiner.maxDepth && this.srcMiner.deepScanRunning; depth++) {
            this.srcMiner.currentDepth = depth;

            if (currentUrls.length === 0) {

                break;
            }


            this.updateDeepScanProgress(0, currentUrls.length, `第 ${depth} 层扫描`);


            const newUrls = await this.scanUrlBatchOptimized(currentUrls, baseUrl, options, depth);


            const nextUrlsSet = new Set(newUrls);
            currentUrls = Array.from(nextUrlsSet).filter(url => !this.srcMiner.scannedUrls.has(url));




            this.srcMiner.results = this.srcMiner.deepScanResults;
            this.srcMiner.displayResults();



            if (typeof window.gc === 'function') {
                try {
                    window.gc();
                } catch (e) {}
            }
        }
    }


    async scanUrlBatchOptimized(urls, baseUrl, options, depth) {
        const newUrls = new Set();
        let processedCount = 0;
        const totalUrls = urls.length;
        const concurrency = this.srcMiner.concurrency;


        const queue = [...urls];
        const activeWorkers = new Set();


        let lastProgressUpdate = 0;
        const progressUpdateInterval = 500;

        const processQueue = async () => {
            while (queue.length > 0 && this.srcMiner.deepScanRunning) {
                const url = queue.shift();


                if (this.srcMiner.scannedUrls.has(url)) {
                    processedCount++;
                    continue;
                }


                this.srcMiner.scannedUrls.add(url);

                const workerPromise = (async () => {
                    try {

                        let content;
                        if (this.urlContentCache.has(url)) {
                            content = this.urlContentCache.get(url);
                        } else {
                            content = await this.fetchUrlContent(url);
                            if (content) {

                                if (this.urlContentCache.size > 100) {
                                    const firstKey = this.urlContentCache.keys().next().value;
                                    this.urlContentCache.delete(firstKey);
                                }
                                this.urlContentCache.set(url, content);
                            }
                        }

                        if (content) {

                            const contentHash = this._simpleHash(content);
                            if (!this.contentHashCache.has(contentHash)) {
                                this.contentHashCache.set(contentHash, true);


                                const extractedData = this.extractFromContent(content, url);
                                await this.mergeDeepScanResults(extractedData);
                            }


                            const discoveredUrls = await this.collectUrlsFromContent(content, baseUrl, options);
                            discoveredUrls.forEach(newUrl => newUrls.add(newUrl));
                        }
                    } catch (error) {
                        console.error(`扫描 ${url} 失败:`, error);
                    } finally {
                        processedCount++;


                        const now = Date.now();
                        if ((now - lastProgressUpdate) > progressUpdateInterval) {
                            lastProgressUpdate = now;
                            this.updateDeepScanProgress(processedCount, totalUrls, `第 ${depth} 层扫描`);
                        }

                        activeWorkers.delete(workerPromise);
                    }
                })();

                activeWorkers.add(workerPromise);


                if (activeWorkers.size >= concurrency) {
                    await Promise.race(Array.from(activeWorkers));
                }
            }
        };


        await processQueue();


        if (activeWorkers.size > 0) {
            await Promise.all(Array.from(activeWorkers));
        }

        return Array.from(newUrls);
    }


    async fetchUrlContent(url) {
        try {


            const requestOptions = {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml,text/javascript,application/javascript,text/css,*/*',
                    'Cache-Control': 'no-cache'
                },
                timeout: this.timeout
            };




            const response = await this.makeRequestViaBackground(url, requestOptions);



            if (!response.ok) {
                console.warn(`HTTP ${response.status} for ${url}`);
                return null;
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('image/') ||
                contentType.includes('audio/') ||
                contentType.includes('video/') ||
                contentType.includes('application/octet-stream') ||
                contentType.includes('application/zip') ||
                contentType.includes('application/pdf')) {
                return null;
            }

            const text = await response.text();
            return text;

        } catch (error) {
            console.error(`无法访问 ${url}:`, error);
            return null;
        }
    }


    async makeRequestViaBackground(url, options = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'makeRequest',
                url: url,
                options: options
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {

                    const mockHeaders = new Map(Object.entries(response.data.headers || {}));

                    resolve({
                        ok: response.data.status >= 200 && response.data.status < 300,
                        status: response.data.status,
                        statusText: response.data.statusText,
                        headers: {
                            get: (name) => mockHeaders.get(name.toLowerCase()),
                            has: (name) => mockHeaders.has(name.toLowerCase()),
                            entries: () => mockHeaders.entries(),
                            keys: () => mockHeaders.keys(),
                            values: () => mockHeaders.values()
                        },
                        text: () => Promise.resolve(response.data.text),
                        json: () => {
                            try {
                                return Promise.resolve(JSON.parse(response.data.text));
                            } catch (e) {
                                return Promise.reject(new Error('Invalid JSON'));
                            }
                        },
                        url: response.data.url,
                        clone: () => ({
                            text: () => Promise.resolve(response.data.text),
                            json: () => {
                                try {
                                    return Promise.resolve(JSON.parse(response.data.text));
                                } catch (e) {
                                    return Promise.reject(new Error('Invalid JSON'));
                                }
                            }
                        })
                    });
                } else {
                    reject(new Error(response?.error || 'Request failed'));
                }
            });
        });
    }


    extractFromContent(content, sourceUrl) {

        const isJsFile = sourceUrl.endsWith('.js') ||
                         sourceUrl.includes('.js?') ||
                         (content && content.trim().startsWith('(function') || content.trim().startsWith('function'));

        let extractedResults = {};


        if (this.srcMiner.patternExtractor) {
            try {
                extractedResults = this.srcMiner.patternExtractor.extractPatterns(content, sourceUrl);
            } catch (error) {
                console.error(' PatternExtractor 提取失败:', error);
            }
        }


        if (isJsFile && window.astBridge && window.astBridge.isAvailable()) {
            try {
                const astResult = window.astBridge.extract(content, sourceUrl);

                if (astResult.success && astResult.detections && astResult.detections.length > 0) {

                    const mergedResults = this._mergeASTResults(extractedResults, astResult.detections, sourceUrl);
                    extractedResults = mergedResults;
                }
            } catch (error) {

                console.warn(' AST 提取失败，使用正则结果:', error.message);
            }
        }

        return extractedResults;
    }


    _mergeASTResults(regexResults, astDetections, sourceUrl) {
        const merged = { ...regexResults };


        const typeMapping = {
            'credential': 'credentials',
            'api_endpoint': 'absoluteApis',
            'sensitive_function': 'credentials',
            'config_object': 'credentials',
            'encoded_string': 'credentials'
        };

        for (const detection of astDetections) {
            const resultKey = typeMapping[detection.type] || 'credentials';

            if (!merged[resultKey]) {
                merged[resultKey] = [];
            }


            const value = detection.value;
            const exists = merged[resultKey].some(item =>
                (typeof item === 'object' ? item.value : item) === value
            );

            if (!exists && value) {
                merged[resultKey].push({
                    value: value,
                    sourceUrl: sourceUrl,
                    extractedAt: new Date().toISOString(),
                    pageTitle: document.title || 'Unknown Page',
                    confidence: detection.confidence || 0.8,
                    context: detection.context
                });
            }
        }

        return merged;
    }


    async collectUrlsFromContent(content, baseUrl, options) {


        const urls = new Set();
        const { scanJsFiles, scanHtmlFiles, scanApiFiles } = options;


        if (this.srcMiner.results.vueRoutes && Array.isArray(this.srcMiner.results.vueRoutes)) {
            for (const route of this.srcMiner.results.vueRoutes) {
                const routePath = route.path || route.fullPath || '';
                if (routePath && routePath !== '/') {
                    const fullUrl = this.resolveUrl(routePath, baseUrl);
                    if (fullUrl && await this.isSameDomain(fullUrl, baseUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
        }


        const processedContent = content;


        if (this.srcMiner.patternExtractor) {
            try {
                const extractedData = this.srcMiner.patternExtractor.extractPatterns(processedContent);


                if (scanJsFiles && extractedData.jsFiles) {
                    for (const jsFileItem of extractedData.jsFiles) {

                        const jsFile = typeof jsFileItem === 'object' ? jsFileItem.value : jsFileItem;
                        const fullUrl = this.resolveUrl(jsFile, baseUrl);
                        if (fullUrl && await this.isSameDomain(fullUrl, baseUrl)) {
                            urls.add(fullUrl);
                        }
                    }
                }

                if (scanHtmlFiles && extractedData.urls) {
                    for (const urlItem of extractedData.urls) {

                        const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                        const fullUrl = this.resolveUrl(url, baseUrl);
                        if (fullUrl && await this.isSameDomain(fullUrl, baseUrl) && this.isValidPageUrl(url)) {
                            urls.add(fullUrl);
                        }
                    }
                }

                if (scanApiFiles) {

                    if (extractedData.absoluteApis) {
                        for (const apiItem of extractedData.absoluteApis) {

                            const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                            const fullUrl = this.resolveUrl(api, baseUrl);
                            if (fullUrl && await this.isSameDomain(fullUrl, baseUrl)) {
                                urls.add(fullUrl);
                            }
                        }
                    }


                    if (extractedData.relativeApis) {
                        for (const apiItem of extractedData.relativeApis) {

                            const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                            const fullUrl = this.resolveUrl(api, baseUrl);
                            if (fullUrl && await this.isSameDomain(fullUrl, baseUrl)) {
                                urls.add(fullUrl);
                            }
                        }
                    }
                }


            } catch (error) {
                console.error(' 深度扫描统一化版本：使用PatternExtractor收集URL失败:', error);
            }
        }

        return Array.from(urls);
    }


    isValidPageUrl(url) {
        if (!url || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
            return false;
        }


        if (!this.regexCache.resourceExtensions) {
            this.regexCache.resourceExtensions = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|ttf|eot|woff2|map|pdf|zip)$/i;
        }


        if (this.regexCache.resourceExtensions.test(url.toLowerCase())) {
            return false;
        }

        return true;
    }


    isValidApiUrl(url) {
        if (!url || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
            return false;
        }


        if (!this.regexCache.apiFeatures) {
            this.regexCache.apiFeatures = [
                /\/api\//i,
                /\/admin\//i,
                /\/manage\//i,
                /\/backend\//i,
                /\/service\//i,
                /\.(php|asp|aspx|jsp|do|action|json|xml|csv)(\?|$)/i,
                /\.js\.map(\?|$)/i,
                /\.css\.map(\?|$)/i,
                /config.*\.(json|js|xml)(\?|$)/i,
                /\?.*=/,
                /\.(ts|tsx)(\?|$)/i,
                /\.(tpl|template)(\?|$)/i
            ];
        }

        return this.regexCache.apiFeatures.some(pattern => pattern.test(url));
    }


    async mergeDeepScanResults(newResults) {
        let hasNewData = false;
        const now = Date.now();


        Object.keys(newResults).forEach(key => {
            if (!this.srcMiner.deepScanResults[key]) {
                this.srcMiner.deepScanResults[key] = [];
            }


            const existingValues = new Set(
                this.srcMiner.deepScanResults[key].map(item =>
                    typeof item === 'object' ? item.value : item
                )
            );

            newResults[key].forEach(item => {
                const itemValue = typeof item === 'object' ? item.value : item;
                if (itemValue && !existingValues.has(itemValue)) {
                    this.srcMiner.deepScanResults[key].push(item);
                    existingValues.add(itemValue);
                    hasNewData = true;
                }
            });
        });


        if (hasNewData) {
            this.srcMiner.results = this.srcMiner.deepScanResults;
        }


        const shouldUpdateDisplay = hasNewData &&
            (now - this.throttleConfig.lastDisplayUpdate) > this.throttleConfig.displayUpdateInterval;

        if (shouldUpdateDisplay) {
            this.throttleConfig.lastDisplayUpdate = now;

            requestAnimationFrame(() => {
                this.srcMiner.displayResults();
            });
        }


        const shouldUpdateStorage = hasNewData &&
            (now - this.throttleConfig.lastStorageUpdate) > this.throttleConfig.storageUpdateInterval;

        if (shouldUpdateStorage && !this.throttleConfig.pendingStorageUpdate) {
            this.throttleConfig.pendingStorageUpdate = true;
            this.throttleConfig.lastStorageUpdate = now;


            this._saveToStorageAsync().finally(() => {
                this.throttleConfig.pendingStorageUpdate = false;
            });
        }

        return hasNewData;
    }


    async _saveToStorageAsync() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) return;

            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }

            const urlObj = new URL(tab.url);
            const fullUrl = `https://${urlObj.hostname}`;
            const pageTitle = document.title || tab.title || 'Unknown Page';


            await Promise.all([
                window.indexedDBManager.saveScanResults(fullUrl, this.srcMiner.deepScanResults, tab.url, pageTitle),
                window.indexedDBManager.saveDeepScanResults(fullUrl, this.srcMiner.deepScanResults, tab.url, pageTitle)
            ]);

            console.log(' 深度扫描数据已保存，当前结果数量:',
                Object.values(this.srcMiner.deepScanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0));
        } catch (error) {
            console.error(' 保存深度扫描结果到IndexedDB失败:', error);
        }
    }


    async flushPendingUpdates() {

        this.srcMiner.displayResults();


        await this._saveToStorageAsync();

        console.log(' 已刷新所有待处理的更新');
    }


    applyFilters(results, content, sourceUrl = '未知URL') {



    }


    _simpleHash(str) {
        if (!str) return '0';
        let hash = 0;
        const len = Math.min(str.length, 10000);
        for (let i = 0; i < len; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }


    resolveUrl(url, baseUrl) {
        try {
            if (!url) return null;


            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }


            if (url.startsWith('//')) {
                return new URL(baseUrl).protocol + url;
            }


            return new URL(url, baseUrl).href;

        } catch (error) {
            return null;
        }
    }


    async isSameDomain(url, baseUrl) {
        try {
            const urlObj = new URL(url);
            const baseUrlObj = new URL(baseUrl);


            const domainSettings = await this.getDomainScanSettings();


            if (domainSettings.allowAllDomains) {

                return true;
            }


            if (domainSettings.allowSubdomains) {
                const baseHostname = baseUrlObj.hostname;
                const urlHostname = urlObj.hostname;


                const isSameOrSubdomain = urlHostname === baseHostname ||
                                        urlHostname.endsWith('.' + baseHostname) ||
                                        baseHostname.endsWith('.' + urlHostname);

                if (isSameOrSubdomain) {

                    return true;
                }
            }


            const isSame = urlObj.hostname === baseUrlObj.hostname;
            if (isSame) {

            } else {

            }
            return isSame;

        } catch (error) {
            console.error('域名检查失败:', error);
            return false;
        }
    }


    async getDomainScanSettings() {
        try {

            if (typeof window.SettingsManager !== 'undefined' && window.SettingsManager.getDomainScanSettings) {
                return await window.SettingsManager.getDomainScanSettings();
            }


            const result = await chrome.storage.local.get(['domainScanSettings']);
            const domainSettings = result.domainScanSettings || {
                allowSubdomains: false,
                allowAllDomains: false
            };

            return domainSettings;
        } catch (error) {
            console.error('获取域名扫描设置失败:', error);

            return {
                allowSubdomains: false,
                allowAllDomains: false
            };
        }
    }


    updateDeepScanProgress(current, total, stage) {
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');

        if (progressText && progressBar) {
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressText.textContent = `${stage}: ${current}/${total} (${percentage.toFixed(1)}%)`;
            progressBar.style.width = `${percentage}%`;
        }
    }


    showDeepScanComplete() {
        const deepScanBtn = document.getElementById('deepScanBtn');
        const deepScanBtnText = deepScanBtn.querySelector('.text');

        if (deepScanBtnText) {
            deepScanBtnText.textContent = ' 深度扫描完成';
        }
        deepScanBtn.style.background = 'rgba(0, 212, 170, 0.3)';


        this.srcMiner.saveResults();


        const saveCompletionState = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url) {
                    const urlObj = new URL(tab.url);
                    const fullUrl = `https://${urlObj.hostname}`;

                    if (!window.indexedDBManager) {
                        window.indexedDBManager = new IndexedDBManager();
                    }

                    const completionState = {
                        running: false,
                        complete: true,
                        completedAt: Date.now(),
                        resultsCount: Object.values(this.srcMiner.results).reduce((sum, arr) => sum + (arr?.length || 0), 0),
                        scannedUrls: Array.from(this.srcMiner.scannedUrls || []),
                        currentDepth: this.srcMiner.currentDepth,
                        maxDepth: this.srcMiner.maxDepth,
                        concurrency: this.srcMiner.concurrency
                    };

                    await window.indexedDBManager.saveDeepScanState(fullUrl, completionState);
                }
            } catch (error) {
                console.error('保存深度扫描完成状态失败:', error);
            }
        };

        saveCompletionState();

        setTimeout(() => {
            if (deepScanBtnText) {
                deepScanBtnText.textContent = '深度递归扫描';
            }
            deepScanBtn.style.background = '';
        }, 3000);

        const totalScanned = this.srcMiner.scannedUrls.size;
        const totalResults = Object.values(this.srcMiner.results).reduce((sum, arr) => sum + (arr?.length || 0), 0);


    }

    showError(message) {
        console.error('深度扫描错误:', message);

        if (typeof this.srcMiner.showNotification === 'function') {
            this.srcMiner.showNotification(message, 'error');
        }
    }

    showSuccessNotification(message) {


        if (typeof this.srcMiner.showNotification === 'function') {
            this.srcMiner.showNotification(message, 'success');
        } else {

            alert(message);
        }
    }


    getPageStorageKey(url) {
        try {
            const urlObj = new URL(url);

            const key = urlObj.hostname;

            return key.replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch (error) {
            console.error('生成存储键失败:', error);

            return url.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        }
    }
}
