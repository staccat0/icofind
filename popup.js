// 获取当前活动标签页的网站信息
async function getCurrentSiteInfo() {
    try {
        showLoading();
        hideError();
        
        // 查询当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url) {
            showError("没有活动的标签页");
            return;
        }
        
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        // 设置网站标题和URL
        document.getElementById('site-title').textContent = tab.title || domain;
        document.getElementById('site-url').textContent = domain;
        document.getElementById('previewDomain').textContent = domain;
        
        // 更新状态指示器
        updateStatusIndicator('active');
        
        // 向当前标签页发送消息，获取图标信息
        chrome.tabs.sendMessage(tab.id, { action: "getFavicon" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                showError("无法访问当前页面内容");
                return;
            }
            
            if (response && response.faviconUrl) {
                displayFavicon(response.faviconUrl, response.sizeInfo, response.source);
            } else {
                showError("未找到图标信息");
            }
        });
        
    } catch (error) {
        console.error('获取网站信息失败:', error);
        showError("发生未知错误");
    }
}

// 显示图标
async function displayFavicon(url, sizeInfo, source) {
    const loading = document.getElementById('loading');
    const favicon = document.getElementById('favicon');
    const noIcon = document.getElementById('no-icon');
    const sizeDisplay = document.getElementById('icon-size');
    const sourceDisplay = document.getElementById('icon-source');
    const md5Display = document.getElementById('icon-md5');
    const previewImage = document.getElementById('previewImage');
    const previewSize = document.getElementById('previewSize');
    const previewMd5 = document.getElementById('previewMd5');
    
    loading.style.display = 'none';
    
    if (url) {
        // 设置图标
        favicon.src = url;
        favicon.style.display = 'block';
        noIcon.style.display = 'none';
        previewImage.src = url;
        
        // 设置图标尺寸信息
        if (sizeInfo) {
            sizeDisplay.textContent = sizeInfo;
            sizeDisplay.style.display = 'block';
            previewSize.textContent = `尺寸: ${sizeInfo}`;
        } else {
            previewSize.textContent = `尺寸: 未知`;
        }
        
        // 设置图标来源信息
        sourceDisplay.textContent = `来源: ${source}`;
        
        // 计算并显示MD5值（使用spark-md5）
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const md5Value = SparkMD5.ArrayBuffer.hash(arrayBuffer);
            
            md5Display.textContent = `MD5: ${md5Value}`;
            previewMd5.textContent = `MD5: ${md5Value}`;
            
            // 保存到历史记录（包含MD5值）
            saveToHistory(url, sizeInfo, source, md5Value);
        } catch (error) {
            console.error('计算MD5失败:', error);
            md5Display.textContent = 'MD5: 计算失败';
            previewMd5.textContent = 'MD5: 计算失败';
            // 保存到历史记录（MD5值为空）
            saveToHistory(url, sizeInfo, source, null);
        }
    } else {
        favicon.style.display = 'none';
        noIcon.style.display = 'block';
        sizeDisplay.style.display = 'none';
        sourceDisplay.textContent = '';
        md5Display.textContent = '';
        previewImage.src = '';
        previewMd5.textContent = '';
    }
}

// 保存到历史记录
function saveToHistory(url, sizeInfo, source, md5Value) {
    const domain = document.getElementById('site-url').textContent;
    const title = document.getElementById('site-title').textContent;
    
    // 获取现有历史记录
    const history = JSON.parse(localStorage.getItem('iconHistory') || '[]');
    
    // 检查是否已存在
    const existingIndex = history.findIndex(item => item.url === url);
    if (existingIndex !== -1) {
        // 如果已存在，移除旧记录
        history.splice(existingIndex, 1);
    }
    
    // 添加新记录到开头
    history.unshift({ 
        domain, 
        title,
        url, 
        sizeInfo,
        source,
        md5: md5Value, // 新增MD5字段
        timestamp: new Date().getTime() 
    });
    
    // 只保留最近的10条记录
    if (history.length > 10) {
        history.pop();
    }
    
    // 保存到本地存储
    localStorage.setItem('iconHistory', JSON.stringify(history));
    
    // 更新历史记录显示
    renderHistory(history);
}

