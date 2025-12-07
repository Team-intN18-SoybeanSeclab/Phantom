/**
 * 大文件分块处理工具
 */

const ChunkProcessor = {
    // 默认块大小 (100KB)
    defaultChunkSize: 100 * 1024,
    
    /**
     * 分块处理大文件内容
     * @param {string} content - 文件内容
     * @param {Function} processor - 处理函数
     * @param {Object} options - 配置选项
     * @returns {Promise<*[]>} 处理结果数组
     */
    async processInChunks(content, processor, options = {}) {
        const chunkSize = options.chunkSize || this.defaultChunkSize;
        const delay = options.delay || 0;
        const results = [];
        
        if (!content || content.length <= chunkSize) {
            // 内容较小，直接处理
            const result = await processor(content, 0);
            if (result) results.push(result);
            return results;
        }
        
        // 分块处理
        const totalChunks = Math.ceil(content.length / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, content.length);
            const chunk = content.substring(start, end);
            
            try {
                const result = await processor(chunk, i);
                if (result) {
                    if (Array.isArray(result)) {
                        results.push(...result);
                    } else {
                        results.push(result);
                    }
                }
            } catch (error) {
                console.warn(`[ChunkProcessor] 处理块 ${i + 1}/${totalChunks} 失败:`, error);
            }
            
            // 添加延迟，避免阻塞
            if (delay > 0 && i < totalChunks - 1) {
                await this._sleep(delay);
            }
        }
        
        return results;
    },
    
    /**
     * 检测文件大小是否需要分块
     * @param {string} content - 文件内容
     * @param {number} threshold - 阈值（字节）
     * @returns {boolean}
     */
    needsChunking(content, threshold = 500 * 1024) {
        return content && content.length > threshold;
    },
    
    /**
     * 获取推荐的块大小
     * @param {string} content - 文件内容
     * @returns {number}
     */
    getRecommendedChunkSize(content) {
        if (!content) return this.defaultChunkSize;
        
        const size = content.length;
        
        if (size < 100 * 1024) return size;  // < 100KB
        if (size < 500 * 1024) return 100 * 1024;  // < 500KB
        if (size < 1024 * 1024) return 200 * 1024;  // < 1MB
        return 500 * 1024;  // >= 1MB
    },
    
    /**
     * 延迟函数
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.ChunkProcessor = ChunkProcessor;
}
