/**
 * Webpack 扫描器错误处理工具
 */

const WebpackErrorHandler = {
    // 错误日志
    errors: [],
    
    // 最大错误数
    maxErrors: 100,
    
    /**
     * 记录错误
     * @param {string} component - 组件名称
     * @param {Error|string} error - 错误对象或消息
     * @param {Object} context - 上下文信息
     */
    logError(component, error, context = {}) {
        const errorEntry = {
            timestamp: Date.now(),
            component: component,
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : null,
            context: context
        };
        
        this.errors.push(errorEntry);
        
        // 限制错误数量
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // 输出到控制台
        console.error(`[${component}] ${errorEntry.message}`, context);
    },
    
    /**
     * 带超时的 Promise 包装
     * @param {Promise} promise - 原始 Promise
     * @param {number} timeout - 超时时间（毫秒）
     * @param {string} operation - 操作名称
     * @returns {Promise}
     */
    withTimeout(promise, timeout, operation = 'operation') {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.logError('Timeout', `${operation} 超时 (${timeout}ms)`);
                reject(new Error(`${operation} 超时`));
            }, timeout);
            
            promise
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    },
    
    /**
     * 安全执行函数
     * @param {Function} fn - 要执行的函数
     * @param {*} defaultValue - 错误时的默认返回值
     * @param {string} component - 组件名称
     * @returns {*}
     */
    safeExecute(fn, defaultValue, component = 'Unknown') {
        try {
            return fn();
        } catch (error) {
            this.logError(component, error);
            return defaultValue;
        }
    },
    
    /**
     * 安全执行异步函数
     * @param {Function} fn - 要执行的异步函数
     * @param {*} defaultValue - 错误时的默认返回值
     * @param {string} component - 组件名称
     * @returns {Promise<*>}
     */
    async safeExecuteAsync(fn, defaultValue, component = 'Unknown') {
        try {
            return await fn();
        } catch (error) {
            this.logError(component, error);
            return defaultValue;
        }
    },
    
    /**
     * 获取所有错误
     * @returns {Object[]}
     */
    getErrors() {
        return [...this.errors];
    },
    
    /**
     * 清空错误日志
     */
    clearErrors() {
        this.errors = [];
    },
    
    /**
     * 获取错误摘要
     * @returns {Object}
     */
    getSummary() {
        const byComponent = {};
        for (const error of this.errors) {
            byComponent[error.component] = (byComponent[error.component] || 0) + 1;
        }
        
        return {
            total: this.errors.length,
            byComponent: byComponent,
            lastError: this.errors[this.errors.length - 1] || null
        };
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.WebpackErrorHandler = WebpackErrorHandler;
}
