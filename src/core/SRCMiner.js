/**
 * SRCMiner 主类 - 核心控制器
 */
class SRCMiner {
    constructor() {
        this.results = {};
        this.deepScanRunning = false;
        this.scannedUrls = new Set();
        this.pendingUrls = new Set();
        this.deepScanResults = {};
        this.currentDepth = 0;
        this.maxDepth = 2;
        this.concurrency = 3;
        
        // 初始化组件
        this.initComponents();
        this.init();
    }
    
    // 初始化各个组件
    initComponents() {
        // 初始化模式提取器
        this.patternExtractor = new PatternExtractor();
        // 确保加载自定义正则配置（扫描与深度扫描前）
        try {
            if (this.patternExtractor && typeof this.patternExtractor.loadCustomPatterns === 'function') {
                // 首次加载
                this.patternExtractor.loadCustomPatterns().catch(err => {
                    console.error('加载自定义正则失败:', err);
                });
                // 监听设置更新，实时刷新
                window.addEventListener('regexConfigUpdated', () => {
                    try {
                        this.patternExtractor.loadCustomPatterns().catch(err => {
                            console.error('刷新自定义正则失败:', err);
                        });
                    } catch (e) {
                        console.warn('刷新自定义正则异常:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('初始化自定义正则时发生异常:', e);
        }
        
        // 初始化内容提取器
        this.contentExtractor = new ContentExtractor(this);
        
        // 初始化深度扫描器
        this.deepScanner = new DeepScanner(this);
        
        // 初始化显示管理器
        this.displayManager = new DisplayManager(this);
        
        // 初始化API测试器
        this.apiTester = new ApiTester(this);
        
        //console.log('✅ 所有组件初始化完成');
    }
    
    init() {
        // 初始化导航切换
        this.initNavigation();
        
        // 初始化按钮事件
        this.initEventListeners();
        
        // 初始化窗口事件监听
        this.initWindowEvents();
        
        // 加载已保存的结果并自动扫描
        this.loadResults();
        this.autoScanIfNeeded();
    }
    
    // 初始化窗口事件监听
    initWindowEvents() {
        // 监听窗口焦点事件
        window.addEventListener('focus', () => {
            //console.log('🔄 窗口获得焦点，重新加载数据...');
            this.loadResults().then(() => {
                if (Object.keys(this.results).length > 0) {
                    this.displayResults();
                }
            });
        });
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                //console.log('🔄 页面变为可见，重新加载数据...');
                this.loadResults().then(() => {
                    if (Object.keys(this.results).length > 0) {
                        this.displayResults();
                    }
                });
            }
        });
        
        // 定期检查数据完整性
        setInterval(() => {
            this.checkDataIntegrity();
        }, 5000); // 每5秒检查一次
    }
    
    // 检查数据完整性
    async checkDataIntegrity() {
        try {
            // 获取当前页面URL
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) return;
            
            const urlObj = new URL(tab.url);
            const fullUrl = `https://${urlObj.hostname}`;
            
            // 从IndexedDB检查数据
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            const storedData = await window.indexedDBManager.loadScanResults(fullUrl);
            
            // 如果存储中有数据但内存中没有，重新加载
            if (storedData && storedData.results && 
                Object.keys(this.results || {}).length === 0) {
                //console.log('🔧 检测到数据丢失，正在恢复...');
                await this.loadResults();
                if (Object.keys(this.results).length > 0) {
                    this.displayResults();
                }
            }
        } catch (error) {
            console.error('数据完整性检查失败:', error);
        }
    }
    
    initEventListeners() {
        document.getElementById('scanBtn').addEventListener('click', () => this.startScan());
        document.getElementById('deepScanBtn').addEventListener('click', () => this.toggleDeepScan());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearResults());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportResults());
        
        // 批量请求按钮
        const batchRequestBtn = document.getElementById('batchRequestBtn');
        if (batchRequestBtn) {
            batchRequestBtn.addEventListener('click', () => this.batchRequestTest());
        }
        
        // 添加自定义API路径按钮
        const addCustomApiBtn = document.getElementById('addCustomApiBtn');
        if (addCustomApiBtn) {
            addCustomApiBtn.addEventListener('click', () => this.addCustomApiPaths());
        }
        
