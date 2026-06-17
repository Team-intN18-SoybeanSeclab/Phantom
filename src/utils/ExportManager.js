class ExportManager {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
    }

    exportResults() {
        if (Object.keys(this.srcMiner.results).length === 0) {
            alert('没有数据可导出');
            return;
        }

        this.showExportModal();
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'flex';


            if (!this.modalListenersAdded) {
                this.addModalListeners();
                this.modalListenersAdded = true;
            }
        }
    }

    hideExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    addModalListeners() {

        const closeBtn = document.getElementById('closeExportModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideExportModal());
        }


        const jsonBtn = document.getElementById('exportJSON');
        if (jsonBtn) {
            jsonBtn.addEventListener('click', async () => {
                this.hideExportModal();
                await this.exportToJSON();
            });
        }


        const xlsBtn = document.getElementById('exportCSV');
        if (xlsBtn) {
            xlsBtn.addEventListener('click', async () => {
                this.hideExportModal();
                await this.exportToXLS();
            });
        }


        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'exportModal') {
                    this.hideExportModal();
                }
            });
        }
    }

    async exportToJSON() {
        const dataStr = JSON.stringify(this.srcMiner.results, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const fileName = await this.generateFileName();
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    async exportToXLS() {

        let xlsContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>幻影工具</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D4EDF9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="URL">
   <Font ss:Color="#0066CC" ss:Underline="Single"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;


        const categories = Object.keys(this.srcMiner.results);
        let hasData = false;


        const displayManager = this.srcMiner.displayManager;

        for (const category of categories) {
            const items = this.srcMiner.results[category];
            if (Array.isArray(items) && items.length > 0) {
                hasData = true;
                const sheetName = this.sanitizeSheetName(category);

                xlsContent += `
 <Worksheet ss:Name="${this.escapeXml(sheetName)}">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="400"/>
   <Column ss:Width="120"/>
   <Column ss:Width="350"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">序号</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">内容</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">分类</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">来源URL</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">结果来源</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">提取时间</Data></Cell>
   </Row>`;


                for (let index = 0; index < items.length; index++) {
                    const item = items[index];
                    let locationInfo = {
                        sourceUrl: '未知来源',
                        pageTitle: '未知页面',
                        extractedAt: new Date().toISOString()
                    };


                    try {
                        if (displayManager && typeof displayManager.getItemLocationInfo === 'function') {
                            locationInfo = await displayManager.getItemLocationInfo(category, item);
                        } else {

                            if (typeof item === 'object' && item !== null) {
                                locationInfo = {
                                    sourceUrl: item.sourceUrl || '未知来源',
                                    pageTitle: item.pageTitle || '未知页面',
                                    extractedAt: item.extractedAt || new Date().toISOString()
                                };
                            }
                        }
                    } catch (error) {
                        console.warn(`[ExportManager] 获取项目位置信息失败:`, error);
                    }


                    const itemContent = typeof item === 'object' && item !== null ?
                        (item.value || item.text || item.content || JSON.stringify(item)) :
                        String(item);


                    const extractedTime = locationInfo.extractedAt ?
                        new Date(locationInfo.extractedAt).toLocaleString('zh-CN') :
                        '未知时间';

                    xlsContent += `
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${this.escapeXml(itemContent)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${this.escapeXml(category)}</Data></Cell>
    <Cell ss:StyleID="URL"><Data ss:Type="String">${this.escapeXml(locationInfo.sourceUrl)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${this.escapeXml(locationInfo.pageTitle)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${this.escapeXml(extractedTime)}</Data></Cell>
   </Row>`;
                }

                xlsContent += `
  </Table>
 </Worksheet>`;
            }
        }


        if (!hasData) {
            xlsContent += `
 <Worksheet ss:Name="无数据">
  <Table>
   <Column ss:Width="200"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">提示</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="String">没有找到任何数据</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
        }

        xlsContent += `
</Workbook>`;


        const blob = new Blob([xlsContent], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);

        const fileName = await this.generateFileName();
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.xls`;
        a.click();

        URL.revokeObjectURL(url);
    }


    sanitizeSheetName(name) {

        let sanitized = name.replace(/[\\\/\?\*\[\]:]/g, '_');

        if (sanitized.length > 31) {
            sanitized = sanitized.substring(0, 28) + '...';
        }
        return sanitized || '未命名';
    }


    async generateFileName() {
        let domain = 'unknown';

        try {

            const tabs = await new Promise((resolve) => {
                chrome.tabs.query({active: true, currentWindow: true}, resolve);
            });

            if (tabs[0] && tabs[0].url) {
                const url = new URL(tabs[0].url);
                domain = url.hostname;

            }
        } catch (e) {


            try {
                const domainElement = document.getElementById('currentDomain');
                if (domainElement && domainElement.textContent) {
                    const domainText = domainElement.textContent;

                    const match = domainText.match(/https?:\/\/([^\/\s:]+)/);
                    if (match && match[1]) {
                        domain = match[1];

                    }
                }
            } catch (domError) {

            }
        }


        if (domain === 'unknown') {
            domain = `scan_${Date.now()}`;
        }


        domain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');


        const randomNum = Math.floor(100000 + Math.random() * 900000);

        return `${domain}__${randomNum}`;
    }


    escapeXml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}