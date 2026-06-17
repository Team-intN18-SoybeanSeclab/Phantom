class SettingsManager {
    constructor() {
        this.defaultRegexPatterns = {

            absoluteApi: [
                '(?<![\\w/\\\\.-])(?:/[\\w.-]+(?:/[\\w.-]+)+|/[\\w.-]+\\.\\w+|[a-zA-Z]:[/\\\\][\\w\\s.-]+(?:[/\\\\][\\w\\s.-]+)+|\\\\\\\\[\\w.-]+(?:[/\\\\][\\w.-]+)+)(?![\\w/\\\\])'
            ].join('|'),


            relativeApi: [
                '(?<![\\w/\\\\-])(?:\\.{1,2}/)+(?:[^/ \\t\\r\\n<>|"\\\']+/)*[^/ \\t\\r\\n<>|"\\\']*(?![\\w/\\\\])'
            ].join('|'),


            domain: [
                '(?<!\\w)(?:[a-zA-Z0-9-]{2,}\\.)+(?:xin|com|cn|net|com\\.cn|vip|top|cc|shop|club|wang|xyz|luxe|site|news|pub|fun|online|win|red|loan|ren|mom|net\\.cn|org|link|biz|bid|help|tech|date|mobi|so|me|tv|co|vc|pw|video|party|pics|website|store|ltd|ink|trade|live|wiki|space|gift|lol|work|band|info|click|photo|market|tel|social|press|game|kim|org\\.cn|games|pro|men|love|studio|rocks|asia|group|science|design|software|engineer|lawyer|fit|beer|tw|我爱你|中国|公司|网络|在线|网址|网店|集团|中文网)(?=\\b|(?::\\d{1,5})?(?:\\/|$))(?![.\\w])'
            ].join('|'),


            email: [
                '([a-zA-Z0-9\\._\\-]*@[a-zA-Z0-9\\._\\-]{1,63}\\.((?!js|css|jpg|jpeg|png|ico)[a-zA-Z]{2,}))'
            ].join('|'),


            phone: [
                '(?<![\\d.])(?:13\\d|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18\\d|19[0-35-9])\\d{8}(?!\\d)'
            ].join('|'),


            ip: [
                '(?<![\\d.])(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?::\\d{1,5})?(?![\\d.])'
            ].join('|'),



            idCard: [
                '(?<![0-9a-zA-Z])[1-9]\\d{5}(?:18|19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx](?![0-9a-zA-Z])'
            ].join('|'),


            jwt: [
                'eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}'
            ].join('|'),


            bearerToken: [
                '[Bb]earer\\s+[a-zA-Z0-9\\-=._+/\\\\]{20,500}'
            ].join('|'),


            basicAuth: [
                '[Bb]asic\\s+[A-Za-z0-9+/]{18,}={0,2}'
            ].join('|'),


            authHeader: [
                '["\'\\\[]*[Aa]uthorization["\'\\\]]*\\s*[:=]\\s*[\'"]?\\b(?:[Tt]oken\\s+)?[a-zA-Z0-9\\-_+/]{20,500}[\'"]?'
            ].join('|'),


            wechatAppId: [
                '[\'"](wx[a-z0-9]{15,18})[\'"]',
                '[\'"](ww[a-z0-9]{15,18})[\'"]'
            ].join('|'),


            githubToken: [
                '((ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,255})'
            ].join('|'),


            gitlabToken: [
                'glpat-[a-zA-Z0-9\\-=_]{20,22}'
            ].join('|'),


            awsKey: [
                '(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}',
                'LTAI[A-Za-z\\d]{12,30}',
                'AKID[A-Za-z\\d]{13,40}',
                'JDC_[0-9A-Z]{25,40}',
                '(?:AKLT|AKTP)[a-zA-Z0-9]{35,50}',
                'APID[a-zA-Z0-9]{32,42}'
            ].join('|'),


            googleApiKey: [
                'AIza[0-9A-Za-z_\\-]{35}'
            ].join('|'),


            webhookUrls: [
                'https:\\/\\/qyapi\\.weixin\\.qq\\.com\\/cgi\\-bin\\/webhook\\/send\\?key=[a-zA-Z0-9\\-]{25,50}',
                'https:\\/\\/oapi\\.dingtalk\\.com\\/robot\\/send\\?access_token=[a-z0-9]{50,80}',
                'https:\\/\\/open\\.feishu\\.cn\\/open\\-apis\\/bot\\/v2\\/hook\\/[a-z0-9\\-]{25,50}',
                'https:\\/\\/hooks\\.slack\\.com\\/services\\/[a-zA-Z0-9\\-_]{6,12}\\/[a-zA-Z0-9\\-_]{6,12}\\/[a-zA-Z0-9\\-_]{15,24}'
            ].join('|'),


            cryptoUsage: [
                '\\b(?:CryptoJS\\.(?:AES|DES)|Base64\\.(?:encode|decode)|btoa|atob|JSEncrypt|rsa|KJUR|\\$\\.md5|md5|sha1|sha256|sha512)(?:\\.\\w+)*\\s*\\([^)]*\\)'
            ].join('|'),


            sensitive: [

                'github[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?oauth[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?api[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?access[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?client[_-]?secret["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',

                'aws[_-]?access[_-]?key[_-]?id["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'aws[_-]?secret[_-]?access[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'aws[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'awssecretkey["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',

                'google[_-]?api[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'google[_-]?client[_-]?secret["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'google[_-]?maps[_-]?api[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',

                '[\\w_-]*?password[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?token[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?secret[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?accesskey[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?bucket[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',

                '-{5}BEGIN[\\s\\S]*?-{5}END[\\s\\S]*?-{5}',

                'huawei\\.oss\\.(ak|sk|bucket\\.name|endpoint|local\\.path)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',

                'stripe[_-]?(secret|private|publishable)[-_]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'slack[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'twilio[_-]?(token|sid|api[_-]?key|api[_-]?secret)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'firebase[_-]?(token|key|api[_-]?token)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'mailgun[_-]?(api[_-]?key|secret[_-]?api[_-]?key)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'docker[_-]?(token|password|key|hub[_-]?password)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'npm[_-]?(token|api[_-]?key|auth[_-]?token|password)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?'
            ].join('|'),


            github: [
                'https?://github\\.com/[a-zA-Z0-9_\\-\\.]+/[a-zA-Z0-9_\\-\\.]+'
            ].join('|'),


            vue: [
                '["\'][^"\']*\\.vue["\']'
            ].join('|'),


            company: [

            '(?:[\\u4e00-\\u9fa5\\（\\）]{4,15}(?:公司|中心))',
            '(?:[\\u4e00-\\u9fa5]{2,15}(?:软件|科技|集团))',


            '[A-Z][a-zA-Z\\s]{2,30}(?:Inc|Corp|LLC|Ltd|Company|Group|Technology|Systems)',


            '(?:公司|集团|企业|有限责任公司|股份有限公司|科技|网络|信息|技术)[\\u4e00-\\u9fa5]{2,20}(?:公司|集团|企业|有限责任公司|股份有限公司)'
            ].join('|'),


            comment: [
            '<!--(?![\\s\\S]*?Performance optimized)[\\s\\S]*?(?!<|=|\\*)-->',
            '/\\*(?![\\s\\S]*?Performance optimized)(?![\\s\\S]*External (?:script|stylesheet):)[\\s\\S]*?(?!<|=|\\*)\\*/',
            '(?:^|[^\\w"\'\':=/])(?!.*Performance optimized)(?!.*External (?:script|stylesheet))//(?!=|\\*|<)((?:(?!<|=|\\*)[^])*?)(?=<|$)'
            ].join('|')
        };

        this.REGEX_CONFIG_VERSION = 2;

        this.init();
    }


    init() {
        this.bindEvents();
        this.loadSettings();
        this.loadVendorJsSettings();
    }


    bindEvents() {

        document.getElementById('addHeaderBtn')?.addEventListener('click', () => this.addHeaderInput());
        document.getElementById('getCookieBtn')?.addEventListener('click', () => this.getCurrentCookie());
        document.getElementById('saveHeadersBtn')?.addEventListener('click', () => this.saveHeaders());
        document.getElementById('clearHeadersBtn')?.addEventListener('click', () => this.clearHeaders());


        document.getElementById('saveRegexBtn')?.addEventListener('click', () => this.saveRegexConfig());
        document.getElementById('resetRegexBtn')?.addEventListener('click', () => this.resetRegexConfig());


        document.getElementById('clearAllDataBtn')?.addEventListener('click', () => this.clearAllData());


        document.getElementById('allowSubdomains')?.addEventListener('change', () => this.saveDomainScanSettings());
        document.getElementById('allowAllDomains')?.addEventListener('change', () => this.saveDomainScanSettings());


        document.getElementById('saveVueSettingsBtn')?.addEventListener('click', () => this.saveVueDetectorSettings());

        document.getElementById('saveVendorJsSettingsBtn')?.addEventListener('click', () => this.saveVendorJsSettings());
    }

    async loadVendorJsSettings() {
        try {
            const result = await chrome.storage.local.get(['vendorJsFilterSettings']);
            const s = result.vendorJsFilterSettings || { enabled: true, patterns: [] };
            const enabledEl = document.getElementById('skipVendorJs');
            const patternsEl = document.getElementById('customVendorPatterns');
            if (enabledEl) enabledEl.checked = s.enabled !== false;
            if (patternsEl) patternsEl.value = (s.patterns || []).join('\n');
        } catch (error) {
            console.error('加载第三方库屏蔽设置失败:', error);
        }
    }

    async saveVendorJsSettings() {
        try {
            const enabledEl = document.getElementById('skipVendorJs');
            const patternsEl = document.getElementById('customVendorPatterns');
            const patterns = (patternsEl ? patternsEl.value : '')
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            const vendorJsFilterSettings = {
                enabled: enabledEl ? enabledEl.checked : true,
                patterns
            };
            await chrome.storage.local.set({ vendorJsFilterSettings });
            this.showMessage('第三方库屏蔽设置已保存！', 'success');
            window.dispatchEvent(new CustomEvent('vendorJsFilterSettingsUpdated', {
                detail: vendorJsFilterSettings
            }));
        } catch (error) {
            console.error('保存第三方库屏蔽设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
    }


    async loadSettings() {
        try {

            const result = await chrome.storage.local.get(['phantomHeaders', 'phantomRegexConfig', 'regexSettings', 'domainScanSettings', 'regexConfigVersion']);


            this.loadHeaders(result.phantomHeaders || []);


            const regexConfig = result.phantomRegexConfig || this.defaultRegexPatterns;


            if (!result.regexSettings || result.regexConfigVersion !== this.REGEX_CONFIG_VERSION) {
                const regexSettings = {
                    absoluteApis: regexConfig.absoluteApi || this.defaultRegexPatterns.absoluteApi,
                    relativeApis: regexConfig.relativeApi || this.defaultRegexPatterns.relativeApi,
                    domains: regexConfig.domain || this.defaultRegexPatterns.domain,
                    emails: regexConfig.email || this.defaultRegexPatterns.email,
                    phoneNumbers: regexConfig.phone || this.defaultRegexPatterns.phone,
                    credentials: regexConfig.sensitive || this.defaultRegexPatterns.sensitive,
                    ipAddresses: regexConfig.ip || this.defaultRegexPatterns.ip,
                    jwts: regexConfig.jwt || this.defaultRegexPatterns.jwt,
                    githubUrls: regexConfig.github || this.defaultRegexPatterns.github,
                    vueFiles: regexConfig.vue || this.defaultRegexPatterns.vue,
                    companies: regexConfig.company || this.defaultRegexPatterns.company,
                    comments: regexConfig.comment || this.defaultRegexPatterns.comment,

                    idCards: regexConfig.idCard || this.defaultRegexPatterns.idCard,
                    bearerTokens: regexConfig.bearerToken || this.defaultRegexPatterns.bearerToken,
                    basicAuth: regexConfig.basicAuth || this.defaultRegexPatterns.basicAuth,
                    authHeaders: regexConfig.authHeader || this.defaultRegexPatterns.authHeader,
                    wechatAppIds: regexConfig.wechatAppId || this.defaultRegexPatterns.wechatAppId,
                    awsKeys: regexConfig.awsKey || this.defaultRegexPatterns.awsKey,
                    googleApiKeys: regexConfig.googleApiKey || this.defaultRegexPatterns.googleApiKey,
                    githubTokens: regexConfig.githubToken || this.defaultRegexPatterns.githubToken,
                    gitlabTokens: regexConfig.gitlabToken || this.defaultRegexPatterns.gitlabToken,
                    webhookUrls: regexConfig.webhookUrls || this.defaultRegexPatterns.webhookUrls,
                    cryptoUsage: regexConfig.cryptoUsage || this.defaultRegexPatterns.cryptoUsage
                };
                await chrome.storage.local.set({ regexSettings, regexConfigVersion: this.REGEX_CONFIG_VERSION });


                this.notifyConfigUpdate(regexSettings);
            }
            document.getElementById('absoluteApiRegex').value = regexConfig.absoluteApi || this.defaultRegexPatterns.absoluteApi;
            document.getElementById('relativeApiRegex').value = regexConfig.relativeApi || this.defaultRegexPatterns.relativeApi;
            document.getElementById('domainRegex').value = regexConfig.domain || this.defaultRegexPatterns.domain;
            document.getElementById('emailRegex').value = regexConfig.email || this.defaultRegexPatterns.email;
            document.getElementById('phoneRegex').value = regexConfig.phone || this.defaultRegexPatterns.phone;
            document.getElementById('sensitiveRegex').value = regexConfig.sensitive || this.defaultRegexPatterns.sensitive;
            document.getElementById('ipRegex').value = regexConfig.ip || this.defaultRegexPatterns.ip;
            document.getElementById('jwtRegex').value = regexConfig.jwt || this.defaultRegexPatterns.jwt;
            document.getElementById('githubRegex').value = regexConfig.github || this.defaultRegexPatterns.github;
            document.getElementById('vueRegex').value = regexConfig.vue || this.defaultRegexPatterns.vue;
            document.getElementById('companyRegex').value = regexConfig.company || this.defaultRegexPatterns.company;
            document.getElementById('commentRegex').value = regexConfig.comment || this.defaultRegexPatterns.comment;


            document.getElementById('idCardRegex').value = regexConfig.idCard || this.defaultRegexPatterns.idCard;
            document.getElementById('bearerTokenRegex').value = regexConfig.bearerToken || this.defaultRegexPatterns.bearerToken;
            document.getElementById('basicAuthRegex').value = regexConfig.basicAuth || this.defaultRegexPatterns.basicAuth;
            document.getElementById('authHeaderRegex').value = regexConfig.authHeader || this.defaultRegexPatterns.authHeader;
            document.getElementById('wechatAppIdRegex').value = regexConfig.wechatAppId || this.defaultRegexPatterns.wechatAppId;
            document.getElementById('awsKeyRegex').value = regexConfig.awsKey || this.defaultRegexPatterns.awsKey;
            document.getElementById('googleApiKeyRegex').value = regexConfig.googleApiKey || this.defaultRegexPatterns.googleApiKey;
            document.getElementById('githubTokenRegex').value = regexConfig.githubToken || this.defaultRegexPatterns.githubToken;
            document.getElementById('gitlabTokenRegex').value = regexConfig.gitlabToken || this.defaultRegexPatterns.gitlabToken;
            document.getElementById('webhookUrlsRegex').value = regexConfig.webhookUrls || this.defaultRegexPatterns.webhookUrls;
            document.getElementById('cryptoUsageRegex').value = regexConfig.cryptoUsage || this.defaultRegexPatterns.cryptoUsage;


            const domainScanSettings = result.domainScanSettings || {
                allowSubdomains: false,
                allowAllDomains: false
            };

            const allowSubdomainsEl = document.getElementById('allowSubdomains');
            const allowAllDomainsEl = document.getElementById('allowAllDomains');

            if (allowSubdomainsEl) {
                allowSubdomainsEl.checked = domainScanSettings.allowSubdomains;
            }
            if (allowAllDomainsEl) {
                allowAllDomainsEl.checked = domainScanSettings.allowAllDomains;
            }


            await this.loadVueDetectorSettings();

        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }


    async loadVueDetectorSettings() {
        try {
            const result = await chrome.storage.local.get(['vueDetectorSettings']);
            const vueSettings = result.vueDetectorSettings || {
                enabled: true,
                enableGuardPatch: true,
                enableAuthPatch: true,
                timeout: 3000
            };

            const enabledEl = document.getElementById('vueDetectionEnabled');
            const guardPatchEl = document.getElementById('vueGuardPatch');
            const authPatchEl = document.getElementById('vueAuthPatch');
            const timeoutEl = document.getElementById('vueDetectionTimeout');

            if (enabledEl) enabledEl.checked = vueSettings.enabled !== false;
            if (guardPatchEl) guardPatchEl.checked = vueSettings.enableGuardPatch !== false;
            if (authPatchEl) authPatchEl.checked = vueSettings.enableAuthPatch !== false;
            if (timeoutEl) timeoutEl.value = vueSettings.timeout || 3000;

        } catch (error) {
            console.error('加载 Vue 检测设置失败:', error);
        }
    }


    async saveVueDetectorSettings() {
        try {
            const enabledEl = document.getElementById('vueDetectionEnabled');
            const guardPatchEl = document.getElementById('vueGuardPatch');
            const authPatchEl = document.getElementById('vueAuthPatch');
            const timeoutEl = document.getElementById('vueDetectionTimeout');

            const vueSettings = {
                enabled: enabledEl ? enabledEl.checked : true,
                enableGuardPatch: guardPatchEl ? guardPatchEl.checked : true,
                enableAuthPatch: authPatchEl ? authPatchEl.checked : true,
                timeout: timeoutEl ? parseInt(timeoutEl.value) || 3000 : 3000
            };

            await chrome.storage.local.set({ vueDetectorSettings: vueSettings });

            this.showMessage('Vue 检测设置已保存！', 'success');


            window.dispatchEvent(new CustomEvent('vueDetectorSettingsUpdated', {
                detail: vueSettings
            }));

        } catch (error) {
            console.error('保存 Vue 检测设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
    }


    async saveDomainScanSettings() {
        try {
            const allowSubdomainsEl = document.getElementById('allowSubdomains');
            const allowAllDomainsEl = document.getElementById('allowAllDomains');

            const domainScanSettings = {
                allowSubdomains: allowSubdomainsEl ? allowSubdomainsEl.checked : false,
                allowAllDomains: allowAllDomainsEl ? allowAllDomainsEl.checked : false
            };


            if (domainScanSettings.allowAllDomains && allowSubdomainsEl) {
                allowSubdomainsEl.checked = true;
                domainScanSettings.allowSubdomains = true;
            }

            await chrome.storage.local.set({ domainScanSettings });

            let message = '域名扫描设置已保存！';
            if (domainScanSettings.allowAllDomains) {
                message += ' 已启用所有域名扫描（包含子域名）';
            } else if (domainScanSettings.allowSubdomains) {
                message += ' 已启用子域名扫描';
            } else {
                message += ' 已限制为同域名扫描';
            }

            this.showMessage(message, 'success');


            window.dispatchEvent(new CustomEvent('domainScanSettingsUpdated', {
                detail: domainScanSettings
            }));

        } catch (error) {
            console.error('保存域名扫描设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
    }


    async getCurrentCookie() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                this.showMessage('无法获取当前标签页信息', 'error');
                return;
            }

            const url = new URL(tab.url);
            const cookies = await chrome.cookies.getAll({ domain: url.hostname });

            if (cookies.length === 0) {
                this.showMessage('当前网站没有Cookie', 'warning');
                return;
            }

            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');


            this.addHeaderInput('Cookie', cookieString);
            this.showMessage('Cookie已添加为请求头', 'success');

        } catch (error) {
            console.error('获取Cookie失败:', error);
            this.showMessage('获取Cookie失败: ' + error.message, 'error');
        }
    }


    async saveRegexSettings() {
        try {
            const regexSettings = {};


            const regexItems = document.querySelectorAll('.regex-item');
            regexItems.forEach(item => {
                const textarea = item.querySelector('textarea');
                const category = textarea.id.replace('regex-', '');
                regexSettings[category] = textarea.value.trim();
            });


            await chrome.storage.local.set({ regexSettings });




            if (window.patternExtractor) {
                await window.patternExtractor.loadCustomPatterns();

            }

            this.showMessage('正则表达式设置保存成功！配置已生效', 'success');

        } catch (error) {
            console.error('保存正则表达式设置失败:', error);
            this.showMessage('保存正则表达式设置失败: ' + error.message, 'error');
        }
    }


    async saveRegexConfig() {
        try {
            const regexConfig = {
                absoluteApi: document.getElementById('absoluteApiRegex').value.trim(),
                relativeApi: document.getElementById('relativeApiRegex').value.trim(),
                domain: document.getElementById('domainRegex').value.trim(),
                email: document.getElementById('emailRegex').value.trim(),
                phone: document.getElementById('phoneRegex').value.trim(),
                sensitive: document.getElementById('sensitiveRegex').value.trim(),
                ip: document.getElementById('ipRegex').value.trim(),
                jwt: document.getElementById('jwtRegex').value.trim(),
                github: document.getElementById('githubRegex').value.trim(),
                vue: document.getElementById('vueRegex').value.trim(),
                company: document.getElementById('companyRegex').value.trim(),
                comment: document.getElementById('commentRegex').value.trim(),

                idCard: document.getElementById('idCardRegex').value.trim(),
                bearerToken: document.getElementById('bearerTokenRegex').value.trim(),
                basicAuth: document.getElementById('basicAuthRegex').value.trim(),
                authHeader: document.getElementById('authHeaderRegex').value.trim(),
                wechatAppId: document.getElementById('wechatAppIdRegex').value.trim(),
                awsKey: document.getElementById('awsKeyRegex').value.trim(),
                googleApiKey: document.getElementById('googleApiKeyRegex').value.trim(),
                githubToken: document.getElementById('githubTokenRegex').value.trim(),
                gitlabToken: document.getElementById('gitlabTokenRegex').value.trim(),
                webhookUrls: document.getElementById('webhookUrlsRegex').value.trim(),
                cryptoUsage: document.getElementById('cryptoUsageRegex').value.trim()
            };


            for (const [key, pattern] of Object.entries(regexConfig)) {
                if (pattern) {
                    try {
                        new RegExp(pattern, 'gi');
                    } catch (e) {
                        this.showMessage(`${key}正则表达式格式错误: ${e.message}`, 'error');
                        return;
                    }
                }
            }


            const regexSettings = {
                absoluteApis: regexConfig.absoluteApi || this.defaultRegexPatterns.absoluteApi,
                relativeApis: regexConfig.relativeApi || this.defaultRegexPatterns.relativeApi,
                domains: regexConfig.domain || this.defaultRegexPatterns.domain,
                emails: regexConfig.email || this.defaultRegexPatterns.email,
                phoneNumbers: regexConfig.phone || this.defaultRegexPatterns.phone,
                credentials: regexConfig.sensitive || this.defaultRegexPatterns.sensitive,
                ipAddresses: regexConfig.ip || this.defaultRegexPatterns.ip,
                jwts: regexConfig.jwt || this.defaultRegexPatterns.jwt,
                githubUrls: regexConfig.github || this.defaultRegexPatterns.github,
                vueFiles: regexConfig.vue || this.defaultRegexPatterns.vue,
                companies: regexConfig.company || this.defaultRegexPatterns.company,
                comments: regexConfig.comment || this.defaultRegexPatterns.comment,

                idCards: regexConfig.idCard || this.defaultRegexPatterns.idCard,
                bearerTokens: regexConfig.bearerToken || this.defaultRegexPatterns.bearerToken,
                basicAuth: regexConfig.basicAuth || this.defaultRegexPatterns.basicAuth,
                authHeaders: regexConfig.authHeader || this.defaultRegexPatterns.authHeader,
                wechatAppIds: regexConfig.wechatAppId || this.defaultRegexPatterns.wechatAppId,
                awsKeys: regexConfig.awsKey || this.defaultRegexPatterns.awsKey,
                googleApiKeys: regexConfig.googleApiKey || this.defaultRegexPatterns.googleApiKey,
                githubTokens: regexConfig.githubToken || this.defaultRegexPatterns.githubToken,
                gitlabTokens: regexConfig.gitlabToken || this.defaultRegexPatterns.gitlabToken,
                webhookUrls: regexConfig.webhookUrls || this.defaultRegexPatterns.webhookUrls,
                cryptoUsage: regexConfig.cryptoUsage || this.defaultRegexPatterns.cryptoUsage
            };


            await chrome.storage.local.set({
                phantomRegexConfig: regexConfig,
                regexSettings: regexSettings
            });



            this.showMessage('正则配置保存成功', 'success');


            this.notifyConfigUpdate(regexSettings);

        } catch (error) {
            console.error('保存正则配置失败:', error);
            this.showMessage('保存正则配置失败: ' + error.message, 'error');
        }
    }


    async resetRegexConfig() {
        try {

            const absoluteApiRegex = document.getElementById('absoluteApiRegex');
            const relativeApiRegex = document.getElementById('relativeApiRegex');

            if (absoluteApiRegex) {
                absoluteApiRegex.value = this.defaultRegexPatterns.absoluteApi;
            }
            if (relativeApiRegex) {
                relativeApiRegex.value = this.defaultRegexPatterns.relativeApi;
            }


            const regexElements = [
                { id: 'domainRegex', pattern: 'domain' },
                { id: 'emailRegex', pattern: 'email' },
                { id: 'phoneRegex', pattern: 'phone' },
                { id: 'sensitiveRegex', pattern: 'sensitive' },
                { id: 'ipRegex', pattern: 'ip' },
                { id: 'jwtRegex', pattern: 'jwt' },
                { id: 'githubRegex', pattern: 'github' },
                { id: 'vueRegex', pattern: 'vue' },
                { id: 'companyRegex', pattern: 'company' },
                { id: 'commentRegex', pattern: 'comment' },
                { id: 'idCardRegex', pattern: 'idCard' },
                { id: 'bearerTokenRegex', pattern: 'bearerToken' },
                { id: 'basicAuthRegex', pattern: 'basicAuth' },
                { id: 'authHeaderRegex', pattern: 'authHeader' },
                { id: 'wechatAppIdRegex', pattern: 'wechatAppId' },
                { id: 'awsKeyRegex', pattern: 'awsKey' },
                { id: 'googleApiKeyRegex', pattern: 'googleApiKey' },
                { id: 'githubTokenRegex', pattern: 'githubToken' },
                { id: 'gitlabTokenRegex', pattern: 'gitlabToken' },
                { id: 'webhookUrlsRegex', pattern: 'webhookUrls' },
                { id: 'cryptoUsageRegex', pattern: 'cryptoUsage' }
            ];

            regexElements.forEach(({ id, pattern }) => {
                const element = document.getElementById(id);
                if (element && this.defaultRegexPatterns[pattern]) {
                    element.value = this.defaultRegexPatterns[pattern];
                }
            });


            const regexSettings = {
                absoluteApis: this.defaultRegexPatterns.absoluteApi,
                relativeApis: this.defaultRegexPatterns.relativeApi,
                domains: this.defaultRegexPatterns.domain,
                emails: this.defaultRegexPatterns.email,
                phoneNumbers: this.defaultRegexPatterns.phone,
                credentials: this.defaultRegexPatterns.sensitive,
                ipAddresses: this.defaultRegexPatterns.ip,
                jwts: this.defaultRegexPatterns.jwt,
                githubUrls: this.defaultRegexPatterns.github,
                vueFiles: this.defaultRegexPatterns.vue,
                companies: this.defaultRegexPatterns.company,
                comments: this.defaultRegexPatterns.comment,

                idCards: this.defaultRegexPatterns.idCard,
                bearerTokens: this.defaultRegexPatterns.bearerToken,
                basicAuth: this.defaultRegexPatterns.basicAuth,
                authHeaders: this.defaultRegexPatterns.authHeader,
                wechatAppIds: this.defaultRegexPatterns.wechatAppId,
                awsKeys: this.defaultRegexPatterns.awsKey,
                googleApiKeys: this.defaultRegexPatterns.googleApiKey,
                githubTokens: this.defaultRegexPatterns.githubToken,
                gitlabTokens: this.defaultRegexPatterns.gitlabToken,
                webhookUrls: this.defaultRegexPatterns.webhookUrls,
                cryptoUsage: this.defaultRegexPatterns.cryptoUsage
            };


            await chrome.storage.local.set({
                phantomRegexConfig: this.defaultRegexPatterns,
                regexSettings: regexSettings
            });



            this.showMessage('正则配置已重置为默认值', 'success');


            this.notifyConfigUpdate(regexSettings);

        } catch (error) {
            console.error('重置正则配置失败:', error);
            this.showMessage('重置正则配置失败: ' + error.message, 'error');
        }
    }


    notifyConfigUpdate(regexSettings) {



        if (window.patternExtractor) {



            window.patternExtractor.patterns = {};
            window.patternExtractor.customPatternsLoaded = false;


            if (typeof window.patternExtractor.updatePatterns === 'function') {
                window.patternExtractor.updatePatterns(regexSettings);

            } else {
                console.warn(' [SettingsManager] PatternExtractor.updatePatterns方法不存在');
            }
        } else {
            console.warn(' [SettingsManager] PatternExtractor未找到');
        }


        window.dispatchEvent(new CustomEvent('regexConfigUpdated', {
            detail: regexSettings
        }));


    }


    addHeaderInput(key = '', value = '') {
        const container = document.getElementById('headersContainer');
        if (!container) return;

        const headerGroup = document.createElement('div');
        headerGroup.className = 'header-input-group';

        headerGroup.innerHTML = `
            <input type="text" class="header-key-input" placeholder="请求头名称 (如: Authorization)" value="${key}">
            <input type="text" class="header-value-input" placeholder="请求头值 (如: Bearer token123)" value="${value}">
            <button class="remove-header-btn">删除</button>
        `;


        const removeBtn = headerGroup.querySelector('.remove-header-btn');
        removeBtn.addEventListener('click', () => {
            headerGroup.remove();

            this.saveHeaders();
        });

        container.appendChild(headerGroup);
    }


    loadHeaders(headers) {
        const container = document.getElementById('headersContainer');
        if (!container) return;


        container.innerHTML = '';


        if (!headers || headers.length === 0) {
            this.addHeaderInput();
            return;
        }


        headers.forEach(header => {
            this.addHeaderInput(header.key, header.value);
        });
    }


    async saveHeaders() {
        try {
            const headerInputs = document.querySelectorAll('.header-input-group');
            const headers = [];

            headerInputs.forEach(group => {
                const keyInput = group.querySelector('.header-key-input');
                const valueInput = group.querySelector('.header-value-input');


                if (keyInput && valueInput && keyInput.value && valueInput.value) {
                    const key = keyInput.value.trim();
                    const value = valueInput.value.trim();

                    if (key && value) {
                        headers.push({ key, value });
                    }
                }
            });

            await chrome.storage.local.set({ phantomHeaders: headers });
            this.showMessage(`已保存 ${headers.length} 个请求头`, 'success');

        } catch (error) {
            console.error('保存请求头失败:', error);
            this.showMessage('保存请求头失败: ' + error.message, 'error');
        }
    }


    async clearHeaders() {
        try {
            const container = document.getElementById('headersContainer');
            if (container) {
                container.innerHTML = '';
                this.addHeaderInput();
            }

            await chrome.storage.local.remove('phantomHeaders');
            this.showMessage('请求头已清空', 'success');

        } catch (error) {
            console.error('清空请求头失败:', error);
            this.showMessage('清空请求头失败: ' + error.message, 'error');
        }
    }


    async getHeadersSetting() {
        try {
            const result = await chrome.storage.local.get('phantomHeaders');
            return result.phantomHeaders || [];
        } catch (error) {
            console.error('获取请求头设置失败:', error);
            return [];
        }
    }


    async getCookieSetting() {
        try {

            const headers = await this.getHeadersSetting();
            const cookieHeader = headers.find(header =>
                header.key.toLowerCase() === 'cookie'
            );

            if (cookieHeader) {
                return cookieHeader.value;
            }


            const result = await chrome.storage.local.get('phantomCookie');
            return result.phantomCookie || '';
        } catch (error) {
            console.error('获取Cookie设置失败:', error);
            return '';
        }
    }


    async getRegexConfig() {
        try {
            const result = await chrome.storage.local.get('phantomRegexConfig');
            return result.phantomRegexConfig || this.defaultRegexPatterns;
        } catch (error) {
            console.error('获取正则配置失败:', error);
            return this.defaultRegexPatterns;
        }
    }


    async clearAllData() {

        if (!confirm(' 警告：此操作将清空所有页面的扫描数据！\n\n包括：\n• 所有页面的扫描结果\n• 深度扫描数据\n• 扫描状态信息\n\n此操作不可恢复，确定要继续吗？')) {
            return;
        }


        if (!confirm('请再次确认：真的要清空所有数据吗？')) {
            return;
        }

        try {



            let originalSaveResults = null;
            if (window.srcMiner && typeof window.srcMiner.saveResults === 'function') {

                originalSaveResults = window.srcMiner.saveResults;
                window.srcMiner.saveResults = () => {

                };
            }


            if (window.srcMiner) {



                const isDeepScanRunning = window.srcMiner.deepScanRunning;



                window.srcMiner.results = {};
                window.srcMiner.deepScanResults = {};
                window.srcMiner.scannedUrls = new Set();
                window.srcMiner.pendingUrls = new Set();


                if (!isDeepScanRunning) {
                    window.srcMiner.deepScanRunning = false;
                    window.srcMiner.currentDepth = 0;

                } else {

                }
            }


            const allData = await chrome.storage.local.get(null);


            const keysToRemove = [];


            for (const key in allData) {
                if (

                    key.endsWith('__results') ||
                    key.endsWith('__lastSave') ||

                    key.endsWith('_results') ||
                    key.endsWith('_lastSave') ||

                    key === 'srcMinerResults' ||
                    key === 'lastSaveTime' ||

                    key === 'deepScanComplete' ||
                    key === 'deepScanTimestamp' ||
                    key === 'deepScanUrl' ||
                    key === 'deepScanCompletedAt' ||
                    key === 'deepScanResultsCount' ||
                    key === 'lastDeepScanCompleted' ||
                    key === 'deepScanRunning' ||

                    key.startsWith('lastScan_')
                ) {
                    keysToRemove.push(key);
                }
            }




            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);

            }


            try {
                if (!window.indexedDBManager) {
                    window.indexedDBManager = new IndexedDBManager();
                }
                await window.indexedDBManager.clearAllScanResults();

            } catch (error) {
                console.error(' 清空IndexedDB数据失败:', error);
            }


            const verifyData = await chrome.storage.local.get(keysToRemove);
            const remainingKeys = Object.keys(verifyData);

            if (remainingKeys.length > 0) {
                console.warn(' 发现chrome.storage残留数据键，尝试强制删除:', remainingKeys);

                for (const key of remainingKeys) {
                    try {
                        await chrome.storage.local.remove([key]);

                    } catch (error) {
                        console.error(` 强制删除失败: ${key}`, error);
                    }
                }
            }


            const resultsDiv = document.getElementById('results');
            const statsDiv = document.getElementById('stats');
            if (resultsDiv) {
                resultsDiv.innerHTML = '';

            }
            if (statsDiv) {
                statsDiv.textContent = '';

            }


            if (window.srcMiner) {

                if (!window.srcMiner.deepScanRunning) {

                    if (typeof window.srcMiner.resetDeepScanUI === 'function') {
                        window.srcMiner.resetDeepScanUI();

                    }
                }


                if (typeof window.srcMiner.updateCategorySelect === 'function') {
                    window.srcMiner.updateCategorySelect();

                }


                if (typeof window.srcMiner.displayResults === 'function') {
                    window.srcMiner.displayResults();

                }
            }


            const finalCheck = await chrome.storage.local.get(null);
            const remainingDataKeys = Object.keys(finalCheck).filter(key =>
                key.endsWith('__results') ||
                key.endsWith('__lastSave') ||
                key.endsWith('_results') ||
                key.endsWith('_deepBackup') ||
                key.endsWith('_deepState') ||
                key.endsWith('_lastSave') ||
                key === 'srcMinerResults' ||
                key === 'deepScanResults' ||
                key === 'deepScanBackup' ||
                key === 'deepScanState' ||
                key === 'lastSaveTime' ||
                key.startsWith('lastScan_')
            );


            try {
                const indexedDBStats = await window.indexedDBManager.getStats();

            } catch (error) {
                console.error(' 获取IndexedDB统计失败:', error);
            }


            if (originalSaveResults && window.srcMiner) {
                setTimeout(() => {
                    window.srcMiner.saveResults = originalSaveResults;

                }, 1000);
            }


            if (remainingDataKeys.length > 0) {
                console.warn(' 最终检查发现残留数据键:', remainingDataKeys);
                this.showMessage(`清空完成，但发现 ${remainingDataKeys.length} 个残留数据键，可能需要手动处理`, 'warning');
            } else {

                this.showMessage(`已成功清空 ${keysToRemove.length} 个数据项，所有扫描数据已彻底清除`, 'success');
            }

        } catch (error) {
            console.error(' 清空全部数据失败:', error);
            this.showMessage('清空数据失败: ' + error.message, 'error');
        }
    }


    showMessage(message, type = 'info') {

        const messageEl = document.createElement('div');
        messageEl.className = `settings-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 6px;
            color: #fff;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#00d4aa' : type === 'error' ? '#e74c3c' : '#f39c12'};
        `;

        document.body.appendChild(messageEl);


        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }


    async getDomainScanSettings() {
        try {
            const result = await chrome.storage.local.get(['domainScanSettings']);
            return result.domainScanSettings || {
                allowSubdomains: false,
                allowAllDomains: false
            };
        } catch (error) {
            console.error('获取域名扫描设置失败:', error);
            return {
                allowSubdomains: false,
                allowAllDomains: false
            };
        }
    }


    async getCustomRegexConfigs() {
        try {
            const result = await chrome.storage.local.get('customRegexConfigs');
            return result.customRegexConfigs || {};
        } catch (error) {
            console.error('获取自定义正则配置失败:', error);
            return {};
        }
    }


    async saveCustomRegexConfig(key, config) {
        try {
            const data = await chrome.storage.local.get('customRegexConfigs');
            const customConfigs = data.customRegexConfigs || {};

            customConfigs[key] = config;

            await chrome.storage.local.set({ customRegexConfigs: customConfigs });
            console.log(' 自定义正则配置已保存:', { key, config });
        } catch (error) {
            console.error(' 保存自定义正则配置失败:', error);
            throw error;
        }
    }


    async deleteCustomRegexConfig(key) {
        try {
            const data = await chrome.storage.local.get('customRegexConfigs');
            const customConfigs = data.customRegexConfigs || {};

            delete customConfigs[key];

            await chrome.storage.local.set({ customRegexConfigs: customConfigs });
            console.log(' 自定义正则配置已删除:', key);
        } catch (error) {
            console.error(' 删除自定义正则配置失败:', error);
            throw error;
        }
    }
}


window.SettingsManager = SettingsManager;