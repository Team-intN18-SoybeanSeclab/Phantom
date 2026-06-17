class DeepScanWindow {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
        this.scanData = null;
        this.scanResults = {};
        this.isScanRunning = false;
        this.isPaused = false;
        this.currentDepth = 0;
        this.scannedUrls = new Set();
        this.pendingUrls = new Set();
        this.maxDepth = 2;
        this.concurrency = 8;
        this.timeout = 5000;
    }


    async createDeepScanWindow(config) {


        let baseUrl = '';
        let sourceUrl = '';
        let pageTitle = '';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab && tab.url) {
                baseUrl = new URL(tab.url).origin;
                sourceUrl = tab.url;
                pageTitle = tab.title || '';


            }
        } catch (error) {
            console.error(' [DEBUG] 获取当前页面URL失败:', error);
        }


        const scanConfig = {
            maxDepth: config.maxDepth || 2,
            concurrency: config.concurrency || 8,
            timeout: config.timeout || 5000,
            scanJsFiles: config.scanJsFiles !== false,
            scanHtmlFiles: config.scanHtmlFiles !== false,
            scanApiFiles: config.scanApiFiles !== false,
            baseUrl: baseUrl,
            sourceUrl: sourceUrl,
            pageTitle: pageTitle,
            initialResults: this.srcMiner.results || {},
            timestamp: Date.now()
        };


        console.log(' [DEBUG] 初始结果数量统计:', {
            absoluteApis: scanConfig.initialResults.absoluteApis?.length || 0,
            domains: scanConfig.initialResults.domains?.length || 0,
            emails: scanConfig.initialResults.emails?.length || 0,
            jsFiles: scanConfig.initialResults.jsFiles?.length || 0
        });


        try {

            await window.IndexedDBManager.saveDeepScanState(baseUrl, scanConfig);



            const verification = await window.IndexedDBManager.loadDeepScanState(baseUrl);


        } catch (error) {
            console.error(' [DEBUG] 保存深度扫描配置失败:', error);
            throw new Error('保存深度扫描配置失败: ' + error.message);
        }

        try {

            const scanPageUrl = chrome.runtime.getURL('deepscan.html');


            const newWindow = await chrome.windows.create({
                url: scanPageUrl,
                type: 'normal',
                width: 800,
                height: 900,
                focused: true
            });


            return newWindow;
        } catch (error) {
            console.error('创建深度扫描窗口失败:', error);
            throw error;
        }
    }


    async startDeepScan() {
        if (this.srcMiner.deepScanRunning) {

            return;
        }




        const maxDepthInput = document.getElementById('maxDepth');
        const concurrencyInput = document.getElementById('concurrency');
        const timeoutInput = document.getElementById('timeout');
        const scanJsFilesInput = document.getElementById('scanJsFiles');
        const scanHtmlFilesInput = document.getElementById('scanHtmlFiles');
        const scanApiFilesInput = document.getElementById('scanApiFiles');

        const config = {
            maxDepth: parseInt(maxDepthInput?.value) || 2,
            concurrency: parseInt(concurrencyInput?.value) || 8,
            timeout: parseInt(timeoutInput?.value) || 5,
            scanJsFiles: scanJsFilesInput ? scanJsFilesInput.checked : true,
            scanHtmlFiles: scanHtmlFilesInput ? scanHtmlFilesInput.checked : true,
            scanApiFiles: scanApiFilesInput ? scanApiFilesInput.checked : true
        };

        try {

            this.srcMiner.deepScanRunning = true;


            const deepScanBtn = document.getElementById('deepScanBtn');
            const configDiv = document.getElementById('deepScanConfig');

            if (deepScanBtn) {
                const deepScanBtnText = deepScanBtn.querySelector('.text');
                if (deepScanBtnText) {
                    deepScanBtnText.textContent = '⏹ 停止扫描';
                }
                deepScanBtn.style.background = 'rgba(239, 68, 68, 0.3)';
            }

            if (configDiv) {
                configDiv.style.display = 'none';
            }


            await this.createDeepScanWindow(config);

        } catch (error) {
            console.error(' 启动深度扫描失败:', error);
            this.srcMiner.deepScanRunning = false;


            const deepScanBtn = document.getElementById('deepScanBtn');
            if (deepScanBtn) {
                const deepScanBtnText = deepScanBtn.querySelector('.text');
                if (deepScanBtnText) {
                    deepScanBtnText.textContent = '深度递归扫描';
                }
                deepScanBtn.style.background = '';
            }

            throw error;
        }
    }


    stopDeepScan() {
        this.srcMiner.deepScanRunning = false;
        this.isScanRunning = false;


        chrome.runtime.sendMessage({
            action: 'stopDeepScan'
        });


        const deepScanBtn = document.getElementById('deepScanBtn');
        if (deepScanBtn) {
            const deepScanBtnText = deepScanBtn.querySelector('.text');
            if (deepScanBtnText) {
                deepScanBtnText.textContent = '深度递归扫描';
            }
            deepScanBtn.style.background = '';
        }

        const configDiv = document.getElementById('deepScanConfig');
        if (configDiv) {
            configDiv.style.display = 'none';
        }
    }


    handleScanWindowMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'updateScanResults':
                this.updateMainPageResults(message.data);
                sendResponse({ success: true });
                break;

            case 'scanProgress':
                this.updateScanProgress(message.data);
                sendResponse({ success: true });
                break;

            case 'scanComplete':
                this.handleScanComplete(message.data);
                sendResponse({ success: true });
                break;

            case 'scanError':
                this.handleScanError(message.data);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }


    updateMainPageResults(newResults) {
        if (!newResults) return;


        Object.keys(newResults).forEach(key => {
            if (!this.srcMiner.results[key]) {
                this.srcMiner.results[key] = [];
            }


            const existingSet = new Set(this.srcMiner.results[key]);
            newResults[key].forEach(item => {
                if (item && !existingSet.has(item)) {
                    this.srcMiner.results[key].push(item);
                }
            });
        });


        this.srcMiner.displayResults();
        this.srcMiner.saveResults();

        console.log(' 主页面结果已更新，当前结果数量:',
            Object.values(this.srcMiner.results).reduce((sum, arr) => sum + (arr?.length || 0), 0));
    }


    updateScanProgress(progressData) {
        const progressDiv = document.getElementById('deepScanProgress');
        if (progressDiv && progressData) {
            progressDiv.style.display = 'block';

            const progressText = document.getElementById('progressText');
            const progressBar = document.getElementById('progressBar');

            if (progressText) {
                progressText.textContent = `${progressData.stage}: ${progressData.current}/${progressData.total} (${progressData.percentage}%)`;
            }

            if (progressBar) {
                progressBar.style.width = `${progressData.percentage}%`;
            }
        }
    }


    handleScanComplete(finalResults) {



        if (finalResults) {
            this.updateMainPageResults(finalResults);
        }


        this.srcMiner.deepScanRunning = false;
        this.isScanRunning = false;


        const deepScanBtn = document.getElementById('deepScanBtn');
        if (deepScanBtn) {
            const deepScanBtnText = deepScanBtn.querySelector('.text');
            if (deepScanBtnText) {
                deepScanBtnText.textContent = ' 深度扫描完成';
            }
            deepScanBtn.style.background = 'rgba(0, 212, 170, 0.3)';

            setTimeout(() => {
                if (deepScanBtnText) {
                    deepScanBtnText.textContent = '深度递归扫描';
                }
                deepScanBtn.style.background = '';
            }, 3000);
        }


        const progressDiv = document.getElementById('deepScanProgress');
        if (progressDiv) {
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 5000);
        }


        const completionState = {
            deepScanComplete: true,
            deepScanCompletedAt: Date.now(),
            deepScanResultsCount: Object.values(this.srcMiner.results).reduce((sum, arr) => sum + (arr?.length || 0), 0)
        };


        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                const baseUrl = new URL(tabs[0].url).origin;
                IndexedDBManager.saveDeepScanState(baseUrl, completionState);
            }
        });
    }


    handleScanError(errorData) {
        console.error(' 深度扫描出错:', errorData);


        this.srcMiner.deepScanRunning = false;
        this.isScanRunning = false;


        const deepScanBtn = document.getElementById('deepScanBtn');
        if (deepScanBtn) {
            const deepScanBtnText = deepScanBtn.querySelector('.text');
            if (deepScanBtnText) {
                deepScanBtnText.textContent = ' 扫描失败';
            }
            deepScanBtn.style.background = 'rgba(239, 68, 68, 0.3)';

            setTimeout(() => {
                if (deepScanBtnText) {
                    deepScanBtnText.textContent = '深度递归扫描';
                }
                deepScanBtn.style.background = '';
            }, 3000);
        }
    }
}