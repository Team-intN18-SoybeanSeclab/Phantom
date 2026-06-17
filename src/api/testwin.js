let testData = null;
let testResults = [];
let isTestRunning = false;
let isPaused = false;
let currentIndex = 0;
let activeRequests = 0;
let maxConcurrency = 8;
let requestTimeout = 5000;


async function initializePage() {


    try {

        const result = await chrome.storage.local.get(['testConfig']);

        if (!result.testConfig) {
            console.error('找不到测试配置数据');
            document.getElementById('loadingDiv').innerHTML = '<div style="color: #ff4757;">错误: 找不到测试配置数据</div>';
            return;
        }

        testData = result.testConfig;
        maxConcurrency = testData.concurrency || 8;
        requestTimeout = testData.timeout || 5000;




        document.getElementById('testInfo').textContent =
            `${testData.categoryTitle} | ${testData.method} | ${testData.items.length} 项`;
        document.getElementById('totalCount').textContent = testData.items.length;



        const baseUrlInfo = document.getElementById('baseUrlInfo');
        let infoText = `基础URL: ${testData.baseUrl}`;

        if (testData.customBaseApiPaths && testData.customBaseApiPaths.length > 0) {
            if (testData.customBaseApiPaths.length === 1) {
                infoText += ` | Base API路径: ${testData.customBaseApiPaths[0]}`;
            } else {
                infoText += ` | Base API路径: ${testData.customBaseApiPaths.length}个 (${testData.customBaseApiPaths.join(', ')})`;
            }
        }

        if (testData.customDomains && testData.customDomains.length > 0) {
            if (testData.customDomains.length === 1) {
                infoText += ` | 自定义域名: ${testData.customDomains[0]}`;
            } else {
                infoText += ` | 自定义域名: ${testData.customDomains.length}个 (${testData.customDomains.join(', ')})`;
            }
        }

        baseUrlInfo.textContent = infoText;

    } catch (error) {
        console.error('读取配置数据失败:', error);
        document.getElementById('loadingDiv').innerHTML = '<div style="color: #ff4757;">错误: 读取配置数据失败 - ' + error.message + '</div>';
        return;
    }


    document.getElementById('continueBtn').addEventListener('click', continueTest);
    document.getElementById('pauseBtn').addEventListener('click', pauseTest);
    document.getElementById('exportBtn').addEventListener('click', showExportModal);
    document.getElementById('clearBtn').addEventListener('click', clearResults);
    document.getElementById('statusFilter').addEventListener('change', filterResults);
    document.getElementById('statusCodeFilter').addEventListener('change', filterResults);
    document.getElementById('domainFilter').addEventListener('change', filterResults);


    document.getElementById('closeModal').addEventListener('click', hideExportModal);
    document.getElementById('exportJSON').addEventListener('click', () => {
        hideExportModal();
        exportAsJSON();
    });
    document.getElementById('exportCSV').addEventListener('click', () => {
        hideExportModal();
        exportAsCSV();
    });


    document.getElementById('exportModal').addEventListener('click', (e) => {
        if (e.target.id === 'exportModal') {
            hideExportModal();
        }
    });


    const tableHeaders = document.querySelectorAll('th[data-column]');
    tableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const columnIndex = parseInt(this.getAttribute('data-column'));

            sortTable(columnIndex);
        });
    });

    if (!testData || !testData.items || testData.items.length === 0) {
        console.error('测试数据无效');
        document.getElementById('loadingDiv').innerHTML = '<div style="color: #ff4757;">错误: 没有要测试的项目</div>';
        return;
    }

    setTimeout(startTest, 1000);
}


let currentSortColumn = -1;
let sortDirection = 'asc';


function sortTable(columnIndex) {
    const table = document.getElementById('resultsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));


    if (currentSortColumn === columnIndex) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortDirection = 'asc';
        currentSortColumn = columnIndex;
    }


    updateSortIndicators(columnIndex);


    rows.sort((a, b) => {
        let aValue = a.cells[columnIndex].textContent.trim();
        let bValue = b.cells[columnIndex].textContent.trim();


        switch (columnIndex) {
            case 0:
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
                break;
            case 3:

                const aIsNum = !isNaN(parseInt(aValue));
                const bIsNum = !isNaN(parseInt(bValue));

                if (aIsNum && bIsNum) {
                    aValue = parseInt(aValue);
                    bValue = parseInt(bValue);
                } else if (aIsNum && !bIsNum) {
                    return sortDirection === 'asc' ? -1 : 1;
                } else if (!aIsNum && bIsNum) {
                    return sortDirection === 'asc' ? 1 : -1;
                }
                break;
            case 4:
                aValue = parseSizeToBytes(aValue);
                bValue = parseSizeToBytes(bValue);
                break;
            case 5:
                aValue = parseTimeToMs(aValue);
                bValue = parseTimeToMs(bValue);
                break;
            case 1:
            case 2:
            case 6:
            default:

                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
        }

        let result = 0;
        if (aValue < bValue) result = -1;
        else if (aValue > bValue) result = 1;

        return sortDirection === 'asc' ? result : -result;
    });


    rows.forEach(row => tbody.appendChild(row));
}


