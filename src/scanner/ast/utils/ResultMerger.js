class ResultMerger {
    constructor(options = {}) {
        this.dedupeThreshold = options.dedupeThreshold || 0.9;
        this.boostASTConfidence = options.boostASTConfidence !== false;
    }


    merge(astResults, regexResults) {
        if (!astResults && !regexResults) return [];
        if (!astResults || astResults.length === 0) return regexResults || [];
        if (!regexResults || regexResults.length === 0) return astResults;

        const merged = [];
        const seen = new Map();


        for (const detection of astResults) {
            const key = this._getDedupeKey(detection);
            if (!seen.has(key)) {
                seen.set(key, detection);
                merged.push(detection);
            }
        }


        for (const detection of regexResults) {
            const key = this._getDedupeKey(detection);

            if (seen.has(key)) {

                const existing = seen.get(key);
                this._enrichDetection(existing, detection);
            } else {

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


    sortByConfidence(detections, order = 'desc') {
        if (!detections) return [];

        return [...detections].sort((a, b) => {
            const diff = (b.confidence || 0) - (a.confidence || 0);
            return order === 'asc' ? -diff : diff;
        });
    }


    filterByConfidence(detections, minConfidence = 0.5) {
        if (!detections) return [];
        return detections.filter(d => (d.confidence || 0) >= minConfidence);
    }


    _getDedupeKey(detection) {

        const type = detection.type || '';
        const value = (detection.value || '').substring(0, 100);
        const line = detection.location?.start?.line || 0;

        return `${type}:${value}:${line}`;
    }


    _findSimilar(detection, existing) {
        const value = detection.value || '';

        for (const item of existing) {

            if (this._similarity(value, item.value || '') >= this.dedupeThreshold) {
                return item;
            }


            if (this._locationsOverlap(detection.location, item.location)) {
                return item;
            }
        }

        return null;
    }


    _similarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1;


        if (longer.includes(shorter)) {
            return shorter.length / longer.length;
        }


        const editDistance = this._levenshtein(str1.substring(0, 50), str2.substring(0, 50));
        return 1 - editDistance / Math.max(str1.length, str2.length, 1);
    }


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


    _locationsOverlap(loc1, loc2) {
        if (!loc1 || !loc2) return false;

        const start1 = loc1.start?.line || 0;
        const end1 = loc1.end?.line || start1;
        const start2 = loc2.start?.line || 0;
        const end2 = loc2.end?.line || start2;

        return !(end1 < start2 || end2 < start1);
    }


    _enrichDetection(astDetection, regexDetection) {

        if (regexDetection.context) {
            astDetection.context = {
                ...astDetection.context,
                regexMatch: true
            };
        }


        if (this.boostASTConfidence) {
            astDetection.confidence = Math.min(1, (astDetection.confidence || 0.5) + 0.1);
        }


        astDetection.doubleVerified = true;
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResultMerger;
}
if (typeof window !== 'undefined') {
    window.ResultMerger = ResultMerger;
}
