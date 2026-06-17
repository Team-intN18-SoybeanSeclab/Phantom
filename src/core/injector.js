(async () => {
    try {

        window.addEventListener('message', async (event) => {
            if (event.source !== window) return;

            if (event.data.type === 'PHANTOM_INJECT_SCRIPT') {
                const { scriptContent, scriptId } = event.data;

                try {

                    const blob = new Blob([scriptContent], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);

                    const script = document.createElement('script');
                    script.src = url;
                    script.setAttribute('data-phantom-script', scriptId);

                    script.onload = () => {
                        URL.revokeObjectURL(url);

                        window.postMessage({
                            type: 'PHANTOM_SCRIPT_INJECTED',
                            scriptId: scriptId,
                            success: true,
                            message: '脚本注入成功'
                        }, '*');
                    };

                    script.onerror = () => {
                        URL.revokeObjectURL(url);

                        window.postMessage({
                            type: 'PHANTOM_SCRIPT_INJECTED',
                            scriptId: scriptId,
                            success: false,
                            message: '脚本加载失败'
                        }, '*');
                    };


                    (document.head || document.documentElement).appendChild(script);

                } catch (error) {

                    window.postMessage({
                        type: 'PHANTOM_SCRIPT_INJECTED',
                        scriptId: scriptId,
                        success: false,
                        message: error.message
                    }, '*');
                }
            }
        });


        window.postMessage({
            type: 'PHANTOM_INJECTOR_READY'
        }, '*');

    } catch (error) {
        console.error('Phantom injector initialization failed:', error);
    }
})();