function updateSortIndicators(activeColumn) {

    for (let i = 0; i <= 5; i++) {
        const indicator = document.getElementById(`sort-${i}`);
        if (indicator) {
            indicator.textContent = '';
            indicator.classList.remove('active');
        }
    }


    const activeIndicator = document.getElementById(`sort-${activeColumn}`);
    if (activeIndicator) {
        activeIndicator.textContent = sortDirection === 'asc' ? '' : '';
        activeIndicator.classList.add('active');
    }
}


function parseSizeToBytes(sizeStr) {
    if (sizeStr === 'N/A' || !sizeStr) return 0;

    const match = sizeStr.match(/^([0-9.]+)\s*([KMGT]?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
        case 'TB': return value * 1024 * 1024 * 1024 * 1024;
        case 'GB': return value * 1024 * 1024 * 1024;
        case 'MB': return value * 1024 * 1024;
        case 'KB': return value * 1024;
        case 'B':
        default: return value;
    }
}


function parseTimeToMs(timeStr) {
    if (timeStr === 'N/A' || !timeStr) return 0;

    const match = timeStr.match(/^([0-9.]+)ms$/);
    if (!match) return 0;

    return parseFloat(match[1]);
}


document.addEventListener('DOMContentLoaded', initializePage);


async function startTest() {


    if (!testData || isTestRunning) return;

    if (!testData.items || testData.items.length === 0) {
        console.error('没有要测试的项目');
        document.getElementById('loadingDiv').innerHTML = '<div style="color: #ff4757;">错误: 没有要测试的项目</div>';
        return;
    }




    const expandedItems = expandItemsForMultipleBasePaths(testData.items, testData.categoryKey, testData.baseUrl);
    testData.items = expandedItems;



    isTestRunning = true;
    isPaused = false;
    currentIndex = 0;
    activeRequests = 0;
    testResults = [];

    try {
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('continueBtn').style.display = 'none';
        document.getElementById('loadingDiv').style.display = 'none';
        document.getElementById('resultsTable').style.display = 'table';

        updateStatusBar();
        processNextBatch();
    } catch (error) {
        console.error('启动测试时发生错误:', error);
        document.getElementById('loadingDiv').innerHTML = '<div style="color: #ff4757;">启动测试失败: ' + error.message + '</div>';
    }
}


function continueTest() {
    if (isPaused) {
        isPaused = false;
        document.getElementById('pauseBtn').textContent = '暂停测试';
        document.getElementById('continueBtn').style.display = 'none';
        processNextBatch();
    }
}


function pauseTest() {
    isPaused = !isPaused;

    if (isPaused) {
        document.getElementById('pauseBtn').textContent = '继续测试';
        document.getElementById('continueBtn').style.display = 'none';
    } else {
        document.getElementById('pauseBtn').textContent = '暂停测试';
        document.getElementById('continueBtn').style.display = 'none';
        processNextBatch();
    }
}


function processNextBatch() {





    if (isPaused || !isTestRunning) {

        return;
    }

    if (currentIndex >= testData.items.length) {

        return;
    }

    let batchStarted = false;
    while (activeRequests < maxConcurrency && currentIndex < testData.items.length) {
        const item = testData.items[currentIndex];
        const itemIndex = currentIndex;
        currentIndex++;
        activeRequests++;
        batchStarted = true;



        processSingleRequest(item, itemIndex)
            .then(result => {

                activeRequests--;
                testResults.push(result);
                addResultToTable(result);
                updateStatusBar();

                if (currentIndex < testData.items.length && !isPaused) {
                    processNextBatch();
                } else if (activeRequests === 0 && currentIndex >= testData.items.length) {

                    completeTest();
                }
            })
            .catch(error => {
                console.error('请求处理失败:', error);
                activeRequests--;

                let displayItem = item;
                if (typeof item === 'object' && item.displayText) {
                    displayItem = item.displayText;
                }

                const errorResult = {
                    url: displayItem,
                    fullUrl: item,
                    status: 'Error',
                    statusText: error.message,
                    size: 'N/A',
                    time: 'N/A',
                    success: false,
                    index: itemIndex
                };
                testResults.push(errorResult);
                addResultToTable(errorResult);
                updateStatusBar();

                if (currentIndex < testData.items.length && !isPaused) {
                    processNextBatch();
                } else if (activeRequests === 0 && currentIndex >= testData.items.length) {

                    completeTest();
                }
            });
    }

    if (batchStarted) {

    } else {

    }
}


async function processSingleRequest(item, index) {
    try {

        let displayItem = item;
        let url;

        if (typeof item === 'object' && item.fullUrl) {

            displayItem = item.displayText || item.originalItem;
            url = item.fullUrl;
        } else {

            url = buildTestUrl(item, testData.categoryKey, testData.baseUrl);
        }

        if (!url) {
            return {
                url: displayItem,
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
        const response = await makeRequest(url, testData.method, requestTimeout);
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        let textContentOuter = '';

        try {
            textContentOuter = await (response.clone ? response.clone().text() : response.text());
        } catch (_) {
            textContentOuter = '';
        }

        let sizeBytes = 0;
        let sizeFormatted = 'N/A';
        try {
            if (typeof response.byteSize === 'number' && response.byteSize > 0) {
                sizeBytes = response.byteSize;
            } else {
                const cl = response.headers && response.headers.get('content-length');
                if (cl && !isNaN(parseInt(cl))) {
                    sizeBytes = parseInt(cl);
                } else {
                    if (typeof TextEncoder !== 'undefined') {
                        sizeBytes = new TextEncoder().encode(textContentOuter).length;
                    } else {
                        sizeBytes = new Blob([textContentOuter]).size;
                    }
                }
            }
            sizeFormatted = sizeBytes > 0 ? formatBytes(sizeBytes) : 'N/A';
        } catch (e) {
            sizeFormatted = 'N/A';
        }

        const isSuccess = response.ok || (response.status >= 200 && response.status < 300);


        let headersObj = {};
        try {
            if (response.headers && typeof response.headers.entries === 'function') {
                for (const [k, v] of response.headers.entries()) headersObj[k] = v;
            }
        } catch (_) {}
        const contentType = (response.headers && response.headers.get('content-type')) || '';
        const bodyPreview = (typeof textContentOuter === 'string' ? textContentOuter.slice(0, 2000) : '');
        const bodyTruncated = typeof textContentOuter === 'string' && textContentOuter.length > 2000;

        return {
            url: displayItem,
            fullUrl: url,
            status: response.status || 'Unknown',
            statusText: response.statusText || 'OK',
            size: sizeFormatted,
            byteSize: sizeBytes,
            contentType: contentType,
            headers: headersObj,
            bodyPreview: bodyPreview,
            bodyTruncated: bodyTruncated,
            rawBody: (typeof textContentOuter === 'string' ? textContentOuter.slice(0, 262144) : ''),
            rawBodyTruncated: (typeof textContentOuter === 'string' && textContentOuter.length > 262144),
            time: duration + 'ms',
            success: isSuccess,
            index: index
        };
    } catch (error) {
        return {
            url: displayItem,
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


function buildTestUrl(item, categoryKey, baseUrl) {
    try {
        let url = item;


        if (typeof item === 'object' && item !== null) {
            url = item.value || item.url || item;
            console.log('buildTestUrl: 从对象提取URL:', url, '原始对象:', item);
        }


        if (!url || typeof url !== 'string') {
            console.error('buildTestUrl: url参数无效:', url);
            return baseUrl || 'https://example.com';
        }


        const customBaseApiPaths = testData.customBaseApiPaths || [];

        console.log(` [buildTestUrl] 构建URL: 原始="${url}", 分类="${categoryKey}", 基础URL="${baseUrl}", BaseAPI路径=${JSON.stringify(customBaseApiPaths)}`);

        switch (categoryKey) {
            case 'absoluteApis':
            case 'paths':
                if (baseUrl && url.startsWith('/')) {

                    if (customBaseApiPaths.length > 0) {

                        const baseApiPath = customBaseApiPaths[0];

                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        url = baseUrl + normalizedBasePath + url;
                        console.log(` [buildTestUrl] 绝对路径+BaseAPI: "${baseUrl}" + "${normalizedBasePath}" + "${item}" = "${url}"`);
                    } else {
                        url = baseUrl + url;
                        console.log(` [buildTestUrl] 绝对路径: "${baseUrl}" + "${item}" = "${url}"`);
                    }
                }
                break;

            case 'relativeApis':
                if (baseUrl && !url.startsWith('http')) {

                    let cleanedUrl = url;
                    if (cleanedUrl.startsWith('./')) {
                        cleanedUrl = cleanedUrl.substring(2);
                        console.log(` [buildTestUrl] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                    } else if (cleanedUrl.startsWith('.')) {
                        cleanedUrl = cleanedUrl.substring(1);
                        console.log(` [buildTestUrl] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
                    }


                    if (customBaseApiPaths.length > 0) {

                        const baseApiPath = customBaseApiPaths[0];

                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        url = baseUrl + normalizedBasePath + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                        console.log(` [buildTestUrl] 相对路径+BaseAPI: "${baseUrl}" + "${normalizedBasePath}" + "/" + "${cleanedUrl}" = "${url}"`);
                    } else {
                        url = baseUrl + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                        console.log(` [buildTestUrl] 相对路径: "${baseUrl}" + "/" + "${cleanedUrl}" = "${url}"`);
                    }
                }
                break;

            case 'urls':
                if (!url.startsWith('http')) {
                    url = 'http://' + url;
                    console.log(` [buildTestUrl] 完整URL: "http://" + "${item}" = "${url}"`);
                }
                break;

            case 'jsFiles':
            case 'cssFiles':
            case 'images':
                if (baseUrl && !url.startsWith('http')) {
                    if (url.startsWith('/')) {

                        if (customBaseApiPaths.length > 0) {

                            const baseApiPath = customBaseApiPaths[0];
                            const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                            url = baseUrl + normalizedBasePath + url;
                            console.log(` [buildTestUrl] 文件路径+BaseAPI: "${baseUrl}" + "${normalizedBasePath}" + "${item}" = "${url}"`);
                        } else {
                            url = baseUrl + url;
                            console.log(` [buildTestUrl] 文件路径: "${baseUrl}" + "${item}" = "${url}"`);
                        }
                    } else {

                        if (customBaseApiPaths.length > 0) {

                            const baseApiPath = customBaseApiPaths[0];
                            const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                            url = baseUrl + normalizedBasePath + '/' + url;
                            console.log(` [buildTestUrl] 相对文件+BaseAPI: "${baseUrl}" + "${normalizedBasePath}" + "/" + "${item}" = "${url}"`);
                        } else {
                            url = baseUrl + '/' + url;
                            console.log(` [buildTestUrl] 相对文件: "${baseUrl}" + "/" + "${item}" = "${url}"`);
                        }
                    }
                }
                break;

            default:
                if (baseUrl && !url.startsWith('http')) {

                    if (customBaseApiPaths.length > 0) {

                        const baseApiPath = customBaseApiPaths[0];
                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        url = baseUrl + normalizedBasePath + (url.startsWith('/') ? '' : '/') + url;
                        console.log(` [buildTestUrl] 默认+BaseAPI: "${baseUrl}" + "${normalizedBasePath}" + "/" + "${item}" = "${url}"`);
                    } else {
                        url = baseUrl + (url.startsWith('/') ? '' : '/') + url;
                        console.log(` [buildTestUrl] 默认: "${baseUrl}" + "/" + "${item}" = "${url}"`);
                    }
                }
        }


        url = url.replace(/([^:]\/)\/+/g, '$1');

        console.log(` [buildTestUrl] 最终URL: "${url}"`);

        new URL(url);
        return url;
    } catch (error) {
        console.error('构建URL失败:', error, item);
        return null;
    }
}


function expandItemsForMultipleBasePaths(items, categoryKey, baseUrl) {
    const customBaseApiPaths = testData.customBaseApiPaths || [];
    const customDomains = testData.customDomains || [];



    if (customBaseApiPaths.length <= 1 && customDomains.length === 0) {
        return items;
    }

    const expandedItems = [];

    items.forEach(item => {

        if (customDomains.length > 0) {
            customDomains.forEach(customDomain => {

                if (customBaseApiPaths.length > 0) {
                    customBaseApiPaths.forEach(basePath => {
                        let url = item;


                        if (typeof item === 'object' && item !== null) {
                            url = item.value || item.url || item;
                        }


                        if (!url || typeof url !== 'string') {
                            console.error('expandItemsForMultipleBasePaths: url参数无效:', url);
                            return;
                        }

                        switch (categoryKey) {
                            case 'absoluteApis':
                            case 'paths':
                                if (url.startsWith('/')) {
                                    url = customDomain + basePath + url;
                                }
                                break;

                            case 'relativeApis':
                                if (typeof url === 'string' && !url.startsWith('http')) {

                                    let cleanedUrl = url;
                                    if (cleanedUrl.startsWith('./')) {
                                        cleanedUrl = cleanedUrl.substring(2);
                                        console.log(` [expandItems-customDomain] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                                    } else if (cleanedUrl.startsWith('.')) {
                                        cleanedUrl = cleanedUrl.substring(1);
                                        console.log(` [expandItems-customDomain] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
                                    }

                                    url = customDomain + basePath + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                                }
                                break;

                            case 'jsFiles':
                            case 'cssFiles':
                            case 'images':
                                if (typeof url === 'string' && !url.startsWith('http')) {
                                    if (url.startsWith('/')) {
                                        url = customDomain + basePath + url;
                                    } else {
                                        url = customDomain + basePath + '/' + url;
                                    }
                                }
                                break;

                            default:
                                if (typeof url === 'string' && !url.startsWith('http')) {
                                    url = customDomain + basePath + (url.startsWith('/') ? '' : '/') + url;
                                }
                        }


                        expandedItems.push({
                            originalItem: item,
                            customDomain: customDomain,
                            baseApiPath: basePath,
                            fullUrl: url,
                            displayText: `${item} (${customDomain}${basePath})`
                        });
                    });
                } else {

                    let url = item;


                    if (typeof item === 'object' && item !== null) {
                        url = item.value || item.url || item;
                    }


                    if (!url || typeof url !== 'string') {
                        console.error('expandItemsForMultipleBasePaths: url参数无效:', url);
                        return;
                    }

                    switch (categoryKey) {
                        case 'absoluteApis':
                        case 'paths':

                            if (typeof url === 'string' && url.startsWith('/')) {
                                url = customDomain + url;
                            }
                            break;

                        case 'relativeApis':
                            if (typeof url === 'string' && !url.startsWith('http')) {

                                let cleanedUrl = url;
                                if (cleanedUrl.startsWith('./')) {
                                    cleanedUrl = cleanedUrl.substring(2);
                                    console.log(` [expandItems-customDomain-noBP] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                                } else if (cleanedUrl.startsWith('.')) {
                                    cleanedUrl = cleanedUrl.substring(1);
                                    console.log(` [expandItems-customDomain-noBP] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
                                }

                                url = customDomain + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                            }
                            break;

                        case 'jsFiles':
                        case 'cssFiles':
                        case 'images':
                            if (typeof url === 'string' && !url.startsWith('http')) {
                                if (url.startsWith('/')) {
                                    url = customDomain + url;
                                } else {
                                    url = customDomain + '/' + url;
                                }
                            }
                            break;

                        default:
                            if (typeof url === 'string' && !url.startsWith('http')) {
                                url = customDomain + (url.startsWith('/') ? '' : '/') + url;
                            }
                    }


                    expandedItems.push({
                        originalItem: item,
                        customDomain: customDomain,
                        fullUrl: url,
                        displayText: `${item} (${customDomain})`
                    });
                }
            });
        }


        if (customBaseApiPaths.length > 1) {
            customBaseApiPaths.forEach(basePath => {
                let url = item;

                switch (categoryKey) {
                    case 'absoluteApis':
                    case 'paths':
                        if (baseUrl && url.startsWith('/')) {
                            url = baseUrl + basePath + url;
                        }
                        break;

                    case 'relativeApis':
                        if (baseUrl && !url.startsWith('http')) {

                            let cleanedUrl = url;
                            if (cleanedUrl.startsWith('./')) {
                                cleanedUrl = cleanedUrl.substring(2);
                                console.log(` [expandItems-basePath] 去除相对路径开头的"./": "${url}" -> "${cleanedUrl}"`);
                            } else if (cleanedUrl.startsWith('.')) {
                                cleanedUrl = cleanedUrl.substring(1);
                                console.log(` [expandItems-basePath] 去除相对路径开头的".": "${url}" -> "${cleanedUrl}"`);
                            }

                            url = baseUrl + basePath + (cleanedUrl.startsWith('/') ? '' : '/') + cleanedUrl;
                        }
                        break;

                    case 'jsFiles':
                    case 'cssFiles':
                    case 'images':
                        if (baseUrl && !url.startsWith('http')) {
                            if (url.startsWith('/')) {
                                url = baseUrl + basePath + url;
                            } else {
                                url = baseUrl + basePath + '/' + url;
                            }
                        }
                        break;

                    default:
                        if (baseUrl && !url.startsWith('http')) {
                            url = baseUrl + basePath + (url.startsWith('/') ? '' : '/') + url;
                        }
                }


                expandedItems.push({
                    originalItem: item,
                    baseApiPath: basePath,
                    fullUrl: url,
                    displayText: `${item} (${basePath})`
                });
            });
        }


        let originalUrl = item;


        if (typeof item === 'object' && item !== null) {
            originalUrl = item.value || item.url || item;
        }


        if (!originalUrl || typeof originalUrl !== 'string') {
            console.warn('originalUrl不是字符串类型:', originalUrl);
            return expandedItems;
        }


        switch (categoryKey) {
            case 'absoluteApis':
            case 'paths':
                if (baseUrl && originalUrl.startsWith('/')) {
                    if (customBaseApiPaths.length > 0) {
                        const baseApiPath = customBaseApiPaths[0];
                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        originalUrl = baseUrl + normalizedBasePath + originalUrl;
                    } else {
                        originalUrl = baseUrl + originalUrl;
                    }
                }
                break;

            case 'relativeApis':
                if (baseUrl && !originalUrl.startsWith('http')) {

                    let cleanedOriginalUrl = originalUrl;
                    if (cleanedOriginalUrl.startsWith('./')) {
                        cleanedOriginalUrl = cleanedOriginalUrl.substring(2);
                        console.log(` [expandItems] 去除相对路径开头的"./": "${originalUrl}" -> "${cleanedOriginalUrl}"`);
                    } else if (cleanedOriginalUrl.startsWith('.')) {
                        cleanedOriginalUrl = cleanedOriginalUrl.substring(1);
                        console.log(` [expandItems] 去除相对路径开头的".": "${originalUrl}" -> "${cleanedOriginalUrl}"`);
                    }

                    if (customBaseApiPaths.length > 0) {
                        const baseApiPath = customBaseApiPaths[0];
                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        originalUrl = baseUrl + normalizedBasePath + (cleanedOriginalUrl.startsWith('/') ? '' : '/') + cleanedOriginalUrl;
                    } else {
                        originalUrl = baseUrl + (cleanedOriginalUrl.startsWith('/') ? '' : '/') + cleanedOriginalUrl;
                    }
                }
                break;

            case 'jsFiles':
            case 'cssFiles':
            case 'images':
                if (baseUrl && !originalUrl.startsWith('http')) {
                    if (originalUrl.startsWith('/')) {
                        if (customBaseApiPaths.length > 0) {
                            const baseApiPath = customBaseApiPaths[0];
                            const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                            originalUrl = baseUrl + normalizedBasePath + originalUrl;
                        } else {
                            originalUrl = baseUrl + originalUrl;
                        }
                    } else {
                        if (customBaseApiPaths.length > 0) {
                            const baseApiPath = customBaseApiPaths[0];
                            const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                            originalUrl = baseUrl + normalizedBasePath + '/' + originalUrl;
                        } else {
                            originalUrl = baseUrl + '/' + originalUrl;
                        }
                    }
                }
                break;

            default:
                if (baseUrl && !originalUrl.startsWith('http')) {
                    if (customBaseApiPaths.length > 0) {
                        const baseApiPath = customBaseApiPaths[0];
                        const normalizedBasePath = baseApiPath === '/' ? '' : (baseApiPath.startsWith('/') ? baseApiPath : '/' + baseApiPath);
                        originalUrl = baseUrl + normalizedBasePath + (originalUrl.startsWith('/') ? '' : '/') + originalUrl;
                    } else {
                        originalUrl = baseUrl + (originalUrl.startsWith('/') ? '' : '/') + originalUrl;
                    }
                }
        }


        originalUrl = originalUrl.replace(/([^:]\/)\/+/g, '$1');


        expandedItems.push({
            originalItem: item,
            fullUrl: originalUrl,
            displayText: `${item} (原始域名)`
        });
    });

    return expandedItems;
}


async function makeRequest(url, method, timeout = 5000) {


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

        const response = await makeRequestViaBackground(url, requestOptions);
        return response;
    } catch (error) {
        console.error(` 测试窗口请求失败: ${error.message}`);


        return {
            status: 'Error',
            statusText: error.message || '请求失败',
            ok: false,
            headers: new Headers()
        };
    }
}


async function makeRequestViaBackground(url, options = {}) {
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
                    byteSize: (typeof response.data.sizeBytes === 'number' ? response.data.sizeBytes : 0),
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


function addResultToTable(result) {
    const tbody = document.getElementById('resultsBody');
    const row = document.createElement('tr');

    const statusClass = result.success ? 'status-success' : 'status-error';


    let displayUrl = (result.fullUrl || result.url || '');
    let fullDisplayUrl = displayUrl;

    try {
        if (displayUrl.startsWith('http')) {
            const u = new URL(displayUrl);

            displayUrl = u.pathname + (u.search || '') + (u.hash || '');
            fullDisplayUrl = u.href;
        }
    } catch (_) {

        fullDisplayUrl = displayUrl;
    }


    let domainInfo = '原始域名';
    try {
        if (result.fullUrl && result.fullUrl.startsWith('http')) {
            const urlObj = new URL(result.fullUrl);
            domainInfo = urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '');
        }
    } catch (e) {
        domainInfo = '未知域名';
    }


    row.innerHTML =
        '<td>' + (result.index + 1) + '</td>' +
        '<td class="url-cell" title="' + domainInfo + '">' + domainInfo + '</td>' +
        '<td class="url-cell" title="' + fullDisplayUrl + '">' + displayUrl + '</td>' +
        '<td class="' + statusClass + '">' + result.status + '</td>' +
        '<td>' + result.size + '</td>' +
        '<td>' + result.time + '</td>' +
        '<td class="' + statusClass + '">' + (result.success ? '成功' : '失败') + '</td>' +
        '<td><button class="btn btn-primary btn-view" data-index="' + result.index + '">查看</button></td>';

    tbody.appendChild(row);


    updateDomainFilter();


    const viewBtn = row.querySelector('.btn-view');
    if (viewBtn) {
        viewBtn.addEventListener('click', () => {
            const idx = parseInt(viewBtn.getAttribute('data-index'));
            const res = testResults.find(r => r.index === idx) || result;


            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';


            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modalContent.style.maxWidth = '900px';
            modalContent.style.width = '95%';

            const modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            const titleEl = document.createElement('h3');
            titleEl.textContent = '响应详情';
            const closeBtnEl = document.createElement('span');
            closeBtnEl.className = 'close';
            closeBtnEl.textContent = '×';
            modalHeader.appendChild(titleEl);
            modalHeader.appendChild(closeBtnEl);

            const modalBody = document.createElement('div');
            modalBody.className = 'modal-body';

            const metaDiv = document.createElement('div');
            metaDiv.style.marginBottom = '10px';
            metaDiv.style.color = '#fff';
            metaDiv.innerHTML = `
                <div><strong>URL:</strong> ${escapeHtml(res.fullUrl || res.url)}</div>
                <div><strong>状态:</strong> ${escapeHtml(String(res.status))} ${escapeHtml(res.statusText || '')}</div>
                <div><strong>大小:</strong> ${escapeHtml(res.size || '')} (${res.byteSize || 0} B)</div>
                <div><strong>类型:</strong> ${escapeHtml(res.contentType || '')}</div>
            `;
            modalBody.appendChild(metaDiv);


            const headerLines = [];
            if (res.headers && typeof res.headers === 'object') {
                for (const [k, v] of Object.entries(res.headers)) {
                    headerLines.push(`${k}: ${v}`);
                }
            }
            const statusLine = `HTTP/1.1 ${res.status} ${res.statusText || ''}`.trim();
            const rawBody = (typeof res.rawBody === 'string') ? res.rawBody : (res.bodyPreview || '');
            const rawResponse = `${statusLine}\r\n${headerLines.join('\r\n')}\r\n\r\n${rawBody}`;

            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.maxHeight = '480px';
            pre.style.overflow = 'auto';
            pre.style.background = 'rgba(0, 0, 0, 0.3)';
            pre.style.padding = '10px';
            pre.style.borderRadius = '8px';
            pre.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            pre.textContent = rawResponse;
            modalBody.appendChild(pre);

            if (res.rawBodyTruncated) {
                const tip = document.createElement('div');
                tip.style.fontSize = '12px';
                tip.style.color = '#ccc';
                tip.style.marginTop = '6px';
                tip.textContent = '内容已截断展示（前 256 KB）';
                modalBody.appendChild(tip);
            }

            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modal.appendChild(modalContent);

            document.body.appendChild(modal);
            const closeEl = modal.querySelector('.close');
            const close = () => { document.body.removeChild(modal); };
            closeEl.addEventListener('click', close);
            modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        });
    }
}


function updateStatusBar() {
    const total = testData ? testData.items.length : 0;
    const completed = testResults.length;
    const success = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success).length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressCount').textContent = completed;
    document.getElementById('successCount').textContent = success;
    document.getElementById('errorCount').textContent = failed;
}


function completeTest() {
    isTestRunning = false;
    isPaused = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = '暂停测试';
    document.getElementById('continueBtn').style.display = 'none';

    const successCount = testResults.filter(r => r.success).length;
    const totalCount = testResults.length;


    let completionMessage = '测试完成! 成功: ' + successCount + '/' + totalCount + ' | ' + testData.categoryTitle + ' | ' + testData.method;


            if (testData.customBaseApiPaths && testData.customBaseApiPaths.length > 0) {
            if (testData.customBaseApiPaths.length === 1) {
                completionMessage += ' | Base API: ' + testData.customBaseApiPaths[0];
            } else {
                completionMessage += ' | Base APIs: ' + testData.customBaseApiPaths.join(', ');
            }
        }

    document.getElementById('testInfo').textContent = completionMessage;

}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    const rows = document.querySelectorAll('#resultsBody tr');
    const domains = new Set();


    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const domain = row.cells[1].textContent.trim();
            if (domain) {
                domains.add(domain);
            }
        }
    });


    const currentValue = domainFilter.value;


    domainFilter.innerHTML = '<option value="all">全部域名</option>';


    Array.from(domains).sort().forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainFilter.appendChild(option);
    });


    if (currentValue && Array.from(domains).includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}


function filterResults() {
    const statusFilter = document.getElementById('statusFilter').value;
    const statusCodeFilter = document.getElementById('statusCodeFilter').value;
    const domainFilter = document.getElementById('domainFilter').value;
    const rows = document.querySelectorAll('#resultsBody tr');

    rows.forEach(row => {
        let show = true;
        const domainCell = row.cells[1].textContent.trim();
        const statusCell = row.cells[3].textContent.trim();
        const resultCell = row.cells[6].textContent.trim();


        if (domainFilter !== 'all' && domainCell !== domainFilter) {
            show = false;
        }


        if (show && statusFilter === 'success' && resultCell !== '成功') {
            show = false;
        } else if (show && statusFilter === 'error' && resultCell !== '失败') {
            show = false;
        }


        if (show && statusCodeFilter !== 'all') {
            const statusCode = parseInt(statusCell);


            if (isNaN(statusCode)) {
                show = false;
            } else {
                switch (statusCodeFilter) {
                    case '2xx':
                        show = statusCode >= 200 && statusCode < 300;
                        break;
                    case '3xx':
                        show = statusCode >= 300 && statusCode < 400;
                        break;
                    case '4xx':
                        show = statusCode >= 400 && statusCode < 500;
                        break;
                    case '5xx':
                        show = statusCode >= 500 && statusCode < 600;
                        break;
                    default:
                        show = false;
                }
            }
        }

        row.style.display = show ? '' : 'none';
    });
}


function showExportModal() {
    if (testResults.length === 0) {
        alert('没有测试结果可以导出');
        return;
    }

    document.getElementById('exportModal').style.display = 'flex';
}


function hideExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}


function exportAsJSON() {
    const data = {
        testInfo: {
            category: testData.categoryTitle,
            method: testData.method,
            total: testResults.length,
            success: testResults.filter(r => r.success).length,
            failed: testResults.filter(r => !r.success).length,

            timestamp: new Date().toISOString(),
            baseUrl: testData.baseUrl,
            customBaseApiPaths: testData.customBaseApiPaths || []

        },
        results: testResults
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, 'api-test-results-' + Date.now() + '.json');
}


function exportAsCSV() {
    const headers = ['序号', 'url', '状态码', '状态文本', '大小', '耗时', '结果'];
    const csvContent = [
        headers.join(','),
        ...testResults.map(result => [
            result.index + 1,
            '"' + (result.fullUrl || result.url) + '"',
            result.status,
            '"' + result.statusText + '"',
            result.size,
            result.time,
            result.success ? '成功' : '失败'
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, 'api-test-results-' + Date.now() + '.csv');
}


function downloadFile(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function clearResults() {
    if (confirm('确定要清空所有测试结果吗？')) {
        testResults = [];
        document.getElementById('resultsBody').innerHTML = '';
        updateStatusBar();
        document.getElementById('testInfo').textContent = '结果已清空';
    }
}

function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, m => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[m]));
}
function formatHeaders(h) {
    try {
        if (!h) return '';
        if (Array.isArray(h)) return h.map(kv => kv.join(': ')).join('\n');
        if (typeof h === 'object') {
            return Object.entries(h).map(([k,v]) => k + ': ' + v).join('\n');
        }
        return String(h);
    } catch(_) { return ''; }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || bytes === 'N/A') return 'N/A';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}