// 渲染历史记录
function renderHistory(history) {
    const historyContainer = document.getElementById('history-icons');
    const historyCount = document.getElementById('historyCount');
    
    historyCount.textContent = `(${history.length})`;
    
    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<div style="padding:10px;text-align:center;opacity:0.7">无历史记录</div>';
        return;
    }
    
    historyContainer.innerHTML = '';
    
    history.forEach(item => {
        const icon = document.createElement('img');
        icon.className = 'history-icon';
        icon.src = item.url;
        icon.alt = item.domain;
        icon.title = `${item.title}\n${item.domain}\n尺寸: ${item.sizeInfo || '未知'}\n来源: ${item.source}\nMD5: ${item.md5 || '未计算'}`;
        
        // 点击历史图标时显示对应的网站图标
        icon.addEventListener('click', () => {
            displayFavicon(item.url, item.sizeInfo, item.source);
            document.getElementById('site-title').textContent = item.title;
            document.getElementById('site-url').textContent = item.domain;
            document.getElementById('icon-source').textContent = `来源: ${item.source}`;
            document.getElementById('icon-md5').textContent = item.md5 ? `MD5: ${item.md5}` : '';
            document.getElementById('previewDomain').textContent = item.domain;
            document.getElementById('previewMd5').textContent = item.md5 ? `MD5: ${item.md5}` : '';
        });
        
        historyContainer.appendChild(icon);
    });
}

// 显示错误
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    hideLoading();
    updateStatusIndicator('error');
}

// 隐藏错误
function hideError() {
    document.getElementById('errorContainer').style.display = 'none';
}

// 显示加载
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('favicon').style.display = 'none';
    document.getElementById('no-icon').style.display = 'none';
    document.getElementById('icon-size').style.display = 'none';
    document.getElementById('icon-md5').textContent = '';
    document.getElementById('previewMd5').textContent = '';
}

// 隐藏加载
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// 更新状态指示器
function updateStatusIndicator(status) {
    const indicator = document.getElementById('statusIndicator');
    
    if (status === 'active') {
        indicator.style.backgroundColor = '#4CAF50';
        indicator.style.boxShadow = '0 0 8px #4CAF50';
    } else if (status === 'error') {
        indicator.style.backgroundColor = '#ff5757';
        indicator.style.boxShadow = '0 0 8px #ff5757';
    } else {
        indicator.style.backgroundColor = '#ffc107';
        indicator.style.boxShadow = '0 0 8px #ffc107';
    }
}

// 下载图标
function downloadFavicon(url, filename) {
    if (!url) {
        alert('没有可下载的图标');
        return;
    }
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${document.getElementById('site-url').textContent}-favicon.ico`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 查看图标源码
function viewFaviconSource(url) {
    if (!url) {
        alert('没有可查看的图标');
        return;
    }
    
    // 在新标签页中打开图标URL
    chrome.tabs.create({ url });
}

// 尝试解决问题
function troubleshoot() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id);
            setTimeout(getCurrentSiteInfo, 1000);
        }
    });
}

// 显示图标预览
function showIconPreview() {
    const url = document.getElementById('favicon').src;
    if (!url) {
        alert('没有可预览的图标');
        return;
    }
    
    document.getElementById('iconPreview').style.display = 'flex';
}

// 初始化事件监听器
function initEventListeners() {
    // 下载按钮
    document.getElementById('downloadBtn').addEventListener('click', () => {
        const url = document.getElementById('favicon').src;
        downloadFavicon(url);
    });
    
    // 查看源码按钮
    document.getElementById('viewSourceBtn').addEventListener('click', () => {
        const url = document.getElementById('favicon').src;
        viewFaviconSource(url);
    });
    
    // 故障排除按钮
    document.getElementById('troubleshootBtn').addEventListener('click', troubleshoot);
    
    // 预览按钮
    document.getElementById('previewBtn').addEventListener('click', showIconPreview);
    
    // 预览下载按钮
    document.getElementById('downloadPreviewBtn').addEventListener('click', () => {
        const url = document.getElementById('previewImage').src;
        const domain = document.getElementById('previewDomain').textContent;
        downloadFavicon(url, `${domain}-favicon.ico`);
    });
    
    // 复制MD5按钮
    document.getElementById('copyMd5Btn').addEventListener('click', () => {
        const md5Text = document.getElementById('icon-md5').textContent.replace('MD5: ', '');
        if (md5Text && md5Text !== '计算失败') {
            navigator.clipboard.writeText("web.icon=\""+md5Text+"\"")
        } else {
            alert('没有可复制的MD5值');
        }
    });
    
    // 关闭预览
    document.querySelector('.close-preview').addEventListener('click', () => {
        document.getElementById('iconPreview').style.display = 'none';
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化事件监听器
    initEventListeners();
    
    // 获取当前网站信息
    getCurrentSiteInfo();
    
    // 加载历史记录
    const history = JSON.parse(localStorage.getItem('iconHistory') || '[]');
    renderHistory(history);
});