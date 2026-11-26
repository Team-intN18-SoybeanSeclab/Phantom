"""Run with python -B -m unittest discover -s tests after installing Playwright and its Chromium."""

import json
import tempfile
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://demo.example.org/page?private=fixture"
FIXTURE = """<!doctype html><meta charset="utf-8"><meta name="generator" content="WordPress 6">
<main data-v-app></main><footer>京ICP备12345678号-1</footer>"""
RELEASES = "https://github.com/Team-intN18-SoybeanSeclab/Phantom/releases"


class PopupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)

    def setUp(self):
        self.icp_requests = []
        self.icp_reply = {"StateCode": 10025}
        self.releases = []
        profile = tempfile.TemporaryDirectory()
        self.addCleanup(profile.cleanup)
        self.context = self.playwright.chromium.launch_persistent_context(
            profile.name, channel="chromium", headless=True,
            args=[f"--disable-extensions-except={ROOT}", f"--load-extension={ROOT}",
                  "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND"],
        )
        self.addCleanup(self.context.close)
        self.context.route("**/*", self.route)
        self.context.add_init_script("""{
            window.resultWrites = [];
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function(record, ...rest) {
                if (this.name === 'scanResults') window.resultWrites.push(record.id);
                return put.call(this, record, ...rest);
            };
        }""")
        self.worker = next(iter(self.context.service_workers), None) or self.context.wait_for_event("serviceworker")
        self.target = self.context.pages[0]
        self.target.goto(SITE)
        self.open_popup()

    def route(self, route):
        url = route.request.url
        if url == SITE:
            route.fulfill(content_type="text/html; charset=utf-8", body=FIXTURE)
        elif url == "https://apidatav2.chinaz.com/single/icp":
            self.icp_requests.append((route.request.method, route.request.post_data))
            route.fulfill(content_type="application/json", body=json.dumps(self.icp_reply))
        elif url == "https://www.cn-fnst.top/huanying/":
            route.fulfill(content_type="application/json", body=json.dumps(self.releases))
        elif url.startswith(("http:", "https:")):
            route.abort()
        else:
            route.continue_()

    def open_popup(self):
        # Keep the fixture the active tab, as it is when the toolbar popup is opened.
        with self.context.expect_page() as opened:
            self.worker.evaluate("chrome.tabs.create({url:chrome.runtime.getURL('popup.html'),active:false})")
        self.popup = opened.value
        expect(self.popup.locator("#currentDomain")).to_contain_text("demo.example.org")

    def test_restore_switch_and_render_are_read_only(self):
        self.popup.evaluate("""async url => {
            const db = window.IndexedDBManager;
            await db.saveScanResults(url, {urls:['basic']});
            await db.saveDeepScanResults(url, {urls:['deep-one','deep-two']});
        }""", SITE)
        self.popup.close()
        self.open_popup()
        self.assertEqual(self.popup.evaluate("srcMiner.results.urls.map(x => x.value)"), ["basic"])
        self.popup.locator("#resultSource").select_option("deep")
        self.popup.evaluate("srcMiner.loadResults()")
        self.assertEqual(self.popup.evaluate("srcMiner.results.urls.map(x => x.value)"), ["deep-one", "deep-two"])
        self.popup.locator("#resultSource").select_option("basic")
        self.popup.evaluate("srcMiner.displayResults()")
        self.assertEqual(self.popup.evaluate("window.resultWrites"), [])

    def test_identical_basic_save_and_concurrent_deep_history(self):
        self.popup.evaluate("""async url => {
            chrome.tabs.sendMessage = async () => ({urls:['basic']});
            await srcMiner.basicScanner.startScan(true);
            await srcMiner.basicScanner.startScan(true);
            const db = window.IndexedDBManager;
            await Promise.all(['first','second'].map(name =>
                db.saveDeepScanResults(url, {urls:[name]}, url, 'Fixture', true)));
            await srcMiner.loadResults();
        }""", SITE)
        self.assertEqual(self.popup.evaluate("srcMiner.basicResults.urls.map(x => x.value)"), ["basic"])
        self.assertCountEqual(self.popup.evaluate("srcMiner.deepScanResults.urls.map(x => x.value)"), ["first", "second"])
        self.assertEqual(self.popup.evaluate("window.resultWrites"),
                         ["demo.example.org", "demo.example.org__deep", "demo.example.org__deep"])

    def test_failed_save_can_be_retried_and_other_history_survives(self):
        outcome = self.popup.evaluate("""async url => {
            const db = window.IndexedDBManager;
            await db.saveDeepScanResults(url, {urls:['deep']});
            const original = db.saveScanResults.bind(db);
            db.saveScanResults = () => Promise.reject(new Error('fixture failure'));
            srcMiner.basicResults = {urls:['new']};
            let failed = false;
            try { await srcMiner.saveResults('basic'); } catch { failed = true; }
            db.saveScanResults = original;
            await srcMiner.saveResults('basic');
            await srcMiner.loadResults();
            return [failed, srcMiner.basicResults.urls[0].value, srcMiner.deepScanResults.urls[0].value];
        }""", SITE)
        self.assertEqual(outcome, [True, "new", "deep"])

    def test_deep_window_completion_writes_only_its_own_record_once(self):
        self.popup.evaluate("url => window.IndexedDBManager.saveScanResults(url,{urls:['basic']})", SITE)
        with self.context.expect_page() as opened:
            self.worker.evaluate("chrome.tabs.create({url:chrome.runtime.getURL('deepscan.html'),active:false})")
        deep_page = opened.value
        deep_page.wait_for_load_state("load")
        writes = deep_page.evaluate("""async url => {
            scanConfig = {baseUrl: new URL(url).origin, sourceUrl: url, pageTitle: 'Fixture'};
            scanResults = {urls:['deep']};
            await Promise.all([completeScan(), completeScan()]);
            return window.resultWrites;
        }""", SITE)
        self.assertEqual(writes, ["demo.example.org__deep"])
        self.popup.evaluate("srcMiner.loadResults()")
        self.assertEqual(self.popup.evaluate("srcMiner.basicResults.urls[0].value"), "basic")
        self.assertEqual(self.popup.evaluate("srcMiner.deepScanResults.urls[0].value"), "deep")

    def test_empty_history_and_nonpublic_domains(self):
        self.popup.evaluate("srcMiner.loadResults()")
        expect(self.popup.locator("#results")).to_contain_text("暂无")
        self.assertEqual(self.popup.evaluate("window.resultWrites"), [])
        self.worker.evaluate("chrome.storage.session.set({phantomIcpKey:'fixture-key'})")
        outcomes = self.popup.evaluate("""() => Promise.all(['localhost','127.0.0.1','[::1]','portal.internal']
            .map(host => srcMiner.siteInfo.lookup(host, srcMiner.siteInfo.revision)))""")
        self.assertEqual(outcomes, ["仅支持公开域名"] * 4)
        self.assertEqual(self.icp_requests, [])

    def test_restore_legacy_nested_snapshot_without_rewriting(self):
        self.popup.evaluate("""async url => {
            await window.IndexedDBManager.saveScanResults(url, {
                urls:['old-deep'], scanMetadata:{lastScanType:'deep'}, results:{urls:['old-basic']}
            });
            window.resultWrites = [];
            await srcMiner.loadResults();
        }""", SITE)
        self.assertEqual(self.popup.evaluate("srcMiner.basicResults.urls"), ["old-basic"])
        self.assertEqual(self.popup.evaluate("srcMiner.deepScanResults.urls[0].value"), "old-deep")
        self.assertEqual(self.popup.evaluate("window.resultWrites"), [])
        self.popup.evaluate("""async url => {
            await window.IndexedDBManager.saveScanResults(url, {urls:['new-basic']});
            await srcMiner.loadResults();
        }""", SITE)
        self.assertEqual(self.popup.evaluate("srcMiner.basicResults.urls[0].value"), "new-basic")
        self.assertEqual(self.popup.evaluate("srcMiner.deepScanResults.urls[0].value"), "old-deep")

    def test_remote_update_is_text_and_link_is_fixed(self):
        self.releases = [None, {"tag_name": "unknown"}, {
            "tag_name": "v9.0.0", "name": "<i>Title</i>", "body": "<b>Notes</b>", "html_url": SITE,
        }]
        self.popup.evaluate("checkForUpdate()")
        dialog = self.popup.locator("#updateDialog")
        expect(dialog).to_be_visible()
        expect(dialog.locator("[data-notes]")).to_have_text("<b>Notes</b>")
        expect(dialog.locator("[data-title]")).to_have_text("<i>Title</i>")
        expect(dialog.locator("i,b")).to_have_count(0)
        expect(dialog.locator("a")).to_have_attribute("href", RELEASES)
        dialog.locator("button").click()
        expect(dialog).not_to_be_visible()

    def test_site_declarations_lookup_cache_and_disable(self):
        self.popup.evaluate("document.querySelector('[data-page=site]').click()")
        expect(self.popup.locator("#siteFrameworks")).to_have_text("Vue")
        expect(self.popup.locator("#siteCms")).to_have_text("WordPress")
        expect(self.popup.locator("#siteDeclaredIcp")).to_have_text("京ICP备12345678号-1")
        expect(self.popup.locator("#siteIcpResult")).to_contain_text("未启用")
        self.assertEqual(self.icp_requests, [])

        self.icp_reply = {"StateCode": 1, "Result": {
            "SiteLicense": "京ICP备87654321号-1", "CompanyName": "示例主体", "VerifyTime": "2024-06-01",
        }}
        self.popup.locator("#site-page summary").click()
        self.popup.locator("#siteIcpKey").fill("fixture-key")
        self.popup.locator("#siteIcpForm button[type=submit]").click()
        expect(self.popup.locator("#siteIcpResult")).to_contain_text("示例主体")
        expect(self.popup.locator("#siteIcpResult")).to_contain_text("京ICP备87654321号-1")
        self.popup.close()
        self.open_popup()
        self.popup.evaluate("srcMiner.siteInfo.refresh()")
        self.assertEqual(len(self.icp_requests), 1)
        method, body = self.icp_requests[0]
        self.assertEqual(method, "POST")
        self.assertIn("demo.example.org", body)
        self.assertNotIn("private=fixture", body)
        self.popup.evaluate("srcMiner.siteInfo.configure('')")
        self.assertEqual(self.worker.evaluate("chrome.storage.session.get(['phantomIcpKey','phantomIcpLast'])"), {})

    def fingerprints(self, markup):
        self.target.set_content('<!doctype html>' + markup, wait_until="domcontentloaded")
        self.popup.evaluate("srcMiner.siteInfo.refresh()")
        return tuple(self.popup.locator('#' + field).text_content()
                     for field in ('siteCms', 'siteFrameworks', 'siteThemes'))

    def test_zibll_without_generator(self):
        # Public declarations from the theme author's homepage (https://www.zibll.com/).
        self.target.set_content("""
            <link rel="stylesheet" id="_main-css" href="/wp-content/themes/zibll/css/main.min.css">
            <body class="home wp-theme-zibll"><script src="/wp-content/themes/zibll/js/loader.js"></script>
        """)
        self.popup.evaluate("document.querySelector('[data-page=site]').click()")
        expect(self.popup.locator("#siteCms")).to_have_text("WordPress")
        expect(self.popup.locator("#siteThemes")).to_have_text("子比主题（Zibll）")
        for markup in [
            '<link rel="stylesheet" href="//cdn.example.org/blog/wp-content/themes/%7Aibll/style.css?ver=8">',
            '<base href="/blog/"><script src="wp-content/themes/zibll/js/loader.js#cached"></script>',
            '<link rel="preload" as="style" href="/static/themes/zibll/css/main.min.css">',
            '<link rel="stylesheet" href="//cdn.example.org/assets/zibll/css/main.min.css">'
            '<script src="//cdn.example.org/assets/zibll/js/loader.js"></script>',
            '<body class="wp-theme-zibll">',
        ]:
            with self.subTest(markup=markup):
                cms, _, themes = self.fingerprints(markup)
                self.assertEqual((cms, themes), ("WordPress", "子比主题（Zibll）"))

    def test_parent_child_and_unknown_wordpress_themes(self):
        cms, _, themes = self.fingerprints("""
            <link rel="stylesheet" href="/wp-content/themes/astra/demo.css">
            <body class="wp-child-theme-my-child wp-theme-zibll">
        """)
        self.assertEqual(cms, "WordPress")
        self.assertEqual(themes, "子比主题（Zibll）、my-child（子主题）")
        cms, _, themes = self.fingerprints("""
            <link rel="stylesheet" href="/wp-content/themes/my-parent/style.css">
            <link rel="stylesheet" href="/wp-content/themes/my-child/style.css">
            <body class="wp-child-theme-my-child">
        """)
        self.assertEqual((cms, themes), ("WordPress", "my-parent、my-child（子主题）"))

    def test_wappalyzer_generator_dom_and_script_markers(self):
        cases = [
            ('<meta name="GENERATOR" content="concrete5 - 8.5">', 'Concrete CMS', '未发现公开标记'),
            ('<meta name="generator" content="Discuz! X3.5">', 'Discuz! X', '未发现公开标记'),
            ('<link rel="https://api.w.org/" href="/?rest_route=/">', 'WordPress', '未发现公开标记'),
            ('<script type="application/json" data-drupal-selector="drupal-settings-json"></script>'
             '<script src="/_next/static/chunks/app.js"></script>', 'Drupal', 'Next.js、React'),
            ('<link rel="modulepreload" href="/_nuxt/entry.js">', '未发现公开标记', 'Nuxt、Vue'),
            ('<link rel="stylesheet" href="/_app/immutable/assets/app.css">', '未发现公开标记', 'Svelte、SvelteKit'),
        ]
        for markup, cms, frameworks in cases:
            with self.subTest(markup=markup):
                self.assertEqual(self.fingerprints(markup), (cms, frameworks, '未发现公开标记'))

    def test_mentions_links_and_query_strings_are_not_fingerprints(self):
        markup = """
            <link rel="canonical" href="https://demo.example.org/wp-content/themes/zibll/">
            <link rel="stylesheet" href="/css/main.css?redirect=/wp-content/themes/zibll/css/main.min.css">
            <link rel="stylesheet" href="https://first.example.org/zibll/css/main.min.css">
            <script src="https://second.example.org/zibll/js/loader.js"></script>
            <script src="/app.js?from=/_next/static/app.js"></script>
            <body class="wp-themeish-zibll"><a href="/wp-content/themes/zibll/style.css">WordPress 子比主题</a>
            <code>&lt;body class="wp-theme-zibll"&gt;</code>
            <img src="/wp-content/themes/astra/screenshot.png">
        """
        self.assertEqual(self.fingerprints(markup), ('未发现公开标记',) * 3)
        self.assertEqual(self.icp_requests, [])

    def test_lookup_failure_is_distinct_from_missing_record(self):
        self.icp_reply = {"StateCode": 10001, "Reason": "bad key"}
        self.popup.evaluate("srcMiner.siteInfo.configure('fixture-key')")
        expect(self.popup.locator("#siteIcpResult")).to_have_text("请检查 API Key 及其备案查询权限。")
        self.icp_reply = {"StateCode": 10025}
        self.popup.evaluate("srcMiner.siteInfo.refresh()")
        expect(self.popup.locator("#siteIcpResult")).to_have_text("服务未返回备案记录")
        self.assertEqual(len(self.icp_requests), 2)


if __name__ == "__main__":
    unittest.main()
