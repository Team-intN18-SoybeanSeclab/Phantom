const CE_VENDOR_SKIP = [
    /^jquery([.-]?\d*\.?\d*\.?\d*)?(?:[\.-]cookie)?(?:[\.-]fancybox)?(?:[\.-]validate)?(?:[\.-]artdialog)?(?:[\.-]blockui)?(?:[\.-]pack)?(?:[\.-]base64)?(?:[\.-]md5)?(?:[\.-]min)?\.js$/i,
    /^(?:vue|vue-router|vuex)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:react|react-dom)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^bootstrap(?:\.bundle)?[.-]?\d*\.?\d*\.?\d*(?:[\.-]min)?\.js$/i,
    /^(?:layui|lay|layer|element-ui|ueditor|kindeditor|ant-design)[.-]?\d*\.?\d*\.?\d*(?:[\.-]min)?\.js$/i,
    /^(?:echarts|chart|highcharts)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:lodash|moment|axios|underscore|backbone|tinymce|jsencrypt|select2)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:polyfill|modernizr|datatables)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i
];

class ContentExtractor {

    async extractSensitiveInfo(targetUrl, options = {}) {
        try {

            if (window !== window.top) {

                return this.getEmptyResults();
            }


            if (targetUrl && window.location.href !== targetUrl) {

                return this.getEmptyResults();
            }



            this._seenByKey = {};
            this._scanNowIso = null;
            this._scanPageTitle = null;
            this._scanHref = null;

            const results = {
                absoluteApis: new Set(),
                relativeApis: new Set(),
                modulePaths: new Set(),
                domains: new Set(),
                urls: new Set(),
                images: new Set(),
                audios: new Set(),
                videos: new Set(),
                jsFiles: new Set(),
                cssFiles: new Set(),
                emails: new Set(),
                phoneNumbers: new Set(),
                ipAddresses: new Set(),
                sensitiveKeywords: new Set(),
                comments: new Set(),
                subdomains: new Set(),
                ports: new Set(),
                paths: new Set(),
                parameters: new Set(),
                credentials: new Set(),
                cookies: new Set(),
                idKeys: new Set(),
                idcards: new Set(),
                companies: new Set(),
                jwts: new Set(),
                githubUrls: new Set(),
                vueFiles: new Set(),

                bearerTokens: new Set(),
                basicAuth: new Set(),
                authHeaders: new Set(),
                wechatAppIds: new Set(),
                awsKeys: new Set(),
                googleApiKeys: new Set(),
                githubTokens: new Set(),
                gitlabTokens: new Set(),
                webhookUrls: new Set(),
                idCards: new Set(),
                cryptoUsage: new Set()
            };


            const pageContent = this.getPageContent();


            const scriptContent = this.getAllScripts();
            const styleContent = this.getAllStyles();


            const linkContent = this.getAllLinks();


            const storageContent = this.getStorageContent();



            const combinedNonScriptContent = [pageContent, styleContent, linkContent].filter(c => c && c.length > 0).join('\n');



            if (combinedNonScriptContent.length > 0) {
                await this.performMultiLayerScan(combinedNonScriptContent, results, false);
            }


            const combinedScriptContent = [scriptContent, storageContent].filter(c => c && c.length > 0).join('\n');
            if (combinedScriptContent.length > 0) {
                await this.performMultiLayerScan(combinedScriptContent, results, true);
            }

            if (options.fetchExternal) {
                await this.scanExternalScripts(results);
            }


            const finalResults = {};


            const globalSeenValues = new Set();

            const nowIso = this._scanNowIso || (this._scanNowIso = new Date().toISOString());
            const pageTitle = this._scanPageTitle || (this._scanPageTitle = (document.title || 'Unknown Page'));
            const href = this._scanHref || (this._scanHref = window.location.href);

            const processAndDedupe = (items, key) => {
                const seen = new Set();
                return items.filter(item => {
                    const value = typeof item === 'object' ? item.value : item;
                    if (!value || value.length === 0) return false;
                    if (seen.has(value)) return false;
                    seen.add(value);
                    return true;
                }).map(item => {
                    if (typeof item === 'object' && item !== null && item.hasOwnProperty('value')) {
                        return {
                            value: item.value,
                            sourceUrl: item.sourceUrl || href,
                            extractedAt: item.extractedAt || nowIso,
                            pageTitle: item.pageTitle || pageTitle
                        };
                    } else {
                        return {
                            value: item,
                            sourceUrl: href,
                            extractedAt: nowIso,
                            pageTitle: pageTitle
                        };
                    }
                });
            };


            for (const [key, value] of Object.entries(results)) {
                if (value instanceof Set) {
                    finalResults[key] = processAndDedupe(Array.from(value), key);
                } else if (Array.isArray(value)) {
                    finalResults[key] = processAndDedupe(value, key);
                } else if (value) {
                    const items = [value];
                    finalResults[key] = processAndDedupe(items, key);
                } else {
                    finalResults[key] = [];
                }
            }


            if (finalResults.absoluteApis && finalResults.relativeApis) {
                const absoluteValues = new Set(finalResults.absoluteApis.map(item => item.value));
                finalResults.relativeApis = finalResults.relativeApis.filter(item => {

                    return !absoluteValues.has(item.value);
                });
            }


            const urlContainingKeys = [
                'urls',
                'absoluteApis',
                'jsFiles',
                'cssFiles',
                'images',
                'githubUrls',
                'webhookUrls'
            ];

            const existingDomains = new Set((finalResults.domains || []).map(d => d.value));
            if (!finalResults.domains) {
                finalResults.domains = [];
            }

            urlContainingKeys.forEach(key => {
                if (finalResults[key] && finalResults[key].length > 0) {
                    finalResults[key].forEach(urlItem => {
                        const url = urlItem.value || urlItem.fullUrl || urlItem;
                        if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
                            const domain = this.extractDomainFromUrl(url);
                            if (domain && !existingDomains.has(domain)) {
                                existingDomains.add(domain);
                                finalResults.domains.push({
                                    value: domain,
                                    sourceUrl: urlItem.sourceUrl || href,
                                    extractedAt: nowIso,
                                    pageTitle: pageTitle,
                                    extractedFrom: key
                                });
                            }
                        }
                    });
                }
            });


            const customKeys = Object.keys(finalResults).filter(key => key.startsWith('custom_'));
            if (customKeys.length > 0) {

            }


            Object.keys(finalResults).forEach(key => {
                if (finalResults[key].length > 0) {

                }
            });

            return finalResults;

        } catch (error) {
            console.error(' 扫描过程中出错:', error);
            return this.getEmptyResults();
        }
    }


    getPageContent() {
        try {


            let html = document.documentElement.outerHTML;

            html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {

                if (match.includes(' src=') || match.includes(' src =')) {
                    return match.replace(/>[\s\S]*?<\/script>/i, '></script>');
                }

                return match.replace(/>[\s\S]*?<\/script>/i, '></script>');
            });
            return html;
        } catch (e) {
            return '';
        }
    }


    getAllScripts() {
        const scripts = [];


        const inlineScripts = document.querySelectorAll('script:not([src])');

        for (let i = 0; i < inlineScripts.length; i++) {
            const script = inlineScripts[i];
            if (script.textContent) {

                scripts.push(script.textContent);
            }
        }


        document.querySelectorAll('script[src]').forEach(script => {
            if (script.src) {
                scripts.push(`// External script: ${script.src}`);
            }
        });

        return scripts.join('\n');
    }


    getAllStyles() {
        const styles = [];


        const styleElements = document.querySelectorAll('style');

        for (let i = 0; i < styleElements.length; i++) {
            const style = styleElements[i];
            if (style.textContent) {
                styles.push(style.textContent);
            }
        }


        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (link.href) {
                styles.push(`/* External stylesheet: ${link.href} */`);
            }
        });

        return styles.join('\n');
    }


    getAllLinks() {
        const links = new Set();


        const allLinks = document.querySelectorAll('a[href]');

        for (let i = 0; i < allLinks.length; i++) {
            links.add(allLinks[i].href);
        }

        return Array.from(links).join('\n');
    }


    getStorageContent() {
        const storage = [];

        try {



            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                if (value) {
                    storage.push(`localStorage.${key}=${value}`);
                }
            }


            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                if (value) {
                    storage.push(`sessionStorage.${key}=${value}`);
                }
            }
        } catch (e) {

        }

        return storage.join('\n');
    }

    async scanExternalScripts(results) {
        try {
            const targets = await this.collectSameOriginJsUrls();
            if (!targets.length) return;

            const CONCURRENCY = 5;
            const deadline = Date.now() + 15000;
            let idx = 0;
            const worker = async () => {
                while (idx < targets.length && Date.now() < deadline) {
                    const url = targets[idx++];
                    const text = await this.fetchScriptViaBackground(url);
                    if (text) {
                        await this.performMultiLayerScan(text, results, true);
                    }
                }
            };
            const workers = [];
            for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) {
                workers.push(worker());
            }
            await Promise.all(workers);
        } catch (e) {
        }
    }

    async collectSameOriginJsUrls() {
        const origin = window.location.origin;
        let vendorEnabled = true;
        let vendorCustom = [];
        try {
            const r = await chrome.storage.local.get(['vendorJsFilterSettings']);
            const s = r.vendorJsFilterSettings || { enabled: true, patterns: [] };
            vendorEnabled = s.enabled !== false;
            vendorCustom = (s.patterns || []).map(p => {
                try { return new RegExp(p, 'i'); }
                catch (e) { return new RegExp(String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
            });
        } catch (e) {
        }

        const seen = new Set();
        const urls = [];
        document.querySelectorAll('script[src]').forEach(s => {
            if (!s.src) return;
            let u;
            try { u = new URL(s.src, window.location.href); }
            catch (e) { return; }
            if (u.origin !== origin) return;
            if (!/\.js(?:$|\?)/i.test(u.pathname)) return;
            if (seen.has(u.href)) return;
            const name = u.pathname.substring(u.pathname.lastIndexOf('/') + 1).toLowerCase();
            if (vendorEnabled && (CE_VENDOR_SKIP.some(re => re.test(name)) || vendorCustom.some(re => re.test(name)))) return;
            seen.add(u.href);
            urls.push(u.href);
        });

        return urls.slice(0, 15);
    }

    async fetchScriptViaBackground(url) {
        try {
            const resp = await new Promise((resolve) => {
                let done = false;
                const finish = (v) => { if (!done) { done = true; resolve(v); } };
                const timer = setTimeout(() => finish(null), 8000);
                try {
                    chrome.runtime.sendMessage({ action: 'makeRequest', url, options: { method: 'GET', timeout: 6000 } }, (r) => {
                        clearTimeout(timer);
                        if (chrome.runtime.lastError) { finish(null); return; }
                        finish(r && r.success ? r.data : null);
                    });
                } catch (e) {
                    clearTimeout(timer);
                    finish(null);
                }
            });
            if (resp && typeof resp.text === 'string' && resp.text.length > 0) {
                return resp.text.length > 500000 ? resp.text.slice(0, 500000) : resp.text;
            }
        } catch (e) {
        }
        return '';
    }


    async performMultiLayerScan(content, results, useAST = false) {
        if (!content || content.length === 0) return;


        const processContent = content;


        if (window.patternExtractor && typeof window.patternExtractor.extractPatterns === 'function') {
            try {




                if (!window.patternExtractor.customPatternsLoaded) {
                    await window.patternExtractor.loadCustomPatterns();
                }




                let extractedData = await window.patternExtractor.extractPatterns(processContent, window.location.href);


                if (useAST) {
                    extractedData = await this.enhanceWithAST(processContent, extractedData, window.location.href);
                }





                if (extractedData) {
                    if (!this._seenByKey) this._seenByKey = {};
                    const seenByKey = this._seenByKey;
                    const nowIso = this._scanNowIso || (this._scanNowIso = new Date().toISOString());
                    const pageTitle = this._scanPageTitle || (this._scanPageTitle = (document.title || 'Unknown Page'));
                    const href = this._scanHref || (this._scanHref = window.location.href);
                    const getSeen = (key) => seenByKey[key] || (seenByKey[key] = new Set());

                    Object.keys(extractedData).forEach(key => {
                        const isPredefined = results[key] && Array.isArray(extractedData[key]);
                        const isCustom = !isPredefined && key.startsWith('custom_') && Array.isArray(extractedData[key]);
                        if (!isPredefined && !isCustom) return;

                        if (isCustom && !results[key]) {
                            results[key] = new Set();
                        }

                        const targetSet = results[key];
                        const seen = getSeen(key);

                        extractedData[key].forEach(itemObj => {
                            const value = typeof itemObj === 'object' ? itemObj.value : itemObj;
                            if (!value || seen.has(value)) return;
                            seen.add(value);

                            if (typeof itemObj === 'object' && itemObj !== null && itemObj.hasOwnProperty('value')) {
                                targetSet.add({
                                    value: itemObj.value,
                                    sourceUrl: itemObj.sourceUrl || href,
                                    extractedAt: itemObj.extractedAt || nowIso,
                                    pageTitle: itemObj.pageTitle || pageTitle
                                });
                            } else {
                                targetSet.add({
                                    value: itemObj,
                                    sourceUrl: href,
                                    extractedAt: nowIso,
                                    pageTitle: pageTitle
                                });
                            }
                        });
                    });


                    const customKeys = Object.keys(extractedData).filter(key => key.startsWith('custom_'));
                    if (customKeys.length > 0) {

                    }
                }


            } catch (error) {
                console.error(' ContentExtractor统一化系统提取失败:', error);


            }
        } else {
            console.warn(' ContentExtractor统一化版本：PatternExtractor未找到或extractPatterns方法不存在，跳过提取');
        }
    }


    async enhanceWithAST(content, regexResults, sourceUrl) {

        if (!window.astBridge) {
            return regexResults;
        }


        if (!window.astBridge.initialized) {
            try {
                await window.astBridge.init();
            } catch (e) {
                console.warn(' [ContentExtractor] AST 初始化失败:', e.message);
                return regexResults;
            }
        }

        if (!window.astBridge.isAvailable()) {
            return regexResults;
        }


        const isJsContent = this.isJavaScriptContent(content);



        if (!isJsContent) {
            return regexResults;
        }


        if (content.length > 200000) {

            return regexResults;
        }

        try {


            const astResult = window.astBridge.extract(content, sourceUrl);

            if (astResult.success && astResult.detections && astResult.detections.length > 0) {
                console.log(' [AST] ContentExtractor AST 提取成功，检测到', astResult.detections.length, '个敏感信息');


                return this.mergeASTResults(regexResults, astResult.detections, sourceUrl);
            }
        } catch (error) {

            if (isJsContent) {
                console.warn(' [AST] ContentExtractor AST 提取失败:', error.message);
            }
        }

        return regexResults;
    }



    isJavaScriptContent(content) {
        if (!content || typeof content !== 'string') return false;


        const sampleContent = content.length > 5000 ? content.substring(0, 5000) : content;
        const trimmedContent = sampleContent.trim();


        if (trimmedContent.startsWith('(function') ||
            trimmedContent.startsWith('function') ||
            trimmedContent.startsWith('!function') ||
            trimmedContent.startsWith('var ') ||
            trimmedContent.startsWith('const ') ||
            trimmedContent.startsWith('let ') ||
            trimmedContent.startsWith('"use strict"') ||
            trimmedContent.startsWith("'use strict'")) {
            return true;
        }


        const jsIndicators = [
            'function ', 'const ', 'let ', 'var ',
            '=>', 'async ', 'await ', 'class ',
            'import ', 'export ', 'require(',
            '.then(', '.catch(', 'Promise',
            'document.', 'window.', 'console.'
        ];


        let indicatorCount = 0;
        for (const indicator of jsIndicators) {
            if (sampleContent.includes(indicator)) {
                indicatorCount++;
                if (indicatorCount >= 3) return true;
            }
        }

        return false;
    }


    mergeASTResults(regexResults, astDetections, sourceUrl) {
        const merged = { ...regexResults };


        const allExistingValues = new Set();
        Object.values(merged).forEach(arr => {
            if (Array.isArray(arr)) {
                arr.forEach(item => {
                    const v = typeof item === 'object' ? item.value : item;
                    if (v) allExistingValues.add(v);
                });
            }
        });

        for (const detection of astDetections) {

            const value = detection.value;
            if (!value) continue;

            let resultKey;

            if (detection.type === 'api_endpoint') {
                if (window.patternExtractor && typeof window.patternExtractor.isJunkApiEndpoint === 'function' && window.patternExtractor.isJunkApiEndpoint(value)) {
                    continue;
                }
                if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
                    resultKey = 'absoluteApis';
                } else if (value.startsWith('/')) {
                    resultKey = 'relativeApis';
                } else {
                    resultKey = 'absoluteApis';
                }
            } else if (detection.type === 'credential') {
                if (window.patternExtractor && typeof window.patternExtractor.isJunkCredentialValue === 'function' && window.patternExtractor.isJunkCredentialValue(value)) {
                    continue;
                }
                resultKey = 'credentials';
            } else {
                continue;
            }

            if (!merged[resultKey]) {
                merged[resultKey] = [];
            }


            if (allExistingValues.has(value)) {
                continue;
            }


            const exists = merged[resultKey].some(item => {
                const itemValue = typeof item === 'object' ? item.value : item;
                return itemValue === value;
            });

            if (!exists) {
                merged[resultKey].push({
                    value: value,
                    sourceUrl: sourceUrl,
                    extractedAt: new Date().toISOString(),
                    pageTitle: document.title || 'Unknown Page',
                    confidence: detection.confidence || 0.8,
                    context: detection.context,
                    source: 'ast'
                });
                allExistingValues.add(value);
            }
        }

        return merged;
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
            cryptoUsage: []
        };
    }
}