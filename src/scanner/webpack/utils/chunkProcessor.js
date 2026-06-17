const ChunkProcessor = {

    defaultChunkSize: 100 * 1024,


    async processInChunks(content, processor, options = {}) {
        const chunkSize = options.chunkSize || this.defaultChunkSize;
        const delay = options.delay || 0;
        const results = [];

        if (!content || content.length <= chunkSize) {

            const result = await processor(content, 0);
            if (result) results.push(result);
            return results;
        }


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


            if (delay > 0 && i < totalChunks - 1) {
                await this._sleep(delay);
            }
        }

        return results;
    },


    needsChunking(content, threshold = 500 * 1024) {
        return content && content.length > threshold;
    },


    getRecommendedChunkSize(content) {
        if (!content) return this.defaultChunkSize;

        const size = content.length;

        if (size < 100 * 1024) return size;
        if (size < 500 * 1024) return 100 * 1024;
        if (size < 1024 * 1024) return 200 * 1024;
        return 500 * 1024;
    },


    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};


if (typeof window !== 'undefined') {
    window.ChunkProcessor = ChunkProcessor;
}
