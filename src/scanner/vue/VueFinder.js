(function() {
    'use strict';

    const VueFinder = {

        findVueRoot(root, maxDepth = 1000) {
            if (!root) {
                return null;
            }

            const queue = [{ node: root, depth: 0 }];

            while (queue.length) {
                const { node, depth } = queue.shift();


                if (depth > maxDepth) {
                    break;
                }


                if (node.__vue_app__) {
                    return node;
                }


                if (node.__vue__) {
                    return node;
                }


                if (node._vnode) {
                    return node;
                }


                if (node.nodeType === 1 && node.childNodes) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];

                        if (child.nodeType === 1) {
                            queue.push({ node: child, depth: depth + 1 });
                        }
                    }
                }
            }

            return null;
        },


        getVueVersion(vueRoot) {
            if (!vueRoot) {
                return 'unknown';
            }

            let version = null;

            try {

                if (vueRoot.__vue_app__) {
                    version = vueRoot.__vue_app__.version;
                }


                if (!version && vueRoot.__vue__) {
                    version = vueRoot.__vue__.$root?.$options?._base?.version;
                }


                if (!version && typeof window !== 'undefined') {
                    if (window.Vue && window.Vue.version) {
                        version = window.Vue.version;
                    }

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


        detectVueType(vueRoot) {
            if (!vueRoot) {
                return null;
            }


            if (vueRoot.__vue_app__) {
                return 'vue3';
            }


            if (vueRoot.__vue__) {
                return 'vue2';
            }


            if (vueRoot._vnode) {
                return 'vue3';
            }

            return null;
        },


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


                    info.hasRouter = !!(
                        app.config?.globalProperties?.$router ||
                        app._instance?.appContext?.config?.globalProperties?.$router
                    );


                    info.hasStore = !!(
                        app.config?.globalProperties?.$store ||
                        app._instance?.appContext?.config?.globalProperties?.$store
                    );


                    info.componentName = app._component?.name || 'App';

                } else if (info.type === 'vue2' && vueRoot.__vue__) {
                    const vue = vueRoot.__vue__;


                    info.hasRouter = !!(vue.$router || vue.$root?.$router);


                    info.hasStore = !!(vue.$store || vue.$root?.$store);


                    info.componentName = vue.$options?.name || vue.$root?.$options?.name || 'Root';
                }
            } catch (e) {
                console.warn('[VueFinder] Error getting Vue info:', e);
            }

            return info;
        },


        quickDetect() {
            try {

                if (document.body.__vue_app__ || document.body.__vue__) {
                    return true;
                }


                const appElement = document.getElementById('app');
                if (appElement && (appElement.__vue_app__ || appElement.__vue__)) {
                    return true;
                }


                if (typeof window !== 'undefined' && window.Vue) {
                    return true;
                }


                if (typeof window !== 'undefined' && window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
                    return true;
                }


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


                    setTimeout(tryDetect, delay * retryCount);
                };


                const immediate = this.findVueRoot(document.body);
                if (immediate) {
                    resolve(immediate);
                } else {
                    setTimeout(tryDetect, delay);
                }
            });
        }
    };


    if (typeof window !== 'undefined') {
        window.VueFinder = VueFinder;
    }


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VueFinder;
    }

})();
