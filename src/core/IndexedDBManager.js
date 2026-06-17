class IndexedDBManager {
    constructor() {
        this.dbName = 'PhantomScanDB';
        this.dbVersion = 2;
        this.db = null;
        this.storeName = 'scanResults';
    }


    async init() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error(' IndexedDB 打开失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;

                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(' IndexedDB 升级中...');


                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: false
                    });


                    store.createIndex('domain', 'domain', { unique: false });
                    store.createIndex('url', 'url', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });


                }


                if (!db.objectStoreNames.contains('jsScripts')) {
                    const jsStore = db.createObjectStore('jsScripts', {
                        keyPath: 'id',
                        autoIncrement: false
                    });


                    jsStore.createIndex('timestamp', 'timestamp', { unique: false });

                    console.log(' JS脚本对象存储和索引创建成功');
                }
            };
        });
    }


    generateStorageKey(url) {
        try {
            const urlObj = new URL(url);

            const key = urlObj.hostname;
            return key.replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch (error) {
            console.error('生成存储键失败:', error);
            return url.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        }
    }


    async saveScanResults(url, results, sourceUrl = null, pageTitle = null) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url);


            const actualSourceUrl = sourceUrl || url;
            const actualPageTitle = pageTitle || document.title || urlObj.hostname;
            const currentTime = new Date().toISOString();


            const transformedResults = this.dedupeResults(results, actualSourceUrl, currentTime, actualPageTitle);

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                results: transformedResults,
                sourceUrl: actualSourceUrl,
                pageTitle: actualPageTitle,
                extractedAt: currentTime,
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' 保存扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB保存操作失败:', error);
            throw error;
        }
    }


    async loadScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url);
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve({
                            results: result.results || {},
                            timestamp: result.timestamp,
                            lastSave: result.lastSave
                        });
                    } else {

                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error(' 读取扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB读取操作失败:', error);
            throw error;
        }
    }


    async deleteScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url);
            const request = store.delete(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(` 已从IndexedDB删除扫描结果: ${storageKey}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' 删除扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB删除操作失败:', error);
            throw error;
        }
    }


    async getAllScanResults() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const results = request.result || [];
                    console.log(` 获取所有扫描结果，共 ${results.length} 条记录`);
                    resolve(results);
                };

                request.onerror = () => {
                    console.error(' 获取所有扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB获取所有数据操作失败:', error);
            throw error;
        }
    }


    async getScanResultsByDomain(domain) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('domain');

            const request = index.getAll(domain);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const results = request.result || [];
                    console.log(` 获取域名 ${domain} 的扫描结果，共 ${results.length} 条记录`);
                    resolve(results);
                };

                request.onerror = () => {
                    console.error(' 按域名获取扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB按域名查询操作失败:', error);
            throw error;
        }
    }


    async clearAllScanResults() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.clear();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(' 已清空所有IndexedDB扫描结果');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' 清空扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB清空操作失败:', error);
            throw error;
        }
    }


    async getStats() {
        try {
            const allResults = await this.getAllScanResults();

            const stats = {
                totalRecords: allResults.length,
                domains: new Set(allResults.map(r => r.domain)).size,
                totalDataSize: 0,
                oldestRecord: null,
                newestRecord: null
            };

            if (allResults.length > 0) {

                stats.totalDataSize = allResults.reduce((size, record) => {
                    return size + JSON.stringify(record).length;
                }, 0);


                const timestamps = allResults.map(r => r.timestamp).sort((a, b) => a - b);
                stats.oldestRecord = new Date(timestamps[0]);
                stats.newestRecord = new Date(timestamps[timestamps.length - 1]);
            }

            return stats;

        } catch (error) {
            console.error(' 获取IndexedDB统计信息失败:', error);
            return {
                totalRecords: 0,
                domains: 0,
                totalDataSize: 0,
                oldestRecord: null,
                newestRecord: null
            };
        }
    }


    async saveDeepScanResults(url, results, sourceUrl = null, pageTitle = null) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url) + '__deep';


            const actualSourceUrl = sourceUrl || window.location.href || url;
            const actualPageTitle = pageTitle || document.title || urlObj.hostname;
            const currentTime = new Date().toISOString();


            const dedupedResults = this.dedupeResults(results, actualSourceUrl, currentTime, actualPageTitle);

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                results: dedupedResults,
                sourceUrl: actualSourceUrl,
                pageTitle: actualPageTitle,
                extractedAt: currentTime,
                type: 'deepScan',
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {

                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB保存深度扫描结果失败:', error);
            throw error;
        }
    }


    async loadDeepScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url) + '__deep';
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve({
                            results: result.results || {},
                            timestamp: result.timestamp,
                            lastSave: result.lastSave
                        });
                    } else {

                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error(' 读取深度扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB读取深度扫描结果失败:', error);
            throw error;
        }
    }


    async saveDeepScanState(url, state) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url) + '__state';

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                state: state,
                type: 'deepScanState',
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' 保存深度扫描状态失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB保存深度扫描状态失败:', error);
            throw error;
        }
    }


    async loadDeepScanState(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url) + '__state';
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve(result.state || {});
                    } else {
                        console.log(` IndexedDB中未找到深度扫描状态: ${storageKey}`);
                        resolve(null);
                    }
                };

                request.onerror = () => {

                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB读取深度扫描状态失败:', error);
            throw error;
        }
    }


    async deleteDeepScanData(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const baseKey = this.generateStorageKey(url);
            const keysToDelete = [
                baseKey + '__deep',
                baseKey + '__state'
            ];

            const promises = keysToDelete.map(key => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(key);
                    request.onsuccess = () => resolve(key);
                    request.onerror = () => reject(request.error);
                });
            });

            await Promise.all(promises);
            console.log(` 已从IndexedDB删除深度扫描数据: ${baseKey}`);
            return true;

        } catch (error) {
            console.error(' IndexedDB删除深度扫描数据失败:', error);
            throw error;
        }
    }


    async getAllDeepScanStates() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const allData = request.result || [];

                    const deepScanStates = allData
                        .filter(item => item.id && item.id.endsWith('__state') && item.type === 'deepScanState')
                        .map(item => item.state)
                        .filter(state => state && state.baseUrl)
                        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                    console.log(` 获取所有深度扫描状态: 找到 ${deepScanStates.length} 个配置`);
                    resolve(deepScanStates);
                };
                request.onerror = () => {
                    console.error(' 获取所有深度扫描状态失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' 获取所有深度扫描状态失败:', error);
            return [];
        }
    }




    async saveJSScripts(scripts) {
        try {
            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readwrite');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.put({
                    id: 'savedScripts',
                    scripts: scripts,
                    timestamp: Date.now()
                });

                request.onsuccess = () => {
                    console.log(' JS脚本保存成功，共', scripts.length, '个脚本');
                    resolve();
                };
                request.onerror = () => {
                    console.error(' JS脚本保存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS脚本保存失败:', error);
            throw error;
        }
    }


    async loadJSScripts() {
        try {

            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readonly');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.get('savedScripts');

                request.onsuccess = () => {
                    const result = request.result;


                    if (result && result.scripts) {


                        resolve(result.scripts);
                    } else {
                        console.log(' IndexedDB中未找到JS脚本数据，返回空数组');
                        resolve([]);
                    }
                };
                request.onerror = () => {
                    console.error(' JS脚本加载失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS脚本加载失败:', error);
            return [];
        }
    }


    async clearJSScripts() {
        try {
            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readwrite');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.delete('savedScripts');

                request.onsuccess = () => {
                    console.log(' JS脚本清除成功');
                    resolve();
                };
                request.onerror = () => {
                    console.error(' JS脚本清除失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS脚本清除失败:', error);
            throw error;
        }
    }


    async getRecentScanResults(limit = 10) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.getAll();

                request.onsuccess = () => {
                    const results = request.result || [];

                    const sortedResults = results.sort((a, b) => {
                        const timeA = new Date(a.extractedAt || a.timestamp || 0).getTime();
                        const timeB = new Date(b.extractedAt || b.timestamp || 0).getTime();
                        return timeB - timeA;
                    });


                    const limitedResults = sortedResults.slice(0, limit);
                    resolve(limitedResults);
                };

                request.onerror = () => {
                    console.error(' 获取最近扫描结果失败:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' 获取最近扫描结果操作失败:', error);
            return [];
        }
    }


    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log(' IndexedDB连接已关闭');
        }
    }


    dedupeResults(results, sourceUrl, currentTime, pageTitle) {
        if (!results || typeof results !== 'object') {
            return results;
        }

        const dedupedResults = {};

        for (const [key, value] of Object.entries(results)) {
            if (Array.isArray(value)) {

                const seen = new Set();
                const deduped = [];

                for (const item of value) {
                    let itemValue, itemObj;

                    if (typeof item === 'string') {
                        itemValue = item;
                        itemObj = {
                            value: item,
                            sourceUrl: sourceUrl,
                            extractedAt: currentTime,
                            pageTitle: pageTitle
                        };
                    } else if (typeof item === 'object' && item !== null) {
                        itemValue = item.value || JSON.stringify(item);
                        itemObj = {
                            ...item,
                            sourceUrl: item.sourceUrl || sourceUrl,
                            extractedAt: item.extractedAt || currentTime,
                            pageTitle: item.pageTitle || pageTitle
                        };
                    } else {
                        continue;
                    }


                    if (itemValue && !seen.has(itemValue)) {

                        if ((key === 'absoluteApis' || key === 'relativeApis') && this.isInvalidPath(itemValue)) {
                            continue;
                        }
                        seen.add(itemValue);
                        deduped.push(itemObj);
                    }
                }

                dedupedResults[key] = deduped;
            } else {

                dedupedResults[key] = value;
            }
        }


        if (dedupedResults.absoluteApis && dedupedResults.relativeApis) {
            const absoluteValues = new Set(dedupedResults.absoluteApis.map(item =>
                typeof item === 'object' ? item.value : item
            ));
            dedupedResults.relativeApis = dedupedResults.relativeApis.filter(item => {
                const value = typeof item === 'object' ? item.value : item;
                return !absoluteValues.has(value);
            });
        }

        return dedupedResults;
    }


    isInvalidPath(path) {
        if (!path || typeof path !== 'string') return true;


        if (/\/this\.[_a-zA-Z]/.test(path)) return true;


        if (/\/[_a-zA-Z]+\/[gimsuvy]+$/.test(path)) return true;


        if (/\/[A-Za-z0-9]{50,}/.test(path)) return true;


        if (/\/[a-zA-Z]+\._[a-zA-Z]/.test(path)) return true;


        if (/^\/\d+$/.test(path) || /^\/[a-zA-Z]$/.test(path)) return true;


        if (/\/[A-Z]{10,}/.test(path)) return true;


        if (/\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\(|\/|$)/.test(path)) return true;


        const segments = path.split('/');
        if (segments.some(seg => seg.length > 100)) return true;


        if (/^\/[a-zA-Z]\/[a-zA-Z]$/.test(path)) return true;

        return false;
    }
}


const indexedDBManager = new IndexedDBManager();


window.IndexedDBManager = indexedDBManager;