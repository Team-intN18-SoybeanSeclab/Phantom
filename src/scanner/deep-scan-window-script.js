// ==========================================================
// 深度扫描窗口脚本（统一正则版本）
// 所有正则统一通过 SettingsManager 获取，无任何硬编码
// ==========================================================

//console.log('🚀 [DEBUG] 深度扫描窗口脚本（统一正则版本）开始加载...');

// -------------------- 全局变量 --------------------
let scanConfig         = null;
let scanResults        = {};
let isScanRunning      = false;
let isPaused           = false;
let currentDepth       = 0;
let scannedUrls        = new Set();
let pendingUrls        = new Set();
let urlContentCache    = new Map();
let activeRequests     = 0;
let maxConcurrency     = 4; // 默认值，会从扩展设置中读取
let requestTimeout     = 3000; // 默认值，会从扩展设置中读取

// 日志相关变量 - 优化版本
let logEntries         = [];
let maxLogEntries      = 100; // 减少到100条，避免内存占用
let logBuffer          = []; // 日志缓冲区
let logFlushTimer      = null;
const LOG_FLUSH_INTERVAL = 500; // 500ms批量刷新日志

// 筛选器实例
let apiFilter          = null;
let domainPhoneFilter  = null;
let filtersLoaded      = false;
let patternExtractor   = null;

// 性能优化相关变量
let updateQueue        = [];
let isUpdating         = false;
let lastUpdateTime     = 0;
const UPDATE_THROTTLE  = 300; // 🚀 增加到300ms节流，减少更新频率
let pendingResults     = {};
let batchSize          = 15; // 🚀 增加批量处理大小
let updateTimer        = null;
let displayUpdateCount = 0;

// 🚀 内存管理相关变量
let memoryCleanupTimer = null;
const MEMORY_CLEANUP_INTERVAL = 30000; // 30秒清理一次内存

/**
 * 虚拟滚动列表组件：只渲染可视区域 + 上下缓冲行
 * - 使用 transform: translateY 开启合成层
 * - will-change: transform 提示浏览器优化
 * - 统一使用 textContent 安全渲染
 */
class VirtualList {
    constructor(container, {
        itemHeight = 24,
        buffer = 8,
        renderItem = null
    } = {}) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.buffer = buffer;
        this.renderItem = renderItem || ((item) => {
            const div = document.createElement('div');
            div.className = 'vl-item';
            // 可变高度：不固定高度/行高，允许多行换行
            div.style.display = 'block';
            div.style.boxSizing = 'border-box';
            div.style.width = '100%';
            div.style.whiteSpace = 'normal';
            div.style.wordBreak = 'break-word';
            div.style.overflowWrap = 'anywhere';
            div.textContent = String(item);
            return div;
        });

        // 容器样式与合成层（被动视口模式：不在自身开启滚动）
        const cs = window.getComputedStyle(this.container);
        // 保证定位上下文
        const pos = cs.position;
        if ((pos === 'static' || !pos) && !this.container.style.position) {
            this.container.style.position = 'relative';
        }
        // 硬件加速/合成层
        this.container.style.willChange = 'transform';
        this.container.style.transform = this.container.style.transform || 'translateZ(0)';
        // 限定重绘范围，减少父层影响
        this.container.style.contain = this.container.style.contain || 'paint';
        // 记录滚动父容器并监听
        this.scrollParent = this.getScrollParent(this.container) || window;
        this.onScroll = this.onScroll.bind(this);
        const sp = this.scrollParent === window ? window : this.scrollParent;
        sp.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', () => this.render());

        // 内容容器
        this.content = document.createElement('div');
        this.content.className = 'vl-content';
        this.content.style.position = 'relative';
        this.content.style.willChange = 'transform';
        this.content.style.width = '100%';
        this.container.innerHTML = '';
        this.container.appendChild(this.content);

        // 切片容器：承载可视区（可变高度：不再绝对定位/平移）
        this.slice = document.createElement('div');
        this.slice.className = 'vl-slice';
        this.slice.style.position = 'relative';
        this.slice.style.width = '100%';
        this.content.appendChild(this.slice);

        this.items = [];
        // 可变高度支持：高度缓存与估算参数
        this.heightMap = [];               // index -> measured height(px)
        this._avgH = this.itemHeight;      // 运行期估计行高
        this.minRowHeight = this.itemHeight; // 基线行高
        this.avgCharWidth = 7;             // 预估每字符宽度（px），可按需要调整
        // 可变高度支持：高度缓存与估算参数
        this.heightMap = [];               // index -> measured height(px)
        this._avgH = this.itemHeight;      // 运行期估计行高
        this.minRowHeight = this.itemHeight; // 基线行高
        this.avgCharWidth = 7;             // 预估每字符宽度（px），可按需要调整

        // 事件绑定在被动视口模式下已绑定到滚动父容器
    }

    // 查找最近的可滚动父容器
    getScrollParent(el) {
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            const style = window.getComputedStyle(p);
            const oy = style.overflowY;
            if (oy === 'auto' || oy === 'scroll') return p;
            p = p.parentElement;
        }
        return window;
    }
    // 计算容器相对滚动父容器的顶部偏移
    getOffsetTopRelativeToScrollParent() {
        const spEl = this.scrollParent === window ? (document.scrollingElement || document.documentElement) : this.scrollParent;
        let el = this.container;
        let top = 0;
        while (el && el !== spEl && el.offsetParent) {
            top += el.offsetTop;
            el = el.offsetParent;
        }
        return top;
    }

    setItems(items) {
        this.items = Array.isArray(items) ? items : [];

        // 动态测量首项高度，校准 itemHeight，避免位移与实际高度不一致造成重叠
        if (this.items.length > 0) {
            try {
                // 清空切片，仅用于测量
                this.slice.innerHTML = '';
                const probe = this.renderItem(this.items[0], 0);
                // 强制布局样式，避免外部样式干扰测量
                probe.style.display = 'block';
                probe.style.boxSizing = 'border-box';
                probe.style.width = '100%';
                // 若未设高度，则给出预设高度再测量
                if (!probe.style.height) {
                    probe.style.height = this.itemHeight + 'px';
                    probe.style.lineHeight = this.itemHeight + 'px';
                }
                this.slice.appendChild(probe);
                const h = probe.getBoundingClientRect().height;
                if (h > 0 && Math.abs(h - this.itemHeight) >= 0.5) {
                    this.itemHeight = Math.round(h);
                }
                this.slice.innerHTML = '';
            } catch (e) {
                // 忽略测量错误，使用默认 itemHeight
            }
        }

        // 初始化高度缓存，使用可变高度渲染（用 padding 占位）
        this.heightMap = new Array(this.items.length).fill(0);
        this._avgH = this.minRowHeight;
        this.content.style.height = 'auto';
        this.content.style.paddingTop = '0px';
        this.content.style.paddingBottom = '0px';
        this.render();
    }

    onScroll() {
        this.render();
    }

    // 增量追加数据：保留高度缓存，仅为新增项扩容
    appendItems(newItems) {
        if (!Array.isArray(newItems) || newItems.length === 0) return;
        const startLen = this.items.length;
        this.items.push(...newItems);
        if (!Array.isArray(this.heightMap)) this.heightMap = [];
        for (let i = 0; i < newItems.length; i++) {
            this.heightMap[startLen + i] = 0;
        }
        // 渲染即可，测量将在本帧内完成并回写 heightMap
        this.render();
    }

    render() {
        // 使用滚动父容器作为视口
        const sp = this.scrollParent === window ? window : this.scrollParent;
        let viewportHeight, scrollTop;
        if (sp === window) {
            viewportHeight = window.innerHeight || document.documentElement.clientHeight || 300;
            scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        } else {
            viewportHeight = sp.clientHeight || 300;
            scrollTop = sp.scrollTop || 0;
        }
        const containerOffset = this.getOffsetTopRelativeToScrollParent();
        const effectiveScrollTop = Math.max(0, scrollTop - containerOffset);

        // 宽度用于估算行数
        const containerWidth = this.container.clientWidth || this.content.clientWidth || 300;

        // 简单估高函数：按字符数估计行数，再乘基线行高
        const estimateHeight = (item) => {
            try {
                const text = String(item ?? '');
                const chars = text.length;
                const lineChars = Math.max(1, Math.floor(containerWidth / this.avgCharWidth));
                const lines = Math.max(1, Math.ceil(chars / lineChars));
                return Math.max(this.minRowHeight, lines * this.minRowHeight);
            } catch {
                return this.minRowHeight;
            }
        };

        // 计算可视起止索引与上下占位（padding）
        const total = this.items.length;
        if (total === 0) {
            this.slice.innerHTML = '';
            this.content.style.paddingTop = '0px';
            this.content.style.paddingBottom = '0px';
            return;
        }

        let topPad = 0;
        // 从粗略起点开始线性前进，避免全量累加
        const avgH = Math.max(this.minRowHeight, (this._avgH || this.minRowHeight));
        let startIndex = Math.max(0, Math.floor(effectiveScrollTop / avgH) - this.buffer);

        // 前推修正
        let acc = 0;
        for (let i = 0; i < startIndex; i++) {
            const h = this.heightMap[i] || estimateHeight(this.items[i]);
            acc += h;
        }
        while (startIndex > 0 && acc > effectiveScrollTop) {
            startIndex--;
            acc -= (this.heightMap[startIndex] || estimateHeight(this.items[startIndex]));
        }
        while (startIndex < total && acc + (this.heightMap[startIndex] || estimateHeight(this.items[startIndex])) <= effectiveScrollTop) {
            acc += (this.heightMap[startIndex] || estimateHeight(this.items[startIndex]));
            startIndex++;
        }
        topPad = acc;

        // 计算结束索引直到窗口底部 + 缓冲
        const limit = effectiveScrollTop + viewportHeight + this.buffer * this.minRowHeight;
        let endIndex = startIndex;
        let run = acc;
        while (endIndex < total && run <= limit) {
            run += (this.heightMap[endIndex] || estimateHeight(this.items[endIndex]));
            endIndex++;
        }
        endIndex = Math.min(total, endIndex);

        // 计算底部占位
        let bottomPad = 0;
        let remaining = 0;
        for (let i = endIndex; i < total; i++) {
            remaining += (this.heightMap[i] || estimateHeight(this.items[i]));
        }
        const totalEstimated = run + remaining;
        bottomPad = Math.max(0, totalEstimated - run);

        // 应用占位：不再使用 translateY
        this.content.style.paddingTop = `${topPad}px`;
        this.content.style.paddingBottom = `${bottomPad}px`;

        // 渲染可视区
        this.slice.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (let idx = startIndex; idx < endIndex; idx++) {
            const node = this.renderItem(this.items[idx], idx);
            // 统一安全布局（允许多行换行）
            node.style.display = 'block';
            node.style.boxSizing = 'border-box';
            node.style.width = '100%';
            node.style.whiteSpace = node.style.whiteSpace || 'normal';
            node.style.wordBreak = node.style.wordBreak || 'break-word';
            node.style.overflowWrap = node.style.overflowWrap || 'anywhere';
            frag.appendChild(node);
        }
        this.slice.appendChild(frag);

        // 实测高度回写 heightMap，计算新的平均高度以优化下一次起点估计
        const children = Array.from(this.slice.children);
        let measuredChanged = false;
        let measuredCount = 0;
        let measuredSum = 0;
        for (let k = 0; k < children.length; k++) {
            const i = startIndex + k;
            const h = Math.round(children[k].getBoundingClientRect().height || this.minRowHeight);
            if (h > 0 && h !== this.heightMap[i]) {
                this.heightMap[i] = h;
                measuredChanged = true;
            }
            if (h > 0) {
                measuredSum += h;
                measuredCount++;
            }
        }
        if (measuredChanged) {
            const countMeasured = this.heightMap.filter(Boolean).length;
            if (countMeasured > 0) {
                const sum = this.heightMap.reduce((s, v) => s + (v || 0), 0);
                this._avgH = Math.max(this.minRowHeight, Math.round(sum / countMeasured));
            } else if (measuredCount > 0) {
                this._avgH = Math.max(this.minRowHeight, Math.round(measuredSum / measuredCount));
            }
            // 轻微微调：下一帧重渲染，使 paddingTop/Bottom 更精确
            requestAnimationFrame(() => this.render());
        }
    }
}

// 虚拟列表实例注册
const __virtualLists = new Map();
// 文本缓存与增量计数：按分类 key 维护
const __renderedTextCache = {};
const __lastRenderedCounts = {};

/**
 * 获取或创建虚拟列表实例
 * @param {string} elementId
 * @param {object} options
 */
function getVirtualList(elementId, options = {}) {
    const key = elementId;
    if (__virtualLists.has(key)) return __virtualLists.get(key);
    const el = document.getElementById(elementId);
    if (!el) return null;
    const vl = new VirtualList(el, options);
    __virtualLists.set(key, vl);
    return vl;
}

