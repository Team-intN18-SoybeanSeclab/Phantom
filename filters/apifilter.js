class APIFilter {
    constructor() {
        this.regexCache = this.initRegexCache();
        this.config = this.initConfig();

        this.domainPhoneFilter = window.domainPhoneFilter || (typeof DomainPhoneFilter !== 'undefined' ? new DomainPhoneFilter() : null);
    }

    initRegexCache() {
        return {

            coordPattern: /^coord/,
            valuePattern: /^\/|true|false|register|signUp|name|basic|http/i,
            chinesePattern: /^[\u4e00-\u9fa5]+$/,
            keywordPattern: /^func|variable|input|true|false|newline|null|http|unexpected|error|data|object|brac|beare|str|self|void|num|atom|opts|token|params|result|con|text|stor|sup|pun|emp|this|key|com|ent|met|opera|return|case|pare|ident|reg|invalid/i,
            camelCasePattern: /\b[_a-z]+(?:[A-Z][a-z]+)+\b/,


            fontPattern: /\.(woff|woff2|ttf|eot|otf)(\?.*)?$/i,
            imagePattern: /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp|tiff)(\?.*)?$/i,
            jsPattern: /\.(js|jsx|ts|tsx|vue|mjs|cjs)(\?.*)?$/i,
            cssPattern: /\.(css|scss|sass|less|styl)(\?.*)?$/i,
            docPattern: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md)(\?.*)?$/i,
            audioPattern: /\.(mp3|wav|ogg|m4a|aac|flac|wma)(\?.*)?$/i,
            videoPattern: /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)(\?.*)?$/i,


            apiPathPattern: /^\/(?:api|admin|manage|backend|service|rest|graphql|v\d+)\//,
            dynamicApiPattern: /\.(php|asp|aspx|jsp|do|action)(\?.*)?$/i,
            queryApiPattern: /\?[^#\s]+/,


            relativeModulePattern: /^\.{1,2}\//,
            nodeModulePattern: /node_modules/,


            staticResourcePattern: /^(audio|blots|core|ace|icon|css|formats|image|js|modules|text|themes|ui|video|static|attributors|application)/,
            shortPathPattern: /^.{1,4}$/,
            invalidCharsPattern: /[A-Z\.\/\#\+\?23]/,


            domainPattern: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?/i,
            cnMobilePattern: /(?<!\d)(?:1(3([0-35-9]\d|4[1-8])|4[14-9]\d|5(\d\d|7[1-79])|66\d|7[2-35-8]\d|8\d{2}|9[89]\d)\d{7})(?!\d)/,
            intlMobilePattern: /(?<!\d)(?:\+\d{1,3}[\s-]?)?\d{6,14}(?!\d)/,
            emailPattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        };
    }

    initConfig() {
        return {

            filteredContentTypes: [
                'text/css', 'text/javascript', 'application/javascript',
                'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml',
                'font/woff', 'font/woff2', 'application/font-woff',
                'audio/mpeg', 'video/mp4', 'application/octet-stream'
            ],


            minPathLength: 2,
            maxPathLength: 500,


            apiKeywords: [
                'api', 'admin', 'manage', 'backend', 'service', 'rest',
                'graphql', 'ajax', 'json', 'xml', 'data', 'query',
                'search', 'upload', 'download', 'export', 'import'
            ],


            excludedPrefixes: [
                'chrome-extension://', 'moz-extension://', 'about:',
                'data:', 'javascript:', 'mailto:', 'tel:', 'ftp:'
            ],


            invalidDomainSuffixes: new Set([
                'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'woff', 'woff2',
                'ttf', 'eot', 'mp3', 'mp4', 'webm', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt',
                'pptx', 'zip', 'rar', 'tar', 'gz', '7z', 'exe', 'dll', 'bin', 'iso', 'dmg', 'apk',
                'ts', 'jsx', 'vue', 'scss', 'less', 'sass', 'json', 'xml', 'csv', 'md', 'txt',
                'log', 'bak', 'tmp', 'temp', 'swf', 'flv', 'avi', 'mov', 'wmv', 'mkv'
            ])
        };
    }


    filterAPI(match, resultsSet) {

        const cleanPath = this.cleanPath(match);
        if (!cleanPath) return false;


        if (!this.isValidPath(cleanPath)) return false;


        if (this.regexCache.fontPattern.test(cleanPath)) {
            return false;
        }


        if (this.classifyFileType(cleanPath, resultsSet)) {
            return true;
        }


        if (this.isFilteredContentType(cleanPath)) {
            return false;
        }


        return this.classifyAndProcessPath(cleanPath, resultsSet);
    }


    cleanPath(path) {
        if (!path || typeof path !== 'string') return null;


        let cleaned = path.replace(/^['"`]|['"`]$/g, '');


        if (this.config.excludedPrefixes.some(prefix => cleaned.startsWith(prefix))) {
            return null;
        }


        if (cleaned.length < this.config.minPathLength ||
            cleaned.length > this.config.maxPathLength) {
            return null;
        }

        return cleaned;
    }


    isValidPath(path) {

        if (!path || path.trim() === '') return false;


        if (path.length <= 4 && this.regexCache.invalidCharsPattern.test(path.slice(1))) {
            return false;
        }


        if (this.regexCache.staticResourcePattern.test(path)) {
            return false;
        }

        return true;
    }


    classifyFileType(path, resultsSet) {
        const classifications = [
            { pattern: this.regexCache.imagePattern, set: 'imageFiles' },
            { pattern: this.regexCache.jsPattern, set: 'jsFiles' },
            { pattern: this.regexCache.cssPattern, set: 'cssFiles' },
            { pattern: this.regexCache.docPattern, set: 'docFiles' },
            { pattern: this.regexCache.audioPattern, set: 'audioFiles' },
            { pattern: this.regexCache.videoPattern, set: 'videoFiles' }
        ];

        for (const { pattern, set } of classifications) {
            if (pattern.test(path)) {
                resultsSet?.[set]?.add(path);
                return true;
            }
        }

        return false;
    }


    isStaticResource(path) {
        return this.regexCache.imagePattern.test(path) ||
               this.regexCache.jsPattern.test(path) ||
               this.regexCache.cssPattern.test(path) ||
               this.regexCache.docPattern.test(path) ||
               this.regexCache.audioPattern.test(path) ||
               this.regexCache.videoPattern.test(path) ||
               this.regexCache.fontPattern.test(path);
    }


    isFilteredContentType(path) {
        const lowerPath = path.toLowerCase();
        return this.config.filteredContentTypes.some(type =>
            lowerPath.includes(type.toLowerCase())
        );
    }


    classifyAndProcessPath(path, resultsSet) {

        if (path.endsWith('.vue')) {
            resultsSet?.vueFiles?.add(path);
            return true;
        }


        if (this.isModulePath(path)) {
            resultsSet?.moduleFiles?.add(path);
            return true;
        }


        if (path.startsWith('/')) {
            return this.processAbsolutePath(path, resultsSet);
        }


        return this.processRelativePath(path, resultsSet);
    }


    isModulePath(path) {
        return this.regexCache.relativeModulePattern.test(path) ||
               this.regexCache.nodeModulePattern.test(path);
    }


    processAbsolutePath(path, resultsSet) {

        if (path.length <= 4 && this.regexCache.invalidCharsPattern.test(path.slice(1))) {
            return false;
        }


        if (this.isStaticResource(path)) {
            this.classifyFileType(path, resultsSet);
            return true;
        }


        if (this.isAPIPath(path)) {
            resultsSet?.absoluteApis?.add(path);
            return true;
        }


        if (this.regexCache.dynamicApiPattern.test(path) ||
            this.regexCache.queryApiPattern.test(path)) {
            resultsSet?.absoluteApis?.add(path);
            return true;
        }


        resultsSet?.absolutePaths?.add(path);
        return true;
    }


    processRelativePath(path, resultsSet) {

        if (path.length <= 4) return false;


        if (this.regexCache.staticResourcePattern.test(path)) {
            return false;
        }


        if (this.isStaticResource(path)) {
            this.classifyFileType(path, resultsSet);
            return true;
        }


        if (this.isAPIPath(path)) {
            resultsSet?.relativeApis?.add(path);
            return true;
        }


        if (this.regexCache.dynamicApiPattern.test(path) ||
            this.regexCache.queryApiPattern.test(path)) {
            resultsSet?.relativeApis?.add(path);
            return true;
        }


        resultsSet?.relativePaths?.add(path);
        return true;
    }


    isAPIPath(path) {

        if (this.isStaticResource(path)) {
            return false;
        }

        if (this.regexCache.apiPathPattern.test(path)) {
            return true;
        }


        const lowerPath = path.toLowerCase();
        return this.config.apiKeywords.some(keyword =>
            lowerPath.includes(`/${keyword}/`) ||
            lowerPath.includes(`${keyword}.`) ||
            lowerPath.startsWith(`${keyword}/`)
        );
    }


    batchFilter(paths, resultsSet = null) {
        if (!resultsSet) {
            resultsSet = this.createEmptyResultSet();
        }

        let processed = 0;
        let filtered = 0;

        paths.forEach(path => {
            processed++;
            if (this.filterAPI(path, resultsSet)) {

            } else {
                filtered++;
            }
        });

        return {
            processed,
            filtered,
            results: this.convertSetsToArrays(resultsSet)
        };
    }


    createEmptyResultSet() {
        return {
            absoluteApis: new Set(),
            relativeApis: new Set(),
            absolutePaths: new Set(),
            relativePaths: new Set(),
            moduleFiles: new Set(),
            jsFiles: new Set(),
            cssFiles: new Set(),
            imageFiles: new Set(),
            audioFiles: new Set(),
            videoFiles: new Set(),
            docFiles: new Set(),
            vueFiles: new Set(),

            domains: new Set(),
            phoneNumbers: new Set(),
            emails: new Set()
        };
    }


    convertSetsToArrays(resultsSet) {
        const result = {};
        Object.keys(resultsSet).forEach(key => {
            if (resultsSet[key] instanceof Set) {
                result[key] = Array.from(resultsSet[key]);
            } else {
                result[key] = resultsSet[key];
            }
        });
        return result;
    }


    getStats(resultsSet) {
        const stats = {};
        Object.keys(resultsSet).forEach(key => {
            if (resultsSet[key] instanceof Set) {
                stats[key] = resultsSet[key].size;
            } else if (Array.isArray(resultsSet[key])) {
                stats[key] = resultsSet[key].length;
            }
        });
        return stats;
    }


    extractSensitiveInfo(text, resultsSet = null) {
        if (!resultsSet) {
            resultsSet = this.createEmptyResultSet();
        }

        if (!text || typeof text !== 'string') {
            return this.convertSetsToArrays(resultsSet);
        }

        try {

            if (this.domainPhoneFilter) {

                const domainMatches = this.extractDomainsFromText(text);
                if (domainMatches && domainMatches.length > 0) {

                    const validDomains = this.domainPhoneFilter.filterDomains(domainMatches);
                    validDomains.forEach(domain => resultsSet.domains.add(domain));
                }


                const phoneMatches = this.extractPhonesFromText(text);
                if (phoneMatches && phoneMatches.length > 0) {

                    const validPhones = this.domainPhoneFilter.filterPhones(phoneMatches, true);
                    validPhones.forEach(phone => resultsSet.phoneNumbers.add(phone));
                }


                const emailMatches = this.extractEmailsFromText(text);
                if (emailMatches && emailMatches.length > 0) {

                    const validEmails = this.domainPhoneFilter.filterEmails(emailMatches);
                    validEmails.forEach(email => resultsSet.emails.add(email));
                }
            } else {

                this.extractDomainsWithRegex(text, resultsSet);
                this.extractPhonesWithRegex(text, resultsSet);
                this.extractEmailsWithRegex(text, resultsSet);
            }
        } catch (error) {
            console.error('Error extracting sensitive info:', error);
        }

        return this.convertSetsToArrays(resultsSet);
    }


    extractDomainsFromText(text) {
        const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?/gi;
        const matches = [];
        let match;

        while ((match = domainRegex.exec(text)) !== null) {

            let domain = match[1] || match[0];
            domain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
            domain = domain.split('/')[0].split('?')[0].split('#')[0];

            if (domain && domain.includes('.')) {
                matches.push(domain);
            }
        }

        return matches;
    }


    extractPhonesFromText(text) {
        const matches = [];


        const cnPhoneRegex = /(?<!\d)(?:1(3([0-35-9]\d|4[1-8])|4[14-9]\d|5(\d\d|7[1-79])|66\d|7[2-35-8]\d|8\d{2}|9[89]\d)\d{7})(?!\d)/g;
        let cnMatch;
        while ((cnMatch = cnPhoneRegex.exec(text)) !== null) {
            matches.push(cnMatch[0]);
        }


        const intlPhoneRegex = /(?<!\d)(?:\+\d{1,3}[\s-]?)?\d{6,15}(?!\d)/g;
        let intlMatch;
        while ((intlMatch = intlPhoneRegex.exec(text)) !== null) {

            if (!matches.includes(intlMatch[0])) {
                matches.push(intlMatch[0]);
            }
        }

        return matches;
    }


    extractEmailsFromText(text) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = [];
        let match;

        while ((match = emailRegex.exec(text)) !== null) {
            matches.push(match[0]);
        }

        return matches;
    }


    extractDomainsWithRegex(text, resultsSet) {
        const matches = text.match(this.regexCache.domainPattern) || [];

        for (let match of matches) {

            match = match.trim();


            match = match.replace(/^https?:\/\//i, '');


            match = match.split('/')[0].split('?')[0].split('#')[0];


            if (this.isValidDomainName(match)) {
                resultsSet.domains.add(match);
            }
        }
    }


    isValidDomainName(domain) {
        if (!domain || typeof domain !== 'string') return false;


        if (domain.length < 4 || domain.length > 253) {
            return false;
        }


        if (!domain.includes('.')) return false;


        const parts = domain.split('.');
        const tld = parts[parts.length - 1].toLowerCase();


        if (this.config.invalidDomainSuffixes.has(tld)) {
            return false;
        }


        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) {
            return false;
        }

        return true;
    }


    extractPhonesWithRegex(text, resultsSet) {

        const cnMatches = text.match(this.regexCache.cnMobilePattern) || [];
        for (let match of cnMatches) {
            if (this.isValidChinesePhoneNumber(match)) {
                resultsSet.phoneNumbers.add(match);
            }
        }
    }


    isValidChinesePhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return false;


        const cleaned = phone.replace(/\D/g, '');


        if (cleaned.length !== 11 || !cleaned.startsWith('1')) {
            return false;
        }


        const secondDigit = parseInt(cleaned.charAt(1));
        if (secondDigit < 3 || secondDigit > 9) {
            return false;
        }


        if (/^1(?:0{10}|1{10}|2{10}|3{10}|4{10}|5{10}|6{10}|7{10}|8{10}|9{10})$/.test(cleaned)) {
            return false;
        }


        if (/^1(?:0123456789|9876543210)$/.test(cleaned)) {
            return false;
        }

        return true;
    }


    isValidInternationalPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return false;


        const cleaned = phone.replace(/[\s\-\(\)]/g, '');


        if (cleaned.length < 10 || cleaned.length > 15) {
            return false;
        }


        if (/^(\+?)\d*(\d)\2{8,}$/.test(cleaned)) {
            return false;
        }


        if (/^(\+?)\d*(?:0123456789|9876543210)/.test(cleaned)) {
            return false;
        }

        return true;
    }


    extractEmailsWithRegex(text, resultsSet) {
        const matches = text.match(this.regexCache.emailPattern) || [];

        for (let match of matches) {
            if (this.isValidEmailAddress(match)) {
                resultsSet.emails.add(match);
            }
        }
    }


    isValidEmailAddress(email) {
        if (!email || typeof email !== 'string') return false;


        if (!this.regexCache.emailPattern.test(email)) {
            return false;
        }


        const [localPart, domain] = email.split('@');


        if (localPart.length > 64) {
            return false;
        }


        if (!this.isValidDomainName(domain)) {
            return false;
        }

        return true;
    }
}


window.APIFilter = APIFilter;


window.apiFilter = new APIFilter();


window.SCANNER_FILTER = window.SCANNER_FILTER || {};
window.SCANNER_FILTER.api = function(match, resultsSet) {
    return window.apiFilter.filterAPI(match, resultsSet);
};


window.SCANNER_FILTER.extractSensitiveInfo = function(text, resultsSet) {
    return window.apiFilter.extractSensitiveInfo(text, resultsSet);
};