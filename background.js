class BackgroundSRCMiner {
    constructor() {
        this.init();
    }

    init() {

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });


        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab.url);
            }
        });
    }


    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'storeResults':
                    await this.storeResults(request.data, request.url);
                    sendResponse({ success: true });
                    break;

                case 'makeRequest':
                    const response = await this.makeRequestWithCookie(request.url, request.options);
                    sendResponse({ success: true, data: response });
                    break;

                case 'deepScan':
                    const scanResult = await this.performDeepScan(request.url, request.options);
                    sendResponse({ success: true, data: scanResult });
                    break;

                case 'apiTest':
                    const testResult = await this.performApiTest(request.urls, request.options);
                    sendResponse({ success: true, data: testResult });
                    break;

                case 'executeJSInjection':
                    const injectionResult = await this.executeJSInjection(request.tabId, request.code);
                    sendResponse({ success: true, data: injectionResult });
                    break;


                case 'updateScanResults':
                case 'scanProgress':
                case 'scanComplete':
                case 'scanError':
                case 'stopDeepScan':
                    await this.handleDeepScanMessage(request, sender);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }


    async handleDeepScanMessage(request, sender) {



        try {

            const tabs = await chrome.tabs.query({});

            for (const tab of tabs) {

                if (tab.url &&
                    tab.url.startsWith('http') &&
                    !tab.url.includes('deepscan.html')) {

                    try {
                        await chrome.tabs.sendMessage(tab.id, request);

                    } catch (error) {


                    }
                }
            }
        } catch (error) {
            console.error(' 转发深度扫描消息失败:', error);
        }
    }


    async makeRequestWithCookie(url, options = {}) {
        let hasCustomHeaders = false;
        try {
            const result = await chrome.storage.local.get('phantomHeaders');
            const customHeaders = (result.phantomHeaders || []).filter(h => h && h.key && h.value);
            hasCustomHeaders = customHeaders.length > 0;

            if (hasCustomHeaders) {
                await this.addCustomHeadersRule(url, customHeaders);
            }

            await this.ensureOffscreenDocument();

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'makeRequestWithCookie',
                    url: url,
                    options: options,
                    customHeaders: customHeaders
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(' 离屏文档通信失败:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response.data);
                    } else {
                        console.error(' 离屏文档请求失败:', response?.error);
                        reject(new Error(response?.error || 'Offscreen request failed'));
                    }
                });
            });

            if (hasCustomHeaders) {
                await this.removeCustomHeadersRule();
            }

            return response;
        } catch (error) {
            console.error(` 后台脚本请求失败: ${error.message}`);
            if (hasCustomHeaders) {
                try {
                    await this.removeCustomHeadersRule();
                } catch (e) {
                    console.warn('清理规则时出错:', e);
                }
            }
            throw error;
        }
    }


    async addCustomHeadersRule(url, customHeaders) {
        try {

            if (!customHeaders || customHeaders.length === 0) {

                return;
            }

            const urlObj = new URL(url);
            const ruleId = 1;




            const requestHeaders = customHeaders
                .filter(header => header && header.key && header.value)
                .map(header => ({
                    header: header.key,
                    operation: 'set',
                    value: header.value
                }));


            if (requestHeaders.length === 0) {

                return;
            }

            const rule = {
                id: ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: requestHeaders
                },
                condition: {
                    urlFilter: `*://${urlObj.hostname}/*`,
                    resourceTypes: ['xmlhttprequest', 'other']
                }
            };

            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: [rule],
                removeRuleIds: [ruleId]
            });


        } catch (error) {
            console.error(' 添加自定义请求头规则失败:', error);

        }
    }


    async removeCustomHeadersRule() {
        try {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1]
            });

        } catch (error) {


        }
    }



    _offscreenCreating = false;
    _offscreenPromise = null;

    async ensureOffscreenDocument() {

        if (this._offscreenCreating && this._offscreenPromise) {
            return this._offscreenPromise;
        }

        try {

            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT']
            });

            if (existingContexts.length > 0) {

                return;
            }


            this._offscreenCreating = true;



            this._offscreenPromise = chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['DOM_SCRAPING'],
                justification: '需要使用完整的Web API来发送带Cookie的网络请求'
            });

            await this._offscreenPromise;


        } catch (error) {

            if (error.message && error.message.includes('single offscreen document')) {
                console.log(' 离屏文档已存在（并发创建）');
                return;
            }
            console.error(' 离屏文档创建失败:', error);
            throw error;
        } finally {

            this._offscreenCreating = false;
            this._offscreenPromise = null;
        }
    }


    async performDeepScan(baseUrl, options = {}) {
        try {
            const results = {
                urls: [],
                errors: []
            };


            const urlsToScan = options.urls || [baseUrl];

            for (const url of urlsToScan) {
                try {
                    const response = await this.makeRequestWithCookie(url, {
                        method: 'GET',
                        timeout: options.timeout || 10000
                    });

                    results.urls.push({
                        url: url,
                        status: response.status,
                        content: response.text,
                        headers: response.headers
                    });
                } catch (error) {
                    results.errors.push({
                        url: url,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Deep scan failed: ${error.message}`);
        }
    }


    async performApiTest(urls, options = {}) {
        try {
            const results = [];
            const concurrency = options.concurrency || 5;
            const timeout = options.timeout || 5000;


            for (let i = 0; i < urls.length; i += concurrency) {
                const batch = urls.slice(i, i + concurrency);
                const batchPromises = batch.map(async (url) => {
                    try {
                        const startTime = Date.now();
                        const response = await this.makeRequestWithCookie(url, {
                            method: options.method || 'GET',
                            timeout: timeout
                        });
                        const endTime = Date.now();

                        return {
                            url: url,
                            status: response.status,
                            statusText: response.statusText,
                            responseTime: endTime - startTime,
                            success: true,
                            headers: response.headers
                        };
                    } catch (error) {
                        return {
                            url: url,
                            status: 0,
                            statusText: error.message,
                            responseTime: 0,
                            success: false,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            throw new Error(`API test failed: ${error.message}`);
        }
    }


    async executeJSInjection(tabId, code) {
        try {
            console.log(' 开始执行JS注入 (world: MAIN)...');


            console.log(' 准备执行用户代码，长度:', code.length);


            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                args: [code],
                func: (userCode) => {
                    try {

                        eval(userCode);
                        return { success: true, message: '脚本执行成功' };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                }
            });

            const result = results[0]?.result;
            if (result?.success) {
                console.log(' JS脚本执行成功');
                return { success: true, message: '脚本执行成功 (world: MAIN)' };
            } else {
                console.error(' JS脚本执行失败:', result?.error);
                return { success: false, error: result?.error || '未知错误' };
            }

        } catch (error) {
            console.error(' 脚本注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    async storeResults(data, url) {
        try {
            const timestamp = new Date().toISOString();












            await chrome.storage.local.set({
                'latestResults': {
                    url: url,
                    timestamp: timestamp,
                    data: data
                }
            });


        } catch (error) {
            console.error('保存结果失败:', error);
        }
    }


    async executeScriptContent(scriptContent) {
        try {
            console.log(' 开始执行JS脚本 (通过background.js)...');


            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                alert('无法获取当前标签页');
                return;
            }


            const response = await chrome.runtime.sendMessage({
                action: 'executeJSInjection',
                tabId: tab.id,
                code: scriptContent
            });

            if (response?.success && response.data?.success) {
                console.log(' JS脚本执行成功');
                alert('脚本执行成功 (world: MAIN)');
            } else {
                const errorMsg = response?.data?.error || response?.error || '未知错误';
                console.error(' JS脚本执行失败:', errorMsg);
                alert('脚本执行失败: ' + errorMsg);
            }

        } catch (error) {
            console.error(' 脚本注入失败:', error);
            alert('脚本注入失败: ' + error.message);
        }
    }

    async handleTabUpdate(tabId, url) {

        if (url.startsWith('http')) {

        }
    }


    async cleanOldData() {
        try {
            const data = await chrome.storage.local.get();
            const keys = Object.keys(data);
            const resultKeys = keys.filter(key => key.startsWith('results_'));


            if (resultKeys.length > 50) {
                const sortedKeys = resultKeys.sort().slice(0, -50);
                await chrome.storage.local.remove(sortedKeys);

            }
        } catch (error) {
            console.error('清理数据失败:', error);
        }
    }
}


const backgroundSRCMiner = new BackgroundSRCMiner();


chrome.runtime.onInstalled.addListener(() => {

});


setInterval(() => {
    backgroundSRCMiner.cleanOldData();
}, 24 * 60 * 60 * 1000);