/**
 * 更新虚拟列表数据
 * @param {string} elementId
 * @param {any[]} items
 * @param {object} options
 */
function updateVirtualList(elementId, items, options = {}) {
    const vl = getVirtualList(elementId, options);
    if (!vl) return;
    vl.setItems(items || []);
}

/**
 * 仅追加新增条目，避免全量重建
 */
function updateVirtualListAppend(elementId, newItems, options = {}) {
    let vl = getVirtualList(elementId);
    if (!vl) {
        // 首次创建时需要完整初始化
        vl = getVirtualList(elementId, options);
        if (!vl) return;
        vl.setItems(newItems || []);
        return;
    }
    if (newItems && newItems.length) {
        vl.appendItems(newItems);
    }
}

// -------------------- 性能优化工具函数 --------------------

// 🚀 内存清理函数
function performMemoryCleanup() {
    //console.log('🧹 执行内存清理...');
    
    // 清理URL内容缓存，只保留最近的50个
    if (urlContentCache.size > 50) {
        const entries = Array.from(urlContentCache.entries());
        const toKeep = entries.slice(-50);
        urlContentCache.clear();
        toKeep.forEach(([key, value]) => urlContentCache.set(key, value));
        //console.log(`🧹 清理URL缓存，保留 ${toKeep.length} 个条目`);
    }
    
    // 清理日志缓冲区
    if (logBuffer && logBuffer.length > 0) {
        flushLogBuffer();
    }
    
    // 强制垃圾回收（如果可用）
    if (window.gc) {
        window.gc();
    }
}

// 启动内存清理定时器
function startMemoryCleanup() {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
    }
    memoryCleanupTimer = setInterval(performMemoryCleanup, MEMORY_CLEANUP_INTERVAL);
}

// 停止内存清理定时器
function stopMemoryCleanup() {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
        memoryCleanupTimer = null;
    }
}

