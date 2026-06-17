const WebpackErrorHandler = {

    errors: [],


    maxErrors: 100,


    logError(component, error, context = {}) {
        const errorEntry = {
            timestamp: Date.now(),
            component: component,
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : null,
            context: context
        };

        this.errors.push(errorEntry);


        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }


        console.error(`[${component}] ${errorEntry.message}`, context);
    },


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


    safeExecute(fn, defaultValue, component = 'Unknown') {
        try {
            return fn();
        } catch (error) {
            this.logError(component, error);
            return defaultValue;
        }
    },


    async safeExecuteAsync(fn, defaultValue, component = 'Unknown') {
        try {
            return await fn();
        } catch (error) {
            this.logError(component, error);
            return defaultValue;
        }
    },


    getErrors() {
        return [...this.errors];
    },


    clearErrors() {
        this.errors = [];
    },


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


if (typeof window !== 'undefined') {
    window.WebpackErrorHandler = WebpackErrorHandler;
}
