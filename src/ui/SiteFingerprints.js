import Wappalyzer from '../../libs/wappalyzer/core.js';
import { generatorRules } from '../../libs/wappalyzer/generators.js';

const CMS = 1, FRAMEWORK = 12, THEME = 80;
const stylesheetLinks = 'link[rel~="stylesheet" i][href], link[rel~="preload" i][as="style" i][href]';
const wpAssets = '/(?:wp-content/(?:themes|plugins|mu-plugins|cache)|wp-includes/(?:js|css|blocks))/';
const zibllAssets = '/themes/zibll/(?:css/(?:main|bootstrap|font-awesome)(?:\\.min)?\\.css|style\\.css|js/(?:loader(?:\\.min)?|libs/(?:jquery|bootstrap)(?:\\.min)?)\\.js)$';
const zibll = '子比主题（Zibll）';

function withStyles(pattern, ...selectors) {
    const dom = Object.fromEntries(selectors.map(selector => [selector, { exists: '' }]));
    dom[stylesheetLinks] = { attributes: { href: pattern } };
    return dom;
}

const rules = Object.fromEntries(Object.entries(generatorRules).map(([name, generator]) =>
    [name, { cats: [CMS], meta: { generator } }]));

// The public DOM and asset markers complement generator declarations, which many sites remove.
const additions = {
    WordPress: { cats: [CMS], meta: { generator: '^WordPress\\b' }, scriptSrc: wpAssets,
        dom: withStyles(wpAssets, 'link[rel~="https://api.w.org/"]', 'style#wp-emoji-styles-inline-css') },
    [zibll]: { cats: [THEME], scriptSrc: zibllAssets, dom: withStyles(zibllAssets), implies: 'WordPress' },
    Drupal: { cats: [CMS], scriptSrc: '/(?:core/)?misc/drupal(?:\\.min)?\\.js$',
        dom: 'script[data-drupal-selector="drupal-settings-json"]' },
    Joomla: { cats: [CMS], dom: 'script.joomla-script-options', meta: { generator: '^Joomla\\b' } },
    MediaWiki: { cats: [CMS], dom: 'body.mediawiki' },
    'TYPO3 CMS': { cats: [CMS], meta: { generator: '^TYPO3\\b' }, scriptSrc: '/(?:typo3temp/assets|typo3conf/ext)/' },
    Ghost: { cats: [CMS], meta: { generator: '^Ghost\\b' } },
    Hugo: { cats: [CMS] }, Hexo: { cats: [CMS] }, Jekyll: { cats: [CMS] },
    Typecho: { cats: [CMS] }, Halo: { cats: [CMS] },
    'Discuz! X': { cats: [CMS], scriptSrc: '/static/js/(?:common|forum)_(?:seditor|viewthread)\\.js$' },
    Webflow: { cats: [CMS], dom: 'html[data-wf-site]' },
    Shopify: { cats: [CMS], dom: 'link[rel~="preconnect"][href="https://cdn.shopify.com"]',
        scriptSrc: '^https?://[^/]+/cdn/shopifycloud/' },
    Squarespace: { cats: [CMS], dom: 'body.squarespace-config, script[data-name="static-context"]#static-context',
        scriptSrc: '^https?://static[0-9]*\\.squarespace\\.com/static/' },
    'Z-BlogPHP': { cats: [CMS], meta: { generator: '^Z-BlogPHP\\b' }, scriptSrc: '/zb_system/script/(?:zblogphp|common)\\.js$' },
    MkDocs: { cats: [CMS], dom: 'meta[name="generator"][content^="mkdocs-" i]' },
    Docusaurus: { cats: [CMS], dom: 'html[data-theme] #__docusaurus', implies: 'React' },
    Gatsby: { cats: [CMS], dom: '#___gatsby', implies: 'React' },
    VitePress: { cats: [CMS], dom: '#app .Layout .VPNav', implies: 'Vue' },
    VuePress: { cats: [CMS], implies: 'Vue' },
    React: { cats: [FRAMEWORK], dom: '[data-reactroot]',
        scriptSrc: '/(?:react|react-dom)(?:\\.production\\.min|\\.development|\\.min)?\\.js$' },
    Vue: { cats: [FRAMEWORK], dom: '[data-v-app]',
        scriptSrc: '/vue(?:\\.runtime)?(?:\\.global|\\.esm-browser)?(?:\\.prod|\\.min)?\\.js$' },
    Angular: { cats: [FRAMEWORK], dom: '[ng-version]' },
    AngularJS: { cats: [FRAMEWORK], dom: '[ng-app], [data-ng-app]', scriptSrc: '/angular(?:\\.min)?\\.js$' },
    'Next.js': { cats: [FRAMEWORK], scriptSrc: '/_next/static/', dom: withStyles('/_next/static/', 'script#__NEXT_DATA__'), implies: 'React' },
    Nuxt: { cats: [FRAMEWORK], scriptSrc: '/_nuxt/', dom: withStyles('/_nuxt/', 'script#__NUXT_DATA__, script[data-nuxt-data]'), implies: 'Vue' },
    Astro: { cats: [FRAMEWORK], dom: withStyles('/_astro/', 'astro-island'), scriptSrc: '/_astro/' },
    Svelte: { cats: [FRAMEWORK] },
    SvelteKit: { cats: [FRAMEWORK], dom: withStyles('/_app/immutable/', '#svelte-announcer, [data-sveltekit-preload-data]'),
        scriptSrc: '/_app/immutable/', implies: 'Svelte' },
    Qwik: { cats: [FRAMEWORK], dom: '[q\\:container][q\\:version]' },
    'Alpine.js': { cats: [FRAMEWORK], scriptSrc: '/(?:alpinejs(?:@[^/]+)?/dist/cdn|alpine)(?:\\.min)?\\.js$' },
    Ember: { cats: [FRAMEWORK], scriptSrc: '/ember(?:\\.prod|\\.debug|\\.min)?\\.js$' }
};
for (const [name, rule] of Object.entries(additions)) {
    const base = rules[name];
    const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactName = '^' + literal + '(?=$|[^a-z0-9])';
    const generator = rule.meta?.generator || (base ? [base.meta.generator, exactName] : exactName);
    rules[name] = { ...rule, meta: { generator } };
}
Wappalyzer.setCategories({
    [CMS]: { name: 'CMS', priority: 1 }, [FRAMEWORK]: { name: 'Framework', priority: 2 },
    [THEME]: { name: 'WordPress theme', priority: 3 }
});
Wappalyzer.setTechnologies(rules);
const scripted = Wappalyzer.technologies.filter(technology => technology.scriptSrc.length);
const structured = Wappalyzer.technologies.filter(technology => Object.keys(technology.dom).length);
export const pageQueries = {
    stylesheetLinks,
    selectors: [...new Set(structured.flatMap(technology => Object.keys(technology.dom)))].filter(selector => selector !== stylesheetLinks)
};

