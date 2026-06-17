class ApiTester {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
    }


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


    normalizeBaseApiPath(baseApiPath) {
        if (!baseApiPath || typeof baseApiPath !== 'string') {
            return '';
        }

        const trimmedPath = baseApiPath.trim();
        if (trimmedPath === '') {
            return '';
        }


        if (!trimmedPath.startsWith('/')) {
            return '/' + trimmedPath;
        }

        return trimmedPath;
    }


    normalizeMultipleBaseApiPaths(baseApiPaths) {
        if (!baseApiPaths || typeof baseApiPaths !== 'string') {
            return [];
        }


        const paths = baseApiPaths
            .split('\n')
            .map(path => path.trim())
            .filter(path => path.length > 0);


        return paths.map(path => this.normalizeBaseApiPath(path));
    }


    normalizeMultipleDomains(domains) {
        if (!domains || typeof domains !== 'string') {
            return [];
        }


        return domains
            .split('\n')
            .map(domain => domain.trim())
            .filter(domain => domain.length > 0)
            .map(domain => {

                if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
                    domain = 'http://' + domain;
                }

                return domain.replace(/\/$/, '');
            });
    }


    async batchRequestTest() {
        const method = document.getElementById('requestMethod').value;
        const selectedCategory = document.getElementById('categorySelect').value;


        const concurrencyInput = document.getElementById('apiConcurrency');
        const timeoutInput = document.getElementById('apiTimeout');


        const baseApiPathInput = document.getElementById('baseApiPath');
        const rawBaseApiPaths = baseApiPathInput ? baseApiPathInput.value.trim() : '';
        const customBaseApiPaths = this.normalizeMultipleBaseApiPaths(rawBaseApiPaths);


        const customDomainsInput = document.getElementById('customDomains');
        const rawCustomDomains = customDomainsInput ? customDomainsInput.value.trim() : '';
        const customDomains = this.normalizeMultipleDomains(rawCustomDomains);


        if (rawBaseApiPaths) {
            const originalPaths = rawBaseApiPaths.split('\n').map(p => p.trim()).filter(p => p);
            const normalizedPaths = customBaseApiPaths;


            originalPaths.forEach((originalPath, index) => {
                const normalizedPath = normalizedPaths[index];
                if (originalPath && originalPath !== normalizedPath) {

                }
            });

            if (customBaseApiPaths.length > 1) {

            }
        }


        const customApiPathsInput = document.getElementById('customApiPaths');
        const customApiPaths = customApiPathsInput ? customApiPathsInput.value.trim() : '';

        const concurrency = concurrencyInput ? parseInt(concurrencyInput.value) : 8;
        const timeout = timeoutInput ? parseInt(timeoutInput.value) * 1000 : 5000;




        if (!selectedCategory) {
            alert('请先选择要测试的分类');
            return;
        }

        let items = this.srcMiner.results[selectedCategory] || [];


        if (customApiPaths) {
            const customPaths = this.parseCustomApiPaths(customApiPaths);
            items = this.mergeAndDeduplicateItems(items, customPaths);

        }


        if (selectedCategory === 'customApis') {
            items = this.srcMiner.results.customApis || [];
            if (items.length === 0) {
                alert('自定义API路径分类中没有数据，请先添加自定义API路径');
                return;
            }

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


    isTestableCategory(categoryKey) {
        const testableCategories = [
            'customApis', 'absoluteApis', 'relativeApis', 'jsFiles', 'cssFiles',
            'images', 'urls', 'paths', 'vueRoutes'
        ];
        return testableCategories.includes(categoryKey);
    }


    async testSelectedCategory(categoryKey, items, method, concurrency = 8, timeout = 5000, customBaseApiPaths = [], customDomains = []) {

        try {

            const customHeaders = await this.getCustomHeaders();



            const testWindow = new TestWindow();

            await testWindow.createTestWindow(categoryKey, items, method, concurrency, timeout, customHeaders, customBaseApiPaths, customDomains);



            const modal = document.getElementById('requestResultModal');
            const resultsDiv = document.getElementById('requestResults');

            modal.style.display = 'block';
            resultsDiv.innerHTML = `
                <div style="text-align: center; color: #00d4aa; margin-bottom: 20px;">
                    <h3> 测试窗口已打开</h3>
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


            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('创建测试窗口失败:', error);
            alert('创建测试窗口失败: ' + error.message);
        }

        return;

        const results = [];
        let successCount = 0;
        let failCount = 0;


        let completedCount = 0;
        let activeRequests = 0;
        let currentIndex = 0;

        const processNextBatch = () => {

            while (activeRequests < concurrency && currentIndex < items.length) {
                const item = items[currentIndex];
                const itemIndex = currentIndex;
                currentIndex++;
                activeRequests++;


                this.processSingleRequest(item, categoryKey, baseUrl, method, timeout, itemIndex)
                    .then(result => {

                        activeRequests--;
                        completedCount++;

                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                        }

                        results.push(result);


                        resultsDiv.innerHTML = `
                            <div style="text-align: center; color: #00d4aa; margin-bottom: 10px;">
                                测试进度: ${completedCount}/${items.length} | 成功: ${successCount} | 失败: ${failCount}
                                <br>当前并发: ${activeRequests}/${concurrency}
                            </div>
                            ${this.renderRequestResults(results)}
                        `;


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


                        resultsDiv.innerHTML = `
                            <div style="text-align: center; color: #00d4aa; margin-bottom: 10px;">
                                测试进度: ${completedCount}/${items.length} | 成功: ${successCount} | 失败: ${failCount}
                                <br>当前并发: ${activeRequests}/${concurrency}
                            </div>
                            ${this.renderRequestResults(results)}
                        `;


                        if (currentIndex < items.length) {
                            processNextBatch();
                        }
                    });
            }
        };


        processNextBatch();


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

            }


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


    async buildTestUrl(item, categoryKey, baseUrl) {
        try {
            let url = item;



            if (typeof item === 'object' && item !== null) {
                url = item.fullUrl || item.value || item.url || item;
            }


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

                        let cleanedUrl = url;
                        if (cleanedUrl.startsWith('./')) {
                            cleanedUrl = cleanedUrl.substring(2);
                            console.log(` [ApiTester] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                        } else if (cleanedUrl.startsWith('.')) {
                            cleanedUrl = cleanedUrl.substring(1);
                            console.log(` [ApiTester] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
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


                case 'vueRoutes':


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



    async makeRequest(url, method, timeout = 5000, customCookie = null) {


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

            const response = await this.makeRequestViaBackground(url, requestOptions);
            return response;
        } catch (error) {

            return {
                status: 'Error',
                statusText: error.message || '请求失败',
                ok: false,
                headers: new Headers()
            };
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


    async testMultipleApis(items, method, baseUrl) {
        if (!items || items.length === 0) {
            return [];
        }



        const results = [];
        const concurrencyLimit = 5;


        const chunks = [];
        for (let i = 0; i < items.length; i += concurrencyLimit) {
            chunks.push(items.slice(i, i + concurrencyLimit));
        }

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (item) => {
                try {

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


                    const startTime = performance.now();
                    const response = await this.makeRequest(url, method, 5000);
                    const endTime = performance.now();
                    const time = Math.round(endTime - startTime);


                    let data = null;
                    try {
                        if (response.status !== 0) {
                            const contentType = response.headers.get('content-type') || '';
                            if (contentType.includes('application/json')) {
                                data = await response.json();
                            } else if (contentType.includes('text/')) {
                                const text = await response.text();
                                data = text.substring(0, 5000);
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


        return results;
    }


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


    parseCustomApiPaths(customApiPaths) {
        if (!customApiPaths || typeof customApiPaths !== 'string') {
            return [];
        }


        return customApiPaths
            .split('\n')
            .map(path => path.trim())
            .filter(path => path.length > 0);
    }


    mergeAndDeduplicateItems(existingItems, customPaths) {
        if (!Array.isArray(existingItems)) {
            existingItems = [];
        }
        if (!Array.isArray(customPaths)) {
            customPaths = [];
        }


        const uniqueItems = new Set();


        existingItems.forEach(item => {
            if (item && typeof item === 'string') {
                uniqueItems.add(item.trim());
            }
        });


        customPaths.forEach(path => {
            if (path && typeof path === 'string') {
                uniqueItems.add(path.trim());
            }
        });


        return Array.from(uniqueItems);
    }


    formatBytes(bytes, decimals = 2) {
        if (bytes === 0 || bytes === 'N/A') return 'N/A';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}