        // 模态框关闭按钮
        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                document.getElementById('requestResultModal').style.display = 'none';
            });
        }
        
        // 新按钮事件处理
        const toggleExpandBtn = document.getElementById('toggleExpandBtn');
        if (toggleExpandBtn) {
            toggleExpandBtn.addEventListener('click', () => {
                const resultItems = document.querySelectorAll('.result-item');
                resultItems.forEach(item => {
                    item.classList.toggle('collapsed');
                });
            });
        }
        
        const batchViewBtn = document.getElementById('batchViewBtn');
        if (batchViewBtn) {
            batchViewBtn.addEventListener('click', () => {
                const modal = document.getElementById('requestResultModal');
                const resultsContainer = document.getElementById('requestResults');
                resultsContainer.innerHTML = '';
                
                // 获取所有扫描结果并添加到模态框
                const resultItems = document.querySelectorAll('.result-item');
                resultItems.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.classList.remove('collapsed');
                    resultsContainer.appendChild(clone);
                });
                
                modal.style.display = 'block';
            });
        }
        
        // 复制所有结果按钮
        const copyAllResultsBtn = document.getElementById('copyAllResultsBtn');
        if (copyAllResultsBtn) {
            copyAllResultsBtn.addEventListener('click', () => {
                const results = document.getElementById('requestResults').innerText;
                navigator.clipboard.writeText(results).then(() => {
                    const textSpan = copyAllResultsBtn.querySelector('.text');
                    if (textSpan) {
                        textSpan.textContent = '✅ 已复制';
                        setTimeout(() => {
                            textSpan.textContent = '复制全部结果';
                        }, 2000);
                    }
                });
            });
        }
    }
    
    // 初始化导航功能
    initNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        const pages = document.querySelectorAll('.page');
        
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPage = tab.dataset.page;
                
                // 更新导航状态
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 更新页面显示
                pages.forEach(page => {
                    page.classList.remove('active');
                    const pageId = `${targetPage}-page`;
                    if (page.id === pageId) {
                        page.classList.add('active');
                    }
                });
                
                // 页面切换后的特殊处理
                this.handlePageSwitch(targetPage);
            });
        });
    }
    
    // 处理页面切换后的逻辑
    handlePageSwitch(pageName) {
        switch (pageName) {
            case 'scan':
                // 切换到扫描页面时，重新加载并显示结果
                this.loadResults().then(() => {
                    if (Object.keys(this.results).length > 0) {
                        this.displayResults();
                    }
                });
                break;
            case 'deep':
                // 切换到深度扫描页面时，恢复深度扫描状态
                this.loadResults().then(() => {
                    this.restoreDeepScanUI();
                });
                break;
            case 'test':
                // 切换到API测试页面时，更新分类选择器
                this.loadResults().then(() => {
                    this.updateCategorySelect();
                });
                break;
            case 'about':
                // 关于页面
                break;
        }
    }
    
    // 恢复深度扫描UI状态
    restoreDeepScanUI() {
        if (this.deepScanRunning) {
            const deepScanBtn = document.getElementById('deepScanBtn');
            const deepScanBtnText = deepScanBtn?.querySelector('.text');
            const configDiv = document.getElementById('deepScanConfig');
            const progressDiv = document.getElementById('deepScanProgress');
            
            if (deepScanBtnText) {
                deepScanBtnText.textContent = '⏹️ 停止扫描';
            }
            if (deepScanBtn) {
                deepScanBtn.style.background = 'rgba(239, 68, 68, 0.3)';
                deepScanBtn.style.color = '#fff';
            }
            if (configDiv) {
                configDiv.style.display = 'block';
            }
            if (progressDiv) {
                progressDiv.style.display = 'block';
            }
        }
        
        // 如果有深度扫描结果，确保显示
        if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
            this.results = this.deepScanResults;
            this.displayResults();
        }
    }
    
    // 更新分类选择器
    updateCategorySelect() {
        const categorySelect = document.getElementById('categorySelect');
        if (!categorySelect || !this.results) return;
        
        // 保存当前选中的值
        const currentValue = categorySelect.value;
        
        // 清空现有选项
        categorySelect.innerHTML = '';
        
        // 添加默认选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '请选择要测试的分类';
        categorySelect.appendChild(defaultOption);
        
        // 添加有数据的分类
        const categories = [
            { key: 'customApis', title: '自定义API路径' },
            { key: 'absoluteApis', title: '绝对路径API' },
            { key: 'relativeApis', title: '相对路径API' },
            { key: 'jsFiles', title: 'JS文件' },
            { key: 'cssFiles', title: 'CSS文件' },
            { key: 'images', title: '图片文件' },
            { key: 'urls', title: '完整URL' },
            { key: 'domains', title: '域名' },
            { key: 'paths', title: '路径' }
        ];
        
        categories.forEach(category => {
            const items = this.results[category.key] || [];
            if (items.length > 0) {
                const option = document.createElement('option');
                option.value = category.key;
                option.textContent = `${category.title} (${items.length})`;
                categorySelect.appendChild(option);
            }
        });
        
        // 恢复之前选中的值（如果仍然存在）
        if (currentValue && categorySelect.querySelector(`option[value="${currentValue}"]`)) {
            categorySelect.value = currentValue;
        }
    }
    
    // 开始扫描
    async startScan(silent = false) {
        if (!silent) {
            //console.log('🔍 开始扫描页面...');
        }
        
        try {
            // 发送消息到content script进行扫描
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url) {
                throw new Error('无法获取当前页面信息');
            }
            
            // 检查是否是有效的网页URL
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                if (!silent) {
                    alert('无法扫描系统页面，请在普通网页上使用此功能');
                }
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractInfo' });
            
            if (response) {
                //console.log('🔍 [SCAN LOG] 收到原始扫描结果');
                //console.log('🔍 [SCAN LOG] 原始结果统计:', this.getResultsStats(response));
                
                // 在扫描阶段就应用筛选器
                //console.log('🔍 [SCAN LOG] 开始应用筛选器到扫描结果...');
                this.results = await this.applyFiltersToScanResults(response);
                //console.log('🔍 [SCAN LOG] 筛选后结果统计:', this.getResultsStats(this.results));
                //console.log('✅ [SCAN LOG] 筛选器应用完成');
                
                // 清空深度扫描结果，避免旧数据干扰
                this.deepScanResults = {};
                //console.log('🔍 [SCAN LOG] 已清空深度扫描结果缓存');
                
                await this.displayResults();
                
                // 确保保存操作被执行
                //console.log('🔍 [SCAN LOG] 准备调用 saveResults()...');
                try {
                    await this.saveResults();
                    //console.log('✅ [SCAN LOG] saveResults() 调用完成');
                } catch (saveError) {
                    console.error('❌ [SCAN LOG] saveResults() 调用失败:', saveError);
                }
                
                // 更新分类选择器
                this.updateCategorySelect();
                
                if (!silent) {
                    //console.log('✅ [SCAN LOG] 扫描完成');
                }
            } else {
                throw new Error('未收到扫描结果');
            }
        } catch (error) {
            console.error('❌ [SCAN LOG] 扫描失败:', error);
            if (!silent) {
                alert('扫描失败: ' + error.message);
            }
        }
    }
    
    // 在扫描阶段应用筛选器
    async applyFiltersToScanResults(rawResults) {
        try {
            //console.log('🔍 [FILTER LOG] 开始应用筛选器...');
            //console.log('🔍 [FILTER LOG] 原始结果统计:', this.getResultsStats(rawResults));
            
            // 确保筛选器已加载
            await this.loadFiltersIfNeeded();
            
            // 如果筛选器不可用，返回原始结果
            if (!window.domainPhoneFilter && !window.apiFilter) {
                console.warn('⚠️ [FILTER LOG] 筛选器未加载，返回原始扫描结果');
                return rawResults;
            }
            
            console.log('🔍 [FILTER LOG] 筛选器状态:', {
                domainPhoneFilter: !!window.domainPhoneFilter,
                apiFilter: !!window.apiFilter
            });
            
            // 创建筛选后的结果对象
            const filteredResults = {};
            
            // 使用API筛选器处理路径类型数据
            if (window.apiFilter) {
                //console.log('🔍 [FILTER LOG] 使用API筛选器处理路径数据...');
                const resultsSet = window.apiFilter.createEmptyResultSet();
                
                // 处理各种路径类型
                const pathCategories = ['absoluteApis', 'relativeApis', 'jsFiles', 'cssFiles', 'images', 'urls', 'paths'];
                pathCategories.forEach(category => {
                    if (rawResults[category] && Array.isArray(rawResults[category])) {
                        //console.log(`🔍 [FILTER LOG] 处理 ${category}: ${rawResults[category].length} 个项目`);
                        rawResults[category].forEach(item => {
                            if (item && typeof item === 'string') {
                                window.apiFilter.filterAPI(item, resultsSet);
                            }
                        });
                    }
                });
                
                // 将筛选后的Set转换为Array
                Object.keys(resultsSet).forEach(key => {
                    if (resultsSet[key] instanceof Set) {
                        filteredResults[key] = Array.from(resultsSet[key]);
                        //console.log(`🔍 [FILTER LOG] API筛选器处理 ${key}: ${filteredResults[key].length} 个项目`);
                    } else if (Array.isArray(resultsSet[key])) {
                        filteredResults[key] = resultsSet[key];
                        //console.log(`🔍 [FILTER LOG] API筛选器处理 ${key}: ${filteredResults[key].length} 个项目`);
                    }
                });
            } else {
                // 如果没有API筛选器，直接复制路径类型数据
                //console.log('⚠️ [FILTER LOG] API筛选器不可用，直接复制路径数据');
                const pathCategories = ['absoluteApis', 'relativeApis', 'jsFiles', 'cssFiles', 'images', 'urls', 'paths'];
                pathCategories.forEach(category => {
                    if (rawResults[category] && Array.isArray(rawResults[category])) {
                        filteredResults[category] = [...rawResults[category]];
                    }
                });
            }
            
            // 使用域名和手机号筛选器处理敏感信息
            if (window.domainPhoneFilter) {
                //console.log('🔍 [FILTER LOG] 使用域名手机号筛选器处理敏感信息...');
                
                // 筛选域名
                if (rawResults.domains && Array.isArray(rawResults.domains)) {
                    //console.log(`🔍 [FILTER LOG] 筛选域名: ${rawResults.domains.length} -> `, rawResults.domains.slice(0, 5));
                    filteredResults.domains = window.domainPhoneFilter.filterDomains(rawResults.domains);
                    //console.log(`🔍 [FILTER LOG] 域名筛选结果: ${filteredResults.domains.length} 个有效域名`);
                }
                
                // 筛选子域名
                if (rawResults.subdomains && Array.isArray(rawResults.subdomains)) {
                    //console.log(`🔍 [FILTER LOG] 筛选子域名: ${rawResults.subdomains.length} 个`);
                    filteredResults.subdomains = window.domainPhoneFilter.filterDomains(rawResults.subdomains);
                    //console.log(`🔍 [FILTER LOG] 子域名筛选结果: ${filteredResults.subdomains.length} 个有效子域名`);
                }
                
                // 筛选邮箱
                if (rawResults.emails && Array.isArray(rawResults.emails)) {
                    //console.log(`🔍 [FILTER LOG] 筛选邮箱: ${rawResults.emails.length} 个`);
                    filteredResults.emails = window.domainPhoneFilter.filterEmails(rawResults.emails);
                    //console.log(`🔍 [FILTER LOG] 邮箱筛选结果: ${filteredResults.emails.length} 个有效邮箱`);
                }
                
                // 筛选手机号
                if (rawResults.phoneNumbers && Array.isArray(rawResults.phoneNumbers)) {
                    //console.log(`🔍 [FILTER LOG] 筛选手机号: ${rawResults.phoneNumbers.length} 个`);
                    filteredResults.phoneNumbers = window.domainPhoneFilter.filterPhones(rawResults.phoneNumbers, true);
                    //console.log(`🔍 [FILTER LOG] 手机号筛选结果: ${filteredResults.phoneNumbers.length} 个有效手机号`);
                }
            } else {
                // 如果没有域名手机号筛选器，直接复制敏感信息
                //console.log('⚠️ [FILTER LOG] 域名手机号筛选器不可用，直接复制敏感信息');
                const sensitiveCategories = ['domains', 'subdomains', 'emails', 'phoneNumbers'];
                sensitiveCategories.forEach(category => {
                    if (rawResults[category] && Array.isArray(rawResults[category])) {
                        filteredResults[category] = [...rawResults[category]];
                    }
                });
            }
            
            // 保留其他未处理的类别（直接复制）
            const otherCategories = [
                'ipAddresses', 'sensitiveKeywords', 'comments', 'parameters', 
                'credentials', 'cookies', 'idKeys', 'companies', 'jwts', 'githubUrls',
                'modulePaths', 'vueFiles', 'audios', 'videos', 'idcards', 'ports'
            ];
            
            otherCategories.forEach(category => {
                if (rawResults[category] && Array.isArray(rawResults[category])) {
                    filteredResults[category] = [...rawResults[category]];
                }
            });
            
            //console.log('✅ [FILTER LOG] 筛选完成，最终结果统计:', this.getResultsStats(filteredResults));
            
            // 标记结果已筛选
            filteredResults._filtered = true;
            
            return filteredResults;
            
        } catch (error) {
            console.error('❌ [FILTER LOG] 应用筛选器失败:', error);
            console.error('❌ [FILTER LOG] 错误堆栈:', error.stack);
            return rawResults; // 出错时返回原始结果
        }
    }
    
    // 加载筛选器（如果需要）
    async loadFiltersIfNeeded() {
        try {
            // 检查是否已经加载过滤器
            if (window.domainPhoneFilter && window.apiFilter) {
                return;
            }
            
            //console.log('🔄 开始加载扫描筛选器...');
            
            // 加载域名和手机号筛选器
            if (!window.domainPhoneFilter) {
                await this.loadFilterScript('filters/domain-phone-filter.js');
                
                if (typeof DomainPhoneFilter !== 'undefined') {
                    window.domainPhoneFilter = new DomainPhoneFilter();
                    //console.log('✅ 域名手机号筛选器初始化成功');
                }
            }
            
            // 加载API筛选器
            if (!window.apiFilter) {
                await this.loadFilterScript('filters/api-filter.js');
                
                if (typeof APIFilter !== 'undefined') {
                    window.apiFilter = new APIFilter();
                    //console.log('✅ API筛选器初始化成功');
                }
            }
            
        } catch (error) {
            console.error('❌ 筛选器加载失败:', error);
        }
    }
    
    // 加载筛选器脚本
    async loadFilterScript(scriptPath) {
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL(scriptPath);
                
                script.onload = () => {
                    //console.log(`📦 筛选器脚本加载成功: ${scriptPath}`);
                    resolve();
                };
                
                script.onerror = (error) => {
                    console.error(`❌ 筛选器脚本加载失败: ${scriptPath}`, error);
                    reject(error);
                };
                
                document.head.appendChild(script);
                
                // 设置超时保护
                setTimeout(() => {
                    resolve();
                }, 3000);
            } catch (error) {
                console.warn(`⚠️ 加载筛选器脚本失败: ${scriptPath}`, error);
                resolve();
            }
        });
    }
    
    // 获取结果统计信息
    getResultsStats(results) {
        const stats = {};
        let total = 0;
        
        Object.keys(results || {}).forEach(key => {
            const count = Array.isArray(results[key]) ? results[key].length : 0;
            stats[key] = count;
            total += count;
        });
        
        stats.total = total;
        return stats;
    }
    
    async autoScanIfNeeded() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 检查是否是有效的网页URL
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                //console.log('跳过系统页面的自动扫描');
                return;
            }
            
            // 更新当前扫描域名显示
            this.updateCurrentDomain(tab.url);
            
            const urlObj = new URL(tab.url);
            const fullUrl = `https://${urlObj.hostname}`;
            
            // 从IndexedDB检查上次扫描时间
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            const scanData = await window.indexedDBManager.loadScanResults(fullUrl);
            
            // 如果没有扫描过当前页面，或者超过5分钟，则自动扫描
            const now = Date.now();
            const lastScanTime = scanData ? scanData.timestamp : 0;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (now - lastScanTime > fiveMinutes) {
                setTimeout(() => {
                    this.startScan(true); // 静默扫描
                }, 2000);
            }
        } catch (error) {
            console.error('自动扫描检查失败:', error);
        }
    }
    
    updateCurrentDomain(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const protocol = urlObj.protocol;
            const port = urlObj.port ? `:${urlObj.port}` : '';
            
            const domainDisplay = document.getElementById('currentDomain');
            if (domainDisplay) {
                domainDisplay.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; opacity: 0.8;">正在扫描:</span>
                        <span style="color: #00d4aa; font-weight: 600;">${protocol}//${domain}${port}</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('更新域名显示失败:', error);
        }
    }
    
    async clearResults() {
        // 确认清空操作
        if (!confirm('确定要清空当前页面的扫描数据吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            // 获取当前页面URL
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                this.showNotification('无法获取当前页面URL', 'error');
                return;
            }
            
            const urlObj = new URL(tab.url);
            const fullUrl = `https://${urlObj.hostname}`;
            
            // 清空内存中的数据
            this.results = {};
            this.deepScanResults = {};
            this.scannedUrls = new Set();
            this.pendingUrls = new Set();
            this.deepScanRunning = false;
            this.currentDepth = 0;
            
            // 清空界面显示
            document.getElementById('results').innerHTML = '';
            document.getElementById('stats').textContent = '';
            
            // 从IndexedDB清空当前页面相关的数据
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            await window.indexedDBManager.deleteScanResults(fullUrl);
            await window.indexedDBManager.deleteDeepScanResults(fullUrl);
            await window.indexedDBManager.deleteDeepScanState(fullUrl);
            
            // 重置深度扫描UI状态
            this.resetDeepScanUI();
            
            // 重置分类选择器
            this.updateCategorySelect();
            
            // 显示清空成功提示
            this.showNotification(`页面 ${urlObj.hostname} 的扫描数据已清空`, 'success');
            
            //console.log(`✅ 页面 ${urlObj.hostname} 的扫描数据已清空`);
            
        } catch (error) {
            console.error('❌ 清空数据失败:', error);
            this.showNotification('清空数据失败: ' + error.message, 'error');
        }
    }
    
    // 重置深度扫描UI状态
    resetDeepScanUI() {
        const deepScanBtn = document.getElementById('deepScanBtn');
        const deepScanBtnText = deepScanBtn?.querySelector('.text');
        const configDiv = document.getElementById('deepScanConfig');
        const progressDiv = document.getElementById('deepScanProgress');
        
        if (deepScanBtnText) {
            deepScanBtnText.textContent = '🚀 开始深度扫描';
        }
        if (deepScanBtn) {
            deepScanBtn.style.background = 'rgba(0, 212, 170, 0.3)';
            deepScanBtn.style.color = '#00d4aa';
        }
        if (configDiv) {
            configDiv.style.display = 'none';
        }
        if (progressDiv) {
            progressDiv.style.display = 'none';
            progressDiv.innerHTML = '';
        }
        
        // 重置深度扫描相关的输入框
        const maxDepthInput = document.getElementById('maxDepth');
        const concurrencyInput = document.getElementById('concurrency');
        if (maxDepthInput) maxDepthInput.value = '2';
        if (concurrencyInput) concurrencyInput.value = '3';
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // 设置样式
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '6px';
        notification.style.zIndex = '10000';
        notification.style.fontSize = '12px';
        notification.style.fontWeight = '500';
        notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        notification.style.animation = 'slideIn 0.3s ease';
        
        // 根据类型设置颜色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#00d4aa';
                notification.style.color = '#fff';
                break;
            case 'error':
                notification.style.backgroundColor = '#e74c3c';
                notification.style.color = '#fff';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f39c12';
                notification.style.color = '#fff';
                break;
            default:
                notification.style.backgroundColor = '#3498db';
                notification.style.color = '#fff';
        }
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    async saveResults() {
        try {
            // 获取当前页面URL作为存储键
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                console.warn('⚠️ 无法获取当前页面URL，跳过保存');
                return;
            }
            
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            
            //console.log('💾 [SAVE LOG] 开始保存结果...');
            //console.log('💾 [SAVE LOG] 当前 this.results 统计:', this.getResultsStats(this.results));
            //console.log('💾 [SAVE LOG] 当前 this.deepScanResults 统计:', this.getResultsStats(this.deepScanResults));
            
            // 确定要保存的最终结果
            let finalResults = {};
            
            // 如果有普通扫描结果，直接使用（已经筛选过）
            if (this.results && Object.keys(this.results).length > 0) {
                //console.log('💾 [SAVE LOG] 使用普通扫描结果作为基础');
                finalResults = { ...this.results };
            }
            
            // 如果有深度扫描结果，需要先筛选再合并
            if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
                //console.log('💾 [SAVE LOG] 处理深度扫描结果...');
                
                // 先对深度扫描结果应用筛选器
                const filteredDeepResults = await this.applyFiltersToScanResults(this.deepScanResults);
                //console.log('💾 [SAVE LOG] 深度扫描结果筛选后统计:', this.getResultsStats(filteredDeepResults));
                
                // 合并筛选后的结果
                finalResults = this.mergeResults(finalResults, filteredDeepResults);
                //console.log('💾 [SAVE LOG] 合并后最终结果统计:', this.getResultsStats(finalResults));
            }
            
            // 保存最终的筛选后结果到IndexedDB
            if (Object.keys(finalResults).length > 0) {
                const itemCount = Object.values(finalResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                //console.log(`💾 [SAVE LOG] 最终保存到 IndexedDB，共 ${itemCount} 条筛选后的记录`);
                
                // 验证保存的数据
                const domainCount = finalResults.domains ? finalResults.domains.length : 0;
                //console.log(`💾 [SAVE LOG] 验证：保存的域名数量 = ${domainCount}`);
                
                // 使用IndexedDB保存普通扫描结果
                if (!window.indexedDBManager) {
                    window.indexedDBManager = new IndexedDBManager();
                }
                // 构造完整的URL用于保存
                const fullUrl = `https://${hostname}`;
                
                // 获取页面标题用于URL位置跟踪
                const pageTitle = document.title || tab.title || 'Unknown Page';
                
                // 保存结果时包含URL位置信息
                await window.indexedDBManager.saveScanResults(fullUrl, finalResults, tab.url, pageTitle);
                //console.log(`✅ [SAVE LOG] IndexedDB 保存完成: ${hostname}，包含URL位置信息`);
            } else {
                //console.log('💾 [SAVE LOG] 没有有效结果需要保存');
            }
            
            // 使用IndexedDB保存深度扫描状态
            const deepState = {
                running: this.deepScanRunning,
                scannedUrls: Array.from(this.scannedUrls || []),
                currentDepth: this.currentDepth,
                maxDepth: this.maxDepth,
                concurrency: this.concurrency
            };
            
            await window.indexedDBManager.saveDeepScanState(fullUrl, deepState);
            //console.log(`✅ [SAVE LOG] 深度扫描状态保存到IndexedDB完成: ${hostname}`);
            
            // 如果有深度扫描结果，也保存到IndexedDB
            if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
                await window.indexedDBManager.saveDeepScanResults(fullUrl, this.deepScanResults);
                //console.log(`✅ [SAVE LOG] 深度扫描结果保存到IndexedDB完成: ${hostname}`);
            }
            
        } catch (error) {
            console.error('❌ [SAVE LOG] 数据保存失败:', error);
        }
    }
    
    // 合并筛选后的扫描结果（确保合并的数据也是筛选过的）
    async mergeFilteredResults(existingResults, newResults) {
        //console.log('🔍 [MERGE LOG] 开始合并筛选后的结果...');
        //console.log('🔍 [MERGE LOG] 现有结果统计:', this.getResultsStats(existingResults));
        //console.log('🔍 [MERGE LOG] 新结果统计:', this.getResultsStats(newResults));
        
        // 如果新结果还没有经过筛选，先筛选
        let filteredNewResults = newResults;
        if (newResults && !newResults._filtered) {
            //console.log('⚠️ [MERGE LOG] 新结果未筛选，正在应用筛选器...');
            filteredNewResults = await this.applyFiltersToScanResults(newResults);
            filteredNewResults._filtered = true; // 标记已筛选
            //console.log('✅ [MERGE LOG] 新结果筛选完成:', this.getResultsStats(filteredNewResults));
        } else {
            //console.log('✅ [MERGE LOG] 新结果已筛选，直接合并');
        }
        
        const mergedResults = {};
        const categories = [
            'absoluteApis', 'relativeApis', 'modulePaths', 'domains', 'urls', 
            'images', 'jsFiles', 'cssFiles', 'emails', 'phoneNumbers', 
            'ipAddresses', 'sensitiveKeywords', 'comments', 'paths', 
            'parameters', 'credentials', 'cookies', 'idKeys', 'companies', 
            'jwts', 'githubUrls', 'vueFiles', 'subdomains', 'audios', 'videos', 
            'idcards', 'ports'
        ];
        
        categories.forEach(category => {
            const existingItems = existingResults[category] || [];
            const newItems = filteredNewResults[category] || [];
            
            // 使用Set去重，然后合并
            const combinedSet = new Set([...existingItems, ...newItems]);
            mergedResults[category] = Array.from(combinedSet);
            
            if (existingItems.length > 0 || newItems.length > 0) {
                //console.log(`🔍 [MERGE LOG] ${category}: ${existingItems.length} + ${newItems.length} = ${mergedResults[category].length}`);
            }
        });
        
        // 标记合并后的结果已筛选
        mergedResults._filtered = true;
        
        //console.log('✅ [MERGE LOG] 筛选后结果合并完成，最终统计:', this.getResultsStats(mergedResults));
        return mergedResults;
    }
    
    // 合并扫描结果的辅助方法
    mergeResults(existingResults, newResults) {
        //console.log('🔍 [MERGE-SIMPLE LOG] 开始简单合并结果...');
        //console.log('🔍 [MERGE-SIMPLE LOG] 现有结果统计:', this.getResultsStats(existingResults));
        //console.log('🔍 [MERGE-SIMPLE LOG] 新结果统计:', this.getResultsStats(newResults));
        
        const mergedResults = {};
        const categories = [
            'customApis', 'absoluteApis', 'relativeApis', 'modulePaths', 'domains', 'urls', 
            'images', 'jsFiles', 'cssFiles', 'emails', 'phoneNumbers', 
            'ipAddresses', 'sensitiveKeywords', 'comments', 'paths', 
            'parameters', 'credentials', 'cookies', 'idKeys', 'companies', 
            'jwts', 'githubUrls', 'vueFiles'
        ];
        
        categories.forEach(category => {
            const existingItems = existingResults[category] || [];
            const newItems = newResults[category] || [];
            
            // 使用Set去重，然后合并
            const combinedSet = new Set([...existingItems, ...newItems]);
            mergedResults[category] = Array.from(combinedSet);
            
            if (existingItems.length > 0 || newItems.length > 0) {
                //console.log(`🔍 [MERGE-SIMPLE LOG] ${category}: ${existingItems.length} + ${newItems.length} = ${mergedResults[category].length}`);
            }
        });
        
        //console.log('✅ [MERGE-SIMPLE LOG] 简单合并完成，最终统计:', this.getResultsStats(mergedResults));
        console.warn('⚠️ [MERGE-SIMPLE LOG] 注意：此方法未应用筛选器，可能包含未筛选数据');
        
        return mergedResults;
    }
    
    async loadResults() {
        try {
            // 获取当前页面URL作为存储键
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                console.warn('⚠️ 无法获取当前页面URL，跳过加载');
                return;
            }
            
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            
            console.log(`🔄 [LOAD LOG] 正在加载页面数据: ${hostname}`);
            
            // 从IndexedDB加载普通扫描结果
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            // 构造完整的URL用于加载
            const fullUrl = `https://${hostname}`;
            const loadedDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            // 修复：正确处理新的数据结构，数据存储在 results 属性中
            let loadedData = null;
            if (loadedDataWrapper && loadedDataWrapper.results) {
                // 检查是否是新的嵌套结构
                if (loadedDataWrapper.results.results) {
                    // 新格式：数据在 results.results 中
                    loadedData = loadedDataWrapper.results.results;
                } else {
                    // 旧格式：数据直接在 results 中
                    loadedData = loadedDataWrapper.results;
                }
            }
            
            if (loadedData && typeof loadedData === 'object') {
                const itemCount = Object.values(loadedData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                const domainCount = loadedData.domains ? loadedData.domains.length : 0;
                
                //console.log(`🔄 [LOAD LOG] 从IndexedDB加载数据统计:`, this.getResultsStats(loadedData));
                //console.log(`🔄 [LOAD LOG] 存储中域名数量: ${domainCount}`);
                
                // 检查数据是否已经筛选过
                if (loadedData._filtered) {
                    //console.log(`✅ [LOAD LOG] 数据已筛选，直接使用`);
                    this.results = loadedData;
                    this.deepScanResults = loadedData;
                } else {
                    //console.log(`⚠️ [LOAD LOG] 数据未筛选，重新应用筛选器...`);
                    // 对加载的数据重新应用筛选器
                    this.results = await this.applyFiltersToScanResults(loadedData);
                    this.deepScanResults = this.results;
                    
                    // 重新保存筛选后的数据
                    await this.saveResults();
                    //console.log(`✅ [LOAD LOG] 已重新筛选并保存数据`);
                }
                
                //console.log(`✅ [LOAD LOG] 最终加载数据统计:`, this.getResultsStats(this.results));
                this.displayResults();
            } else {
                //console.log(`⚠️ [LOAD LOG] 页面 ${hostname} 未找到有效的扫描数据`);
            }
            
            // 从IndexedDB恢复深度扫描状态
            const deepState = await window.indexedDBManager.loadDeepScanState(fullUrl);
            
            if (deepState) {
                this.deepScanRunning = deepState.running || false;
                this.scannedUrls = new Set(deepState.scannedUrls || []);
                this.currentDepth = deepState.currentDepth || 0;
                this.maxDepth = deepState.maxDepth || 2;
                this.concurrency = deepState.concurrency || 3;
                
                console.log('🔄 [LOAD LOG] 从IndexedDB恢复深度扫描状态:', {
                    running: this.deepScanRunning,
                    scannedCount: this.scannedUrls.size,
                    depth: this.currentDepth
                });
            }
            
            // 尝试从IndexedDB加载深度扫描结果
            const deepScanDataWrapper = await window.indexedDBManager.loadDeepScanResults(fullUrl);
            if (deepScanDataWrapper && deepScanDataWrapper.results) {
                const deepScanData = deepScanDataWrapper.results;
                const deepItemCount = Object.values(deepScanData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                
                // 如果深度扫描结果比普通扫描结果更完整，使用深度扫描结果
                if (deepItemCount > 0) {
                    const currentItemCount = loadedData ? Object.values(loadedData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
                    if (deepItemCount > currentItemCount) {
                        this.results = deepScanData;
                        this.deepScanResults = deepScanData;
                        console.log(`🔄 [LOAD LOG] 使用IndexedDB深度扫描结果，共 ${deepItemCount} 条记录`);
                        this.displayResults();
                    }
                }
            }
        } catch (error) {
            console.error('❌ [LOAD LOG] 加载结果失败:', error);
        }
    }
    
    // 生成页面存储键 - 统一使用域名作为键
    getPageStorageKey(url) {
        try {
            const urlObj = new URL(url);
            // 只使用域名作为键，不包含路径，确保同一域名下的所有页面共享存储
            const key = urlObj.hostname;
            // 替换特殊字符，确保键的有效性
            return key.replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch (error) {
            console.error('生成存储键失败:', error);
            // 如果URL解析失败，使用简化的键
            return url.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        }
    }
    
    // 显示结果 - 使用DisplayManager
    async displayResults() {
        if (this.displayManager) {
            await this.displayManager.displayResults();
        } else {
            console.error('DisplayManager未初始化');
        }
    }
    
    // 批量请求测试 - 使用ApiTester
    async batchRequestTest() {
        if (this.apiTester) {
            await this.apiTester.batchRequestTest();
        } else {
            console.error('ApiTester未初始化');
            alert('API测试器未初始化，无法执行测试');
        }
    }
    
        // 添加自定义API路径
    addCustomApiPaths() {
        const customApiPathsInput = document.getElementById('customApiPaths');
        if (!customApiPathsInput) {
            console.error('找不到自定义API路径输入框');
            return;
        }
        
        const customApiPaths = customApiPathsInput.value.trim();
        if (!customApiPaths) {
            alert('请输入自定义API路径，每行一个路径');
            return;
        }
        
        // 解析自定义API路径
        const paths = this.apiTester.parseCustomApiPaths(customApiPaths);
        if (paths.length === 0) {
            alert('请输入有效的API路径');
            return;
        }
        
        // 将自定义API路径添加到扫描结果中
        if (!this.results.customApis) {
            this.results.customApis = [];
        }
        
        // 使用Set进行去重
        const existingSet = new Set(this.results.customApis);
        let addedCount = 0;
        
        paths.forEach(path => {
            if (!existingSet.has(path)) {
                this.results.customApis.push(path);
                existingSet.add(path);
                addedCount++;
            }
        });
        
        // 保存结果到存储
        this.saveResults();
        
        // 重新显示结果
        this.displayResults();
        
        // 显示添加成功的提示
        const message = `成功添加 ${addedCount} 个自定义API路径到扫描结果中:\n${paths.join('\n')}`;
        alert(message);
        
        // 清空输入框
        customApiPathsInput.value = '';
        
        //console.log(`✅ 添加了 ${addedCount} 个自定义API路径到扫描结果:`, paths);
    }
    
    // 切换深度扫描 - 使用DeepScanner
    toggleDeepScan() {
        if (this.deepScanner) {
            this.deepScanner.toggleDeepScan();
        } else {
            console.error('DeepScanner未初始化');
            alert('深度扫描器未初始化，无法执行扫描');
        }
    }
}