function convertRelativeToAbsolute(relativePath) {
    try {
        const base = scanConfig?.baseUrl || window.location.origin;
        return new URL(relativePath, base).href;
    } catch {
        return relativePath;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL(src) : src;
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// -------------------- 统一筛选器加载 --------------------
async function loadFilters() {
    //console.log('🔍 [DEBUG] 开始加载统一筛选器...');

    try {
        // 加载 SettingsManager（必须）
        if (typeof window.SettingsManager === 'undefined') {
            await loadScript('src/utils/SettingsManager.js');
        }

        // 加载 PatternExtractor（必须）
        if (typeof window.PatternExtractor === 'undefined') {
            await loadScript('src/scanner/PatternExtractor.js');
        }

        // 等待脚本解析
        await new Promise(r => setTimeout(r, 100));

        // 实例化
        if (typeof window.PatternExtractor === 'undefined') {
            throw new Error('PatternExtractor 未加载成功');
        }
        patternExtractor = new window.PatternExtractor();

        // 强制加载自定义正则
        if (typeof patternExtractor.ensureCustomPatternsLoaded === 'function') {
            patternExtractor.ensureCustomPatternsLoaded();
        }

        // 监听设置页正则更新
        window.addEventListener('regexConfigUpdated', (e) => {
            //console.log('🔄 [DEBUG] 收到正则配置更新事件');
            if (patternExtractor?.updatePatterns) {
                patternExtractor.updatePatterns(e.detail);
            } else if (patternExtractor?.loadCustomPatterns) {
                patternExtractor.loadCustomPatterns(e.detail);
            }
        });

        filtersLoaded = true;
        //console.log('✅ [DEBUG] 统一筛选器加载完毕');
    } catch (err) {
        console.error('❌ [DEBUG] 筛选器加载失败:', err);
        filtersLoaded = false;
    }
}

// -------------------- 统一内容提取 --------------------
async function extractFromContent(content, sourceUrl = 'unknown') {
    //console.log('🔍 [DEBUG] 开始统一内容提取...');

    if (!patternExtractor || typeof patternExtractor.extractPatterns !== 'function') {
        throw new Error('PatternExtractor.extractPatterns 不可用');
    }

    // 确保配置已加载
    if (typeof patternExtractor.ensureCustomPatternsLoaded === 'function') {
        await patternExtractor.ensureCustomPatternsLoaded();
    }

    // 使用统一入口提取
    const results = await patternExtractor.extractPatterns(content, sourceUrl);

    // 🔥 修复：使用 IndexedDB 数据进行智能相对路径解析
    await enhanceRelativePathsWithIndexedDB(results, sourceUrl);

    return results;
}

// -------------------- 智能相对路径解析 --------------------
async function enhanceRelativePathsWithIndexedDB(results, currentSourceUrl) {
    //console.log('🔍 [DEBUG] 开始智能相对路径解析，当前源URL:', currentSourceUrl);
    
    if (!results.relativeApis || results.relativeApis.length === 0) {
        //console.log('⚠️ 没有相对路径API需要解析');
        return;
    }
    
    try {
        // 🔥 修复：严格按照IndexedDB数据获取提取来源路径
        const baseUrl = scanConfig?.baseUrl || window.location.origin;
        console.log('🔍 [DEBUG] 基础URL:', baseUrl);
        
        // 获取所有扫描结果数据，包括深度扫描结果
        let allScanData = [];
        
        // 方法1：尝试获取当前域名的扫描结果
        try {
            const currentScanData = await window.IndexedDBManager.loadScanResults(baseUrl);
            if (currentScanData && currentScanData.results) {
                allScanData.push(currentScanData);
                console.log('✅ [DEBUG] 获取到当前域名扫描结果');
            }
        } catch (e) {
            console.warn('⚠️ 获取当前域名扫描结果失败:', e);
        }
        
        // 方法2：获取所有扫描结果作为备选
        try {
            const allResults = await window.IndexedDBManager.getAllScanResults();
            if (allResults && Array.isArray(allResults)) {
                allScanData = allScanData.concat(allResults);
                console.log('✅ [DEBUG] 获取到所有扫描结果，共', allResults.length, '个');
            }
        } catch (e) {
            console.warn('⚠️ 获取所有扫描结果失败:', e);
        }
        
        if (allScanData.length === 0) {
            console.log('⚠️ 未找到任何 IndexedDB 数据，使用传统拼接方式');
            return;
        }
        
        // 🔥 修复：严格按照IndexedDB中每个数据项的sourceUrl进行路径解析
        const sourceUrlToBasePath = new Map();
        const itemToSourceUrlMap = new Map(); // 新增：建立数据项到sourceUrl的映射
        
        console.log('🔍 [DEBUG] 开始分析IndexedDB数据，共', allScanData.length, '个数据源');
        
        // 遍历所有扫描数据，建立完整的映射关系
        allScanData.forEach((scanData, dataIndex) => {
            if (!scanData.results) return;
            
            //console.log(`🔍 [DEBUG] 分析数据源 ${dataIndex + 1}:`, {
            //    url: scanData.url,
            //    sourceUrl: scanData.sourceUrl,
            //    domain: scanData.domain,
            //    pageTitle: scanData.pageTitle
            //});
            
            // 遍历所有类型的数据
            Object.entries(scanData.results).forEach(([category, items]) => {
                if (!Array.isArray(items)) return;
                
                items.forEach(item => {
                    if (typeof item === 'object' && item !== null && item.sourceUrl) {
                        // 🔥 关键修复：使用数据项自己的sourceUrl
                        const itemSourceUrl = item.sourceUrl;
                        const itemValue = item.value || item.text || item.content;
                        
                        if (itemValue && itemSourceUrl) {
                            try {
                                const sourceUrlObj = new URL(itemSourceUrl);
                                // 提取基础路径（去掉文件名）
                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const fullBasePath = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                
                                sourceUrlToBasePath.set(itemSourceUrl, fullBasePath);
                                itemToSourceUrlMap.set(itemValue, itemSourceUrl);
                                
                                //console.log(`📋 [DEBUG] 映射建立: "${itemValue}" -> "${itemSourceUrl}" -> "${fullBasePath}"`);
                            } catch (e) {
                                //console.warn('⚠️ 无效的sourceUrl:', itemSourceUrl, e);
                            }
                        }
                    } else if (typeof item === 'string') {
                        // 对于字符串格式的数据，使用扫描结果的sourceUrl
                        const fallbackSourceUrl = scanData.sourceUrl || scanData.url;
                        if (fallbackSourceUrl) {
                            try {
                                const sourceUrlObj = new URL(fallbackSourceUrl);
                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const fullBasePath = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                
                                sourceUrlToBasePath.set(fallbackSourceUrl, fullBasePath);
                                itemToSourceUrlMap.set(item, fallbackSourceUrl);
                                
                                console.log(`📋 [DEBUG] 备选映射: "${item}" -> "${fallbackSourceUrl}" -> "${fullBasePath}"`);
                            } catch (e) {
                                console.warn('⚠️ 无效的备选sourceUrl:', fallbackSourceUrl, e);
                            }
                        }
                    }
                });
            });
        });
        
        console.log('📊 [DEBUG] 映射建立完成:', {
            sourceUrlToBasePath: sourceUrlToBasePath.size,
            itemToSourceUrlMap: itemToSourceUrlMap.size
        });
        
        // 🔥 修复：严格按照每个相对路径API的来源进行解析
        const enhancedRelativeApis = [];
        
        for (const apiItem of results.relativeApis) {
            const apiValue = typeof apiItem === 'object' ? apiItem.value : apiItem;
            // 硬过滤：剔除仅为 "/" 的无效相对路径
            if (String(apiValue ?? '').trim() === '/') {
                console.log('⛔ [过滤] 跳过无效相对路径 "/"');
                continue;
            }
            let apiSourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : currentSourceUrl;
            
            //console.log(`🔍 [DEBUG] 处理相对路径API: "${apiValue}", 源URL: "${apiSourceUrl}"`);
            
            let resolvedUrl = null;
            let usedSourceUrl = null;
            
            // 🔥 方法1：严格按照数据项的sourceUrl进行解析
            if (itemToSourceUrlMap.has(apiValue)) {
                const exactSourceUrl = itemToSourceUrlMap.get(apiValue);
                if (sourceUrlToBasePath.has(exactSourceUrl)) {
                    const basePath = sourceUrlToBasePath.get(exactSourceUrl);
                    resolvedUrl = resolveRelativePath(apiValue, basePath);
                    usedSourceUrl = exactSourceUrl;
                    console.log('✅ [精确匹配] 找到数据项的确切来源:', apiValue, '->', resolvedUrl, '(源:', exactSourceUrl, ')');
                }
            }
            
            // 🔥 方法2：如果精确匹配失败，使用API项目自带的sourceUrl
            if (!resolvedUrl && apiSourceUrl && sourceUrlToBasePath.has(apiSourceUrl)) {
                const basePath = sourceUrlToBasePath.get(apiSourceUrl);
                resolvedUrl = resolveRelativePath(apiValue, basePath);
                usedSourceUrl = apiSourceUrl;
                console.log('✅ [直接匹配] 使用API项目的sourceUrl:', apiValue, '->', resolvedUrl, '(源:', apiSourceUrl, ')');
            }
            
            // 🔥 方法3：如果还是失败，尝试查找相似的源URL（域名匹配）
            if (!resolvedUrl && sourceUrlToBasePath.size > 0) {
                const targetDomain = baseUrl ? new URL(baseUrl).hostname : null;
                
                for (const [sourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                    try {
                        const sourceDomain = new URL(sourceUrl).hostname;
                        if (targetDomain && sourceDomain === targetDomain) {
                            const testUrl = resolveRelativePath(apiValue, basePath);
                            if (testUrl) {
                                resolvedUrl = testUrl;
                                usedSourceUrl = sourceUrl;
                                //console.log('✅ [域名匹配] 找到同域名的源URL:', apiValue, '->', resolvedUrl, '(源:', sourceUrl, ')');
                                break;
                            }
                        }
                    } catch (e) {
                        // 忽略无效URL
                    }
                }
            }
            
            // 🔥 方法4：最后的备选方案，使用基础URL拼接
            if (!resolvedUrl) {
                try {
                    if (apiValue.startsWith('./')) {
                        resolvedUrl = baseUrl + apiValue.substring(1); // 去掉.，保留/
                    } else if (apiValue.startsWith('../')) {
                        // 简单处理上级目录
                        const upLevels = (apiValue.match(/\.\.\//g) || []).length;
                        const remainingPath = apiValue.replace(/\.\.\//g, '');
                        const baseUrlObj = new URL(baseUrl);
                        const pathParts = baseUrlObj.pathname.split('/').filter(p => p);
                        
                        // 向上移动指定层级
                        for (let i = 0; i < upLevels && pathParts.length > 0; i++) {
                            pathParts.pop();
                        }
                        
                        resolvedUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${pathParts.join('/')}${pathParts.length > 0 ? '/' : ''}${remainingPath}`;
                    } else if (!apiValue.startsWith('/') && !apiValue.startsWith('http')) {
                        resolvedUrl = baseUrl + '/' + apiValue;
                    } else {
                        resolvedUrl = apiValue;
                    }
                    
                    // 清理多余的斜杠
                    resolvedUrl = resolvedUrl.replace(/\/+/g, '/').replace(':/', '://');
                    usedSourceUrl = baseUrl;
                    
                    console.log('🔄 [备选解析] 使用基础URL拼接:', apiValue, '->', resolvedUrl);
                } catch (e) {
                    resolvedUrl = apiValue; // 保持原值
                    usedSourceUrl = currentSourceUrl;
                    console.warn('⚠️ [解析失败] 保持原值:', apiValue, e.message);
                }
            }
            
            // 保持原始格式，添加解析后的 URL 和实际使用的源URL
            if (typeof apiItem === 'object') {
                enhancedRelativeApis.push({
                    ...apiItem,
                    resolvedUrl: resolvedUrl,
                    actualSourceUrl: usedSourceUrl || apiItem.sourceUrl // 记录实际使用的源URL
                });
            } else {
                enhancedRelativeApis.push({
                    value: apiItem,
                    sourceUrl: usedSourceUrl || currentSourceUrl,
                    resolvedUrl: resolvedUrl,
                    actualSourceUrl: usedSourceUrl
                });
            }
        }
        
        // 更新结果
        results.relativeApis = enhancedRelativeApis;
        
        console.log('✅ [智能解析] 相对路径解析完成，处理了', enhancedRelativeApis.length, '个相对路径');
        console.log('📊 [智能解析] 解析统计:', {
            总数: enhancedRelativeApis.length,
            成功解析: enhancedRelativeApis.filter(item => item.resolvedUrl && item.resolvedUrl !== item.value).length,
            使用IndexedDB数据: enhancedRelativeApis.filter(item => item.actualSourceUrl && item.actualSourceUrl !== currentSourceUrl).length
        });
        
    } catch (error) {
        console.error('❌ 智能相对路径解析失败:', error);
        // 出错时保持原始数据不变
    }
}

// 辅助函数：解析相对路径
function resolveRelativePath(relativePath, basePath) {
    try {
        if (!relativePath || !basePath) {
            console.warn('⚠️ 相对路径解析参数无效:', { relativePath, basePath });
            return null;
        }
        
        console.log(`🔧 [解析] 开始解析相对路径: "${relativePath}" 基于 "${basePath}"`);
        
        // 确保basePath以/结尾
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        
        let resolvedPath;
        
        if (relativePath.startsWith('./')) {
            // 当前目录：./file.js -> basePath + file.js
            resolvedPath = basePath + relativePath.substring(2);
            console.log(`🔧 [解析] 当前目录解析: "${relativePath}" -> "${resolvedPath}"`);
        } else if (relativePath.startsWith('../')) {
            // 上级目录：../file.js -> 需要处理路径层级
            const upLevels = (relativePath.match(/\.\.\//g) || []).length;
            const remainingPath = relativePath.replace(/\.\.\//g, '');
            
            console.log(`🔧 [解析] 上级目录解析: 向上${upLevels}级, 剩余路径: "${remainingPath}"`);
            
            try {
                const baseUrlObj = new URL(basePath);
                const pathParts = baseUrlObj.pathname.split('/').filter(p => p);
                
                console.log(`🔧 [解析] 基础路径部分:`, pathParts);
                
                // 向上移动指定层级
                for (let i = 0; i < upLevels && pathParts.length > 0; i++) {
                    pathParts.pop();
                }
                
                console.log(`🔧 [解析] 向上移动后路径部分:`, pathParts);
                
                resolvedPath = `${baseUrlObj.protocol}//${baseUrlObj.host}/${pathParts.join('/')}${pathParts.length > 0 ? '/' : ''}${remainingPath}`;
                console.log(`🔧 [解析] 上级目录最终解析: "${relativePath}" -> "${resolvedPath}"`);
            } catch (e) {
                console.warn('⚠️ 上级目录解析失败，使用简单方法:', e);
                // 简单处理方式
                const baseUrl = basePath.split('/').slice(0, 3).join('/'); // protocol://host
                resolvedPath = baseUrl + '/' + remainingPath;
            }
        } else if (!relativePath.startsWith('/') && !relativePath.startsWith('http')) {
            // 相对路径：file.js -> basePath + file.js
            resolvedPath = basePath + relativePath;
            console.log(`🔧 [解析] 相对路径解析: "${relativePath}" -> "${resolvedPath}"`);
        } else {
            // 已经是绝对路径
            resolvedPath = relativePath;
            console.log(`🔧 [解析] 已是绝对路径: "${relativePath}"`);
        }
        
        // 清理多余的斜杠
        const cleanedPath = resolvedPath.replace(/\/+/g, '/').replace(':/', '://');
        
        if (cleanedPath !== resolvedPath) {
            console.log(`🔧 [解析] 路径清理: "${resolvedPath}" -> "${cleanedPath}"`);
        }
        
        console.log(`✅ [解析] 相对路径解析完成: "${relativePath}" -> "${cleanedPath}"`);
        return cleanedPath;
        
    } catch (error) {
        console.warn('❌ 相对路径解析失败:', error, { relativePath, basePath });
        return null;
    }
}

// -------------------- 传统结果处理（备用） --------------------
function convertRelativeApisToAbsolute(results) {
    // 🔥 修复：完全移除自动转换逻辑，保持绝对路径API和相对路径API的独立性
    // 不再将相对路径API自动转换并添加到绝对路径API中
    // 这样可以避免意外添加不符合绝对路径API正则要求的数据
    
    //console.log('🔍 [DEBUG] API转换完成（已禁用自动转换）:');
    //console.log('  - 保留的相对路径API:', results.relativeApis?.length || 0, '个');
    //console.log('  - 保留的绝对路径API:', results.absoluteApis?.length || 0, '个');
    
    // 如果需要转换功能，应该在PatternExtractor中通过正则表达式来实现
    // 而不是在这里进行强制转换
}

// -------------------- 性能优化函数 --------------------
// 节流更新显示
function throttledUpdateDisplay() {
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_THROTTLE) {
        // 如果距离上次更新时间太短，延迟更新
        if (updateTimer) {
            clearTimeout(updateTimer);
        }
        updateTimer = setTimeout(() => {
            performDisplayUpdate();
        }, UPDATE_THROTTLE);
        return;
    }
    
    performDisplayUpdate();
}

// 执行显示更新
function performDisplayUpdate() {
    if (isUpdating) return;
    
    isUpdating = true;
    lastUpdateTime = Date.now();
    displayUpdateCount++;
    
    try {
        // 使用 requestAnimationFrame 确保在下一帧更新
        requestAnimationFrame(() => {
            updateResultsDisplayVirtual();
            updateStatusDisplay();
            isUpdating = false;
        });
    } catch (error) {
        console.error('显示更新失败:', error);
        isUpdating = false;
    }
}

// 批量处理结果合并
function batchMergeResults(newResults) {
    let hasNewData = false;
    
    // 将新结果添加到待处理队列
    Object.keys(newResults).forEach(key => {
        if (!pendingResults[key]) {
            pendingResults[key] = new Map(); // 使用Map来存储对象，以value为键避免重复
        }
        
        if (Array.isArray(newResults[key])) {
            newResults[key].forEach(item => {
                if (item) {
                    // 硬过滤：relativeApis 中剔除仅为 "/" 的无效相对路径
                    if (key === 'relativeApis') {
                        const raw = (typeof item === 'object' ? (item.value || item.url || item.path || item.content) : item);
                        if (String(raw ?? '').trim() === '/') {
                            // console.log('⛔ [过滤] batchMergeResults 跳过 "/"');
                            return;
                        }
                    }
                    // 处理结构化对象（带sourceUrl）和简单字符串
                    const itemKey = typeof item === 'object' ? item.value : item;
                    const itemData = typeof item === 'object' ? item : { value: item, sourceUrl: 'unknown' };
                    
                    if (itemKey == null) return;
                    if (!pendingResults[key].has(itemKey)) {
                        pendingResults[key].set(itemKey, itemData);
                        hasNewData = true;
                    }
                }
            });
        }
    });
    
    // 如果有新数据，触发节流更新
    if (hasNewData) {
        throttledUpdateDisplay();
    }
    
    return hasNewData;
}

// 将待处理结果合并到主结果中
function flushPendingResults() {
    Object.keys(pendingResults).forEach(key => {
        if (!scanResults[key]) {
            scanResults[key] = [];
        }
        
        // 创建现有结果的键集合，用于去重
        const existingKeys = new Set();
        scanResults[key].forEach(item => {
            const itemKey = typeof item === 'object' ? item.value : item;
            existingKeys.add(itemKey);
        });
        
        // 添加新的结果项
        pendingResults[key].forEach((itemData, itemKey) => {
            // 硬过滤：relativeApis 中剔除仅为 "/" 的无效相对路径
            if (key === 'relativeApis' && String(itemKey ?? '').trim() === '/') {
                // console.log('⛔ [过滤] flushPendingResults 跳过 "/"');
                return;
            }
            if (!existingKeys.has(itemKey)) {
                scanResults[key].push(itemData);
            }
        });
        
        // 清空待处理队列
        pendingResults[key].clear();
    });
}

// -------------------- 页面初始化 --------------------
async function initializePage() {
    //console.log('🔍 [DEBUG] 页面初始化中...');

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('❌ Chrome扩展API不可用');
        return;
    }

    await loadFilters();

    try {
        // 获取baseUrl（从扫描配置中的baseUrl或当前窗口的opener）
        let baseUrl = '';
        if (window.opener) {
            try {
                // 尝试从opener窗口获取URL
                baseUrl = window.opener.location.origin;
            } catch (e) {
                // 如果跨域访问失败，使用默认方式
                console.warn('无法从opener获取URL，使用默认方式');
            }
        }
        
        // 从IndexedDB加载深度扫描配置
        let deepScanConfig = null;
        if (baseUrl) {
            deepScanConfig = await window.IndexedDBManager.loadDeepScanState(baseUrl);
        }
        
        // 如果没有找到配置，尝试获取所有可用的配置
        if (!deepScanConfig) {
            console.warn('⚠️ 未找到指定URL的扫描配置，尝试获取所有可用配置...');
            const allConfigs = await window.IndexedDBManager.getAllDeepScanStates();
            if (allConfigs && allConfigs.length > 0) {
                // 使用最新的配置
                deepScanConfig = allConfigs[allConfigs.length - 1];
                console.log('✅ 找到可用配置:', deepScanConfig.baseUrl);
            }
        }
        
        if (!deepScanConfig) throw new Error('未找到扫描配置');
        scanConfig = deepScanConfig;

        maxConcurrency = scanConfig.concurrency || 8;
        requestTimeout  = (scanConfig.timeout * 1000) || 5000;

        updateConfigDisplay();
        initializeScanResults();
    } catch (err) {
        console.error('❌ 初始化失败:', err);
    }

    // 绑定按钮事件
    document.getElementById('startBtn')?.addEventListener('click', startScan);
    document.getElementById('pauseBtn')?.addEventListener('click', pauseScan);
    document.getElementById('stopBtn')?.addEventListener('click', stopScan);
    document.getElementById('exportBtn')?.addEventListener('click', exportResults);
    document.getElementById('toggleAllBtn')?.addEventListener('click', toggleAllCategories);
    
    // 🚀 添加滚动优化：检测用户是否在滚动
    const logSection = document.getElementById('logSection');
    if (logSection) {
        let scrollTimeout;
        logSection.addEventListener('scroll', () => {
            logSection.isUserScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                logSection.isUserScrolling = false;
            }, 1000); // 1秒后认为用户停止滚动
        });
        
        // 🚀 优化滚动性能
        logSection.style.willChange = 'scroll-position';
        logSection.style.transform = 'translateZ(0)'; // 启用硬件加速
    }

    // 监听扩展消息
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
        if (msg.action === 'stopDeepScan') {
            stopScan();
            reply({ success: true });
        }
    });

    // 自动开始
    setTimeout(startScan, 1000);
}

// -------------------- 配置显示 --------------------
function updateConfigDisplay() {
    if (!scanConfig) return;

    document.getElementById('maxDepthDisplay').textContent = scanConfig.maxDepth || 2;
    document.getElementById('concurrencyDisplay').textContent = scanConfig.concurrency || 8;
    document.getElementById('timeoutDisplay').textContent = scanConfig.timeout || 5;
    
    const scanTypes = [];
    if (scanConfig.scanJsFiles) scanTypes.push('JS文件');
    if (scanConfig.scanHtmlFiles) scanTypes.push('HTML页面');
    if (scanConfig.scanApiFiles) scanTypes.push('API接口');
    
    document.getElementById('scanTypesDisplay').textContent = scanTypes.join(', ') || '全部';
    document.getElementById('scanInfo').textContent = `目标: ${scanConfig.baseUrl}`;
}

// -------------------- 扫描结果初始化 --------------------
function initializeScanResults() {
    scanResults = {
        absoluteApis: [],
        relativeApis: [],
        moduleApis: [],
        domains: [],
        urls: [],
        images: [],
        jsFiles: [],
        cssFiles: [],
        vueFiles: [],
        emails: [],
        phoneNumbers: [],
        ipAddresses: [],
        sensitiveKeywords: [],
        comments: [],
        paths: [],
        parameters: [],
        credentials: [],
        cookies: [],
        idKeys: [],
        companies: [],
        jwts: [],
        githubUrls: [],
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

// -------------------- 扫描控制 --------------------
async function startScan() {
    if (isScanRunning) return;
    
    //console.log('🚀 [DEBUG] 开始深度扫描...');
    isScanRunning = true;
    isPaused = false;
    currentDepth = 0;
    scannedUrls.clear();
    pendingUrls.clear();
    urlContentCache.clear();
    
    // 更新UI状态
    updateButtonStates();
    updateStatusDisplay();
    
    // 隐藏加载提示
    document.getElementById('loadingDiv').style.display = 'none';
    
    try {
        // 收集初始URL
        const initialUrls = await collectInitialUrls();
        //console.log(`📋 [DEBUG] 收集到 ${initialUrls.length} 个初始URL`);
        addLogEntry(`📋 收集到 ${initialUrls.length} 个初始扫描URL`, 'info');
        
        if (initialUrls.length === 0) {
            addLogEntry('⚠️ 没有找到可扫描的URL', 'warning');
            return;
        }
        
        // 🔥 记录初始URL列表（前几个）
        if (initialUrls.length > 0) {
            const urlsToShow = initialUrls.slice(0, 5);
            addLogEntry(`🎯 初始扫描目标: ${urlsToShow.join(', ')}${initialUrls.length > 5 ? ` 等${initialUrls.length}个URL` : ''}`, 'info');
        }
        
        // 记录扫描配置
        addLogEntry(`⚙️ 扫描配置 - 最大深度: ${scanConfig.maxDepth}, 并发数: ${scanConfig.concurrency}, 超时: ${scanConfig.timeout}ms`, 'info');
        
        // 开始分层扫描
        await performLayeredScan(initialUrls);
        
        // 完成扫描
        completeScan();
        
    } catch (error) {
        console.error('❌ 扫描失败:', error);
        addLogEntry(`❌ 扫描失败: ${error.message}`, 'error');
    } finally {
        isScanRunning = false;
        updateButtonStates();
    }
}

function pauseScan() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = isPaused ? '继续扫描' : '暂停扫描';
    
    if (isPaused) {
        addLogEntry('⏸️ 扫描已暂停', 'warning');
        addLogEntry(`📊 暂停时状态: 已扫描${scannedUrls.size}个URL，当前深度${currentDepth}`, 'info');
    } else {
        addLogEntry('▶️ 扫描已继续', 'success');
    }
}

function stopScan() {
    isScanRunning = false;
    isPaused = false;
    addLogEntry('⏹️ 用户手动停止扫描', 'warning');
    addLogEntry(`📊 停止时状态: 已扫描${scannedUrls.size}个URL，当前深度${currentDepth}`, 'info');
    updateButtonStates();
    completeScan();
}

// -------------------- 初始URL收集 --------------------
async function collectInitialUrls() {
    //console.log('📋 [DEBUG] 开始收集初始URL - 从普通扫描结果中获取');
    
    const urls = new Set();
    
    try {
        // 从深度扫描配置中获取普通扫描的结果
        if (!scanConfig.initialResults) {
            console.warn('⚠️ 深度扫描配置中未找到普通扫描结果，将扫描当前页面');
            urls.add(scanConfig.baseUrl);
            return Array.from(urls);
        }
        
        const initialResults = scanConfig.initialResults;
        //console.log('📊 [DEBUG] 找到普通扫描结果:', Object.keys(initialResults));
        console.log('📊 [DEBUG] 普通扫描结果统计:', {
            absoluteApis: initialResults.absoluteApis?.length || 0,
            jsFiles: initialResults.jsFiles?.length || 0,
            urls: initialResults.urls?.length || 0,
            domains: initialResults.domains?.length || 0,
            emails: initialResults.emails?.length || 0
        });
        
        // 将普通扫描结果作为深度扫描的起始结果
        Object.keys(initialResults).forEach(key => {
            if (scanResults[key] && Array.isArray(initialResults[key])) {
                scanResults[key] = [...initialResults[key]];
            }
        });
        
        // 从普通扫描结果中收集JS文件进行深度扫描
        if (scanConfig.scanJsFiles && initialResults.jsFiles) {
            //console.log(`📁 [DEBUG] 从普通扫描结果收集JS文件: ${initialResults.jsFiles.length} 个`);
            for (const jsFile of initialResults.jsFiles) {
                // 兼容新格式（对象）和旧格式（字符串）
                const url = typeof jsFile === 'object' ? jsFile.value : jsFile;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, scanConfig.baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                    urls.add(fullUrl);
                    //console.log(`✅ [DEBUG] 添加JS文件: ${fullUrl}`);
                }
            }
        }
        
        // 从普通扫描结果中收集HTML页面进行深度扫描
        if (scanConfig.scanHtmlFiles && initialResults.urls) {
            //console.log(`🌐 [DEBUG] 从普通扫描结果收集URL: ${initialResults.urls.length} 个`);
            for (const urlItem of initialResults.urls) {
                // 兼容新格式（对象）和旧格式（字符串）
                const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, scanConfig.baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl) && isValidPageUrl(fullUrl)) {
                    urls.add(fullUrl);
                    //console.log(`✅ [DEBUG] 添加页面URL: ${fullUrl}`);
                }
            }
        }
        
        // 从普通扫描结果中收集API接口进行深度扫描
        if (scanConfig.scanApiFiles) {
            // 绝对路径API
            if (initialResults.absoluteApis) {
                //console.log(`🔗 [DEBUG] 从普通扫描结果收集绝对API: ${initialResults.absoluteApis.length} 个`);
                for (const apiItem of initialResults.absoluteApis) {
                    // 兼容新格式（对象）和旧格式（字符串）
                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, scanConfig.baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                        urls.add(fullUrl);
                        //console.log(`✅ [DEBUG] 添加绝对API: ${fullUrl}`);
                    }
                }
            }
            
            // 相对路径API
            if (initialResults.relativeApis) {
                //console.log(`🔗 [DEBUG] 从普通扫描结果收集相对API: ${initialResults.relativeApis.length} 个`);
                for (const apiItem of initialResults.relativeApis) {
                    // 兼容新格式（对象）和旧格式（字符串）
                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, scanConfig.baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                        urls.add(fullUrl);
                        //console.log(`✅ [DEBUG] 添加相对API: ${fullUrl}`);
                    }
                }
            }
        }
        
        // 如果没有收集到任何URL，添加当前页面作为备用
        if (urls.size === 0) {
            console.warn('⚠️ 从普通扫描结果中未收集到任何URL，添加当前页面');
            urls.add(scanConfig.baseUrl);
        }
        
        //console.log(`📊 [DEBUG] 初始URL收集完成，共收集到 ${urls.size} 个URL`);
        //console.log(`📊 [DEBUG] 初始结果数量: ${Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0)}`);
        return Array.from(urls);
        
    } catch (error) {
        console.error('❌ 收集初始URL失败:', error);
        // 出错时添加当前页面作为备用
        urls.add(scanConfig.baseUrl);
        return Array.from(urls);
    }
}

