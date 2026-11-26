class IcpServiceError extends Error {}

class SiteInfoPanel {
    constructor() {
        this.revision = 0;
        this.pendingLookup = null;
        const form = document.getElementById('siteIcpForm');
        form.addEventListener('submit', event => {
            event.preventDefault();
            const key = document.getElementById('siteIcpKey').value.trim();
            if (key) this.configure(key);
        });
        document.getElementById('siteIcpDisable').addEventListener('click', () => this.configure(''));
    }

    async configure(key) {
        this.revision++;
        const status = document.getElementById('siteIcpSettingStatus');
        try {
            if (key) {
                await chrome.storage.session.set({ phantomIcpKey: key, phantomIcpLast: null });
            } else {
                await chrome.storage.session.remove(['phantomIcpKey', 'phantomIcpLast']);
            }
            document.getElementById('siteIcpKey').value = '';
            status.textContent = key ? '本次会话已启用自动查询。' : '已停用自动查询。';
            await this.refresh();
        } catch {
            status.textContent = '查询设置保存失败，请重试。';
        }
    }

    async refresh() {
        const revision = ++this.revision;
        const set = (id, value) => {
            if (this.revision === revision) document.getElementById(id).textContent = value;
        };
        for (const id of ['siteHost', 'siteFrameworks', 'siteCms', 'siteThemes', 'siteDeclaredIcp', 'siteIcpResult']) set(id, '—');
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (this.revision !== revision) return;
            if (!Number.isInteger(tab?.id) || !/^https?:\/\//i.test(tab.url || '')) {
                set('siteHost', '请在 HTTP 或 HTTPS 网页上打开。');
                return;
            }
            const hostname = new URL(tab.url).hostname;
            set('siteHost', hostname);
            const readPage = async () => {
                try {
                    const { readSiteDeclarations, identifySite, pageQueries } = await import('./SiteFingerprints.js');
                    const [frame] = await chrome.scripting.executeScript({
                        target: { tabId: tab.id }, func: readSiteDeclarations, args: [pageQueries]
                    });
                    const info = frame?.result;
                    if (info?.hostname !== hostname) throw new Error();
                    set('siteDeclaredIcp', info.filings.join('、') || '未找到页面公示号');
                    const { frameworks, cms, themes } = identifySite(info);
                    set('siteFrameworks', frameworks.join('、') || '未发现公开标记');
                    set('siteCms', cms.join('、') || '未发现公开标记');
                    set('siteThemes', themes.join('、') || '未发现公开标记');
                } catch {
                    for (const id of ['siteFrameworks', 'siteCms', 'siteThemes', 'siteDeclaredIcp']) set(id, '无法读取当前页面');
                }
            };
            set('siteIcpResult', '正在检查…');
            const icp = this.lookup(hostname, revision).then(
                value => set('siteIcpResult', value),
                error => set('siteIcpResult', error instanceof IcpServiceError ? error.message : '查询暂不可用，请稍后再试。')
            );
            await Promise.all([readPage(), icp]);
        } catch {
            set('siteIcpResult', '查询服务暂不可用，请稍后再试。');
        }
    }

    async lookup(hostname, revision) {
        const host = hostname.toLowerCase().replace(/\.$/, '');
        if (!/^(?:[a-z0-9-]+\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(host) ||
            /(?:^|\.)(?:localhost|local|lan|internal|home|test|example|invalid|arpa|onion)$/.test(host)) {
            return '仅支持公开域名';
        }
        const { phantomIcpKey: key, phantomIcpLast: cached } = await chrome.storage.session.get(['phantomIcpKey', 'phantomIcpLast']);
        if (!key) return '未启用，可在下方配置 API Key';
        if (cached?.host === host && Date.now() - cached.time < 3600000) return cached.label;
        if (revision !== this.revision) return '';
        if (this.pendingLookup?.host === host && this.pendingLookup.key === key) return this.pendingLookup.promise;

        const promise = this.requestRecord(host, key);
        this.pendingLookup = { host, key, promise };
        try {
            const label = await promise;
            const settings = await chrome.storage.session.get('phantomIcpKey');
            if (settings.phantomIcpKey === key) {
                await chrome.storage.session.set({ phantomIcpLast: { host, label, time: Date.now() } });
            }
            return label;
        } finally {
            if (this.pendingLookup?.promise === promise) this.pendingLookup = null;
        }
    }

    async requestRecord(host, key) {
        const form = new FormData();
        form.set('domain', host);
        form.set('key', key);
        const response = await fetch('https://apidatav2.chinaz.com/single/icp', {
            method: 'POST', body: form, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
            signal: AbortSignal.timeout(15000)
        });
        if (response.status === 429) throw new IcpServiceError('查询过于频繁，请稍后再试。');
        if (!response.ok) throw new IcpServiceError('查询服务暂不可用，请稍后再试。');
        const data = await response.json();
        const code = Number(data?.StateCode);
        if (code === 10025 || (code === 0 && /暂无备案|未查到|没有查询到/.test(data.Reason || ''))) {
            return '服务未返回备案记录';
        }
        if ([10001, 10002, 10003, 10009].includes(code)) throw new IcpServiceError('请检查 API Key 及其备案查询权限。');
        if ([10011, 10012, 10013, 10022, 10026].includes(code)) throw new IcpServiceError('查询额度或频率已达上限。');
        if (code !== 1 || typeof data.Result?.SiteLicense !== 'string' || !data.Result.SiteLicense.trim()) {
            throw new Error('备案服务未返回有效记录');
        }
        return [data.Result.SiteLicense, data.Result.CompanyName, data.Result.VerifyTime]
            .filter(value => typeof value === 'string' && value.trim()).map(value => value.slice(0, 180)).join('\n');
    }
}
