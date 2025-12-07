// 后台脚本
class BackgroundSRCMiner {
    constructor() {
        this.init();
    }
    
    init() {
        // 监听来自content script的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // 保持消息通道开放以支持异步响应
        });
        
        // 监听标签页更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab.url);
            }
        });
    }
    
    // 处理消息
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
                
                // 处理深度扫描窗口的消息
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
    
    // 处理深度扫描相关消息
    async handleDeepScanMessage(request, sender) {
        //console.log('🔍 处理深度扫描消息:', request.action);
        
        // 转发消息给主扩展页面（popup或content script）
        try {
            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                // 跳过扫描窗口本身和非HTTP页面
                if (tab.url && 
                    tab.url.startsWith('http') && 
                    !tab.url.includes('deep-scan-window.html')) {
                    
                    try {
                        await chrome.tabs.sendMessage(tab.id, request);
                        //console.log(`✅ 消息已转发到标签页: ${tab.id}`);
                    } catch (error) {
                        // 忽略无法发送消息的标签页（可能没有content script）
                        //console.log(`⚠️ 无法向标签页 ${tab.id} 发送消息:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 转发深度扫描消息失败:', error);
        }
    }
    
    // 使用自定义请求头发送请求 - 通过declarativeNetRequest动态修改请求头
    async makeRequestWithCookie(url, options = {}) {
        try {
            //console.log(`🌐 后台脚本准备发送请求: ${url}`);
            
            // 获取保存的自定义请求头设置
            ////console.log('🔍 [DEBUG] 开始获取自定义请求头...');
            const result = await chrome.storage.local.get('phantomHeaders');
            ////console.log('🔍 [DEBUG] chrome.storage.local.get结果:', result);
            const customHeaders = result.phantomHeaders || [];
            
            ////console.log(`📋 获取到自定义请求头:`, customHeaders);
            ////console.log(`📋 请求头数量: ${customHeaders.length}`);
            ////console.log(`📋 请求头详情:`, JSON.stringify(customHeaders, null, 2));
            
            // 尝试添加自定义请求头规则（如果有的话）
            await this.addCustomHeadersRule(url, customHeaders);
            
            // 确保离屏文档存在
            await this.ensureOffscreenDocument();
            
            // 通过离屏文档发送请求
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'makeRequestWithCookie',
                    url: url,
                    options: options,
                    customHeaders: customHeaders
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ 离屏文档通信失败:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        //console.log(`✅ 离屏文档请求成功: ${response.data.status}`);
                        resolve(response.data);
                    } else {
                        console.error('❌ 离屏文档请求失败:', response?.error);
                        reject(new Error(response?.error || 'Offscreen request failed'));
                    }
                });
            });
            
            // 清理规则（无论是否有自定义请求头都要清理，避免残留规则）
            await this.removeCustomHeadersRule();
            
            return response;
        } catch (error) {
            console.error(`❌ 后台脚本请求失败: ${error.message}`);
            // 确保清理规则
            try {
                await this.removeCustomHeadersRule();
            } catch (e) {
                console.warn('清理规则时出错:', e);
            }
            throw error;
        }
    }
    
    // 添加自定义请求头规则
    async addCustomHeadersRule(url, customHeaders) {
        try {
            // 如果没有自定义请求头，直接返回
            if (!customHeaders || customHeaders.length === 0) {
                //console.log('🔧 没有自定义请求头，跳过规则添加');
                return;
            }
            
            const urlObj = new URL(url);
            const ruleId = 1; // 使用固定ID，方便后续删除
            
            //console.log(`🔧 添加自定义请求头规则: ${urlObj.hostname}`, customHeaders);
            
            // 构建请求头数组，过滤无效的请求头
            const requestHeaders = customHeaders
                .filter(header => header && header.key && header.value)
                .map(header => ({
                    header: header.key,
                    operation: 'set',
                    value: header.value
                }));
            
            // 如果过滤后没有有效的请求头，直接返回
            if (requestHeaders.length === 0) {
                //console.log('🔧 没有有效的自定义请求头，跳过规则添加');
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
                removeRuleIds: [ruleId] // 先删除可能存在的旧规则
            });
            
            //console.log(`✅ 自定义请求头规则添加成功，共${requestHeaders.length}个请求头`);
        } catch (error) {
            console.error('❌ 添加自定义请求头规则失败:', error);
            // 不要抛出错误，让请求继续进行
        }
    }
    
    // 移除自定义请求头规则
    async removeCustomHeadersRule() {
        try {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1]
            });
            //console.log('🔧 自定义请求头规则已清理');
        } catch (error) {
            // 规则可能不存在，这是正常的，不需要报错
            //console.log('🔧 清理自定义请求头规则（规则可能不存在）');
        }
    }
    
    // 确保离屏文档存在
    // 🔥 添加锁机制防止并发创建离屏文档
    _offscreenCreating = false;
    _offscreenPromise = null;
    
    async ensureOffscreenDocument() {
        // 🔥 如果正在创建中，等待创建完成
        if (this._offscreenCreating && this._offscreenPromise) {
            return this._offscreenPromise;
        }
        
        try {
            // 检查是否已有离屏文档
            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT']
            });
            
            if (existingContexts.length > 0) {
                //console.log('🔧 离屏文档已存在');
                return;
            }
            
            // 🔥 设置锁
            this._offscreenCreating = true;
            
            // 创建离屏文档
            //console.log('🔧 创建离屏文档...');
            this._offscreenPromise = chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['DOM_SCRAPING'],
                justification: '需要使用完整的Web API来发送带Cookie的网络请求'
            });
            
            await this._offscreenPromise;
            
            //console.log('✅ 离屏文档创建成功');
        } catch (error) {
            // 🔥 如果是"已存在"错误，忽略它
            if (error.message && error.message.includes('single offscreen document')) {
                console.log('🔧 离屏文档已存在（并发创建）');
                return;
            }
            console.error('❌ 离屏文档创建失败:', error);
            throw error;
        } finally {
            // 🔥 释放锁
            this._offscreenCreating = false;
            this._offscreenPromise = null;
        }
    }
    
    // 执行深度扫描
    async performDeepScan(baseUrl, options = {}) {
        try {
            const results = {
                urls: [],
                errors: []
            };
            
            // 获取要扫描的URL列表
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
    
    // 执行API测试
    async performApiTest(urls, options = {}) {
        try {
            const results = [];
            const concurrency = options.concurrency || 5;
            const timeout = options.timeout || 5000;
            
            // 分批处理URL
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
        
        // 安装时的初始化
        chrome.runtime.onInstalled.addListener(() => {
            //console.log('幻影已安装');
        });
    }
    
    // JS注入功能 - 使用chrome.scripting.executeScript({world:'MAIN'})绕过CSP
    async executeJSInjection(tabId, code) {
        try {
            console.log('🔧 开始执行JS注入 (world: MAIN)...');
            
            // 记录执行的脚本内容（用于调试）
            console.log('✅ 准备执行用户代码，长度:', code.length);

            // 使用 world: 'MAIN' 在主世界执行脚本，绕过CSP限制
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',  // 关键：在主世界执行，不受页面CSP限制
                args: [code],
                func: (userCode) => {
                    try {
                        // 直接 eval 即可，CSP 不会拦截扩展注入
                        eval(userCode);
                        return { success: true, message: '脚本执行成功' };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                }
            });

            const result = results[0]?.result;
            if (result?.success) {
                console.log('✅ JS脚本执行成功');
                return { success: true, message: '脚本执行成功 (world: MAIN)' };
            } else {
                console.error('❌ JS脚本执行失败:', result?.error);
                return { success: false, error: result?.error || '未知错误' };
            }

        } catch (error) {
            console.error('❌ 脚本注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    async storeResults(data, url) {
        try {
            const timestamp = new Date().toISOString();
            // 注释掉创建大量垃圾存储的功能
            // const key = `results_${Date.now()}`;
            
            // await chrome.storage.local.set({
            //     [key]: {
            //         url: url,
            //         timestamp: timestamp,
            //         data: data
            //     }
            // });
            
            // 更新最新结果
            await chrome.storage.local.set({
                'latestResults': {
                    url: url,
                    timestamp: timestamp,
                    data: data
                }
            });
            
            //console.log('扫描结果已保存:', url);
        } catch (error) {
            console.error('保存结果失败:', error);
        }
    }

    // 执行脚本内容 - 使用chrome.scripting.executeScript({world:'MAIN'})绕过CSP
    async executeScriptContent(scriptContent) {
        try {
            console.log('🔧 开始执行JS脚本 (world: MAIN)...');
            
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                alert('无法获取当前标签页');
                return;
            }

            // 记录执行的脚本内容（用于调试）
            console.log('✅ 准备执行用户代码，长度:', scriptContent.length);

            // 使用 world: 'MAIN' 在主世界执行脚本，绕过CSP限制
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',  // 关键：在主世界执行，不受页面CSP限制
                args: [scriptContent],
                func: (code) => {
                    try {
                        // 直接 eval 即可，CSP 不会拦截扩展注入
                        eval(code);
                        return { success: true, message: '脚本执行成功' };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                }
            });

            const result = results[0]?.result;
            if (result?.success) {
                console.log('✅ JS脚本执行成功');
                alert('脚本执行成功 (world: MAIN)');
            } else {
                console.error('❌ JS脚本执行失败:', result?.error);
                alert('脚本执行失败: ' + (result?.error || '未知错误'));
            }

        } catch (error) {
            console.error('❌ 脚本注入失败:', error);
            alert('脚本注入失败: ' + error.message);
        }
    }

    // 执行脚本内容 - 通过background.js使用chrome.scripting.executeScript({world:'MAIN'})绕过CSP
    async executeScriptContent(scriptContent) {
        try {
            console.log('🔧 开始执行JS脚本 (通过background.js)...');
            
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                alert('无法获取当前标签页');
                return;
            }

            // 通过background.js执行注入
            const response = await chrome.runtime.sendMessage({
                action: 'executeJSInjection',
                tabId: tab.id,
                code: scriptContent
            });

            if (response?.success && response.data?.success) {
                console.log('✅ JS脚本执行成功');
                alert('脚本执行成功 (world: MAIN)');
            } else {
                const errorMsg = response?.data?.error || response?.error || '未知错误';
                console.error('❌ JS脚本执行失败:', errorMsg);
                alert('脚本执行失败: ' + errorMsg);
            }

        } catch (error) {
            console.error('❌ 脚本注入失败:', error);
            alert('脚本注入失败: ' + error.message);
        }
    }
    
    async handleTabUpdate(tabId, url) {
        // 当页面加载完成时，可以执行一些后台任务
        if (url.startsWith('http')) {
            //console.log('页面已加载:', url);
        }
    }
    
    // 清理旧数据
    async cleanOldData() {
        try {
            const data = await chrome.storage.local.get();
            const keys = Object.keys(data);
            const resultKeys = keys.filter(key => key.startsWith('results_'));
            
            // 只保留最近50条记录
            if (resultKeys.length > 50) {
                const sortedKeys = resultKeys.sort().slice(0, -50);
                await chrome.storage.local.remove(sortedKeys);
                //console.log('已清理旧数据:', sortedKeys.length, '条');
            }
        } catch (error) {
            console.error('清理数据失败:', error);
        }
    }
}

// 初始化后台脚本
new BackgroundSRCMiner();

// 定期清理数据
setInterval(() => {
    new BackgroundSRCMiner().cleanOldData();
}, 24 * 60 * 60 * 1000); // 每24小时清理一次