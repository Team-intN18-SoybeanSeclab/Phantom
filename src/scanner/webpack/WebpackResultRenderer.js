/**
 * WebpackResultRenderer - Webpack 扫描结果渲染器
 * 负责在 UI 中展示 Webpack 扫描结果
 * 
 * @class WebpackResultRenderer
 */
class WebpackResultRenderer {
    constructor() {
        this.containerId = 'webpackResults';
    }

    /**
     * 渲染 Webpack 扫描结果
     * @param {Object} results - 包含 Webpack 检测结果的对象
     * @param {HTMLElement} container - 结果容器元素
     */
    render(results, container) {
        if (!results || !results.webpackDetection) {
            return;
        }
        
        const detection = results.webpackDetection;
        
        // 如果未检测到 Webpack，不显示
        if (!detection.detected) {
            return;
        }
        
        // 创建 Webpack 结果区域
        const webpackSection = this._createSection(results);
        
        // 插入到结果容器的开头
        if (container && webpackSection) {
            const firstChild = container.firstChild;
            if (firstChild) {
                container.insertBefore(webpackSection, firstChild);
            } else {
                container.appendChild(webpackSection);
            }
        }
    }

    /**
     * 创建 Webpack 结果区域
     * @private
     */
    _createSection(results) {
        const detection = results.webpackDetection;
        
        const section = document.createElement('div');
        section.id = this.containerId;
        section.className = 'result-section webpack-section';
        section.style.cssText = `
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        `;
        
        // 标题
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        `;
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📦</span>
                <span style="font-weight: bold; color: #8b5cf6;">Webpack 检测</span>
            </div>
            <span style="
                background: rgba(139, 92, 246, 0.2);
                color: #a78bfa;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
            ">v${detection.version || 'unknown'}</span>
        `;
        section.appendChild(header);
        
        // 基本信息
        const info = document.createElement('div');
        info.style.cssText = 'font-size: 12px; color: #9ca3af; margin-bottom: 10px;';
        info.innerHTML = `
            <div>打包模式: <span style="color: ${detection.buildMode === 'production' ? '#10b981' : '#f59e0b'}">${detection.buildMode}</span></div>
        `;
        section.appendChild(info);
        
        // 统计信息
        const stats = this._createStats(results);
        section.appendChild(stats);
        
        // 详细信息（可折叠）
        const details = this._createDetails(results);
        section.appendChild(details);
        
        return section;
    }


    /**
     * 创建统计信息
     * @private
     */
    _createStats(results) {
        const stats = document.createElement('div');
        stats.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 10px;
        `;
        
        const items = [
            { label: 'Chunks', value: results.webpackChunks?.length || 0, icon: '📄' },
            { label: 'Source Maps', value: results.webpackSourceMaps?.length || 0, icon: '🗺️' },
            { label: 'API 端点', value: results.webpackDefineConstants?.length || 0, icon: '🔗' }
        ];
        
        for (const item of items) {
            const statItem = document.createElement('div');
            statItem.style.cssText = `
                background: rgba(0, 0, 0, 0.2);
                padding: 8px;
                border-radius: 4px;
                text-align: center;
            `;
            statItem.innerHTML = `
                <div style="font-size: 14px;">${item.icon}</div>
                <div style="font-size: 16px; font-weight: bold; color: #fff;">${item.value}</div>
                <div style="font-size: 10px; color: #9ca3af;">${item.label}</div>
            `;
            stats.appendChild(statItem);
        }
        
        // 如果是 Vue + Webpack 组合，显示额外信息
        if (results.webpackDetection?.isVueWebpack) {
            const vueWebpackBadge = document.createElement('div');
            vueWebpackBadge.style.cssText = `
                grid-column: span 3;
                background: linear-gradient(135deg, rgba(66, 184, 131, 0.2), rgba(139, 92, 246, 0.2));
                border: 1px solid rgba(66, 184, 131, 0.3);
                padding: 8px;
                border-radius: 4px;
                text-align: center;
                margin-top: 8px;
            `;
            vueWebpackBadge.innerHTML = `
                <span style="color: #42b883;">🌿 Vue.js</span>
                <span style="color: #9ca3af;"> + </span>
                <span style="color: #8b5cf6;">📦 Webpack</span>
                <span style="color: #9ca3af; font-size: 11px; margin-left: 8px;">
                    ${results.vueWebpackInfo?.lazyRoutes || 0} 个懒加载路由
                </span>
            `;
            stats.appendChild(vueWebpackBadge);
        }
        
        return stats;
    }

    /**
     * 创建详细信息
     * @private
     */
    _createDetails(results) {
        const details = document.createElement('details');
        details.style.cssText = 'font-size: 12px;';
        
        const summary = document.createElement('summary');
        summary.style.cssText = 'cursor: pointer; color: #9ca3af; margin-bottom: 8px;';
        summary.textContent = '查看详情';
        details.appendChild(summary);
        
        const content = document.createElement('div');
        content.style.cssText = 'max-height: 200px; overflow-y: auto;';
        
        // Chunks 列表
        if (results.webpackChunks && results.webpackChunks.length > 0) {
            content.innerHTML += `<div style="margin-bottom: 8px; color: #a78bfa;">Chunks:</div>`;
            for (const chunk of results.webpackChunks.slice(0, 10)) {
                content.innerHTML += `<div style="color: #9ca3af; word-break: break-all; margin-left: 8px;">• ${chunk.value}</div>`;
            }
            if (results.webpackChunks.length > 10) {
                content.innerHTML += `<div style="color: #6b7280; margin-left: 8px;">... 还有 ${results.webpackChunks.length - 10} 个</div>`;
            }
        }
        
        // Source Maps 列表
        if (results.webpackSourceMaps && results.webpackSourceMaps.length > 0) {
            content.innerHTML += `<div style="margin-top: 8px; margin-bottom: 8px; color: #a78bfa;">Source Maps:</div>`;
            for (const sm of results.webpackSourceMaps.slice(0, 5)) {
                content.innerHTML += `<div style="color: #9ca3af; word-break: break-all; margin-left: 8px;">• ${sm.value}</div>`;
            }
        }
        
        details.appendChild(content);
        return details;
    }

    /**
     * 移除 Webpack 结果区域
     */
    remove() {
        const existing = document.getElementById(this.containerId);
        if (existing) {
            existing.remove();
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackResultRenderer = WebpackResultRenderer;
}
