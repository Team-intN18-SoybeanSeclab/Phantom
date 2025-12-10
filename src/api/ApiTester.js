/**
 * API测试器 - 负责API接口的批量测试功能
 */
class ApiTester {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
    }
    
    /**
     * 获取自定义请求头设置
     */
    async getCustomHeaders() {
        try {
            if (this.srcMiner.settingsManager) {
                return await this.srcMiner.settingsManager.getHeadersSetting();
            }
            return [];
        } catch (error) {
            console.error('获取自定义请求头设置失败:', error);
            return [];
        }
    }

    /**
     * 获取Cookie设置（兼容性方法）
     */
    async getCookieSetting() {
        try {
            if (this.srcMiner.settingsManager) {
                return await this.srcMiner.settingsManager.getCookieSetting();
            }
            return '';
        } catch (error) {
            console.error('获取Cookie设置失败:', error);
            return '';
        }
    }
    
    /**
     * 检查和自动添加"/"前缀到baseapi路径
     * @param {string} baseApiPath - 输入的baseapi路径
     * @returns {string} - 处理后的baseapi路径
     */
    normalizeBaseApiPath(baseApiPath) {
        if (!baseApiPath || typeof baseApiPath !== 'string') {
            return '';
        }
        
        const trimmedPath = baseApiPath.trim();
        if (trimmedPath === '') {
            return '';
        }
        
        // 如果路径不是以"/"开头，自动添加
        if (!trimmedPath.startsWith('/')) {
            return '/' + trimmedPath;
        }
        
        return trimmedPath;
    }
    
    /**
     * 处理多个baseapi路径（每行一个）
     * @param {string} baseApiPaths - 输入的多个baseapi路径，每行一个
     * @returns {Array<string>} - 处理后的baseapi路径数组
     */
    normalizeMultipleBaseApiPaths(baseApiPaths) {
        if (!baseApiPaths || typeof baseApiPaths !== 'string') {
            return [];
        }
        
        // 按换行符分割，去除空白字符，过滤空字符串
        const paths = baseApiPaths
            .split('\n')
            .map(path => path.trim())
            .filter(path => path.length > 0);
        
        // 对每个路径进行标准化处理
        return paths.map(path => this.normalizeBaseApiPath(path));
    }
    
    /**
     * 标准化多个自定义域名输入
     * @param {string} domains - 多行域名字符串
     * @returns {Array<string>} - 处理后的域名数组
     */
    normalizeMultipleDomains(domains) {
        if (!domains || typeof domains !== 'string') {
            return [];
        }
        
        // 按换行符分割，去除空白字符，过滤空字符串
        return domains
            .split('\n')
            .map(domain => domain.trim())
            .filter(domain => domain.length > 0)
            .map(domain => {
                // 确保域名包含协议
                if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
                    domain = 'http://' + domain;
                }
                // 移除末尾的斜杠
                return domain.replace(/\/$/, '');
            });
    }
    
    // 批量请求测试
    async batchRequestTest() {
        const method = document.getElementById('requestMethod').value;
        const selectedCategory = document.getElementById('categorySelect').value;
        
        // 获取并发数和超时时间配置
        const concurrencyInput = document.getElementById('apiConcurrency');
        const timeoutInput = document.getElementById('apiTimeout');

        // 获取base API路径配置
        const baseApiPathInput = document.getElementById('baseApiPath');
        const rawBaseApiPaths = baseApiPathInput ? baseApiPathInput.value.trim() : '';
        const customBaseApiPaths = this.normalizeMultipleBaseApiPaths(rawBaseApiPaths);
        
        // 获取自定义域名配置
        const customDomainsInput = document.getElementById('customDomains');
        const rawCustomDomains = customDomainsInput ? customDomainsInput.value.trim() : '';
        const customDomains = this.normalizeMultipleDomains(rawCustomDomains);
        
        // 如果自动添加了"/"前缀，给出提示
        if (rawBaseApiPaths) {
            const originalPaths = rawBaseApiPaths.split('\n').map(p => p.trim()).filter(p => p);
            const normalizedPaths = customBaseApiPaths;
            
            // 检查每个路径是否被修改
            originalPaths.forEach((originalPath, index) => {
                const normalizedPath = normalizedPaths[index];
                if (originalPath && originalPath !== normalizedPath) {
                    //console.log(`🔧 自动为baseapi路径添加"/"前缀: "${originalPath}" -> "${normalizedPath}"`);
                }
            });
            
            if (customBaseApiPaths.length > 1) {
                //console.log(`🔧 检测到 ${customBaseApiPaths.length} 个baseapi路径: ${customBaseApiPaths.join(', ')}`);
            }
        }
        
        // 获取自定义API路径配置
        const customApiPathsInput = document.getElementById('customApiPaths');
        const customApiPaths = customApiPathsInput ? customApiPathsInput.value.trim() : '';
        
        const concurrency = concurrencyInput ? parseInt(concurrencyInput.value) : 8;
        const timeout = timeoutInput ? parseInt(timeoutInput.value) * 1000 : 5000; // 转换为毫秒
        
        //console.log(`🔧 API测试配置: 并发数=${concurrency}, 超时=${timeout/1000}秒, Base API路径=${customBaseApiPaths.length > 0 ? customBaseApiPaths.join(', ') : '无'}, 自定义API路径=${customApiPaths || '无'}`);

        
        if (!selectedCategory) {
            alert('请先选择要测试的分类');
            return;
        }
        
        let items = this.srcMiner.results[selectedCategory] || [];
        
        // 如果有自定义API路径，添加到测试列表中
        if (customApiPaths) {
            const customPaths = this.parseCustomApiPaths(customApiPaths);
            items = this.mergeAndDeduplicateItems(items, customPaths);
            //console.log(`📝 添加了 ${customPaths.length} 个自定义API路径，去重后总计 ${items.length} 个测试项目`);
        }
        
        // 如果选择了自定义API路径分类，直接使用扫描结果中的自定义API路径
        if (selectedCategory === 'customApis') {
            items = this.srcMiner.results.customApis || [];
            if (items.length === 0) {
                alert('自定义API路径分类中没有数据，请先添加自定义API路径');
                return;
            }
            //console.log(`🔧 使用扫描结果中的自定义API路径进行测试，共 ${items.length} 个`);
        }
        
        if (items.length === 0) {
            alert(`选中的分类"${this.getCategoryTitle(selectedCategory)}"中没有数据，请先扫描页面`);
            return;
        }
        
        if (this.isTestableCategory(selectedCategory)) {
            await this.testSelectedCategory(selectedCategory, items, method, concurrency, timeout, customBaseApiPaths, customDomains);

        } else {
            alert(`分类"${this.getCategoryTitle(selectedCategory)}"不支持请求测试`);
        }
    }
    
    // 获取分类标题
    getCategoryTitle(categoryKey) {
        const categoryTitles = {
            'customApis': '自定义API路径',
            'absoluteApis': '绝对路径API',
            'relativeApis': '相对路径API',
            'vueRoutes': 'Vue路由',
            'jsFiles': 'JS文件',
            'urls': '完整URL',
            'domains': '域名',
            'paths': '路径'
        };
        return categoryTitles[categoryKey] || categoryKey;
    }
    
    // 检查分类是否可以进行请求测试
    isTestableCategory(categoryKey) {
        const testableCategories = [
            'customApis', 'absoluteApis', 'relativeApis', 'jsFiles', 'cssFiles', 
            'images', 'urls', 'paths', 'vueRoutes'
        ];
        return testableCategories.includes(categoryKey);
    }
    
    // 测试选中的分类
    async testSelectedCategory(categoryKey, items, method, concurrency = 8, timeout = 5000, customBaseApiPaths = [], customDomains = []) {

        try {
            // 获取自定义请求头设置
            const customHeaders = await this.getCustomHeaders();
            //console.log('📋 获取到自定义请求头:', customHeaders);
            
            // 使用新的TestWindow类创建测试窗口
            const testWindow = new TestWindow();

            await testWindow.createTestWindow(categoryKey, items, method, concurrency, timeout, customHeaders, customBaseApiPaths, customDomains);

            
            // 显示成功提示
            const modal = document.getElementById('requestResultModal');
            const resultsDiv = document.getElementById('requestResults');
            
            modal.style.display = 'block';
            resultsDiv.innerHTML = `
                <div style="text-align: center; color: #00d4aa; margin-bottom: 20px;">
                    <h3>✅ 测试窗口已打开</h3>
                    <p>已在新窗口中启动 ${this.getCategoryTitle(categoryKey)} 的批量测试</p>
                    <p>测试项目数: ${items.length} | 方法: ${method}</p>
                    <p>并发数: ${concurrency} | 超时: ${timeout/1000}秒</p>
                    <br>
                    <button onclick="document.getElementById('requestResultModal').style.display='none'" 
                            style="padding: 10px 20px; background: #00d4aa; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        关闭此提示
                    </button>
                </div>
            `;
            
            // 3秒后自动关闭提示
            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);
            
        } catch (error) {
            console.error('创建测试窗口失败:', error);
            alert('创建测试窗口失败: ' + error.message);
        }
        
        return; // 直接返回，不再执行原来的测试逻辑
        
        const results = [];
        let successCount = 0;
        let failCount = 0;
        
        // 真正的并发处理 - 每个请求完成后立即显示结果
        let completedCount = 0;
        let activeRequests = 0;
        let currentIndex = 0;
        
        const processNextBatch = () => {
            // 启动新的请求直到达到并发限制或没有更多项目
            while (activeRequests < concurrency && currentIndex < items.length) {
                const item = items[currentIndex];
                const itemIndex = currentIndex;
                currentIndex++;
                activeRequests++;
                
                // 异步处理单个请求
                this.processSingleRequest(item, categoryKey, baseUrl, method, timeout, itemIndex)
                    .then(result => {
                        // 请求完成，更新计数器
                        activeRequests--;
                        completedCount++;
                        
                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                        
                        results.push(result);
                        
                        // 立即更新显示
                        resultsDiv.innerHTML = `
                            <div style="text-align: center; color: #00d4aa; margin-bottom: 10px;">
                                测试进度: ${completedCount}/${items.length} | 成功: ${successCount} | 失败: ${failCount}
                                <br>当前并发: ${activeRequests}/${concurrency}
                            </div>
                            ${this.renderRequestResults(results)}
                        `;
                        
                        // 如果还有未处理的项目，启动下一个请求
                        if (currentIndex < items.length) {
                            processNextBatch();
                        }
                    })
                    .catch(error => {
                        console.error('请求处理失败:', error);
                        activeRequests--;
                        completedCount++;
                        failCount++;
                        
                        results.push({
                            url: item,
                            fullUrl: item,
                            status: 'Error',
                            statusText: error.message || '请求失败',
                            size: 'N/A',
                            time: 'N/A',
                            success: false
                        });
                        
                        // 更新显示
                        resultsDiv.innerHTML = `
                            <div style="text-align: center; color: #00d4aa; margin-bottom: 10px;">
                                测试进度: ${completedCount}/${items.length} | 成功: ${successCount} | 失败: ${failCount}
                                <br>当前并发: ${activeRequests}/${concurrency}
                            </div>
                            ${this.renderRequestResults(results)}
                        `;
                        
                        // 继续处理下一个
                        if (currentIndex < items.length) {
                            processNextBatch();
                        }
                    });
            }
        };
        
        // 开始处理
        processNextBatch();
        
        // 等待所有请求完成
        while (completedCount < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const modalTitle = modal.querySelector('h3');
        modalTitle.textContent = '批量测试结果';
        
        resultsDiv.innerHTML = `
            <div style="text-align: center; color: #00d4aa; margin-bottom: 10px;">
                测试完成: ${successCount} 成功 / ${failCount} 失败 (共 ${items.length} 个)
                <br>分类: ${this.getCategoryTitle(categoryKey)} | 方法: ${method}
            </div>
            ${this.renderRequestResults(results)}
        `;
    }
    
    // 处理单个请求
    async processSingleRequest(item, categoryKey, baseUrl, method, timeout, index, cookieSetting = null) {
        try {
            let url = await this.buildTestUrl(item, categoryKey, baseUrl);
            
            if (!url) {
                return {
                    url: item,
                    fullUrl: 'Invalid URL',
                    status: 'Error',
                    statusText: '无法构建有效URL',
                    size: 'N/A',
                    time: 'N/A',
                    success: false,
                    index: index
                };
            }
            
            const startTime = performance.now();
            const response = await this.makeRequest(url, method, timeout, cookieSetting);
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);
            
            let size = 'N/A';
            try {
                if (response.headers && response.headers.get('content-length')) {
                    size = this.formatBytes(parseInt(response.headers.get('content-length')));
                }
            } catch (e) {
                // 忽略获取大小失败
            }
            
            // 判断成功状态：2xx状态码或者no-cors模式下的200
            const isSuccess = response.ok || (response.status >= 200 && response.status < 300);
            
            return {
                url: item,
                fullUrl: url,
                status: response.status || 'Unknown',
                statusText: response.statusText || 'OK',
                size: size,
                time: `${duration}ms`,
                success: isSuccess,
                index: index
            };
        } catch (error) {
            // 这里应该很少执行到，因为makeRequest已经处理了大部分错误
            return {
                url: item,
                fullUrl: item,
                status: 'Exception',
                statusText: error.message || '未知异常',
                size: 'N/A',
                time: 'N/A',
                success: false,
                index: index
            };
        }
    }

    // 构建测试URL
    async buildTestUrl(item, categoryKey, baseUrl) {
        try {
            let url = item;
            
            // 修复：如果item是对象，提取value属性
            // 🔥 优先使用 fullUrl（用于 Vue 路由等需要完整 URL 的场景）
            if (typeof item === 'object' && item !== null) {
                url = item.fullUrl || item.value || item.url || item;
            }
            
            // 修复：确保url是字符串类型
            if (!url || typeof url !== 'string') {
                console.error('buildTestUrl: url参数无效:', url);
                return null;
            }
            
            switch (categoryKey) {
                case 'absoluteApis':
                case 'paths':
                    if (baseUrl && url.startsWith('/')) {
                        url = baseUrl + url;
                    }
                    break;
                    
                case 'relativeApis':
                    if (baseUrl && !url.startsWith('http')) {
                        // 🔥 修复：自动去除相对路径开头的"."
                        let cleanedUrl = url;
                        if (cleanedUrl.startsWith('./')) {
                            cleanedUrl = cleanedUrl.substring(2); // 去除 "./"
                            console.log(`🔧 [ApiTester] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                        } else if (cleanedUrl.startsWith('.')) {
                            cleanedUrl = cleanedUrl.substring(1); // 去除单独的 "."
                            console.log(`🔧 [ApiTester] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
                        }
                        
                        url = baseUrl + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                    }
                    break;
                    
                case 'urls':
                    if (!url.startsWith('http')) {
                        url = 'http://' + url;
                    }
                    break;
                    
                case 'jsFiles':
                case 'cssFiles':
                case 'images':
                    if (baseUrl && !url.startsWith('http')) {
                        if (url.startsWith('/')) {
                            url = baseUrl + url;
                        } else {
                            url = baseUrl + '/' + url;
                        }
                    }
                    break;
                    
                // 🔥 Vue 路由：已经是完整 URL，直接使用
                case 'vueRoutes':
                    // Vue 路由的 fullUrl 已经是完整的 URL，不需要额外处理
                    // 如果不是完整 URL，尝试构建
                    if (!url.startsWith('http')) {
                        if (baseUrl) {
                            url = baseUrl + (url.startsWith('/') ? '' : '/') + url;
                        }
                    }
                    break;
                    
                default:
                    if (baseUrl && !url.startsWith('http')) {
                        url = baseUrl + (url.startsWith('/') ? '' : '/') + url;
                    }
            }
            
            new URL(url);
            return url;
        } catch (error) {
            console.error('构建URL失败:', error, item);
            return null;
        }
    }
    
    // 发送请求
    // 发送请求 - 通过后台脚本
    async makeRequest(url, method, timeout = 5000, customCookie = null) {
        //console.log(`🌐 API测试通过后台脚本请求: ${url}`);
        
        const requestOptions = {
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            timeout: timeout
        };
        
        if (method === 'POST') {
            requestOptions.headers['Content-Type'] = 'application/json';
            requestOptions.body = JSON.stringify({});
        }
        
        try {
            // 通过后台脚本发送请求（会自动使用保存的Cookie）
            const response = await this.makeRequestViaBackground(url, requestOptions);
            return response;
        } catch (error) {
            // 返回错误响应对象
            return {
                status: 'Error',
                statusText: error.message || '请求失败',
                ok: false,
                headers: new Headers()
            };
        }
    }
    
    // 通过后台脚本发送请求
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
                    // 模拟fetch响应对象
                    resolve({
                        ok: response.data.status >= 200 && response.data.status < 300,
                        status: response.data.status,
                        statusText: response.data.statusText,
                        headers: new Map(Object.entries(response.data.headers || {})),
                        text: () => Promise.resolve(response.data.text),
                        json: () => {
                            try {
                                return Promise.resolve(JSON.parse(response.data.text));
                            } catch (e) {
                                return Promise.reject(new Error('Invalid JSON'));
                            }
                        },
                        url: response.data.url
                    });
                } else {
                    reject(new Error(response?.error || 'Request failed'));
                }
            });
        });
    }
    
    // 批量测试多个API - 供DisplayManager调用
    async testMultipleApis(items, method, baseUrl) {
        if (!items || items.length === 0) {
            return [];
        }
        
        //console.log(`🔍 开始批量测试 ${items.length} 个API，方法: ${method}`);
        
        const results = [];
        const concurrencyLimit = 5; // 并发限制
        
        // 分批处理
        const chunks = [];
        for (let i = 0; i < items.length; i += concurrencyLimit) {
            chunks.push(items.slice(i, i + concurrencyLimit));
        }
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (item) => {
                try {
                    // 构建URL
                    let url = await this.buildTestUrl(item, 'absoluteApis', baseUrl);
                    if (!url) {
                        return {
                            url: item,
                            method: method,
                            status: 'Error',
                            success: false,
                            time: 0,
                            data: null,
                            error: '无法构建有效URL'
                        };
                    }
                    
                    // 发送请求并计时
                    const startTime = performance.now();
                    const response = await this.makeRequest(url, method, 5000); // 使用默认5秒超时
                    const endTime = performance.now();
                    const time = Math.round(endTime - startTime);
                    
                    // 尝试获取响应数据
                    let data = null;
                    try {
                        if (response.status !== 0) {
                            const contentType = response.headers.get('content-type') || '';
                            if (contentType.includes('application/json')) {
                                data = await response.json();
                            } else if (contentType.includes('text/')) {
                                const text = await response.text();
                                data = text.substring(0, 5000); // 限制文本大小
                            } else {
                                data = `[${contentType}] 二进制数据`;
                            }
                        }
                    } catch (e) {
                        data = `解析响应失败: ${e.message}`;
                    }
                    
                    return {
                        url: item,
                        fullUrl: url,
                        method: method,
                        status: response.status,
                        statusText: response.statusText,
                        success: response.ok || response.status < 400,
                        time: time,
                        data: data
                    };
                } catch (error) {
                    return {
                        url: item,
                        method: method,
                        status: 'Error',
                        statusText: error.message,
                        success: false,
                        time: 0,
                        data: null,
                        error: error.message
                    };
                }
            });
            
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }
        
        //console.log(`✅ API测试完成，成功: ${results.filter(r => r.success).length}/${results.length}`);
        return results;
    }
    
    // 渲染请求结果
    renderRequestResults(results) {
        if (!results || results.length === 0) {
            return '<div style="text-align: center; color: #666;">无结果</div>';
        }
        
        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: rgba(0, 212, 170, 0.1);">
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #00d4aa;">路径</th>
                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #00d4aa;">状态码</th>
                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #00d4aa;">大小</th>
                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #00d4aa;">耗时</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        results.forEach(result => {
            const statusColor = result.success ? '#00d4aa' : '#ff4757';
            html += `
                <tr style="border-bottom: 1px solid rgba(0, 212, 170, 0.2);">
                    <td style="padding: 8px; word-break: break-all;">${result.url}</td>
                    <td style="padding: 8px; text-align: center; color: ${statusColor};">${result.status}</td>
                    <td style="padding: 8px; text-align: center;">${result.size}</td>
                    <td style="padding: 8px; text-align: center;">${result.time}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        return html;
    }
    
    // 解析自定义API路径
    parseCustomApiPaths(customApiPaths) {
        if (!customApiPaths || typeof customApiPaths !== 'string') {
            return [];
        }
        
        // 按换行符分割，去除空白字符，过滤空字符串
        return customApiPaths
            .split('\n')
            .map(path => path.trim())
            .filter(path => path.length > 0);
    }
    
    // 合并并去重API路径
    mergeAndDeduplicateItems(existingItems, customPaths) {
        if (!Array.isArray(existingItems)) {
            existingItems = [];
        }
        if (!Array.isArray(customPaths)) {
            customPaths = [];
        }
        
        // 创建Set用于去重
        const uniqueItems = new Set();
        
        // 添加现有项目
        existingItems.forEach(item => {
            if (item && typeof item === 'string') {
                uniqueItems.add(item.trim());
            }
        });
        
        // 添加自定义路径
        customPaths.forEach(path => {
            if (path && typeof path === 'string') {
                uniqueItems.add(path.trim());
            }
        });
        
        // 转换回数组
        return Array.from(uniqueItems);
    }
    
    // 格式化字节大小
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0 || bytes === 'N/A') return 'N/A';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}