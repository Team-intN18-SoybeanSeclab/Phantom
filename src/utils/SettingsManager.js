/**
 * 设置管理器
 * 负责管理Cookie设置和正则表达式配置
 */
class SettingsManager {
    constructor() {
        this.defaultRegexPatterns = {
            // 绝对路径API
            absoluteApi: [
                '(?<![\\w/\\\\.-])(?:/[\\w.-]+(?:/[\\w.-]+)+|/[\\w.-]+\\.\\w+|[a-zA-Z]:[/\\\\][\\w\\s.-]+(?:[/\\\\][\\w\\s.-]+)+|\\\\\\\\[\\w.-]+(?:[/\\\\][\\w.-]+)+)(?![\\w/\\\\])'
            ].join('|'),
            
            // 相对路径API
            relativeApi: [
                '(?<![\\w/\\\\-])(?:\\.{1,2}/)+(?:[^/ \\t\\r\\n<>|"\\\']+/)*[^/ \\t\\r\\n<>|"\\\']*(?![\\w/\\\\])'
            ].join('|'),
            
            // 域名和URL
            domain: [
                '(?<!\\w)(?:[a-zA-Z0-9-]{2,}\\.)+(?:xin|com|cn|net|com\\.cn|vip|top|cc|shop|club|wang|xyz|luxe|site|news|pub|fun|online|win|red|loan|ren|mom|net\\.cn|org|link|biz|bid|help|tech|date|mobi|so|me|tv|co|vc|pw|video|party|pics|website|store|ltd|ink|trade|live|wiki|space|gift|lol|work|band|info|click|photo|market|tel|social|press|game|kim|org\\.cn|games|pro|men|love|studio|rocks|asia|group|science|design|software|engineer|lawyer|fit|beer|tw|我爱你|中国|公司|网络|在线|网址|网店|集团|中文网)(?=\\b|(?::\\d{1,5})?(?:\\/|$))(?![.\\w])'
            ].join('|'),
            
            // 邮箱地址（排除静态资源域名）
            email: [
                '([a-zA-Z0-9\\._\\-]*@[a-zA-Z0-9\\._\\-]{1,63}\\.((?!js|css|jpg|jpeg|png|ico)[a-zA-Z]{2,}))'
            ].join('|'),
            
            // 中国大陆手机号
            phone: [
                '(?<!\\d)1(?:3\\d{2}|4[14-9]\\d|5\\d{2}|66\\d|7[2-35-8]\\d|8\\d{2}|9[89]\\d)\\d{7}(?!\\d)'
            ].join('|'),
            
            // IP地址
            ip: [
                '[\'"](([a-zA-Z0-9]+:)?\\/\\/)?\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(\\/.*?)?[\'"]'
            ].join('|'),
            
            
            // 身份证号
            idCard: [
                '[\'"](\\d{8}(0\\d|10|11|12)([0-2]\\d|30|31)\\d{3}$)|(\\d{6}(18|19|20)\\d{2}(0[1-9]|10|11|12)([0-2]\\d|30|31)\\d{3}(\\d|X|x))[\'"]'
            ].join('|'),
            
            // JWT Token
            jwt: [
                '[\'""]ey[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9._-]{10,}|ey[A-Za-z0-9_\\/+-]{10,}\\.[A-Za-z0-9._\\/+-]{10,}[\'""]'
            ].join('|'),
            
            // Bearer Token
            bearerToken: [
                '[Bb]earer\\s+[a-zA-Z0-9\\-=._+/\\\\]{20,500}'
            ].join('|'),
            
            // Basic Auth
            basicAuth: [
                '[Bb]asic\\s+[A-Za-z0-9+/]{18,}={0,2}'
            ].join('|'),
            
            // Authorization Header
            authHeader: [
                '["\'\\\[]*[Aa]uthorization["\'\\\]]*\\s*[:=]\\s*[\'"]?\\b(?:[Tt]oken\\s+)?[a-zA-Z0-9\\-_+/]{20,500}[\'"]?'
            ].join('|'),
            
            // 微信AppID
            wechatAppId: [
                '[\'"](wx[a-z0-9]{15,18})[\'"]',
                '[\'"](ww[a-z0-9]{15,18})[\'"]'
            ].join('|'),
            
            // GitHub Token
            githubToken: [
                '((ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,255})'
            ].join('|'),
            
            // GitLab Token
            gitlabToken: [
                'glpat-[a-zA-Z0-9\\-=_]{20,22}'
            ].join('|'),
            
            // AWS密钥
            awsKey: [
                'AKIA[A-Z0-9]{16}',
                'LTAI[A-Za-z\\d]{12,30}',
                'AKID[A-Za-z\\d]{13,40}'
            ].join('|'),
            
            // Google API Key
            googleApiKey: [
                'AIza[0-9A-Za-z_\\-]{35}'
            ].join('|'),
            
            // Webhook URLs
            webhookUrls: [
                'https:\\/\\/qyapi\\.weixin\\.qq\\.com\\/cgi\\-bin\\/webhook\\/send\\?key=[a-zA-Z0-9\\-]{25,50}',
                'https:\\/\\/oapi\\.dingtalk\\.com\\/robot\\/send\\?access_token=[a-z0-9]{50,80}',
                'https:\\/\\/open\\.feishu\\.cn\\/open\\-apis\\/bot\\/v2\\/hook\\/[a-z0-9\\-]{25,50}',
                'https:\\/\\/hooks\\.slack\\.com\\/services\\/[a-zA-Z0-9\\-_]{6,12}\\/[a-zA-Z0-9\\-_]{6,12}\\/[a-zA-Z0-9\\-_]{15,24}'
            ].join('|'),
            
            // 加密算法调用检测
            cryptoUsage: [
                '\\b(?:CryptoJS\\.(?:AES|DES)|Base64\\.(?:encode|decode)|btoa|atob|JSEncrypt|rsa|KJUR|\\$\\.md5|md5|sha1|sha256|sha512)(?:\\.\\w+)*\\s*\\([^)]*\\)'
            ].join('|'),
            
            // 敏感信息（综合模式）
            sensitive: [
                // GitHub 各类 Token
                'github[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?oauth[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?api[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?access[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'github[_-]?client[_-]?secret["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                // AWS 密钥
                'aws[_-]?access[_-]?key[_-]?id["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'aws[_-]?secret[_-]?access[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'aws[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'awssecretkey["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                // Google API Key
                'google[_-]?api[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'google[_-]?client[_-]?secret["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'google[_-]?maps[_-]?api[_-]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                // 通用密钥字段
                '[\\w_-]*?password[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?token[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?secret[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?accesskey[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                '[\\w_-]*?bucket[\\w_-]*?["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                // 私钥
                '-{5}BEGIN[\\s\\S]*?-{5}END[\\s\\S]*?-{5}',
                // 华为云 OSS
                'huawei\\.oss\\.(ak|sk|bucket\\.name|endpoint|local\\.path)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                // 其他服务密钥
                'stripe[_-]?(secret|private|publishable)[-_]?key["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'slack[_-]?token["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'twilio[_-]?(token|sid|api[_-]?key|api[_-]?secret)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'firebase[_-]?(token|key|api[_-]?token)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'mailgun[_-]?(api[_-]?key|secret[_-]?api[_-]?key)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'docker[_-]?(token|password|key|hub[_-]?password)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?',
                'npm[_-]?(token|api[_-]?key|auth[_-]?token|password)["\']?[^\\S\\r\\n]*[=:][^\\S\\r\\n]*["\']?[\\w-]+["\']?'
            ].join('|'),
            
            // GitHub链接
            github: [
                'https?://github\\.com/[a-zA-Z0-9_\\-\\.]+/[a-zA-Z0-9_\\-\\.]+'
            ].join('|'),
            
            // Vue文件
            vue: [
                '["\'][^"\']*\\.vue["\']'
            ].join('|'),
            
            // 公司名称
            company: [
            // 中文公司名称模式
            '(?:[\\u4e00-\\u9fa5\\（\\）]{4,15}(?:公司|中心))',
            '(?:[\\u4e00-\\u9fa5]{2,15}(?:软件|科技|集团))',
    
            // 英文公司名称模式（新增）
            '[A-Z][a-zA-Z\\s]{2,30}(?:Inc|Corp|LLC|Ltd|Company|Group|Technology|Systems)',
    
            // 扩展的中文公司类型（新增）
            '(?:公司|集团|企业|有限责任公司|股份有限公司|科技|网络|信息|技术)[\\u4e00-\\u9fa5]{2,20}(?:公司|集团|企业|有限责任公司|股份有限公司)'
            ].join('|'),
            
            // 注释
            comment: [
            '<!--(?![\\s\\S]*?Performance optimized)[\\s\\S]*?(?!<|=|\\*)-->',
            '/\\*(?![\\s\\S]*?Performance optimized)(?![\\s\\S]*External (?:script|stylesheet):)[\\s\\S]*?(?!<|=|\\*)\\*/',
            '(?:^|[^\\w"\'\':=/])(?!.*Performance optimized)(?!.*External (?:script|stylesheet))//(?!=|\\*|<)((?:(?!<|=|\\*)[^])*?)(?=<|$)'
            ].join('|')
        };
        
        this.init();
    }

    /**
     * 初始化设置管理器
     */
    init() {
        this.bindEvents();
        this.loadSettings();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 请求头相关按钮
        document.getElementById('addHeaderBtn')?.addEventListener('click', () => this.addHeaderInput());
        document.getElementById('getCookieBtn')?.addEventListener('click', () => this.getCurrentCookie());
        document.getElementById('saveHeadersBtn')?.addEventListener('click', () => this.saveHeaders());
        document.getElementById('clearHeadersBtn')?.addEventListener('click', () => this.clearHeaders());
        
        // 正则配置相关按钮
        document.getElementById('saveRegexBtn')?.addEventListener('click', () => this.saveRegexConfig());
        document.getElementById('resetRegexBtn')?.addEventListener('click', () => this.resetRegexConfig());
        
        // 数据管理按钮
        document.getElementById('clearAllDataBtn')?.addEventListener('click', () => this.clearAllData());
        
        // 域名扫描设置
        document.getElementById('allowSubdomains')?.addEventListener('change', () => this.saveDomainScanSettings());
        document.getElementById('allowAllDomains')?.addEventListener('change', () => this.saveDomainScanSettings());
        
        // Vue 检测设置
        document.getElementById('saveVueSettingsBtn')?.addEventListener('click', () => this.saveVueDetectorSettings());
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            // 加载请求头设置
            const result = await chrome.storage.local.get(['phantomHeaders', 'phantomRegexConfig', 'regexSettings', 'domainScanSettings']);
            
            // 加载请求头配置
            this.loadHeaders(result.phantomHeaders || []);
            
            // 加载正则配置
            const regexConfig = result.phantomRegexConfig || this.defaultRegexPatterns;

            // 如果 regexSettings 不存在，基于当前配置构建并保存，保证全链路生效
            if (!result.regexSettings) {
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
                    // 扩展项
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
                await chrome.storage.local.set({ regexSettings });
                //console.log('✅ 已构建并保存默认 regexSettings（首次初始化）');
                // 通知其他模块配置已更新
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
            
            // 新增的正则表达式输入框
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
            
            // 加载域名扫描设置
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
            
            // 加载 Vue 检测设置
            await this.loadVueDetectorSettings();
            
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    /**
     * 加载 Vue 检测设置
     */
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

    /**
     * 保存 Vue 检测设置
     */
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
            
            // 触发事件通知其他模块
            window.dispatchEvent(new CustomEvent('vueDetectorSettingsUpdated', { 
                detail: vueSettings 
            }));
            
        } catch (error) {
            console.error('保存 Vue 检测设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 保存域名扫描设置
     */
    async saveDomainScanSettings() {
        try {
            const allowSubdomainsEl = document.getElementById('allowSubdomains');
            const allowAllDomainsEl = document.getElementById('allowAllDomains');
            
            const domainScanSettings = {
                allowSubdomains: allowSubdomainsEl ? allowSubdomainsEl.checked : false,
                allowAllDomains: allowAllDomainsEl ? allowAllDomainsEl.checked : false
            };
            
            // 互斥逻辑：如果选择了"所有域名"，则自动启用"子域名"
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
            
            // 触发事件通知其他模块
            window.dispatchEvent(new CustomEvent('domainScanSettingsUpdated', { 
                detail: domainScanSettings 
            }));
            
        } catch (error) {
            console.error('保存域名扫描设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 获取当前网站的Cookie并添加为请求头
     */
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
            
            // 添加Cookie作为请求头
            this.addHeaderInput('Cookie', cookieString);
            this.showMessage('Cookie已添加为请求头', 'success');
            
        } catch (error) {
            console.error('获取Cookie失败:', error);
            this.showMessage('获取Cookie失败: ' + error.message, 'error');
        }
    }

    /**
     * 保存正则表达式设置
     */
    async saveRegexSettings() {
        try {
            const regexSettings = {};
            
            // 收集所有正则表达式设置
            const regexItems = document.querySelectorAll('.regex-item');
            regexItems.forEach(item => {
                const textarea = item.querySelector('textarea');
                const category = textarea.id.replace('regex-', '');
                regexSettings[category] = textarea.value.trim();
            });
            
            // 保存到Chrome存储
            await chrome.storage.local.set({ regexSettings });
            
            //console.log('正则表达式设置已保存:', regexSettings);
            
            // 通知PatternExtractor重新加载配置
            if (window.patternExtractor) {
                await window.patternExtractor.loadCustomPatterns();
                //console.log('✅ PatternExtractor已重新加载配置');
            }
            
            this.showMessage('正则表达式设置保存成功！配置已生效', 'success');
            
        } catch (error) {
            console.error('保存正则表达式设置失败:', error);
            this.showMessage('保存正则表达式设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 保存正则配置
     */
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

            // 验证正则表达式
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

            // 转换为PatternExtractor期望的格式
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
                // 新增的正则表达式配置映射
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

            // 同时保存两种格式以保持兼容性
            await chrome.storage.local.set({ 
                phantomRegexConfig: regexConfig,
                regexSettings: regexSettings
            });
            
            //console.log('✅ 正则配置已保存:', { regexConfig, regexSettings });
            
            this.showMessage('正则配置保存成功', 'success');
            
            // 通知其他模块配置已更新
            this.notifyConfigUpdate(regexSettings);
            
        } catch (error) {
            console.error('保存正则配置失败:', error);
            this.showMessage('保存正则配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 重置正则配置为默认值
     */
    async resetRegexConfig() {
        try {
            // 检查并设置绝对路径和相对路径API正则
            const absoluteApiRegex = document.getElementById('absoluteApiRegex');
            const relativeApiRegex = document.getElementById('relativeApiRegex');
            
            if (absoluteApiRegex) {
                absoluteApiRegex.value = this.defaultRegexPatterns.absoluteApi;
            }
            if (relativeApiRegex) {
                relativeApiRegex.value = this.defaultRegexPatterns.relativeApi;
            }
            
            // 检查并设置其他正则表达式输入框
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
            
            // 转换为PatternExtractor期望的格式
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
                // 新增的正则表达式配置映射
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
            
            // 同时保存两种格式
            await chrome.storage.local.set({ 
                phantomRegexConfig: this.defaultRegexPatterns,
                regexSettings: regexSettings
            });
            
            //console.log('✅ 正则配置已重置为默认值:', { regexSettings });
            
            this.showMessage('正则配置已重置为默认值', 'success');
            
            // 通知其他模块配置已更新
            this.notifyConfigUpdate(regexSettings);
            
        } catch (error) {
            console.error('重置正则配置失败:', error);
            this.showMessage('重置正则配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 通知其他模块配置已更新 - 统一化版本
     */
    notifyConfigUpdate(regexSettings) {
        //console.log('🔄 [SettingsManager] 开始通知其他模块配置已更新:', regexSettings);
        
        // 强制重新加载PatternExtractor配置
        if (window.patternExtractor) {
            //console.log('🔄 [SettingsManager] 强制重新加载PatternExtractor配置...');
            
            // 清除现有配置
            window.patternExtractor.patterns = {};
            window.patternExtractor.customPatternsLoaded = false;
            
            // 更新配置
            if (typeof window.patternExtractor.updatePatterns === 'function') {
                window.patternExtractor.updatePatterns(regexSettings);
                //console.log('✅ [SettingsManager] PatternExtractor配置已强制更新');
            } else {
                console.warn('⚠️ [SettingsManager] PatternExtractor.updatePatterns方法不存在');
            }
        } else {
            console.warn('⚠️ [SettingsManager] PatternExtractor未找到');
        }
        
        // 触发全局事件，通知其他可能监听的模块
        window.dispatchEvent(new CustomEvent('regexConfigUpdated', { 
            detail: regexSettings 
        }));
        
        //console.log('✅ [SettingsManager] 配置更新通知完成');
    }

    /**
     * 添加请求头输入框
     */
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
        
        // 为删除按钮添加事件监听器
        const removeBtn = headerGroup.querySelector('.remove-header-btn');
        removeBtn.addEventListener('click', () => {
            headerGroup.remove();
            // 删除后自动保存
            this.saveHeaders();
        });
        
        container.appendChild(headerGroup);
    }

    /**
     * 加载请求头配置
     */
    loadHeaders(headers) {
        const container = document.getElementById('headersContainer');
        if (!container) return;

        // 清空现有内容
        container.innerHTML = '';

        // 如果没有保存的请求头，添加一个空的输入框
        if (!headers || headers.length === 0) {
            this.addHeaderInput();
            return;
        }

        // 加载保存的请求头
        headers.forEach(header => {
            this.addHeaderInput(header.key, header.value);
        });
    }

    /**
     * 保存请求头设置
     */
    async saveHeaders() {
        try {
            const headerInputs = document.querySelectorAll('.header-input-group');
            const headers = [];

            headerInputs.forEach(group => {
                const keyInput = group.querySelector('.header-key-input');
                const valueInput = group.querySelector('.header-value-input');
                
                // 添加空值检查，防止访问 null 对象的属性
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

    /**
     * 清空请求头设置
     */
    async clearHeaders() {
        try {
            const container = document.getElementById('headersContainer');
            if (container) {
                container.innerHTML = '';
                this.addHeaderInput(); // 添加一个空的输入框
            }
            
            await chrome.storage.local.remove('phantomHeaders');
            this.showMessage('请求头已清空', 'success');
            
        } catch (error) {
            console.error('清空请求头失败:', error);
            this.showMessage('清空请求头失败: ' + error.message, 'error');
        }
    }

    /**
     * 获取当前请求头设置
     */
    async getHeadersSetting() {
        try {
            const result = await chrome.storage.local.get('phantomHeaders');
            return result.phantomHeaders || [];
        } catch (error) {
            console.error('获取请求头设置失败:', error);
            return [];
        }
    }

    /**
     * 获取当前Cookie设置（兼容性方法）
     */
    async getCookieSetting() {
        try {
            // 先尝试从新的请求头设置中获取Cookie
            const headers = await this.getHeadersSetting();
            const cookieHeader = headers.find(header => 
                header.key.toLowerCase() === 'cookie'
            );
            
            if (cookieHeader) {
                return cookieHeader.value;
            }

            // 如果没有找到，尝试从旧的Cookie设置中获取（向后兼容）
            const result = await chrome.storage.local.get('phantomCookie');
            return result.phantomCookie || '';
        } catch (error) {
            console.error('获取Cookie设置失败:', error);
            return '';
        }
    }

    /**
     * 获取当前正则配置
     */
    async getRegexConfig() {
        try {
            const result = await chrome.storage.local.get('phantomRegexConfig');
            return result.phantomRegexConfig || this.defaultRegexPatterns;
        } catch (error) {
            console.error('获取正则配置失败:', error);
            return this.defaultRegexPatterns;
        }
    }

    /**
     * 清空全部数据 - 真正解决自动保存问题
     */
    async clearAllData() {
        // 确认清空操作
        if (!confirm('⚠️ 警告：此操作将清空所有页面的扫描数据！\n\n包括：\n• 所有页面的扫描结果\n• 深度扫描数据\n• 扫描状态信息\n\n此操作不可恢复，确定要继续吗？')) {
            return;
        }
        
        // 二次确认
        if (!confirm('请再次确认：真的要清空所有数据吗？')) {
            return;
        }
        
        try {
            //console.log('🗑️ 开始清空全部数据...');
            
            // 第一步：暂时禁用自动保存机制，防止数据被重新写入
            let originalSaveResults = null;
            if (window.srcMiner && typeof window.srcMiner.saveResults === 'function') {
                //console.log('🚫 暂时禁用自动保存机制...');
                originalSaveResults = window.srcMiner.saveResults;
                window.srcMiner.saveResults = () => {
                    //console.log('🚫 自动保存已被暂时禁用');
                };
            }
            
            // 第二步：彻底清空 SRCMiner 实例的内存数据
            if (window.srcMiner) {
                //console.log('🧹 清空SRCMiner实例内存数据...');
                
                // 检查是否有深度扫描正在运行
                const isDeepScanRunning = window.srcMiner.deepScanRunning;
                //console.log('深度扫描运行状态:', isDeepScanRunning);
                
                // 清空所有内存中的数据
                window.srcMiner.results = {};
                window.srcMiner.deepScanResults = {};
                window.srcMiner.scannedUrls = new Set();
                window.srcMiner.pendingUrls = new Set();
                
                // 只有在没有深度扫描运行时才重置扫描状态
                if (!isDeepScanRunning) {
                    window.srcMiner.deepScanRunning = false;
                    window.srcMiner.currentDepth = 0;
                    //console.log('✅ 已重置扫描状态');
                } else {
                    //console.log('⚠️ 检测到深度扫描正在运行，保持扫描状态');
                }
            }
            
            // 第三步：获取所有存储的键并识别扫描相关数据
            const allData = await chrome.storage.local.get(null);
            //console.log('📋 当前存储的所有数据键:', Object.keys(allData));
            
            const keysToRemove = [];
            
            // 找出所有与扫描数据相关的键（包括双下划线格式）
            for (const key in allData) {
                if (
                    // 双下划线格式（实际存储格式）
                    key.endsWith('__results') || 
                    key.endsWith('__lastSave') ||
                    // 单下划线格式（兼容性）
                    key.endsWith('_results') || 
                    key.endsWith('_lastSave') ||
                    // 旧版本的全局键
                    key === 'srcMinerResults' ||
                    key === 'lastSaveTime' ||
                    // 其他可能的扫描相关键
                    key === 'deepScanComplete' ||
                    key === 'deepScanTimestamp' ||
                    key === 'deepScanUrl' ||
                    key === 'deepScanCompletedAt' ||
                    key === 'deepScanResultsCount' ||
                    key === 'lastDeepScanCompleted' ||
                    key === 'deepScanRunning' ||
                    // lastScan_ 开头的键（自动扫描时间记录）
                    key.startsWith('lastScan_')
                ) {
                    keysToRemove.push(key);
                }
            }
            
            //console.log(`🔍 找到 ${keysToRemove.length} 个数据键需要清空:`, keysToRemove);
            
            // 第四步：删除chrome.storage中的相关键（保留非扫描数据）
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                //console.log(`✅ 已删除chrome.storage中的 ${keysToRemove.length} 个数据键`);
            }
            
            // 第五步：清空IndexedDB中的所有扫描数据
            try {
                if (!window.indexedDBManager) {
                    window.indexedDBManager = new IndexedDBManager();
                }
                await window.indexedDBManager.clearAllScanResults();
                //console.log('✅ 已清空IndexedDB中的所有扫描数据');
            } catch (error) {
                console.error('❌ 清空IndexedDB数据失败:', error);
            }
            
            // 第六步：验证chrome.storage删除结果并处理残留数据
            const verifyData = await chrome.storage.local.get(keysToRemove);
            const remainingKeys = Object.keys(verifyData);
            
            if (remainingKeys.length > 0) {
                console.warn('⚠️ 发现chrome.storage残留数据键，尝试强制删除:', remainingKeys);
                // 尝试逐个删除剩余的键
                for (const key of remainingKeys) {
                    try {
                        await chrome.storage.local.remove([key]);
                        //console.log(`✅ 强制删除成功: ${key}`);
                    } catch (error) {
                        console.error(`❌ 强制删除失败: ${key}`, error);
                    }
                }
            }
            
            // 第七步：清空界面显示
            const resultsDiv = document.getElementById('results');
            const statsDiv = document.getElementById('stats');
            if (resultsDiv) {
                resultsDiv.innerHTML = '';
                //console.log('✅ 已清空结果显示区域');
            }
            if (statsDiv) {
                statsDiv.textContent = '';
                //console.log('✅ 已清空统计显示区域');
            }
            
            // 第八步：重置UI状态
            if (window.srcMiner) {
                // 只有在没有深度扫描运行时才重置UI状态
                if (!window.srcMiner.deepScanRunning) {
                    // 重置深度扫描UI状态
                    if (typeof window.srcMiner.resetDeepScanUI === 'function') {
                        window.srcMiner.resetDeepScanUI();
                        //console.log('✅ 已重置深度扫描UI状态');
                    }
                }
                
                // 更新分类选择器
                if (typeof window.srcMiner.updateCategorySelect === 'function') {
                    window.srcMiner.updateCategorySelect();
                    //console.log('✅ 已更新分类选择器');
                }
                
                // 强制刷新显示
                if (typeof window.srcMiner.displayResults === 'function') {
                    window.srcMiner.displayResults();
                    //console.log('✅ 已刷新结果显示');
                }
            }
            
            // 第九步：最终验证chrome.storage（只检查非扫描数据相关键）
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
            
            // 第十步：验证IndexedDB清空结果
            try {
                const indexedDBStats = await window.indexedDBManager.getStats();
                //console.log('📊 IndexedDB清空后统计:', indexedDBStats);
            } catch (error) {
                console.error('❌ 获取IndexedDB统计失败:', error);
            }
            
            // 第九步：恢复自动保存机制
            if (originalSaveResults && window.srcMiner) {
                setTimeout(() => {
                    window.srcMiner.saveResults = originalSaveResults;
                    //console.log('✅ 自动保存机制已恢复');
                }, 1000); // 1秒后恢复，确保清空操作完全完成
            }
            
            // 显示结果
            if (remainingDataKeys.length > 0) {
                console.warn('⚠️ 最终检查发现残留数据键:', remainingDataKeys);
                this.showMessage(`清空完成，但发现 ${remainingDataKeys.length} 个残留数据键，可能需要手动处理`, 'warning');
            } else {
                //console.log('✅ 数据清空验证通过，无残留数据');
                this.showMessage(`已成功清空 ${keysToRemove.length} 个数据项，所有扫描数据已彻底清除`, 'success');
            }
            
        } catch (error) {
            console.error('❌ 清空全部数据失败:', error);
            this.showMessage('清空数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示消息提示
     */
    showMessage(message, type = 'info') {
        // 创建消息提示元素
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

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 获取域名扫描设置
     */
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

    /**
     * 获取自定义正则配置
     */
    async getCustomRegexConfigs() {
        try {
            const result = await chrome.storage.local.get('customRegexConfigs');
            return result.customRegexConfigs || {};
        } catch (error) {
            console.error('获取自定义正则配置失败:', error);
            return {};
        }
    }

    /**
     * 保存自定义正则配置
     */
    async saveCustomRegexConfig(key, config) {
        try {
            const data = await chrome.storage.local.get('customRegexConfigs');
            const customConfigs = data.customRegexConfigs || {};
            
            customConfigs[key] = config;
            
            await chrome.storage.local.set({ customRegexConfigs: customConfigs });
            console.log('✅ 自定义正则配置已保存:', { key, config });
        } catch (error) {
            console.error('❌ 保存自定义正则配置失败:', error);
            throw error;
        }
    }

    /**
     * 删除自定义正则配置
     */
    async deleteCustomRegexConfig(key) {
        try {
            const data = await chrome.storage.local.get('customRegexConfigs');
            const customConfigs = data.customRegexConfigs || {};
            
            delete customConfigs[key];
            
            await chrome.storage.local.set({ customRegexConfigs: customConfigs });
            console.log('✅ 自定义正则配置已删除:', key);
        } catch (error) {
            console.error('❌ 删除自定义正则配置失败:', error);
            throw error;
        }
    }
}

// 导出设置管理器
window.SettingsManager = SettingsManager;