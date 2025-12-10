class ILoveYouTranslucent7 {
    constructor() {
        this.results = {};
        this.deepScanRunning = false;
        this.scannedUrls = new Set();
        this.pendingUrls = new Set();
        this.deepScanResults = {};
        this.currentDepth = 0;
        this.maxDepth = 2;
        this.concurrency = 3;
        
        // 初始化功能模块 - 先初始化SettingsManager
        this.settingsManager = new SettingsManager();
        window.SettingsManager = this.settingsManager; // 确保全局可访问
        
        this.basicScanner = new BasicScanner(this);
        this.deepScanner = new DeepScanner(this);
        this.displayManager = new DisplayManager(this);
        this.apiTester = new ApiTester(this);
        this.exportManager = new ExportManager(this);
        this.contentExtractor = new ContentExtractor();
        this.patternExtractor = new PatternExtractor();
        this.jsInjector = new JSInjector();
        
        this.init();
    }
    
    init() {
        // 初始化导航切换
        this.initNavigation();
        
        // 初始化按钮事件
        this.initEventListeners();
        
        // 初始化数据同步机制
        this.initDataSync();
        
        // 初始化消息监听器
        this.initMessageListeners();
        
        // 加载已保存的结果并自动扫描
        this.loadResults();
        this.autoScanIfNeeded();
    }
    
    // 初始化消息监听器
    initMessageListeners() {
        // 监听来自深度扫描窗口的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateScanResults' || 
                message.action === 'scanProgress' || 
                message.action === 'scanComplete' || 
                message.action === 'scanError') {
                
                // 处理深度扫描窗口的消息
                if (this.deepScanner) {
                    return this.deepScanner.handleScanWindowMessage(message, sender, sendResponse);
                }
            }
        });
    }
    
    // 初始化数据同步机制
    initDataSync() {
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
            if (!tab || !tab.url) {
                return;
            }
            
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const fullUrl = `https://${hostname}`;
            
            // 从IndexedDB检查数据完整性
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            // 检查普通扫描结果
            const scanDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const scanData = scanDataWrapper ? scanDataWrapper.results : null;
            
            // 检查深度扫描结果
            const deepScanDataWrapper = await window.indexedDBManager.loadDeepScanResults(fullUrl);
            const deepScanData = deepScanDataWrapper ? deepScanDataWrapper.results : null;
            
            // 如果IndexedDB中有当前页面的数据但内存中没有，重新加载
            if ((scanData || deepScanData) && Object.keys(this.results || {}).length === 0) {
                //console.log(`🔧 检测到页面 ${hostname} IndexedDB数据丢失，正在恢复...`);
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
        
        // 收放按钮事件
        const toggleButtonsBtn = document.getElementById('toggleButtonsBtn');
        if (toggleButtonsBtn) {
            toggleButtonsBtn.addEventListener('click', () => this.toggleScanButtons());
        }
        
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
            case 'settings':
                // 切换到设置页面时，加载设置
                if (this.settingsManager) {
                    this.settingsManager.loadSettings();
                }
                // 初始化自定义正则弹窗事件
                this.initCustomRegexModal();
                // 加载并显示自定义正则配置列表
                this.loadCustomRegexList();
                break;
            case 'js-injection':
                // 切换到JS注入页面时，初始化JS注入功能
                this.initJSInjectPage();
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
        
        // 清空现有选项（保留默认选项）
        const defaultOption = categorySelect.querySelector('option[value=""]');
        categorySelect.innerHTML = '';
        if (defaultOption) {
            categorySelect.appendChild(defaultOption);
        }
        
        // 添加有数据的分类
        const categories = [
            { key: 'customApis', title: '自定义API路径' },
            { key: 'absoluteApis', title: '绝对路径API' },
            { key: 'relativeApis', title: '相对路径API' },
            { key: 'vueRoutes', title: 'Vue路由' },
            { key: 'jsFiles', title: 'JS文件' },
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
    
    // 委托方法 - 将功能委托给相应的模块
    async startScan(silent = false) {
        // 重新加载正则表达式配置
        if (this.patternExtractor) {
            await this.patternExtractor.loadCustomPatterns();
            //console.log('🔄 已重新加载正则表达式配置');
        }
        return await this.basicScanner.startScan(silent);
    }
    
    toggleDeepScan() {
        return this.deepScanner.toggleDeepScan();
    }
    
    displayResults() {
        return this.displayManager.displayResults();
    }
    
    async batchRequestTest() {
        return await this.apiTester.batchRequestTest();
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
    
    exportResults() {
        return this.exportManager.exportResults();
    }
    
    // 收放按钮功能
    // 收放按钮功能
    toggleScanButtons() {
        const scanButtonsContainer = document.getElementById('scanButtonsContainer');
        const toggleButton = document.getElementById('toggleButtonsBtn');
        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        const toggleText = toggleButton.querySelector('.toggle-text');
        const resultsContainer = document.getElementById('results');
        
        if (scanButtonsContainer && toggleButton) {
            const isCollapsed = scanButtonsContainer.classList.contains('collapsed');
            
            if (isCollapsed) {
                // 展开按钮
                scanButtonsContainer.classList.remove('collapsed');
                toggleIcon.textContent = '▲';
                toggleText.textContent = '收起按钮';
                toggleButton.classList.remove('collapsed');
                
                // 恢复结果容器的原始高度
                if (resultsContainer) {
                    resultsContainer.classList.remove('expanded');
                }
            } else {
                // 收起按钮
                scanButtonsContainer.classList.add('collapsed');
                toggleIcon.textContent = '▼';
                toggleText.textContent = '展开按钮';
                toggleButton.classList.add('collapsed');
                
                // 扩展结果容器高度，占用原来按钮的空间
                if (resultsContainer) {
                    resultsContainer.classList.add('expanded');
                }
            }
        }
    }

    // 初始化自定义正则弹窗
    initCustomRegexModal() {
        const addCustomRegexBtn = document.getElementById('addCustomRegexBtn');
        const customRegexModal = document.getElementById('customRegexModal');
        const closeCustomRegexModal = document.getElementById('closeCustomRegexModal');
        const confirmCustomRegexBtn = document.getElementById('confirmCustomRegexBtn');
        const cancelCustomRegexBtn = document.getElementById('cancelCustomRegexBtn');

        // 打开弹窗
        if (addCustomRegexBtn) {
            addCustomRegexBtn.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'block';
                    // 清空输入框
                    document.getElementById('customRegexName').value = '';
                    document.getElementById('customRegexKey').value = '';
                    document.getElementById('customRegexPattern').value = '';
                }
            });
        }

        // 关闭弹窗
        if (closeCustomRegexModal) {
            closeCustomRegexModal.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }

        // 取消按钮
        if (cancelCustomRegexBtn) {
            cancelCustomRegexBtn.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }

        // 确认添加按钮
        if (confirmCustomRegexBtn) {
            confirmCustomRegexBtn.addEventListener('click', () => {
                this.handleCustomRegexSubmit();
            });
        }

        // 点击弹窗外部关闭
        if (customRegexModal) {
            customRegexModal.addEventListener('click', (e) => {
                if (e.target === customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }
    }

    // 处理自定义正则提交
    // 处理自定义正则提交
    async handleCustomRegexSubmit() {
        const nameInput = document.getElementById('customRegexName');
        const keyInput = document.getElementById('customRegexKey');
        const patternInput = document.getElementById('customRegexPattern');
        const modal = document.getElementById('customRegexModal');

        if (!nameInput || !keyInput || !patternInput) {
            this.showNotification('输入框元素未找到', 'error');
            return;
        }

        const name = nameInput.value.trim();
        const key = keyInput.value.trim();
        const pattern = patternInput.value.trim();

        // 验证输入
        if (!name) {
            this.showNotification('请输入显示名称', 'warning');
            nameInput.focus();
            return;
        }

        if (!key) {
            this.showNotification('请输入存储键名', 'warning');
            keyInput.focus();
            return;
        }

        if (!pattern) {
            this.showNotification('请输入正则表达式', 'warning');
            patternInput.focus();
            return;
        }

        // 验证键名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
            this.showNotification('存储键名只能包含字母、数字和下划线，且必须以字母开头', 'warning');
            keyInput.focus();
            return;
        }

        // 验证正则表达式
        try {
            new RegExp(pattern);
        } catch (error) {
            this.showNotification('正则表达式格式错误: ' + error.message, 'error');
            patternInput.focus();
            return;
        }

        // 检查名称和键名是否重复
        try {
            // 从SettingsManager获取自定义正则配置
            const customConfigs = await this.settingsManager.getCustomRegexConfigs();

            // 检查键名是否重复
            if (customConfigs[key]) {
                this.showNotification(`存储键名 "${key}" 已存在，请使用其他键名`, 'warning');
                keyInput.focus();
                return; // 不关闭弹窗
            }

            // 检查名称是否重复
            const existingNames = Object.values(customConfigs).map(config => config.name);
            if (existingNames.includes(name)) {
                this.showNotification(`显示名称 "${name}" 已存在，请使用其他名称`, 'warning');
                nameInput.focus();
                return; // 不关闭弹窗
            }

            // 如果没有重复，保存配置
            await this.saveCustomRegexConfig(name, key, pattern);
            
            // 关闭弹窗
            if (modal) {
                modal.style.display = 'none';
            }
            this.showNotification(`自定义正则 "${name}" 添加成功`, 'success');

        } catch (error) {
            console.error('检查重复或保存配置失败:', error);
            this.showNotification('操作失败: ' + error.message, 'error');
        }
    }

    // 保存自定义正则配置
    async saveCustomRegexConfig(name, key, pattern) {
        try {
            // 通过SettingsManager保存自定义正则配置
            await this.settingsManager.saveCustomRegexConfig(key, {
                name: name,
                pattern: pattern,
                createdAt: Date.now()
            });

            //console.log('✅ 自定义正则配置已保存:', { name, key, pattern });

            // 通知PatternExtractor重新加载配置
            if (this.patternExtractor) {
                await this.patternExtractor.loadCustomPatterns();
            }

            // 刷新自定义正则配置列表显示
            this.loadCustomRegexList();

        } catch (error) {
            console.error('❌ 保存自定义正则配置失败:', error);
            throw error;
        }
    }

    // 加载并显示自定义正则配置列表
    async loadCustomRegexList() {
        try {
            const customConfigs = await this.settingsManager.getCustomRegexConfigs();
            
            // 查找或创建自定义正则配置列表容器
            let listContainer = document.getElementById('customRegexList');
            if (!listContainer) {
                // 如果容器不存在，创建它并插入到"添加自定义正则"按钮后面
                const addRegexBtn = document.getElementById('addCustomRegexBtn');
                if (addRegexBtn) {
                    listContainer = document.createElement('div');
                    listContainer.id = 'customRegexList';
                    listContainer.className = 'api-test-section';
                    listContainer.innerHTML = `
                        <div class="config-title">已添加的自定义正则配置</div>
                        <div id="customRegexItems"></div>
                    `;
                    addRegexBtn.parentNode.insertBefore(listContainer, addRegexBtn);
                }
            }
            
            const itemsContainer = document.getElementById('customRegexItems');
            if (!itemsContainer) return;
            
            // 清空现有内容
            itemsContainer.innerHTML = '';
            
            // 如果没有自定义配置，显示提示信息
            if (Object.keys(customConfigs).length === 0) {
                itemsContainer.innerHTML = `
                    <div style="text-align: center; color: #888; padding: 20px; font-size: 12px;">
                        暂无自定义正则配置<br>
                        点击上方"添加自定义正则"按钮来添加配置
                    </div>
                `;
                return;
            }
            
            // 显示每个自定义配置
            Object.entries(customConfigs).forEach(([key, config]) => {
                const configItem = document.createElement('div');
                configItem.className = 'custom-regex-item';
                configItem.style.cssText = `
                    background: rgba(40, 40, 40, 0.5);
                    border: 1px solid rgba(90, 90, 90, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    transition: all 0.3s;
                `;
                
                const createdDate = config.createdAt ? new Date(config.createdAt).toLocaleString() : '未知';
                
                configItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #00d4aa; font-size: 14px; margin-bottom: 4px;">
                                <input type="text" class="edit-name-input" value="${config.name}" style="
                                    background: transparent;
                                    border: none;
                                    color: #00d4aa;
                                    font-weight: 600;
                                    font-size: 14px;
                                    width: 100%;
                                    outline: none;
                                    border-bottom: 1px solid transparent;
                                    transition: all 0.2s;
                                " readonly>
                            </div>
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
                                键名: <span style="color: #ccc; font-family: monospace;">${key}</span>
                            </div>
                            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">
                                创建时间: ${createdDate}
                            </div>
                            <div style="position: relative;">
                                <textarea class="edit-pattern-textarea" style="
                                    font-size: 12px;
                                    color: #ccc;
                                    font-family: monospace;
                                    background: rgba(0,0,0,0.3);
                                    padding: 6px;
                                    border-radius: 4px;
                                    word-break: break-all;
                                    width: 100%;
                                    border: 1px solid transparent;
                                    resize: vertical;
                                    min-height: 40px;
                                    outline: none;
                                    transition: all 0.2s;
                                " readonly>${config.pattern}</textarea>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                            <button class="edit-custom-regex-btn" data-key="${key}" style="
                                background: rgba(0, 212, 170, 0.3);
                                border: 1px solid rgba(0, 212, 170, 0.5);
                                color: #00d4aa;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                            ">编辑</button>
                            <button class="save-custom-regex-btn" data-key="${key}" style="
                                background: rgba(52, 152, 219, 0.3);
                                border: 1px solid rgba(52, 152, 219, 0.5);
                                color: #3498db;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                                display: none;
                            ">保存</button>
                            <button class="cancel-edit-regex-btn" data-key="${key}" style="
                                background: rgba(149, 165, 166, 0.3);
                                border: 1px solid rgba(149, 165, 166, 0.5);
                                color: #95a5a6;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                                display: none;
                            ">取消</button>
                            <button class="delete-custom-regex-btn" data-key="${key}" style="
                                background: rgba(231, 76, 60, 0.3);
                                border: 1px solid rgba(231, 76, 60, 0.5);
                                color: #e74c3c;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                            ">删除</button>
                        </div>
                    </div>
                `;
                
                // 添加悬停效果
                configItem.addEventListener('mouseenter', () => {
                    configItem.style.transform = 'translateY(-2px)';
                    configItem.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.4)';
                    configItem.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                });
                
                configItem.addEventListener('mouseleave', () => {
                    configItem.style.transform = 'translateY(0)';
                    configItem.style.boxShadow = 'none';
                    configItem.style.borderColor = 'rgba(90, 90, 90, 0.3)';
                });
                
                // 获取各个按钮和输入框元素
                const editBtn = configItem.querySelector('.edit-custom-regex-btn');
                const saveBtn = configItem.querySelector('.save-custom-regex-btn');
                const cancelBtn = configItem.querySelector('.cancel-edit-regex-btn');
                const deleteBtn = configItem.querySelector('.delete-custom-regex-btn');
                const nameInput = configItem.querySelector('.edit-name-input');
                const patternTextarea = configItem.querySelector('.edit-pattern-textarea');
                
                // 存储原始值用于取消编辑
                let originalName = config.name;
                let originalPattern = config.pattern;
                
                // 编辑按钮事件
                editBtn.addEventListener('click', () => {
                    // 进入编辑模式
                    nameInput.removeAttribute('readonly');
                    patternTextarea.removeAttribute('readonly');
                    nameInput.style.borderBottom = '1px solid #00d4aa';
                    patternTextarea.style.border = '1px solid #00d4aa';
                    patternTextarea.style.background = 'rgba(0,0,0,0.5)';
                    
                    // 切换按钮显示状态
                    editBtn.style.display = 'none';
                    saveBtn.style.display = 'block';
                    cancelBtn.style.display = 'block';
                    
                    // 聚焦到名称输入框
                    nameInput.focus();
                });
                
                // 保存按钮事件
                saveBtn.addEventListener('click', async () => {
                    const newName = nameInput.value.trim();
                    const newPattern = patternTextarea.value.trim();
                    
                    // 验证输入
                    if (!newName) {
                        this.showNotification('请输入显示名称', 'warning');
                        nameInput.focus();
                        return;
                    }
                    
                    if (!newPattern) {
                        this.showNotification('请输入正则表达式', 'warning');
                        patternTextarea.focus();
                        return;
                    }
                    
                    // 验证正则表达式
                    try {
                        new RegExp(newPattern);
                    } catch (error) {
                        this.showNotification('正则表达式格式错误: ' + error.message, 'error');
                        patternTextarea.focus();
                        return;
                    }
                    
                    // 检查名称是否与其他配置重复（排除当前配置）
                    const customConfigs = await this.settingsManager.getCustomRegexConfigs();
                    const existingNames = Object.entries(customConfigs)
                        .filter(([k, v]) => k !== key)
                        .map(([k, v]) => v.name);
                    
                    if (existingNames.includes(newName)) {
                        this.showNotification(`显示名称 "${newName}" 已存在，请使用其他名称`, 'warning');
                        nameInput.focus();
                        return;
                    }
                    
                    try {
                        // 更新配置
                        await this.settingsManager.saveCustomRegexConfig(key, {
                            name: newName,
                            pattern: newPattern,
                            createdAt: customConfigs[key]?.createdAt || Date.now(),
                            updatedAt: Date.now()
                        });
                        
                        //console.log(`✅ 已更新自定义正则配置: ${newName} (${key})`);
                        this.showNotification(`自定义正则配置 "${newName}" 已更新`, 'success');
                        
                        // 通知PatternExtractor重新加载配置
                        if (this.patternExtractor) {
                            await this.patternExtractor.loadCustomPatterns();
                        }
                        
                        // 刷新配置列表显示
                        this.loadCustomRegexList();
                        
                    } catch (error) {
                        console.error('❌ 更新自定义正则配置失败:', error);
                        this.showNotification('更新配置失败: ' + error.message, 'error');
                    }
                });
                
                // 取消编辑按钮事件
                cancelBtn.addEventListener('click', () => {
                    // 恢复原始值
                    nameInput.value = originalName;
                    patternTextarea.value = originalPattern;
                    
                    // 退出编辑模式
                    nameInput.setAttribute('readonly', true);
                    patternTextarea.setAttribute('readonly', true);
                    nameInput.style.borderBottom = '1px solid transparent';
                    patternTextarea.style.border = '1px solid transparent';
                    patternTextarea.style.background = 'rgba(0,0,0,0.3)';
                    
                    // 切换按钮显示状态
                    editBtn.style.display = 'block';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                });
                
                // 删除按钮事件
                deleteBtn.addEventListener('click', () => this.deleteCustomRegexConfig(key, config.name));
                
                // 按钮悬停效果
                editBtn.addEventListener('mouseenter', () => {
                    editBtn.style.background = 'rgba(0, 212, 170, 0.5)';
                    editBtn.style.borderColor = 'rgba(0, 212, 170, 0.7)';
                });
                editBtn.addEventListener('mouseleave', () => {
                    editBtn.style.background = 'rgba(0, 212, 170, 0.3)';
                    editBtn.style.borderColor = 'rgba(0, 212, 170, 0.5)';
                });
                
                saveBtn.addEventListener('mouseenter', () => {
                    saveBtn.style.background = 'rgba(52, 152, 219, 0.5)';
                    saveBtn.style.borderColor = 'rgba(52, 152, 219, 0.7)';
                });
                saveBtn.addEventListener('mouseleave', () => {
                    saveBtn.style.background = 'rgba(52, 152, 219, 0.3)';
                    saveBtn.style.borderColor = 'rgba(52, 152, 219, 0.5)';
                });
                
                cancelBtn.addEventListener('mouseenter', () => {
                    cancelBtn.style.background = 'rgba(149, 165, 166, 0.5)';
                    cancelBtn.style.borderColor = 'rgba(149, 165, 166, 0.7)';
                });
                cancelBtn.addEventListener('mouseleave', () => {
                    cancelBtn.style.background = 'rgba(149, 165, 166, 0.3)';
                    cancelBtn.style.borderColor = 'rgba(149, 165, 166, 0.5)';
                });
                
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'rgba(231, 76, 60, 0.5)';
                    deleteBtn.style.borderColor = 'rgba(231, 76, 60, 0.7)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'rgba(231, 76, 60, 0.3)';
                    deleteBtn.style.borderColor = 'rgba(231, 76, 60, 0.5)';
                });
                
                itemsContainer.appendChild(configItem);
            });
            
        } catch (error) {
            console.error('❌ 加载自定义正则配置列表失败:', error);
        }
    }

    // 删除自定义正则配置
    async deleteCustomRegexConfig(key, name) {
        if (!confirm(`确定要删除自定义正则配置 "${name}" 吗？此操作不可恢复。`)) {
            return;
        }
        
        try {
            // 通过SettingsManager删除配置
            await this.settingsManager.deleteCustomRegexConfig(key);
            
            //console.log(`✅ 已删除自定义正则配置: ${name} (${key})`);
            this.showNotification(`自定义正则配置 "${name}" 已删除`, 'success');
            
            // 通知PatternExtractor重新加载配置
            if (this.patternExtractor) {
                await this.patternExtractor.loadCustomPatterns();
            }
            
            // 刷新配置列表显示
            this.loadCustomRegexList();
            
        } catch (error) {
            console.error('❌ 删除自定义正则配置失败:', error);
            this.showNotification('删除配置失败: ' + error.message, 'error');
        }
    }
    
    // 核心功能方法
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
            
            const scanDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const scanData = scanDataWrapper ? scanDataWrapper.results : null;
            
            // 如果没有扫描过当前页面，或者超过5分钟，则自动扫描
            const now = Date.now();
            const lastScanTime = scanDataWrapper ? scanDataWrapper.timestamp : 0;
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
            
            const pageKey = this.getPageStorageKey(tab.url);
            
            // 清空内存中的数据
            this.results = {};
            this.deepScanResults = {};
            this.scannedUrls = new Set();
            this.pendingUrls = new Set();
            this.currentDepth = 0;
            this.deepScanRunning = false;
            
            // 清空界面显示
            document.getElementById('results').innerHTML = '';
            document.getElementById('stats').textContent = '';
            
            // 从IndexedDB删除所有相关数据
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const fullUrl = `https://${hostname}`;
            
            // 删除普通扫描结果
            await window.indexedDBManager.deleteScanResults(fullUrl);
            
            // 删除深度扫描相关数据（包括结果和状态）
            await window.indexedDBManager.deleteDeepScanData(fullUrl);
            
            // 重置深度扫描UI状态
            this.resetDeepScanUI();
            
            // 显示清空成功提示
            this.showNotification(`页面 ${tab.url} 的扫描数据已清空`, 'success');
            
            //console.log(`✅ 页面 ${pageKey} 的扫描数据已清空`);
            
        } catch (error) {
            console.error('❌ 清空数据失败:', error);
            this.showNotification('清空数据失败: ' + error.message, 'error');
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
            // 构造完整的URL用于保存
            const fullUrl = `https://${hostname}`;
            
            // 初始化IndexedDBManager
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            // 使用IndexedDB保存普通扫描结果
            if (this.results && Object.keys(this.results).length > 0) {
                await window.indexedDBManager.saveScanResults(fullUrl, this.results);
                //console.log(`✅ 普通扫描结果保存到IndexedDB成功: ${hostname}`);
            }
            
            // 保存深度扫描结果
            if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
                await window.indexedDBManager.saveDeepScanResults(fullUrl, this.deepScanResults);
                //console.log('💾 深度扫描结果保存到IndexedDB，数据条目:', 
                    //Object.values(this.deepScanResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0));
            }
            
            // 保存深度扫描状态
            const deepState = {
                running: this.deepScanRunning,
                scannedUrls: Array.from(this.scannedUrls || []),
                currentDepth: this.currentDepth,
                maxDepth: this.maxDepth,
                concurrency: this.concurrency
            };
            
            await window.indexedDBManager.saveDeepScanState(fullUrl, deepState);
            //console.log(`✅ 深度扫描状态保存到IndexedDB成功: ${hostname}`);
            
        } catch (error) {
            console.error('❌ 数据保存失败:', error);
        }
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
            const pageKey = this.getPageStorageKey(tab.url);
            
            //console.log(`🔄 正在加载页面数据: ${hostname}`);
            
            // 从IndexedDB加载普通扫描结果
            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }
            
            // 构造完整的URL用于加载
            const fullUrl = `https://${hostname}`;
            const loadedDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const indexedDBResults = loadedDataWrapper ? loadedDataWrapper.results : null;
            
            // 从IndexedDB加载深度扫描结果和状态
            const deepScanDataWrapper = await window.indexedDBManager.loadDeepScanResults(fullUrl);
            const deepScanResults = deepScanDataWrapper ? deepScanDataWrapper.results : null;
            
            // 优先使用最完整的数据源
            let bestResults = null;
            let bestSource = '';
            
            // 比较各个数据源的完整性
            const sources = [
                { data: deepScanResults, name: 'deepScanResults' },
                { data: indexedDBResults, name: 'scanResults' }
            ];
            
            for (const source of sources) {
                if (source.data && typeof source.data === 'object') {
                    const itemCount = Object.values(source.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                    if (itemCount > 0 && (!bestResults || itemCount > Object.values(bestResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0))) {
                        bestResults = source.data;
                        bestSource = source.name;
                    }
                }
            }
            
            if (bestResults) {
                this.results = bestResults;
                this.deepScanResults = bestResults;
                //console.log(`✅ 从IndexedDB ${bestSource} 加载了页面数据，共 ${Object.values(bestResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)} 条记录`);
                this.displayResults();
            } else {
                //console.log(`⚠️ 页面 ${hostname} 未找到有效的扫描数据`);
            }
            
            // 从IndexedDB恢复深度扫描状态
            const deepState = await window.indexedDBManager.loadDeepScanState(fullUrl);
            if (deepState) {
                this.deepScanRunning = deepState.running || false;
                this.scannedUrls = new Set(deepState.scannedUrls || []);
                this.currentDepth = deepState.currentDepth || 0;
                this.maxDepth = deepState.maxDepth || 2;
                this.concurrency = deepState.concurrency || 3;
                
                //console.log('🔄 从IndexedDB恢复深度扫描状态:', {
                //    running: this.deepScanRunning,
                //    scannedCount: this.scannedUrls.size,
                //    depth: this.currentDepth
                //});
            }
        } catch (error) {
            console.error('❌ 加载结果失败:', error);
        }
    }

    // 初始化JS注入页面
    initJSInjectPage() {
        if (this.jsInjector) {
            // 设置全局引用，供HTML中的onclick使用
            window.jsInjector = this.jsInjector;
            // 延迟初始化，确保DOM元素已加载
            setTimeout(() => {
                this.jsInjector.init();
            }, 100);
        }
    }
}

const CURRENT_VERSION = 'v1.8.0'; // 请根据实际版本修改

function compareVersion(v1, v2) {
    const arr1 = v1.replace(/^v/, '').split('.').map(Number);
    const arr2 = v2.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
        const num1 = arr1[i] || 0;
        const num2 = arr2[i] || 0;
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    return 0;
}

function showUpdateModal(release) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;
        background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
        <div style="background:#222;padding:30px 24px;border-radius:12px;max-width:350px;color:#fff;text-align:center;box-shadow:0 0 20px #000;">
            <h2 style="color:#00d4aa;">Xuan8a1提醒您，有新版本：${release.tag_name}</h2>
            <div style="margin:12px 0 18px 0;font-size:13px;">${release.name || ''}</div>
            <div style="margin-bottom:12px;font-size:12px;color:#ccc;">${release.body || ''}</div>
            <a href="${release.html_url}" target="_blank" style="display:inline-block;padding:8px 18px;background:#00d4aa;color:#222;border-radius:6px;text-decoration:none;font-weight:bold;">前往下载</a>
            <br><button style="margin-top:18px;padding:6px 18px;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;" id="closeUpdateModal">关闭</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeUpdateModal').onclick = () => modal.remove();
}

async function checkForUpdate() {
    try {
        const lastShown = localStorage.getItem('phantom_update_last_shown');
        const now = Date.now();
        if (lastShown && now - Number(lastShown) < 24 * 60 * 60 * 1000) return;

        const res = await fetch('https://www.cn-fnst.top/huanying/');
        if (!res.ok) return;
        const releases = await res.json();
        if (!Array.isArray(releases) || releases.length === 0) return;
        // 找到最大版本
        let maxRelease = releases[0];
        for (const r of releases) {
            if (compareVersion(maxRelease.tag_name, r.tag_name) < 0) {
                maxRelease = r;
            }
        }
        if (compareVersion(CURRENT_VERSION, maxRelease.tag_name) < 0) {
            showUpdateModal(maxRelease);
            localStorage.setItem('phantom_update_last_shown', now);
        }
    } catch (e) {}
}

// 初始化 AST 系统
async function initASTSystem() {
    console.log('🔄 [AST] 开始初始化 AST 系统...');
    
    try {
        // 检查依赖
        if (!window.acorn) {
            console.warn('⚠️ [AST] acorn 未加载');
            return false;
        }
        
        // 优先使用 astBridge
        if (window.astBridge) {
            console.log('🔄 [AST] 使用 ASTBridge 初始化...');
            const initResult = await window.astBridge.init();
            
            if (initResult && window.astBridge.isAvailable()) {
                console.log('✅ [AST] ASTBridge 初始化成功');
                return true;
            }
        }
        
        // 备选：使用 initASTExtractor
        if (typeof window.initASTExtractor === 'function') {
            console.log('🔄 [AST] 使用 initASTExtractor 初始化...');
            await window.initASTExtractor();
            console.log('✅ [AST] ASTExtractor 初始化成功');
            return true;
        }
        
        console.warn('⚠️ [AST] AST 模块未加载');
        return false;
        
    } catch (error) {
        console.error('❌ [AST] AST 系统初始化失败:', error);
        return false;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 AST 系统
    await initASTSystem();
    
    // 初始化主应用
    new ILoveYouTranslucent7();
    checkForUpdate();
});
