class JSInjector {
    constructor() {
        this.savedScripts = [];
        this.activeScripts = new Set();
        this.PH_BOOTSTRAP = ";(function(){if(window.__PH)return;window.__PH={hooks:{},begun:{},current:null,reg:function(r){this.hooks[this.current]=(typeof r==='function')?r:function(){};},begin:function(id){if(this.begun[id])return false;this.begun[id]=true;return true;},unreg:function(id){var r=this.hooks[id];if(r){try{r();}catch(e){}}delete this.hooks[id];delete this.begun[id];return !!r;},active:function(){return Object.keys(this.begun);},has:function(id){return !!this.begun[id];}};})();";
    }

    hookIdFor(script) {
        if (script && script.hookId) return script.hookId;
        return 'ph_' + String((script && script.name) || 'script').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    async runInPage(code) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return { ok: false, error: '无法获取当前标签页' };
        }
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                args: [code],
                func: (c) => {
                    try { return { ok: true, ret: eval(c) }; }
                    catch (e) { return { ok: false, error: e.message }; }
                }
            });
            const r = (results && results[0] && results[0].result) || { ok: false };
            r.tabId = tab.id;
            return r;
        } catch (e) {
            return { ok: false, error: e.message, tabId: tab.id };
        }
    }

    async syncActiveHooks() {
        try {
            const r = await this.runInPage('window.__PH ? window.__PH.active() : []');
            this.activeScripts = new Set(Array.isArray(r.ret) ? r.ret : []);
            this.displaySavedScripts();
        } catch (e) {
        }
    }


    init() {


        if (typeof JSHookPresets !== 'undefined' && JSHookPresets.initializePresets) {
            JSHookPresets.initializePresets().then(() => {
                this.loadSavedScripts();
            }).catch(error => {
                console.error('预设脚本初始化失败:', error);
                this.loadSavedScripts();
            });
        } else {
            this.loadSavedScripts();
        }
        this.initEvents();
    }


    initEvents() {


        const addScriptBtn = document.getElementById('addScriptBtn');

        if (addScriptBtn) {

            addScriptBtn.addEventListener('click', () => {

                this.showAddScriptModal();
            });
        } else {
            console.error('addScriptBtn element not found!');
        }


        const modal = document.getElementById('addScriptModal');
        const closeBtn = modal?.querySelector('.close');
        const cancelBtn = document.getElementById('cancelAddScriptBtn');
        const saveBtn = document.getElementById('saveScriptBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideAddScriptModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideAddScriptModal());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNewScript());
        }


        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAddScriptModal();
                }
            });
        }


        this.bindScriptEvents();





        window.openScriptDetails = (scriptName, description) => {
            const index = this.savedScripts.findIndex(s => s.name === scriptName);
            if (index !== -1) {
                this.showScriptDetail(index);
            }
        };


        const scriptDetailModal = document.getElementById('scriptDetailModal');
        if (scriptDetailModal) {
            const closeBtn = scriptDetailModal.querySelector('.close');
            const closeDetailBtn = document.getElementById('closeDetailBtn');
            const copyDescBtn = document.getElementById('copyDescBtn');

            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeScriptDetailModal());
            }
            if (closeDetailBtn) {
                closeDetailBtn.addEventListener('click', () => this.closeScriptDetailModal());
            }
            if (copyDescBtn) {
                copyDescBtn.addEventListener('click', () => this.copyScriptDescription());
            }


            scriptDetailModal.addEventListener('click', (e) => {
                if (e.target === scriptDetailModal) {
                    this.closeScriptDetailModal();
                }
            });
        }
    }


    showAddScriptModal() {
        const modal = document.getElementById('addScriptModal');
        if (modal) {
            modal.style.display = 'block';

            document.getElementById('scriptNameInput').value = '';
            document.getElementById('scriptCodeInput').value = '';
            const descriptionInput = document.getElementById('scriptDescInput');
            if (descriptionInput) descriptionInput.value = '';
        }
    }


    hideAddScriptModal() {
        const modal = document.getElementById('addScriptModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }


    async saveNewScript() {
        const nameInput = document.getElementById('scriptNameInput');
        const codeInput = document.getElementById('scriptCodeInput');
        const descriptionInput = document.getElementById('scriptDescInput');

        if (!nameInput.value.trim() || !codeInput.value.trim()) {
            alert('请输入脚本名称和代码内容');
            return;
        }

        const script = {
            id: Date.now(),
            name: nameInput.value.trim(),
            content: codeInput.value.trim(),
            description: descriptionInput ? descriptionInput.value.trim() : '',
            size: new Blob([codeInput.value]).size,
            createdAt: new Date().toLocaleString()
        };

        try {

            const savedScripts = await window.IndexedDBManager.loadJSScripts();
            savedScripts.push(script);


            await window.IndexedDBManager.saveJSScripts(savedScripts);

            this.hideAddScriptModal();
            this.loadSavedScripts();
            alert('脚本保存成功');


            nameInput.value = '';
            codeInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
        } catch (error) {
            console.error(' 保存脚本失败:', error);
            alert('脚本保存失败: ' + error.message);
        }
    }


    async loadSavedScripts() {
        try {



            if (!window.IndexedDBManager) {
                console.error('[JSInjector] IndexedDBManager未找到');
                this.savedScripts = [];
                this.displaySavedScripts();
                return;
            }


            this.savedScripts = await window.IndexedDBManager.loadJSScripts();



            this.displaySavedScripts();
            this.syncActiveHooks();
        } catch (error) {
            console.error(' 加载脚本失败:', error);
            this.savedScripts = [];
            this.displaySavedScripts();
        }
    }


    displaySavedScripts() {
        const container = document.getElementById('scriptsContainer');
        if (!container) return;


        container.innerHTML = '';

        if (this.savedScripts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p style="font-style: normal;">暂无保存的脚本，点击下方"添加脚本"按钮开始创建</p>
                </div>
            `;
            return;
        }


        this.savedScripts.forEach((script, index) => {
            const scriptItem = document.createElement('div');
            scriptItem.className = 'header-input-group script-item';
            scriptItem.style.justifyContent = 'space-between';
            scriptItem.style.cursor = 'pointer';

            const description = script.description || '无描述';
            const truncatedDesc = description.length > 30 ? description.substring(0, 30) + '...' : description;


            const scriptInfoDiv = document.createElement('div');
            scriptInfoDiv.style.cssText = 'flex: 1; max-width: 200px; cursor: pointer;';
            scriptInfoDiv.addEventListener('click', () => {
                this.showScriptDetail(index);
            });

            scriptInfoDiv.innerHTML = `
                <div style="color: #fff; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${script.name}</div>
                <div class="script-desc-preview" style="color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;" title="${description}">${truncatedDesc}</div>
            `;


            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.cssText = 'display: flex; gap: 5px; flex-shrink: 0;';

            const hookId = this.hookIdFor(script);
            const active = this.activeScripts.has(hookId);

            buttonsDiv.innerHTML = `
                ${script.isPreset ? '<span style="color: #4CAF50; font-size: 12px; padding: 4px 8px; background: rgba(76, 175, 80, 0.1); border-radius: 3px; margin-right: 5px;">预设</span>' : ''}
                <button class="${active ? 'close-hook-btn' : 'inject-btn'}" data-index="${index}" data-action="${active ? 'uninstall' : 'inject'}" onclick="event.stopPropagation()">${active ? '关闭' : '注入'}</button>
                <button class="modify-btn" data-index="${index}" data-action="modify" onclick="event.stopPropagation()">修改</button>
                <button class="delete-btn" data-index="${index}" data-action="delete" onclick="event.stopPropagation()">删除</button>
            `;

            scriptItem.appendChild(scriptInfoDiv);
            scriptItem.appendChild(buttonsDiv);
            container.appendChild(scriptItem);
        });
    }


    bindScriptEvents() {
        const container = document.getElementById('scriptsContainer');
        if (container) {
            container.addEventListener('click', (e) => {
                const button = e.target.closest('button[data-action]');
                if (button) {
                    const action = button.dataset.action;
                    const index = parseInt(button.dataset.index);

                    switch (action) {
                        case 'inject':
                            this.injectScript(index);
                            break;
                        case 'uninstall':
                            this.uninstallScript(index);
                            break;
                        case 'modify':
                            this.modifyScript(index);
                            break;
                        case 'delete':
                            this.deleteScript(index);
                            break;
                    }
                }
            });
        }
    }


    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }


    async injectScript(index) {
        const script = this.savedScripts[index];
        if (!script) return;
        const code = script.content || script.code || '';
        const id = this.hookIdFor(script);
        const wrapped = this.PH_BOOTSTRAP + '\nwindow.__PH.current=' + JSON.stringify(id) + ';\nif(window.__PH.begin(' + JSON.stringify(id) + ')){\n' + code + '\n}';
        const r = await this.runInPage(wrapped);
        if (r.ok) {
            this.activeScripts.add(id);
            this.displaySavedScripts();
        } else {
            alert('脚本执行失败: ' + (r.error || '未知错误'));
        }
    }

    async uninstallScript(index) {
        const script = this.savedScripts[index];
        if (!script) return;
        const id = this.hookIdFor(script);
        const r = await this.runInPage('window.__PH ? window.__PH.unreg(' + JSON.stringify(id) + ') : false');
        this.activeScripts.delete(id);
        this.displaySavedScripts();
        if (!(r.ok && r.ret === true)) {
            if (confirm('该脚本无法即时还原，需要刷新页面才能完全关闭。是否立即刷新当前页面？')) {
                if (r.tabId) chrome.tabs.reload(r.tabId);
            }
        }
    }


    modifyScript(index) {
        if (this.savedScripts[index]) {
            const script = this.savedScripts[index];


            this.showAddScriptModal();


            document.getElementById('scriptNameInput').value = script.name;
            document.getElementById('scriptCodeInput').value = script.content || script.code || '';
            const descriptionInput = document.getElementById('scriptDescInput');
            if (descriptionInput) descriptionInput.value = script.description || '';


            const saveBtn = document.getElementById('saveScriptBtn');
            saveBtn.textContent = '更新脚本';


            saveBtn.replaceWith(saveBtn.cloneNode(true));
            const newSaveBtn = document.getElementById('saveScriptBtn');
            newSaveBtn.addEventListener('click', () => this.updateScript(index));
        }
    }


    async updateScript(index) {
        const nameInput = document.getElementById('scriptNameInput');
        const codeInput = document.getElementById('scriptCodeInput');
        const descriptionInput = document.getElementById('scriptDescInput');

        if (!nameInput.value.trim() || !codeInput.value.trim()) {
            alert('请输入脚本名称和代码内容');
            return;
        }

        try {

            this.savedScripts[index] = {
                ...this.savedScripts[index],
                name: nameInput.value.trim(),
                content: codeInput.value.trim(),
                description: descriptionInput ? descriptionInput.value.trim() : '',
                size: new Blob([codeInput.value]).size,
                updatedAt: new Date().toLocaleString()
            };


            await window.IndexedDBManager.saveJSScripts(this.savedScripts);

            this.hideAddScriptModal();
            this.loadSavedScripts();
            alert('脚本更新成功');


            const saveBtn = document.getElementById('saveScriptBtn');
            saveBtn.textContent = '保存脚本';
            saveBtn.onclick = () => this.saveNewScript();
        } catch (error) {
            console.error(' 更新脚本失败:', error);
            alert('脚本更新失败: ' + error.message);
        }
    }


    async deleteScript(index) {
        if (!confirm('确定要删除这个脚本吗？')) {
            return;
        }

        try {

            this.savedScripts.splice(index, 1);


            await window.IndexedDBManager.saveJSScripts(this.savedScripts);

            this.loadSavedScripts();
            alert('脚本删除成功');
        } catch (error) {
            console.error(' 删除脚本失败:', error);
            alert('脚本删除失败: ' + error.message);
        }
    }


    showMessage(message, type = 'info') {

        alert(message);
    }




    showScriptDetail(index) {

        if (!this.savedScripts[index]) {

            return;
        }

        const script = this.savedScripts[index];


        const modal = document.getElementById('scriptDetailModal');
        const nameElement = document.getElementById('scriptDetailName');
        const descElement = document.getElementById('scriptDetailDesc');
        const createdElement = document.getElementById('scriptDetailCreated');
        const updatedElement = document.getElementById('scriptDetailUpdated');
        const updatedGroup = document.getElementById('scriptDetailUpdatedGroup');



        if (modal && nameElement && descElement) {
            nameElement.textContent = script.name;
            descElement.textContent = script.description || '无描述';


            if (createdElement && script.created) {
                createdElement.textContent = new Date(script.created).toLocaleString('zh-CN');
            }


            if (updatedElement && updatedGroup && script.updated) {
                updatedElement.textContent = new Date(script.updated).toLocaleString('zh-CN');
                updatedGroup.style.display = 'block';
            } else if (updatedGroup) {
                updatedGroup.style.display = 'none';
            }

            modal.style.display = 'block';


            this.currentScriptDescription = script.description || '';

        } else {

        }
    }


    closeScriptDetailModal() {
        const modal = document.getElementById('scriptDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }


    copyScriptDescription() {
        if (this.currentScriptDescription) {
            navigator.clipboard.writeText(this.currentScriptDescription).then(() => {
                alert('描述已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动选择文本复制');
            });
        } else {
            alert('无描述内容可复制');
        }
    }




    async executeScriptContent(scriptContent) {
        const r = await this.runInPage(this.PH_BOOTSTRAP + '\n' + scriptContent);
        if (!r.ok) {
            alert('脚本执行失败: ' + (r.error || '未知错误'));
        }
    }
}