// -------------------- 分层扫描 --------------------
async function performLayeredScan(initialUrls) {
    let currentUrls = [...initialUrls];
    
    for (let depth = 1; depth <= scanConfig.maxDepth && isScanRunning; depth++) {
        currentDepth = depth;
        
        if (currentUrls.length === 0) {
            //console.log(`第 ${depth} 层没有URL需要扫描`);
            break;
        }
        
        //console.log(`🔍 开始第 ${depth} 层扫描，URL数量: ${currentUrls.length}`);
        addLogEntry(`🔍 开始第 ${depth} 层扫描，URL数量: ${currentUrls.length}`, 'info');
        
        // 🔥 记录当前层要扫描的URL列表（前几个）
        if (currentUrls.length > 0) {
            const urlsToShow = currentUrls.slice(0, 3);
            addLogEntry(`📋 第 ${depth} 层扫描目标: ${urlsToShow.join(', ')}${currentUrls.length > 3 ? ` 等${currentUrls.length}个URL` : ''}`, 'info');
        }
        
        // 批量扫描URL
        const newUrls = await scanUrlBatch(currentUrls, depth);
        
        // 准备下一层URL
        currentUrls = newUrls.filter(url => !scannedUrls.has(url));
        
        //console.log(`✅ 第 ${depth} 层扫描完成，发现新URL: ${currentUrls.length} 个`);
        addLogEntry(`✅ 第 ${depth} 层扫描完成，发现新URL: ${currentUrls.length} 个`, 'success');
        
        // 🔥 记录下一层将要扫描的URL数量
        if (currentUrls.length > 0 && depth < scanConfig.maxDepth) {
            addLogEntry(`🔄 准备第 ${depth + 1} 层扫描，待扫描URL: ${currentUrls.length} 个`, 'info');
        }
        
        // 更新显示
        updateResultsDisplay();
        updateStatusDisplay();
    }
}

// -------------------- 批量URL扫描 --------------------
async function scanUrlBatch(urls, depth) {
    const newUrls = new Set();
    let processedCount = 0;
    const totalUrls = urls.length;
    
    // 使用队列和并发控制
    const queue = [...urls];
    const activeWorkers = new Set();
    
    // 实时显示计数器
    let lastDisplayUpdate = 0;
    const displayUpdateInterval = 500; // 每0.5秒最多更新一次显示，提高响应速度
    
    const processQueue = async () => {
        while (queue.length > 0 && isScanRunning && !isPaused) {
            const url = queue.shift();
            
            if (scannedUrls.has(url)) {
                processedCount++;
                updateProgressDisplay(processedCount, totalUrls, `第 ${depth} 层扫描`);
                continue;
            }
            
            scannedUrls.add(url);
            
            const workerPromise = (async () => {
                try {
                    // 获取URL内容
                    let content;
                    if (urlContentCache.has(url)) {
                        content = urlContentCache.get(url);
                    } else {
                        content = await fetchUrlContent(url);
                        if (content) {
                            urlContentCache.set(url, content);
                        }
                    }
                    
                        if (content) {
                            // 🚀 性能优化：移除频繁的扫描日志
                            // addLogEntry(`🔍 正在扫描: ${url}`, 'info');
                            
                            // 提取信息
                            const extractedData = await extractFromContent(content, url);
                            const hasNewData = mergeResults(extractedData);
                            
                            // 🔥 记录提取结果日志
                            if (hasNewData) {
                                const newDataCount = Object.values(extractedData).reduce((sum, arr) => sum + (arr?.length || 0), 0);
                                addLogEntry(`✅ 从 ${url} 提取到 ${newDataCount} 个新数据项`, 'success');
                            } else {
                                addLogEntry(`ℹ️ 从 ${url} 未发现新数据`, 'info');
                            }
                            
                            // 🚀 性能优化：减少显示更新频率，只在批量处理时更新
                            if (hasNewData) {
                                // 每处理10个URL才更新一次显示
                                if (processedCount % 10 === 0) {
                                    throttledUpdateDisplay();
                                }
                            }
                            
                            // 收集新URL
                            const discoveredUrls = await collectUrlsFromContent(content, scanConfig.baseUrl);
                            if (discoveredUrls.length > 0) {
                                addLogEntry(`🔗 从 ${url} 发现 ${discoveredUrls.length} 个新URL`, 'info');
                            }
                            discoveredUrls.forEach(newUrl => newUrls.add(newUrl));
                        } else {
                            // 🔥 记录无内容的情况
                            addLogEntry(`⚠️ ${url} 返回空内容或无法访问`, 'warning');
                        }
                    } catch (error) {
                        console.error(`扫描 ${url} 失败:`, error);
                        // 🔥 添加错误日志记录
                        addLogEntry(`❌ 扫描失败: ${url} - ${error.message}`, 'error');
                    } finally {
                        processedCount++;
                        // 🚀 性能优化：减少进度更新频率，每5个URL更新一次
                        if (processedCount % 5 === 0 || processedCount === totalUrls) {
                            updateProgressDisplay(processedCount, totalUrls, `第 ${depth} 层扫描`);
                        }
                        activeWorkers.delete(workerPromise);
                    }
            })();
            
            activeWorkers.add(workerPromise);
            
            // 🚀 性能优化：控制并发数并添加延迟
            if (activeWorkers.size >= maxConcurrency) {
                await Promise.race(Array.from(activeWorkers));
            }
            
            // 添加延迟，避免过快请求导致系统卡顿
            if (activeWorkers.size >= maxConcurrency) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 🚀 增加到200ms延迟
            }
        }
    };
    
    await processQueue();
    
    // 等待所有工作完成
    if (activeWorkers.size > 0) {
        await Promise.all(Array.from(activeWorkers));
    }
    
    return Array.from(newUrls);
}