// Chrome serializes this function into the selected tab's isolated world. All dependencies are arguments.
export function readSiteDeclarations(queries) {
    function resourceUrls(selector) {
        const urls = new Set();
        for (const el of document.querySelectorAll(selector)) {
            const raw = el.getAttribute(el.localName === 'script' ? 'src' : 'href');
            if (!raw?.trim()) continue;
            try {
                const url = new URL(raw, document.baseURI);
                if (url.protocol === 'https:' || url.protocol === 'http:') urls.add(url.origin + decodeURI(url.pathname));
            } catch { /* An invalid resource URL does not invalidate the rest of the page. */ }
        }
        return [...urls];
    }
    const scripts = resourceUrls('script[src], link[rel~="modulepreload" i][href], link[rel~="preload" i][as="script" i][href]');
    const styles = resourceUrls(queries.stylesheetLinks);
    const generator = [...(document.head?.querySelectorAll('meta[name="generator" i]') || [])]
        .map(meta => meta.content.trim().slice(0, 512)).filter(Boolean);
    const selectors = queries.selectors.filter(selector => document.querySelector(selector));
    const bodyThemes = [...(document.body?.classList || [])].filter(name => /^wp-(?:child-)?theme-[a-z0-9][a-z0-9._-]*$/i.test(name));
    const filings = new Set();
    for (const element of document.querySelectorAll('footer,[role="contentinfo"],a[href*="miit.gov.cn" i]')) {
        const text = element.textContent.slice(0, 12000).normalize('NFKC');
        for (const [filing] of text.matchAll(/[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼蜀黔滇陇]\s*ICP\s*备\s*\d{5,12}\s*号(?:\s*-\s*\d+)?/gi)) {
            filings.add(filing.replace(/\s/g, ''));
        }
    }
    return { hostname: location.hostname, generator, scripts, styles, selectors, bodyThemes, filings: [...filings] };
}

