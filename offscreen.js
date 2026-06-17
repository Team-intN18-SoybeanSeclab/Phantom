chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {


    if (request.action === 'makeRequestWithCookie') {
        handleRequestWithCustomHeaders(request.url, request.options, request.customHeaders)
            .then(response => {

                sendResponse({ success: true, data: response });
            })
            .catch(error => {
                console.error(' 离屏文档请求失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});


async function handleRequestWithCustomHeaders(url, options = {}, customHeaders = []) {
    try {



        const fetchOptions = {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml,*/*',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            credentials: 'include',
            ...options
        };


        if (customHeaders && customHeaders.length > 0) {
            for (const header of customHeaders) {
                if (header.key && header.value) {
                    fetchOptions.headers[header.key] = header.value;



                    if (header.key.toLowerCase() === 'cookie') {
                        try {
                            const urlObj = new URL(url);
                            if (urlObj.origin === window.location.origin) {

                                const cookies = header.value.split(';').map(c => c.trim());
                                for (const cookie of cookies) {
                                    if (cookie) {
                                        document.cookie = cookie;

                                    }
                                }
                            }
                        } catch (e) {
                            console.warn(' 无法设置document.cookie:', e.message);
                        }
                    }
                }
            }
        }




        const timeout = options.timeout || 10000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        fetchOptions.signal = controller.signal;

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);


        let sizeBytes = 0;
        try {
            const respClone = response.clone();
            const buf = await respClone.arrayBuffer();
            sizeBytes = buf.byteLength;
        } catch (e) {
            sizeBytes = 0;
        }
        const text = await response.text();



        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            text: text,
            url: response.url,
            sizeBytes: sizeBytes
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`请求超时 (${options.timeout || 10000}ms)`);
        }
        console.error(` 离屏文档请求失败: ${error.message}`);
        throw error;
    }
}