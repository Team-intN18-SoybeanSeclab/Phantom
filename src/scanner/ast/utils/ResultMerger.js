/**
 * 结果合并器
 * 合并 AST 和正则提取器的结果，去重并计算置信度
 */
class ResultMerger {
    constructor(options = {}) {
        this.dedupeThreshold = options.dedupeThreshold || 0.9;
        this.boostASTConfidence = options.boostASTConfidence !== false;
    }
    
    /**
     * 合并两个提取结果
     * @param {Array} astResults - AST 提取结果
     * @param {Array} regexResults - 正则提取结果
     * @returns {Array} 合并后的结果
     */
    merge(astResults, regexResults) {
        if (!astResults && !regexResults) return [];
        if (!astResults || astResults.length === 0) return regexResults || [];
        if (!regexResults || regexResults.length === 0) return astResults;
        
        const merged = [];
        const seen = new Map(); // value -> detection
        
        // 先处理 AST 结果（通常更准确）
        for (const detection of astResults) {
            const key = this._getDedupeKey(detection);
            if (!seen.has(key)) {
                seen.set(key, detection);
                merged.push(detection);
            }
        }
        
        // 处理正则结果
        for (const detection of regexResults) {
            const key = this._getDedupeKey(detection);
            
            if (seen.has(key)) {
                // 已存在，合并上下文信息
                const existing = seen.get(key);
                this._enrichDetection(existing, detection);
            } else {
                // 检查是否有相似的检测
                const similar = this._findSimilar(detection, merged);
                if (similar) {
                    this._enrichDetection(similar, detection);
                } else {
                    seen.set(key, detection);
                    merged.push(detection);
                }
            }
        }
        
        return merged;
    }
    
    /**
     * 去重检测结果
     * @param {Array} detections - 检测结果数组
     * @returns {Array} 去重后的结果
     */
    dedupe(detections) {
        if (!detections || detections.length === 0) return [];
        
        const seen = new Map();
        const result = [];
        
        for (const detection of detections) {
            const key = this._getDedupeKey(detection);
            
            if (!seen.has(key)) {
                seen.set(key, detection);
                result.push(detection);
            } else {
                // 保留置信度更高的
                const existing = seen.get(key);
                if (detection.confidence > existing.confidence) {
                    const index = result.indexOf(existing);
                    if (index >= 0) {
                        result[index] = detection;
                        seen.set(key, detection);
                    }
                }
            }
        }
        
        return result;
    }
    
    /**
     * 按类型分组
     * @param {Array} detections - 检测结果数组
     * @returns {Object} 按类型分组的结果
     */
    groupByType(detections) {
        if (!detections) return {};
        
        const groups = {};
        for (const detection of detections) {
            const type = detection.type || 'unknown';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(detection);
        }
        
        return groups;
    }
    
    /**
     * 按置信度排序
     * @param {Array} detections - 检测结果数组
     * @param {string} order - 排序顺序 'asc' 或 'desc'
     * @returns {Array} 排序后的结果
     */
    sortByConfidence(detections, order = 'desc') {
        if (!detections) return [];
        
        return [...detections].sort((a, b) => {
            const diff = (b.confidence || 0) - (a.confidence || 0);
            return order === 'asc' ? -diff : diff;
        });
    }
    
    /**
     * 过滤低置信度结果
     * @param {Array} detections - 检测结果数组
     * @param {number} minConfidence - 最低置信度
     * @returns {Array} 过滤后的结果
     */
    filterByConfidence(detections, minConfidence = 0.5) {
        if (!detections) return [];
        return detections.filter(d => (d.confidence || 0) >= minConfidence);
    }
    
    /**
     * 获取去重键
     */
    _getDedupeKey(detection) {
        // 使用类型+值+位置作为键
        const type = detection.type || '';
        const value = (detection.value || '').substring(0, 100);
        const line = detection.location?.start?.line || 0;
        
        return `${type}:${value}:${line}`;
    }
    
    /**
     * 查找相似的检测
     */
    _findSimilar(detection, existing) {
        const value = detection.value || '';
        
        for (const item of existing) {
            // 检查值相似度
            if (this._similarity(value, item.value || '') >= this.dedupeThreshold) {
                return item;
            }
            
            // 检查位置重叠
            if (this._locationsOverlap(detection.location, item.location)) {
                return item;
            }
        }
        
        return null;
    }
    
    /**
     * 计算字符串相似度
     */
    _similarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1;
        
        // 简单的包含检查
        if (longer.includes(shorter)) {
            return shorter.length / longer.length;
        }
        
        // Levenshtein 距离（简化版）
        const editDistance = this._levenshtein(str1.substring(0, 50), str2.substring(0, 50));
        return 1 - editDistance / Math.max(str1.length, str2.length, 1);
    }
    
    /**
     * Levenshtein 距离
     */
    _levenshtein(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        
        if (m === 0) return n;
        if (n === 0) return m;
        
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        
        return dp[m][n];
    }
    
    /**
     * 检查位置是否重叠
     */
    _locationsOverlap(loc1, loc2) {
        if (!loc1 || !loc2) return false;
        
        const start1 = loc1.start?.line || 0;
        const end1 = loc1.end?.line || start1;
        const start2 = loc2.start?.line || 0;
        const end2 = loc2.end?.line || start2;
        
        return !(end1 < start2 || end2 < start1);
    }
    
    /**
     * 用正则结果丰富 AST 检测
     */
    _enrichDetection(astDetection, regexDetection) {
        // 合并上下文信息
        if (regexDetection.context) {
            astDetection.context = {
                ...astDetection.context,
                regexMatch: true
            };
        }
        
        // 如果两者都检测到，提升置信度
        if (this.boostASTConfidence) {
            astDetection.confidence = Math.min(1, (astDetection.confidence || 0.5) + 0.1);
        }
        
        // 标记为双重验证
        astDetection.doubleVerified = true;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResultMerger;
}
if (typeof window !== 'undefined') {
    window.ResultMerger = ResultMerger;
}