const themeNames = new Map(Object.entries({
    zibll, astra: 'Astra', generatepress: 'GeneratePress', oceanwp: 'OceanWP', blocksy: 'Blocksy',
    kadence: 'Kadence', neve: 'Neve', avada: 'Avada', divi: 'Divi', flatsome: 'Flatsome',
    storefront: 'Storefront', 'hello-elementor': 'Hello Elementor'
}));

export function identifySite(info) {
    const detections = Wappalyzer.analyze({ meta: { generator: info.generator } })
        .concat(Wappalyzer.analyze({ scriptSrc: info.scripts }, scripted));
    const matches = Object.fromEntries(info.selectors.map(selector => [selector, ['']]));
    for (const tech of structured) {
        detections.push(...Wappalyzer.analyzeManyToMany(tech, 'dom.exists', matches));
        if (tech.dom[stylesheetLinks]) {
            detections.push(...Wappalyzer.analyzeManyToMany(tech, 'dom.attributes.href', { [stylesheetLinks]: info.styles }));
        }
    }
    const cms = new Set(), frameworks = new Set(), themes = new Set();
    for (const tech of Wappalyzer.resolve(detections)) {
        const category = tech.categories[0].id;
        if (category === CMS) cms.add(tech.name);
        if (category === FRAMEWORK) frameworks.add(tech.name);
        if (category === THEME) themes.add(tech.name);
    }
    const parent = info.bodyThemes.find(token => /^wp-theme-/i.test(token))?.slice('wp-theme-'.length);
    const child = info.bodyThemes.find(token => /^wp-child-theme-/i.test(token))?.slice('wp-child-theme-'.length);
    if (parent) {
        // Embedded resources can belong to other themes. Prefer WordPress's active template declaration.
        themes.clear();
        themes.add(themeNames.get(parent.toLowerCase()) || parent);
    } else {
        for (const url of [...info.styles, ...info.scripts]) {
            const match = /\/wp-content\/themes\/([a-z0-9][a-z0-9._-]{0,100})\/[^/]/i.exec(new URL(url).pathname);
            if (match && match[1].toLowerCase() !== child?.toLowerCase()) {
                themes.add(themeNames.get(match[1].toLowerCase()) || match[1]);
            }
        }
        // Some CDNs publish just the theme folder. Require both assets under the same URL prefix.
        const cssRoot = /^(https?:\/\/[^/]+\/(?:.*\/)?zibll)\/css\/main(?:\.min)?\.css$/i;
        const jsRoot = /^(https?:\/\/[^/]+\/(?:.*\/)?zibll)\/js\/loader(?:\.min)?\.js$/i;
        const zibllStyles = new Set(info.styles.map(url => cssRoot.exec(url)?.[1]).filter(Boolean));
        if (info.scripts.some(url => zibllStyles.has(jsRoot.exec(url)?.[1]))) themes.add(zibll);
    }
    if (child) themes.add((themeNames.get(child.toLowerCase()) || child) + '（子主题）');
    if (themes.size) cms.add('WordPress');
    return { cms: [...cms].sort(), frameworks: [...frameworks].sort(), themes: [...themes] };
}
