class ASTBridge {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.extractor = null;
        this.merger = null;
        this.initialized = false;
    }


    async init() {
        if (this.initialized) return true;

        try {

            if (typeof window !== 'undefined' && !window.acorn) {

                if (window.AcornLoader) {
                    await window.AcornLoader.loadAcorn();
                }
            }


            if (typeof window !== 'undefined' && window.ASTExtractor) {
                this.extractor = new window.ASTExtractor({
                    timeout: 5000,
                    cacheMaxSize: 50
                });


                this._registerVisitors();


                if (window.ResultMerger) {
                    this.merger = new window.ResultMerger();
                }

                this.initialized = true;

                return true;
            }
        } catch (error) {
            console.error(' [ASTBridge] Initialization failed:', error);
        }

        return false;
    }


    _registerVisitors() {
        if (!this.extractor) return;

        const visitors = [
            window.CredentialVisitor,
            window.APIEndpointVisitor,
            window.SensitiveFunctionVisitor,
            window.ConfigObjectVisitor,
            window.EncodedStringVisitor
        ];

        for (const Visitor of visitors) {
            if (Visitor) {
                try {
                    this.extractor.registerVisitor(new Visitor());
                } catch (e) {
                    console.warn(' [ASTBridge] Failed to register visitor:', e);
                }
            }
        }
    }


    extract(code, sourceUrl = '') {
        if (!this.enabled || !this.extractor) {
            return { success: false, detections: [], fallbackUsed: true };
        }

        return this.extractor.safeExtract(code, sourceUrl);
    }


    mergeWithRegex(astResults, regexResults) {
        if (!this.merger) {
            return { ast: astResults, regex: regexResults };
        }


        const normalizedRegex = this._normalizeRegexResults(regexResults);


        const merged = this.merger.merge(astResults, normalizedRegex);

        return {
            merged,
            astCount: astResults?.length || 0,
            regexCount: normalizedRegex.length,
            mergedCount: merged.length
        };
    }


    _normalizeRegexResults(regexResults) {
        if (!regexResults) return [];

        const normalized = [];


        const typeMap = {
            absoluteApis: 'api_endpoint',
            relativeApis: 'api_endpoint',
            domains: 'domain',
            emails: 'email',
            phones: 'phone',
            credentials: 'credential',
            ips: 'ip',
            jwts: 'jwt',
            idCards: 'id_card'
        };

        for (const [key, type] of Object.entries(typeMap)) {
            const items = regexResults[key];
            if (Array.isArray(items)) {
                for (const item of items) {
                    normalized.push({
                        type,
                        value: typeof item === 'string' ? item : item.value || String(item),
                        confidence: 0.6,
                        location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
                        context: { source: 'regex' },
                        sourceUrl: regexResults.sourceUrl || '',
                        extractedAt: new Date().toISOString()
                    });
                }
            }
        }

        return normalized;
    }


    isAvailable() {
        return this.initialized && this.extractor?.isAvailable();
    }


    getStats() {
        if (!this.extractor) return null;
        return this.extractor.getStats();
    }


    clearCache() {
        if (this.extractor) {
            this.extractor.clearCache();
        }
    }
}


if (typeof window !== 'undefined') {
    window.ASTBridge = ASTBridge;
    window.astBridge = new ASTBridge();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASTBridge;
}
