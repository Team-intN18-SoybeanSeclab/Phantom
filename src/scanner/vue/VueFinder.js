/**
 * VueFinder - Vue 实例查找模块
 * 
 * 负责在 DOM 中查找 Vue 实例，支持 Vue 2 和 Vue 3
 * 
 * 功能：
 * - 广度优先搜索查找 Vue 根实例
 * - 检测 Vue 版本
 * - 识别 Vue 类型（Vue 2 / Vue 3）
 */

(function() {
    'use strict';

    const VueFinder = {
        /**
         * 广度优先查找 Vue 根实例
         * 
         * @param {HTMLElement} root - 搜索起始节点，通常是 document.body
         * @param {number} maxDepth - 最大搜索深度，默认 1000
         * @returns {HTMLElement|null} 找到的 Vue 根元素，未找到返回 null
         */
        findVueRoot(root, maxDepth = 1000) {
            if (!root) {
                return null;
            }

            const queue = [{ node: root, depth: 0 }];
            
            while (queue.length) {
                const { node, depth } = queue.shift();
                
                // 超过最大深度，停止搜索
                if (depth > maxDepth) {
                    break;
                }

                // 检测 Vue 3 实例 (__vue_app__)
                if (node.__vue_app__) {
                    return node;
                }

                // 检测 Vue 2 实例 (__vue__)
                if (node.__vue__) {
                    return node;
                }

                // 检测 Vue 3 vnode
                if (node._vnode) {
                    return node;
                }

                // 继续遍历子节点
                if (node.nodeType === 1 && node.childNodes) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];
                        // 只处理元素节点
                        if (child.nodeType === 1) {
                            queue.push({ node: child, depth: depth + 1 });
                        }
                    }
                }
            }

            return null;
        },

        /**
         * 获取 Vue 版本
         * 
         * @param {HTMLElement} vueRoot - Vue 根元素
         * @returns {string} Vue 版本号，未知返回 'unknown'
         */
        getVueVersion(vueRoot) {
            if (!vueRoot) {
                return 'unknown';
            }

            let version = null;

            try {
                // Vue 3: 从 __vue_app__ 获取版本
                if (vueRoot.__vue_app__) {
                    version = vueRoot.__vue_app__.version;
                }

                // Vue 2: 从 __vue__ 获取版本
                if (!version && vueRoot.__vue__) {
                    version = vueRoot.__vue__.$root?.$options?._base?.version;
                }

                // 尝试从全局 Vue 对象获取
                if (!version && typeof window !== 'undefined') {
                    if (window.Vue && window.Vue.version) {
                        version = window.Vue.version;
                    }
                    // 尝试从 Vue DevTools 获取
                    else if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__ &&
                             window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue) {
                        version = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue.version;
                    }
                }
            } catch (e) {
                console.warn('[VueFinder] Error getting Vue version:', e);
            }

            return version || 'unknown';
        },

        /**
         * 检测 Vue 类型（Vue 2 或 Vue 3）
         * 
         * @param {HTMLElement} vueRoot - Vue 根元素
         * @returns {'vue2'|'vue3'|null} Vue 类型，未检测到返回 null
         */
        detectVueType(vueRoot) {
            if (!vueRoot) {
                return null;
            }

            // Vue 3 检测
            if (vueRoot.__vue_app__) {
                return 'vue3';
            }

            // Vue 2 检测
            if (vueRoot.__vue__) {
                return 'vue2';
            }

            // 通过 _vnode 判断（Vue 3）
            if (vueRoot._vnode) {
                return 'vue3';
            }

            return null;
        },

        /**
         * 获取 Vue 实例详细信息
         * 
         * @param {HTMLElement} vueRoot - Vue 根元素
         * @returns {Object} Vue 实例信息
         */
        getVueInfo(vueRoot) {
            const info = {
                detected: false,
                type: null,
                version: 'unknown',
                hasRouter: false,
                hasStore: false,
                componentName: null
            };

            if (!vueRoot) {
                return info;
            }

            info.type = this.detectVueType(vueRoot);
            info.detected = info.type !== null;
            info.version = this.getVueVersion(vueRoot);

            try {
                if (info.type === 'vue3' && vueRoot.__vue_app__) {
                    const app = vueRoot.__vue_app__;
                    
                    // 检查是否有 Router
                    info.hasRouter = !!(
                        app.config?.globalProperties?.$router ||
                        app._instance?.appContext?.config?.globalProperties?.$router
                    );
                    
                    // 检查是否有 Store (Vuex/Pinia)
                    info.hasStore = !!(
                        app.config?.globalProperties?.$store ||
                        app._instance?.appContext?.config?.globalProperties?.$store
                    );

                    // 获取根组件名称
                    info.componentName = app._component?.name || 'App';

                } else if (info.type === 'vue2' && vueRoot.__vue__) {
                    const vue = vueRoot.__vue__;
                    
                    // 检查是否有 Router
                    info.hasRouter = !!(vue.$router || vue.$root?.$router);
                    
                    // 检查是否有 Store
                    info.hasStore = !!(vue.$store || vue.$root?.$store);

                    // 获取根组件名称
                    info.componentName = vue.$options?.name || vue.$root?.$options?.name || 'Root';
                }
            } catch (e) {
                console.warn('[VueFinder] Error getting Vue info:', e);
            }

            return info;
        },

        /**
         * 快速检测页面是否使用 Vue
         * 不进行深度遍历，只检查常见位置
         * 
         * @returns {boolean} 是否检测到 Vue
         */
        quickDetect() {
            try {
                // 检查 document.body
                if (document.body.__vue_app__ || document.body.__vue__) {
                    return true;
                }

                // 检查 #app 元素（Vue 常用挂载点）
                const appElement = document.getElementById('app');
                if (appElement && (appElement.__vue_app__ || appElement.__vue__)) {
                    return true;
                }

                // 检查全局 Vue 对象
                if (typeof window !== 'undefined' && window.Vue) {
                    return true;
                }

                // 检查 Vue DevTools hook
                if (typeof window !== 'undefined' && window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
                    return true;
                }

                // 检查第一层子元素
                const children = document.body.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].__vue_app__ || children[i].__vue__) {
                        return true;
                    }
                }

                return false;
            } catch (e) {
                console.warn('[VueFinder] Quick detect error:', e);
                return false;
            }
        },

        /**
         * 延迟检测 Vue（用于处理异步加载的 Vue 应用）
         * 
         * @param {number} delay - 延迟时间（毫秒）
         * @param {number} maxRetries - 最大重试次数
         * @returns {Promise<HTMLElement|null>} Vue 根元素
         */
        delayedDetect(delay = 300, maxRetries = 3) {
            return new Promise((resolve) => {
                let retryCount = 0;

                const tryDetect = () => {
                    const vueRoot = this.findVueRoot(document.body);
                    
                    if (vueRoot) {
                        resolve(vueRoot);
                        return;
                    }

                    retryCount++;
                    if (retryCount >= maxRetries) {
                        resolve(null);
                        return;
                    }

                    // 递增延迟时间
                    setTimeout(tryDetect, delay * retryCount);
                };

                // 首次立即尝试
                const immediate = this.findVueRoot(document.body);
                if (immediate) {
                    resolve(immediate);
                } else {
                    setTimeout(tryDetect, delay);
                }
            });
        }
    };

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.VueFinder = VueFinder;
    }

    // Node.js 环境导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueFinder;
    }

})();