// -------------------- URL内容获取 --------------------
async function fetchUrlContent(url) {
    try {
        //console.log(`🔥 深度扫描 - 准备通过后台脚本请求: ${url}`);
        
        const requestOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml,text/javascript,application/javascript,text/css,*/*',
                'Cache-Control': 'no-cache'
            },
            timeout: requestTimeout
        };
        
        const response = await makeRequestViaBackground(url, requestOptions);
        
        if (!response.ok) {
            console.warn(`HTTP ${response.status} for ${url}`);
            // 🔥 添加HTTP错误日志
            addLogEntry(`⚠️ HTTP ${response.status} - ${url}`, 'warning');
            return null;
        }
        
        const contentType = response.headers.get('content-type') || '';
        // 过滤非文本内容
        if (contentType.includes('image/') || 
            contentType.includes('audio/') || 
            contentType.includes('video/') || 
            contentType.includes('application/octet-stream') ||
            contentType.includes('application/zip') ||
            contentType.includes('application/pdf')) {
            // 🔥 添加内容类型过滤日志
            addLogEntry(`🚫 跳过非文本内容 (${contentType}) - ${url}`, 'info');
            return null;
        }
        
        const text = await response.text();
        // 🔥 添加成功获取内容的日志
        const contentSize = text.length;
        const sizeText = contentSize > 1024 ? `${Math.round(contentSize / 1024)}KB` : `${contentSize}B`;
        addLogEntry(`📥 成功获取内容 (${sizeText}) - ${url}`, 'info');
        return text;
        
    } catch (error) {
        console.error(`无法访问 ${url}:`, error);
        // 🔥 添加网络错误日志
        addLogEntry(`❌ 网络错误: ${error.message} - ${url}`, 'error');
        return null;
    }
}

// -------------------- 后台请求 --------------------
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
                    url: response.data.url
                });
            } else {
                reject(new Error(response?.error || 'Request failed'));
            }
        });
    });
}

// -------------------- 从内容收集URL --------------------
async function collectUrlsFromContent(content, baseUrl) {
    const urls = new Set();
    
    try {
        const extractedData = await extractFromContent(content, baseUrl);
        
        // 收集JS文件
        if (scanConfig.scanJsFiles && extractedData.jsFiles) {
            for (const jsFileItem of extractedData.jsFiles) {
                const jsFile = typeof jsFileItem === 'object' ? jsFileItem.value : jsFileItem;
                const sourceUrl = typeof jsFileItem === 'object' ? jsFileItem.sourceUrl : null;
                const fullUrl = await resolveUrl(jsFile, baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                    urls.add(fullUrl);
                }
            }
        }
        
        // 收集HTML页面
        if (scanConfig.scanHtmlFiles && extractedData.urls) {
            for (const urlItem of extractedData.urls) {
                const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, baseUrl) && isValidPageUrl(fullUrl)) {
                    urls.add(fullUrl);
                }
            }
        }
        
        // 收集API接口 - 使用智能解析
        if (scanConfig.scanApiFiles) {
            if (extractedData.absoluteApis) {
                for (const apiItem of extractedData.absoluteApis) {
                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
            
            if (extractedData.relativeApis) {
                for (const apiItem of extractedData.relativeApis) {
                    // 🔥 优先使用智能解析的 URL
                    let fullUrl;
                    if (typeof apiItem === 'object' && apiItem.resolvedUrl) {
                        fullUrl = apiItem.resolvedUrl;
                        //console.log('🎯 [DEBUG] 使用智能解析URL:', apiItem.value, '->', fullUrl);
                    } else {
                        const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                        const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                        fullUrl = await resolveUrl(api, baseUrl, sourceUrl);
                        //console.log('🔄 [DEBUG] 使用传统解析URL:', api, '->', fullUrl);
                    }
                    
                    if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 从内容收集URL失败:', error);
    }
    
    return Array.from(urls);
}

// -------------------- 结果合并 --------------------
function mergeResults(newResults) {
    // 使用批量合并，避免频繁的DOM更新
    return batchMergeResults(newResults);
}

// -------------------- 结果保存 --------------------
async function saveResultsToStorage() {
    try {
        // 生成域名键
        let domainKey = 'unknown__results';
        if (scanConfig?.baseUrl) {
            try {
                const hostname = new URL(scanConfig.baseUrl).hostname;
                domainKey = `${hostname}__results`;
            } catch (e) {
                console.warn('解析域名失败，使用默认键:', e);
            }
        }
        
        //console.log('📝 [DEBUG] 使用存储键:', domainKey);
        
        // 从IndexedDB获取当前的普通扫描结果
        const existingResults = await window.IndexedDBManager.loadScanResults(scanConfig.baseUrl) || {};
        
        // 合并深度扫描结果到普通扫描结果中
        const mergedResults = { ...existingResults };
        
        // 将深度扫描的结果合并到普通扫描结果中
        Object.keys(scanResults).forEach(key => {
            if (!mergedResults[key]) {
                mergedResults[key] = [];
            }
            
            // 创建现有结果的键集合，用于去重
            const existingKeys = new Set();
            mergedResults[key].forEach(item => {
                const itemKey = typeof item === 'object' ? item.value : item;
                existingKeys.add(itemKey);
            });
            
            // 合并新的结果项
            scanResults[key].forEach(item => {
                if (item) {
                    const itemKey = typeof item === 'object' ? item.value : item;
                    // 硬过滤：relativeApis 中剔除仅为 "/" 的无效相对路径
                    if (key === 'relativeApis' && String(itemKey ?? '').trim() === '/') {
                        // console.log('⛔ [过滤] saveResultsToStorage 跳过 "/"');
                        return;
                    }
                    if (!existingKeys.has(itemKey)) {
                        mergedResults[key].push(item);
                        existingKeys.add(itemKey);
                    }
                }
            });
        });
        
        // 添加扫描元数据
        mergedResults.scanMetadata = {
            ...existingResults.scanMetadata,
            lastScanType: 'deep',
            deepScanComplete: true,
            deepScanTimestamp: Date.now(),
            deepScanUrl: scanConfig.baseUrl,
            totalScanned: scannedUrls.size
        };
        
        // 保存合并后的结果到IndexedDB，包含URL位置信息
        const pageTitle = scanConfig.pageTitle || document.title || 'Deep Scan Results';
        // 使用基础URL作为存储键，但保持每个结果项的具体来源URL
        await window.IndexedDBManager.saveScanResults(scanConfig.baseUrl, mergedResults, scanConfig.baseUrl, pageTitle);
        
        //console.log('✅ 深度扫描结果已合并到主扫描结果中');
        //console.log('📊 存储键:', domainKey);
        console.log('📊 合并后结果统计:', {
            总数: Object.values(mergedResults).reduce((sum, arr) => {
                return sum + (Array.isArray(arr) ? arr.length : 0);
            }, 0),
            深度扫描贡献: Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0)
        });
        
    } catch (error) {
        console.error('❌ 保存结果失败:', error);
    }
}

// -------------------- 扫描完成 --------------------
async function completeScan() {
    //console.log('🎉 深度扫描完成！');
    
    // 🔥 优化：确保所有待处理结果都被合并
    flushPendingResults();
    
    const totalResults = Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const totalScanned = scannedUrls.size;
    
    addLogEntry('🎉 深度扫描完成！', 'success');
    addLogEntry(`📊 扫描统计: 扫描了 ${totalScanned} 个文件，提取了 ${totalResults} 个项目`, 'success');
    
    // 🔥 优化：减少详细统计日志，避免卡顿
    const nonEmptyCategories = Object.entries(scanResults).filter(([key, items]) => items && items.length > 0);
    if (nonEmptyCategories.length > 0) {
        const topCategories = nonEmptyCategories
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 5) // 只显示前5个最多的类别
            .map(([key, items]) => `${key}: ${items.length}个`);
        addLogEntry(`📈 主要发现: ${topCategories.join(', ')}`, 'success');
    }
    
    // 🔥 记录扫描耗时
    const scanDuration = Date.now() - (scanConfig.timestamp || Date.now());
    const durationText = scanDuration > 60000 ? 
        `${Math.floor(scanDuration / 60000)}分${Math.floor((scanDuration % 60000) / 1000)}秒` : 
        `${Math.floor(scanDuration / 1000)}秒`;
    addLogEntry(`⏱️ 扫描耗时: ${durationText}`, 'info');
    
    // 保存结果到存储（合并到主扫描结果中）
    await saveResultsToStorage();
    
    // 通知主页面深度扫描完成，让其更新显示
    try {
        chrome.runtime.sendMessage({
            action: 'deepScanComplete',
            data: {
                results: scanResults,
                totalScanned: totalScanned,
                totalResults: totalResults,
                baseUrl: scanConfig.baseUrl
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                //console.log('主页面可能已关闭，无法发送完成通知');
            } else {
                //console.log('✅ 已通知主页面深度扫描完成');
            }
        });
    } catch (error) {
        //console.log('发送完成通知失败:', error);
    }
    
    // 🔥 优化：最终更新UI
    performDisplayUpdate();
    
    // 更新进度显示
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = '✅ 深度扫描完成！';
        progressText.classList.add('success');
    }
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = '100%';
    }
    
    // 更新按钮状态
    updateButtonStates();
    
    // 🔥 优化：清理内存和缓存
    setTimeout(() => {
        cleanupMemory();
    }, 5000); // 5秒后清理内存
}

// 内存清理函数
function cleanupMemory() {
    //console.log('🧹 开始清理内存...');
    
    // 清理URL内容缓存，只保留最近的100个
    if (urlContentCache.size > 100) {
        const entries = Array.from(urlContentCache.entries());
        const toKeep = entries.slice(-100);
        urlContentCache.clear();
        toKeep.forEach(([key, value]) => urlContentCache.set(key, value));
        //console.log(`🧹 清理URL缓存，保留 ${toKeep.length} 个条目`);
    }
    
    // 清理待处理结果
    Object.keys(pendingResults).forEach(key => {
        if (pendingResults[key]) {
            pendingResults[key].clear();
        }
    });
    
    // 清理更新队列
    updateQueue.length = 0;
    
    // 清理定时器
    if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
    }
    
    //console.log('✅ 内存清理完成');
}

// -------------------- UI更新函数 --------------------
function updateButtonStates() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (isScanRunning) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.textContent = '扫描中...';
        pauseBtn.textContent = isPaused ? '继续扫描' : '暂停扫描';
    } else {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.textContent = '开始扫描';
        pauseBtn.textContent = '暂停扫描';
    }
}

function updateStatusDisplay() {
    document.getElementById('currentDepth').textContent = currentDepth;
    document.getElementById('scannedUrls').textContent = scannedUrls.size;
    document.getElementById('pendingUrls').textContent = pendingUrls.size;
    
    const totalResults = Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    document.getElementById('totalResults').textContent = totalResults;
}

function updateProgressDisplay(current, total, stage) {
    // 🚀 防抖处理：避免频繁更新进度条
    if (updateProgressDisplay.pending) return;
    updateProgressDisplay.pending = true;
    
    // 🚀 使用requestAnimationFrame延迟更新，避免阻塞滚动
    requestAnimationFrame(() => {
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');
        
        if (progressText && progressBar) {
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressText.textContent = `${stage}: ${current}/${total} (${percentage.toFixed(1)}%)`;
            progressBar.style.width = `${percentage}%`;
        }
        
        updateProgressDisplay.pending = false;
    });
}

function updateResultsDisplay() {
    // 先合并所有待处理的结果
    flushPendingResults();
    
    //console.log(`🔍 [DEBUG] 开始更新深度扫描结果显示... (第${displayUpdateCount}次更新)`);
    
    // 🔥 减少调试日志输出，避免控制台卡顿
    if (displayUpdateCount % 10 === 0) { // 每10次更新才输出详细日志
        //console.log('🔍 [DEBUG] API数据检查:');
        //console.log('  - absoluteApis:', scanResults.absoluteApis?.length || 0, '个');
        //console.log('  - relativeApis:', scanResults.relativeApis?.length || 0, '个');
        if (scanResults.absoluteApis?.length > 0) {
            //console.log('  - absoluteApis 示例:', scanResults.absoluteApis.slice(0, 3));
        }
        if (scanResults.relativeApis?.length > 0) {
            //console.log('  - relativeApis 示例:', scanResults.relativeApis.slice(0, 3));
        }
    }
    
    // 🔥 修复API显示问题：正确的元素ID映射
    const categoryMapping = {
        absoluteApis: { containerId: 'absoluteApisResult', countId: 'absoluteApisCount', listId: 'absoluteApisList' },
        relativeApis: { containerId: 'relativeApisResult', countId: 'relativeApisCount', listId: 'relativeApisList' },
        moduleApis: { containerId: 'modulePathsResult', countId: 'modulePathsCount', listId: 'modulePathsList' },
        domains: { containerId: 'domainsResult', countId: 'domainsCount', listId: 'domainsList' },
        urls: { containerId: 'urlsResult', countId: 'urlsCount', listId: 'urlsList' },
        images: { containerId: 'imagesResult', countId: 'imagesCount', listId: 'imagesList' },
        jsFiles: { containerId: 'jsFilesResult', countId: 'jsFilesCount', listId: 'jsFilesList' },
        cssFiles: { containerId: 'cssFilesResult', countId: 'cssFilesCount', listId: 'cssFilesList' },
        vueFiles: { containerId: 'vueFilesResult', countId: 'vueFilesCount', listId: 'vueFilesList' },
        emails: { containerId: 'emailsResult', countId: 'emailsCount', listId: 'emailsList' },
        phoneNumbers: { containerId: 'phoneNumbersResult', countId: 'phoneNumbersCount', listId: 'phoneNumbersList' },
        ipAddresses: { containerId: 'ipAddressesResult', countId: 'ipAddressesCount', listId: 'ipAddressesList' },
        sensitiveKeywords: { containerId: 'sensitiveKeywordsResult', countId: 'sensitiveKeywordsCount', listId: 'sensitiveKeywordsList' },
        comments: { containerId: 'commentsResult', countId: 'commentsCount', listId: 'commentsList' },
        paths: { containerId: 'pathsResult', countId: 'pathsCount', listId: 'pathsList' },
        parameters: { containerId: 'parametersResult', countId: 'parametersCount', listId: 'parametersList' },
        credentials: { containerId: 'credentialsResult', countId: 'credentialsCount', listId: 'credentialsList' },
        cookies: { containerId: 'cookiesResult', countId: 'cookiesCount', listId: 'cookiesList' },
        idKeys: { containerId: 'idKeysResult', countId: 'idKeysCount', listId: 'idKeysList' },
        companies: { containerId: 'companiesResult', countId: 'companiesCount', listId: 'companiesList' },
        jwts: { containerId: 'jwtsResult', countId: 'jwtsCount', listId: 'jwtsList' },
        githubUrls: { containerId: 'githubUrlsResult', countId: 'githubUrlsCount', listId: 'githubUrlsList' },
        bearerTokens: { containerId: 'bearerTokensResult', countId: 'bearerTokensCount', listId: 'bearerTokensList' },
        basicAuth: { containerId: 'basicAuthResult', countId: 'basicAuthCount', listId: 'basicAuthList' },
        authHeaders: { containerId: 'authHeadersResult', countId: 'authHeadersCount', listId: 'authHeadersList' },
        wechatAppIds: { containerId: 'wechatAppIdsResult', countId: 'wechatAppIdsCount', listId: 'wechatAppIdsList' },
        awsKeys: { containerId: 'awsKeysResult', countId: 'awsKeysCount', listId: 'awsKeysList' },
        googleApiKeys: { containerId: 'googleApiKeysResult', countId: 'googleApiKeysCount', listId: 'googleApiKeysList' },
        githubTokens: { containerId: 'githubTokensResult', countId: 'githubTokensCount', listId: 'githubTokensList' },
        gitlabTokens: { containerId: 'gitlabTokensResult', countId: 'gitlabTokensCount', listId: 'gitlabTokensList' },
        webhookUrls: { containerId: 'webhookUrlsResult', countId: 'webhookUrlsCount', listId: 'webhookUrlsList' },
        idCards: { containerId: 'idCardsResult', countId: 'idCardsCount', listId: 'idCardsList' },
        cryptoUsage: { containerId: 'cryptoUsageResult', countId: 'cryptoUsageCount', listId: 'cryptoUsageList' }
    };
    
    // 🔥 修复显示逻辑：使用正确的元素ID
    Object.keys(categoryMapping).forEach(key => {
        const items = scanResults[key] || [];
        const mapping = categoryMapping[key];
        
        // 🔥 优化：减少调试日志，只在必要时输出
        if (displayUpdateCount % 20 === 0) {
            //console.log(`🔍 [DEBUG] 处理类别 ${key}: ${items.length} 个项目`);
        }
        
        if (items.length > 0) {
            // 显示容器
            const resultDiv = document.getElementById(mapping.containerId);
            if (resultDiv) {
                resultDiv.style.display = 'block';
            }
            
            // 更新计数
            const countElement = document.getElementById(mapping.countId);
            if (countElement && countElement.textContent !== items.length.toString()) {
                countElement.textContent = items.length;
            }
            
            // 🔥 优化：只在列表内容真正改变时才更新DOM
            const listElement = document.getElementById(mapping.listId);
            if (listElement) {
                const currentItemCount = listElement.children.length;
                if (currentItemCount !== items.length) {
                    // 使用文档片段批量更新DOM
                    const fragment = document.createDocumentFragment();
                    items.forEach((item, index) => {
                        const li = document.createElement('li');
                        li.className = 'result-item';
                        
                        // 安全渲染：统一使用 textContent
                        let displayValue = '';
                        let titleValue = '';
                        const sourceUrl = (typeof item === 'object' && item !== null) ? item.sourceUrl : null;

                        if (typeof item === 'object' && item !== null) {
                            const itemValue = item.value || item.url || item.path || item.content || '';
                            const itemSourceUrl = item.sourceUrl || '未知';

                            displayValue = String(itemValue);
                            
                            if (key === 'relativeApis' && item.resolvedUrl) {
                                displayValue += ` → ${item.resolvedUrl}`;
                                titleValue = `原始值: ${itemValue}
智能解析: ${item.resolvedUrl}
来源: ${itemSourceUrl}`;
                            } else {
                                titleValue = `来源: ${itemSourceUrl}`;
                            }
                            
                            if (!itemValue) {
                                displayValue = JSON.stringify(item);
                                titleValue = displayValue;
                            }
                        } else {
                            displayValue = String(item);
                            titleValue = displayValue;
                        }

                        li.textContent = displayValue;
                        li.title = titleValue;

                        // 如果有来源URL，添加右键点击跳转功能
                        if (sourceUrl) {
                            li.style.cursor = 'pointer';
                            li.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                window.open(sourceUrl, '_blank');
                            });
                        }
                        
                        fragment.appendChild(li);
                    });
                    
                    // 一次性更新DOM
                    listElement.innerHTML = '';
                    listElement.appendChild(fragment);
                }
            }
        }
    });
    
    // 🔥 处理自定义正则结果 - 恢复被删除的功能
    //console.log('🔍 [DEBUG] 开始处理自定义正则结果...');
    Object.keys(scanResults).forEach(key => {
        if (key.startsWith('custom_') && scanResults[key]?.length > 0) {
            //console.log(`🎯 [DEBUG] 发现自定义正则结果: ${key}, 数量: ${scanResults[key].length}`);
            createCustomResultCategory(key, scanResults[key]);
        }
    });
    
    // 🔥 处理其他未预定义的结果类别
    Object.keys(scanResults).forEach(key => {
        // 跳过已处理的预定义类别和自定义正则
        if (!categoryMapping[key] && !key.startsWith('custom_') && scanResults[key]?.length > 0) {
            //console.log(`🆕 [DEBUG] 发现新的结果类别: ${key}, 数量: ${scanResults[key].length}`);
            createCustomResultCategory(key, scanResults[key]);
        }
    });
}

function createCustomResultCategory(key, items) {
    const resultsSection = document.getElementById('resultsSection');
    if (!resultsSection) return;
    
    let resultDiv = document.getElementById(key + 'Result');
    if (!resultDiv) {
        resultDiv = document.createElement('div');
        resultDiv.id = key + 'Result';
        resultDiv.className = 'result-category';
        
        const title = document.createElement('h3');
        // 安全构建标题：🔍 自定义-xxx ( countSpan )
        const prefixText = document.createTextNode('🔍 ');
        const nameText = document.createTextNode(key.replace('custom_', '自定义-'));
        const openParen = document.createTextNode(' (');
        const countSpan = document.createElement('span');
        countSpan.id = `${key}Count`;
        countSpan.textContent = '0';
        const closeParen = document.createTextNode(')');

        title.appendChild(prefixText);
        title.appendChild(nameText);
        title.appendChild(openParen);
        title.appendChild(countSpan);
        title.appendChild(closeParen);
        
        const list = document.createElement('ul');
        list.id = key + 'List';
        list.className = 'result-list';
        
        resultDiv.appendChild(title);
        resultDiv.appendChild(list);
        resultsSection.appendChild(resultDiv);
    }
    
    resultDiv.style.display = 'block';
    
    const countElement = document.getElementById(key + 'Count');
    if (countElement) {
        countElement.textContent = items.length;
    }
    
    const listElement = document.getElementById(key + 'List');
    if (listElement) {
        listElement.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'result-item';
            
            // 安全渲染：统一使用 textContent
            let displayValue = '';
            let titleValue = '';
            const sourceUrl = (typeof item === 'object' && item !== null) ? item.sourceUrl : null;

            if (typeof item === 'object' && item !== null) {
                const itemValue = item.value || item.url || item.path || item.content || '';
                const itemSourceUrl = item.sourceUrl || '未知';

                displayValue = String(itemValue);
                
                if (key === 'relativeApis' && item.resolvedUrl) {
                    displayValue += ` → ${item.resolvedUrl}`;
                    titleValue = `原始值: ${itemValue}
智能解析: ${item.resolvedUrl}
来源: ${itemSourceUrl}`;
                } else {
                    titleValue = `来源: ${itemSourceUrl}`;
                }
                
                if (!itemValue) {
                    displayValue = JSON.stringify(item);
                    titleValue = displayValue;
                }
            } else {
                displayValue = String(item);
                titleValue = displayValue;
            }

            li.textContent = displayValue;
            li.title = titleValue;

            // 如果有来源URL，添加右键点击跳转功能
            if (sourceUrl) {
                li.style.cursor = 'pointer';
                li.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    window.open(sourceUrl, '_blank');
                });
            }
            
            listElement.appendChild(li);
        });
    }
}

function addLogEntry(message, type = 'info') {
    const logSection = document.getElementById('logSection');
    if (!logSection) return;
    
    // 🚀 性能优化：只过滤最频繁的日志，保留重要信息
    if (type === 'info' && (
        message.includes('成功获取内容') ||
        message.includes('跳过非文本内容')
    )) {
        return; // 只跳过这些最频繁的日志
    }
    
    if (!logEntries) {
        logEntries = [];
    }
    
    // 添加到缓冲区
    if (!logBuffer) {
        logBuffer = [];
    }
    logBuffer.push({ message, type, time: new Date().toLocaleTimeString() });
    
    // 批量刷新日志（降低频率）
    if (!logFlushTimer) {
        logFlushTimer = setTimeout(() => {
            flushLogBuffer();
            logFlushTimer = null;
        }, LOG_FLUSH_INTERVAL);
    }
}

// 批量刷新日志缓冲区
function flushLogBuffer() {
    if (!logBuffer || logBuffer.length === 0) return;
    
    // 将缓冲区内容添加到主日志数组
    logEntries.push(...logBuffer);
    logBuffer = [];
    
    // 限制日志条目数量
    if (logEntries.length > maxLogEntries) {
        logEntries = logEntries.slice(-maxLogEntries);
    }
    
    // 更新显示
    updateLogDisplayVirtual();
}

// 🚀 优化的日志显示函数 - 减少DOM操作频率
function updateLogDisplay() {
    const logSection = document.getElementById('logSection');
    if (!logSection || !logEntries) return;
    
    // 🚀 防抖处理：避免频繁更新DOM
    if (updateLogDisplay.pending) return;
    updateLogDisplay.pending = true;
    
    // 只显示最近的20条日志，进一步减少DOM负载
    const recentLogs = logEntries.slice(-20);
    
    // 检查是否需要更新（避免不必要的DOM操作）
    const currentLogCount = logSection.children.length;
    if (currentLogCount === recentLogs.length) {
        updateLogDisplay.pending = false;
        return; // 没有新日志，跳过更新
    }
    
    // 🚀 使用setTimeout延迟更新，避免阻塞滚动
    setTimeout(() => {
        // 使用文档片段批量更新
        const fragment = document.createDocumentFragment();
        recentLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.type}`;
            logEntry.textContent = `[${log.time}] ${log.message}`;
            fragment.appendChild(logEntry);
        });
        
        // 使用requestAnimationFrame优化DOM更新
        requestAnimationFrame(() => {
            logSection.innerHTML = '';
            logSection.appendChild(fragment);
            
            // 🚀 优化滚动：只在必要时滚动
            if (!logSection.isUserScrolling) {
                logSection.scrollTop = logSection.scrollHeight;
            }
            
            updateLogDisplay.pending = false;
        });
    }, 100); // 100ms延迟，避免频繁更新
}

// -------------------- 工具函数 --------------------

// 辅助函数：解析相对路径
function resolveRelativePath(relativePath, basePath) {
    try {
        if (!relativePath || !basePath) return null;
        
        // 确保basePath以/结尾
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        
        // 使用URL构造函数进行标准解析
        const resolved = new URL(relativePath, basePath);
        return resolved.href;
    } catch (error) {
        console.warn('相对路径解析失败:', error);
        return null;
    }
}

async function resolveUrl(url, baseUrl, sourceUrl = null) {
    try {
        if (!url) return null;
        
        //console.log(`🔍 [URL解析] 开始解析: "${url}", 基础URL: "${baseUrl}", 源URL: "${sourceUrl}"`);
        
        // 如果已经是绝对URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            //console.log(`✅ [URL解析] 已是绝对URL: "${url}"`);
            return url;
        }
        
        if (url.startsWith('//')) {
            const result = new URL(baseUrl).protocol + url;
            //console.log(`✅ [URL解析] 协议相对URL: "${url}" -> "${result}"`);
            return result;
        }
        
        // 🔥 修复：严格按照IndexedDB数据获取提取来源路径进行相对路径解析
        if (sourceUrl && (url.startsWith('./') || url.startsWith('../') || !url.startsWith('/'))) {
            //console.log(`🔍 [URL解析] 检测到相对路径，尝试使用IndexedDB数据解析`);
            
            try {
                // 获取所有IndexedDB扫描数据
                let allScanData = [];
                
                // 方法1: 直接从IndexedDBManager获取当前域名数据
                try {
                    if (window.IndexedDBManager && window.IndexedDBManager.loadScanResults) {
                        const currentData = await window.IndexedDBManager.loadScanResults(baseUrl);
                        if (currentData && currentData.results) {
                            allScanData.push(currentData);
                            //console.log(`✅ [URL解析] 获取到当前域名数据`);
                        }
                    }
                } catch (error) {
                    console.warn('获取当前域名IndexedDB数据失败:', error);
                }
                
                // 方法2: 获取所有扫描数据作为备选
                try {
                    if (window.IndexedDBManager && window.IndexedDBManager.getAllScanResults) {
                        const allData = await window.IndexedDBManager.getAllScanResults();
                        if (Array.isArray(allData)) {
                            allScanData = allScanData.concat(allData);
                            //console.log(`✅ [URL解析] 获取到所有扫描数据，共 ${allData.length} 个`);
                        }
                    }
                } catch (error) {
                    console.warn('获取所有IndexedDB数据失败:', error);
                }
                
                if (allScanData.length > 0) {
                    // 构建sourceUrl到basePath的映射
                    const sourceUrlToBasePath = new Map();
                    
                    //console.log(`🔍 [URL解析] 开始分析 ${allScanData.length} 个扫描数据源`);
                    
                    // 遍历所有扫描数据，建立映射关系
                    allScanData.forEach((scanData, dataIndex) => {
                        if (!scanData.results) return;
                        
                        // 遍历所有类型的数据，建立 sourceUrl 映射
                        Object.values(scanData.results).forEach(items => {
                            if (Array.isArray(items)) {
                                items.forEach(item => {
                                    if (typeof item === 'object' && item.sourceUrl) {
                                        try {
                                            const sourceUrlObj = new URL(item.sourceUrl);
                                            // 提取基础路径（去掉文件名）
                                            const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                            const correctBaseUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                            sourceUrlToBasePath.set(item.sourceUrl, correctBaseUrl);
                                            
                                            //console.log(`📋 [URL解析] 映射建立: ${item.sourceUrl} → ${correctBaseUrl}`);
                                        } catch (e) {
                                            //console.warn('无效的sourceUrl:', item.sourceUrl, e);
                                        }
                                    }
                                });
                            }
                        });
                        
                        // 也添加扫描数据本身的sourceUrl作为备选
                        if (scanData.sourceUrl) {
                            try {
                                const sourceUrlObj = new URL(scanData.sourceUrl);
                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const correctBaseUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                sourceUrlToBasePath.set(scanData.sourceUrl, correctBaseUrl);
                                
                                //console.log(`📋 [URL解析] 备选映射: ${scanData.sourceUrl} → ${correctBaseUrl}`);
                            } catch (e) {
                                //console.warn('无效的备选sourceUrl:', scanData.sourceUrl, e);
                            }
                        }
                    });
                    
                    //console.log(`📊 [URL解析] 映射建立完成，共 ${sourceUrlToBasePath.size} 个映射`);
                    
                    // 🔥 方法1：精确匹配sourceUrl
                    if (sourceUrlToBasePath.has(sourceUrl)) {
                        const correctBasePath = sourceUrlToBasePath.get(sourceUrl);
                        const resolvedUrl = resolveRelativePath(url, correctBasePath);
                        if (resolvedUrl) {
                            //console.log(`🎯 [URL解析] 精确匹配成功: ${url} → ${resolvedUrl} (基于源: ${sourceUrl})`);
                            return resolvedUrl;
                        }
                    }
                    
                    // 🔥 方法2：域名匹配
                    const targetDomain = baseUrl ? new URL(baseUrl).hostname : null;
                    if (targetDomain) {
                        for (const [storedSourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                            try {
                                const sourceDomain = new URL(storedSourceUrl).hostname;
                                if (sourceDomain === targetDomain) {
                                    const testUrl = resolveRelativePath(url, basePath);
                                    if (testUrl) {
                                        //console.log(`🎯 [URL解析] 域名匹配成功: ${url} → ${testUrl} (基于源: ${storedSourceUrl})`);
                                        return testUrl;
                                    }
                                }
                            } catch (e) {
                                // 忽略无效URL
                            }
                        }
                    }
                    
                    // 🔥 方法3：尝试任何可用的源URL
                    for (const [storedSourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                        const testUrl = resolveRelativePath(url, basePath);
                        if (testUrl) {
                            //console.log(`🎯 [URL解析] 通用匹配成功: ${url} → ${testUrl} (基于源: ${storedSourceUrl})`);
                            return testUrl;
                        }
                    }
                }
                
                //console.log(`⚠️ [URL解析] IndexedDB智能解析未找到匹配，使用默认方法`);
                
            } catch (error) {
                //console.warn('IndexedDB智能路径解析失败，使用默认方法:', error);
            }
        }
        
        // 🔥 默认方法：直接基于baseUrl解析
        try {
            const resolvedUrl = new URL(url, baseUrl).href;
            //console.log(`📍 [URL解析] 默认解析: ${url} → ${resolvedUrl} (基于: ${baseUrl})`);
            return resolvedUrl;
        } catch (error) {
            console.warn('默认URL解析失败:', error);
            return null;
        }
        
    } catch (error) {
        console.warn('URL解析完全失败:', error);
        return null;
    }
}

// 检查是否为同一域名 - 支持子域名和全部域名设置
async function isSameDomain(url, baseUrl) {
    try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        
        // 获取域名扫描设置
        const domainSettings = await getDomainScanSettings();
        //console.log('🔍 [深度扫描] 当前域名设置:', domainSettings);
        //console.log('🔍 [深度扫描] 检查URL:', url, '基准URL:', baseUrl);
        
        // 如果允许扫描所有域名
        if (domainSettings.allowAllDomains) {
            //console.log(`🌐 [深度扫描] 允许所有域名: ${urlObj.hostname}`);
            addLogEntry(`🌐 允许所有域名: ${urlObj.hostname}`, 'info');
            return true;
        }
        
        // 如果允许扫描子域名
        if (domainSettings.allowSubdomains) {
            const baseHostname = baseUrlObj.hostname;
            const urlHostname = urlObj.hostname;
            
            // 检查是否为同一域名或子域名
            const isSameOrSubdomain = urlHostname === baseHostname || 
                                    urlHostname.endsWith('.' + baseHostname) ||
                                    baseHostname.endsWith('.' + urlHostname);
            
            if (isSameOrSubdomain) {
                //console.log(`🔗 [深度扫描] 允许子域名: ${urlHostname} (基于 ${baseHostname})`);
                //addLogEntry(`🔗 允许子域名: ${urlHostname}`, 'info');
                return true;
            }
        }
        
        // 默认：只允许完全相同的域名
        const isSame = urlObj.hostname === baseUrlObj.hostname;
        if (isSame) {
            //console.log(`✅ [深度扫描] 同域名: ${urlObj.hostname}`);
        } else {
            //console.log(`❌ [深度扫描] 不同域名: ${urlObj.hostname} vs ${baseUrlObj.hostname}`);
        }
        return isSame;
        
    } catch (error) {
        console.error('[深度扫描] 域名检查失败:', error);
        return false;
    }
}

// 获取域名扫描设置
async function getDomainScanSettings() {
    try {
        // 如果SettingsManager可用，使用它获取设置
        if (typeof window.SettingsManager !== 'undefined' && window.SettingsManager.getDomainScanSettings) {
            return await window.SettingsManager.getDomainScanSettings();
        }
        
        // 备用方案：直接从chrome.storage获取
        const result = await chrome.storage.local.get(['domainScanSettings']);
        const domainSettings = result.domainScanSettings || {
            allowSubdomains: false,
            allowAllDomains: false
        };
        //console.log('🔍 [深度扫描] 从storage获取的域名设置:', domainSettings);
        return domainSettings;
    } catch (error) {
        console.error('[深度扫描] 获取域名扫描设置失败:', error);
        // 默认设置：只允许同域名
        return {
            allowSubdomains: false,
            allowAllDomains: false
        };
    }
}

function isValidPageUrl(url) {
    if (!url || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
        return false;
    }
    
    const resourceExtensions = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|ttf|eot|woff2|map|pdf|zip)$/i;
    return !resourceExtensions.test(url.toLowerCase());
}

// -------------------- 导出功能 --------------------
function exportResults() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function toggleAllCategories() {
    const categories = document.querySelectorAll('.result-category');
    const hasVisible = Array.from(categories).some(cat => cat.style.display !== 'none');
    
    categories.forEach(category => {
        category.style.display = hasVisible ? 'none' : 'block';
    });
}

// -------------------- 事件监听器 --------------------
document.addEventListener('DOMContentLoaded', initializePage);

// 导出弹窗事件
document.addEventListener('click', (e) => {
    if (e.target.id === 'closeExportModal' || e.target.id === 'exportModal') {
        document.getElementById('exportModal').style.display = 'none';
    }
    
    if (e.target.id === 'exportJSON') {
        exportAsJSON();
        document.getElementById('exportModal').style.display = 'none';
    }
    
    if (e.target.id === 'exportXLS') {
        exportAsExcel();
        document.getElementById('exportModal').style.display = 'none';
    }
});

async function exportAsJSON() {
    try {
        const filename = await generateFileName('json');
        const dataStr = JSON.stringify(scanResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        link.click();
        
        addLogEntry(`✅ JSON导出成功: ${filename}`, 'success');
    } catch (error) {
        addLogEntry(`❌ JSON导出失败: ${error.message}`, 'error');
    }
}

async function exportAsExcel() {
    try {
        const filename = await generateFileName('xlsx');
        
        // 检查是否有数据可导出
        const hasData = Object.keys(scanResults).some(key => 
            scanResults[key] && Array.isArray(scanResults[key]) && scanResults[key].length > 0
        );
        
        if (!hasData) {
            addLogEntry(`⚠️ 没有数据可导出`, 'warning');
            return;
        }
        
        // 生成Excel XML格式内容
        let xlsContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>幻影工具-深度扫描</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D4EDF9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;

        // 为每个分类创建工作表
        const categories = Object.keys(scanResults);
        let dataExported = false;

        categories.forEach(category => {
            const items = scanResults[category];
            if (Array.isArray(items) && items.length > 0) {
                dataExported = true;
                const sheetName = sanitizeSheetName(category);
                
                xlsContent += `
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="400"/>
   <Column ss:Width="120"/>
   <Column ss:Width="350"/>
   <Column ss:Width="220"/>
   <Column ss:Width="160"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">序号</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">内容</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">分类</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">来源URL</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">页面标题</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">提取时间</Data></Cell>
   </Row>`;

                items.forEach((item, index) => {
                    const normalized = normalizeExportItem(item, category);
                    const extractedTime = normalized.extractedAt ? new Date(normalized.extractedAt).toLocaleString('zh-CN') : '';

                    xlsContent += `
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.value)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(category)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.sourceUrl)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.pageTitle)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(extractedTime)}</Data></Cell>
   </Row>`;
                });

                xlsContent += `
  </Table>
 </Worksheet>`;
            }
        });

        // 如果没有数据，创建一个空的工作表
        if (!dataExported) {
            xlsContent += `
 <Worksheet ss:Name="无数据">
  <Table>
   <Column ss:Width="200"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">提示</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="String">没有找到任何数据</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
        }

        xlsContent += `
</Workbook>`;

        // 创建并下载文件
        const blob = new Blob([xlsContent], { 
            type: 'application/vnd.ms-excel;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.xls`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        addLogEntry(`✅ Excel文件导出成功: ${filename}.xls`, 'success');
        
    } catch (error) {
        addLogEntry(`❌ Excel导出失败: ${error.message}`, 'error');
        console.error('Excel导出错误:', error);
    }
}

// 规范化导出条目，确保不会出现 [object Object]
function normalizeExportItem(item, category) {
    if (item == null) {
        return {
            value: '',
            category,
            sourceUrl: '',
            pageTitle: '',
            extractedAt: ''
        };
    }

    if (typeof item !== 'object') {
        return {
            value: String(item),
            category,
            sourceUrl: '',
            pageTitle: '',
            extractedAt: ''
        };
    }

    const candidates = [item.value, item.text, item.content, item.url, item.path, item.name];
    let displayValue = candidates.find(val => val !== undefined && val !== null);

    if (displayValue === undefined || displayValue === null) {
        displayValue = JSON.stringify(item);
    } else if (typeof displayValue === 'object') {
        try {
            displayValue = JSON.stringify(displayValue);
        } catch (e) {
            displayValue = String(displayValue);
        }
    }

    return {
        value: String(displayValue),
        category,
        sourceUrl: item.sourceUrl || '',
        pageTitle: item.pageTitle || '',
        extractedAt: item.extractedAt || ''
    };
}

// 清理工作表名称（Excel工作表名称有特殊字符限制）
function sanitizeSheetName(name) {
    // 移除或替换Excel不允许的字符
    let sanitized = name.replace(/[\\\/\?\*\[\]:]/g, '_');
    // 限制长度（Excel工作表名称最大31个字符）
    if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 28) + '...';
    }
    return sanitized || '未命名';
}

// XML转义函数
function escapeXml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// 生成文件名：域名__随机数
async function generateFileName(extension = 'json') {
    let domain = 'deep-scan';
    
    try {
        // 优先从扫描配置中获取目标域名
        if (scanConfig && scanConfig.baseUrl) {
            const url = new URL(scanConfig.baseUrl);
            domain = url.hostname;
            //console.log('从扫描配置获取到域名:', domain);
        } else {
            // 备选方案：从当前窗口URL参数中提取目标域名
            if (window.location && window.location.href) {
                const urlParams = new URLSearchParams(window.location.search);
                const targetUrl = urlParams.get('url');
                if (targetUrl) {
                    const url = new URL(targetUrl);
                    domain = url.hostname;
                    //console.log('从URL参数获取到域名:', domain);
                }
            }
        }
    } catch (e) {
        //console.log('获取域名失败，使用默认名称:', e);
        // 使用时间戳作为标识
        domain = `deep-scan_${Date.now()}`;
    }
    
    // 清理域名，移除特殊字符
    domain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // 生成随机数（6位）
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    
    return `${domain}__${randomNum}`;
}

/**
 * 使用虚拟滚动渲染所有结果分类：
 * - 仅渲染可视区域 + 上下缓冲
 * - 安全渲染（textContent）
 * - 同步计数
 */
function updateResultsDisplayVirtual() {
    // 先合并所有待处理的结果，保持与原逻辑一致
    flushPendingResults();

    const categoryMapping = {
        absoluteApis: { containerId: 'absoluteApisResult', countId: 'absoluteApisCount', listId: 'absoluteApisList' },
        relativeApis: { containerId: 'relativeApisResult', countId: 'relativeApisCount', listId: 'relativeApisList' },
        moduleApis: { containerId: 'modulePathsResult', countId: 'modulePathsCount', listId: 'modulePathsList' },
        domains: { containerId: 'domainsResult', countId: 'domainsCount', listId: 'domainsList' },
        urls: { containerId: 'urlsResult', countId: 'urlsCount', listId: 'urlsList' },
        images: { containerId: 'imagesResult', countId: 'imagesCount', listId: 'imagesList' },
        jsFiles: { containerId: 'jsFilesResult', countId: 'jsFilesCount', listId: 'jsFilesList' },
        cssFiles: { containerId: 'cssFilesResult', countId: 'cssFilesCount', listId: 'cssFilesList' },
        vueFiles: { containerId: 'vueFilesResult', countId: 'vueFilesCount', listId: 'vueFilesList' },
        emails: { containerId: 'emailsResult', countId: 'emailsCount', listId: 'emailsList' },
        phoneNumbers: { containerId: 'phoneNumbersResult', countId: 'phoneNumbersCount', listId: 'phoneNumbersList' },
        ipAddresses: { containerId: 'ipAddressesResult', countId: 'ipAddressesCount', listId: 'ipAddressesList' },
        sensitiveKeywords: { containerId: 'sensitiveKeywordsResult', countId: 'sensitiveKeywordsCount', listId: 'sensitiveKeywordsList' },
        comments: { containerId: 'commentsResult', countId: 'commentsCount', listId: 'commentsList' },
        paths: { containerId: 'pathsResult', countId: 'pathsCount', listId: 'pathsList' },
        parameters: { containerId: 'parametersResult', countId: 'parametersCount', listId: 'parametersList' },
        credentials: { containerId: 'credentialsResult', countId: 'credentialsCount', listId: 'credentialsList' },
        cookies: { containerId: 'cookiesResult', countId: 'cookiesCount', listId: 'cookiesList' },
        idKeys: { containerId: 'idKeysResult', countId: 'idKeysCount', listId: 'idKeysList' },
        companies: { containerId: 'companiesResult', countId: 'companiesCount', listId: 'companiesList' },
        jwts: { containerId: 'jwtsResult', countId: 'jwtsCount', listId: 'jwtsList' },
        githubUrls: { containerId: 'githubUrlsResult', countId: 'githubUrlsCount', listId: 'githubUrlsList' },
        bearerTokens: { containerId: 'bearerTokensResult', countId: 'bearerTokensCount', listId: 'bearerTokensList' },
        basicAuth: { containerId: 'basicAuthResult', countId: 'basicAuthCount', listId: 'basicAuthList' },
        authHeaders: { containerId: 'authHeadersResult', countId: 'authHeadersCount', listId: 'authHeadersList' },
        wechatAppIds: { containerId: 'wechatAppIdsResult', countId: 'wechatAppIdsCount', listId: 'wechatAppIdsList' },
        awsKeys: { containerId: 'awsKeysResult', countId: 'awsKeysCount', listId: 'awsKeysList' },
        googleApiKeys: { containerId: 'googleApiKeysResult', countId: 'googleApiKeysCount', listId: 'googleApiKeysList' },
        githubTokens: { containerId: 'githubTokensResult', countId: 'githubTokensCount', listId: 'githubTokensList' },
        gitlabTokens: { containerId: 'gitlabTokensResult', countId: 'gitlabTokensCount', listId: 'gitlabTokensList' },
        webhookUrls: { containerId: 'webhookUrlsResult', countId: 'webhookUrlsCount', listId: 'webhookUrlsList' },
        idCards: { containerId: 'idCardsResult', countId: 'idCardsCount', listId: 'idCardsList' },
        cryptoUsage: { containerId: 'cryptoUsageResult', countId: 'cryptoUsageCount', listId: 'cryptoUsageList' }
    };

    const defaultRender = (text) => {
        const li = document.createElement('div');
        li.className = 'result-item';
        li.style.display = 'block';
        li.style.boxSizing = 'border-box';
        li.style.width = '100%';
        // 可变高度：允许多行换行，避免重叠
        li.style.whiteSpace = 'normal';
        li.style.wordBreak = 'break-word';
        li.style.overflowWrap = 'anywhere';
        li.textContent = String(text);
        return li;
    };

    Object.keys(categoryMapping).forEach(key => {
        const mapping = categoryMapping[key];
        const itemsRaw = scanResults[key] || [];

        // 显示容器
        const resultDiv = document.getElementById(mapping.containerId);
        if (resultDiv) {
            resultDiv.style.display = itemsRaw.length > 0 ? 'block' : resultDiv.style.display;
            // 合成层提示
            resultDiv.style.willChange = 'transform';
            resultDiv.style.transform = resultDiv.style.transform || 'translateZ(0)';
        }

        // 计数
        const countEl = document.getElementById(mapping.countId);
        if (countEl) countEl.textContent = String(itemsRaw.length);

        // 增量渲染：缓存文本并仅对新增项追加
        // 规则：relativeApis 中剔除仅为单独 "/" 的无效相对路径
        const isTrivialSlash = (it) => {
            if (typeof it === 'object' && it) {
                const raw = (it.value || it.url || it.path || it.content || '').trim();
                return raw === '/';
            }
            return String(it || '').trim() === '/';
        };

        const toText = (it) => {
            if (typeof it === 'object' && it) {
                const val = it.value || it.url || it.path || it.content || '';
                if (key === 'relativeApis' && it.resolvedUrl) {
                    return `${String(val)} → ${String(it.resolvedUrl)}`;
                }
                return String(val || JSON.stringify(it));
            }
            return String(it);
        };

        const prevCount = __lastRenderedCounts[key] || 0;
        let itemsText = __renderedTextCache[key];

        // 如果数量减少或结构变化，进行全量重建
        if (!Array.isArray(itemsText) || itemsText.length > itemsRaw.length || prevCount > itemsRaw.length) {
            const filteredRaw = key === 'relativeApis' ? itemsRaw.filter(it => !isTrivialSlash(it)) : itemsRaw;
            itemsText = filteredRaw.map(toText);
            __renderedTextCache[key] = itemsText;
            __lastRenderedCounts[key] = itemsText.length;
            updateVirtualList(mapping.listId, itemsText, {
                itemHeight: 24,
                buffer: 8,
                renderItem: defaultRender
            });
        } else if (itemsRaw.length > prevCount) {
            // 仅追加新增部分
            let newSliceRaw = itemsRaw.slice(prevCount);
            if (key === 'relativeApis') {
                newSliceRaw = newSliceRaw.filter(it => !isTrivialSlash(it));
            }
            const newSlice = newSliceRaw.map(toText);
            itemsText.push(...newSlice);
            __lastRenderedCounts[key] = itemsRaw.length;
            updateVirtualListAppend(mapping.listId, newSlice, {
                itemHeight: 24,
                buffer: 8,
                renderItem: defaultRender
            });
        } else {
            // 无变化，跳过渲染
        }
    });

    // 处理自定义类别与未知类别（保留原有创建逻辑）
    Object.keys(scanResults).forEach(key => {
        if (key.startsWith('custom_') && Array.isArray(scanResults[key]) && scanResults[key].length > 0) {
            createCustomResultCategory(key, scanResults[key]);
        }
    });
    Object.keys(scanResults).forEach(key => {
        if (!categoryMapping[key] && !key.startsWith('custom_') && Array.isArray(scanResults[key]) && scanResults[key].length > 0) {
            createCustomResultCategory(key, scanResults[key]);
        }
    });
}

/**
 * 日志显示：自然高度完整渲染最近 maxLogEntries 条，避免固定行高导致的重叠
 */
function updateLogDisplayVirtual() {
    const logSection = document.getElementById('logSection');
    if (!logSection || !logEntries) return;

    // 合成层/独立层提示
    logSection.style.willChange = 'transform';
    logSection.style.transform = logSection.style.transform || 'translateZ(0)';

    // 渲染最近的日志（数量已由 maxLogEntries 控制）
    const recentLogs = logEntries.slice(-maxLogEntries);

    // 当前是否需要吸底（用户未在主动滚动且接近底部）
    const shouldStickToBottom = !logSection.isUserScrolling &&
        (logSection.scrollTop + logSection.clientHeight >= logSection.scrollHeight - 4);

    const frag = document.createDocumentFragment();
    for (const l of recentLogs) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        // 自然高度，允许多行换行，避免任何重叠
        div.style.display = 'block';
        div.style.boxSizing = 'border-box';
        div.style.width = '100%';
        div.style.whiteSpace = 'normal';
        div.style.wordBreak = 'break-word';
        div.style.overflowWrap = 'anywhere';
        div.textContent = `[${l.time}] ${l.message}`;
        frag.appendChild(div);
    }

    logSection.innerHTML = '';
    logSection.appendChild(frag);

    if (shouldStickToBottom) {
        logSection.scrollTop = logSection.scrollHeight;
    }
}

//console.log('✅ [DEBUG] 深度扫描窗口脚本（统一正则版本）加载完成');