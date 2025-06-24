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
function base64EncodeWithNewlines(buffer) {
    const byteArray = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < byteArray.length; i++) {
        binaryString += String.fromCharCode(byteArray[i]);
    }
    
    // 基本base64编码
    const base64Data = btoa(binaryString);
    
    // 每76个字符添加换行符
    let formattedBase64 = '';
    for (let i = 0; i < base64Data.length; i += 76) {
        formattedBase64 += base64Data.substring(i, i + 76) + '\n';
    }
    
    return formattedBase64;
}

function murmurhash3_32_gc(key, seed = 0) {
    let h1 = seed;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const length = key.length;
    
    // 处理4字节块
    let i = 0;
    while (i <= length - 4) {
        let k1 = 
            (key[i] & 0xff) |
            ((key[i + 1] & 0xff) << 8) |
            ((key[i + 2] & 0xff) << 16) |
            ((key[i + 3] & 0xff) << 24);
        
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17); // ROTL32(k1, 15)
        k1 = Math.imul(k1, c2);
        
        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19); // ROTL32(h1, 13)
        h1 = Math.imul(h1, 5) + 0xe6546b64;
        
        i += 4;
    }
    
    // 处理尾部
    let k1 = 0;
    const tail = length % 4;
    if (tail === 3) k1 ^= (key[i + 2] & 0xff) << 16;
    if (tail >= 2) k1 ^= (key[i + 1] & 0xff) << 8;
    if (tail >= 1) k1 ^= (key[i] & 0xff);
    
    if (tail > 0) {
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17); // ROTL32(k1, 15)
        k1 = Math.imul(k1, c2);
        h1 ^= k1;
    }
    
    // 最终处理
    h1 ^= length;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;
    
    return h1 | 0; // 返回有符号32位整数
}

// 可靠的 FOFA 哈希计算
function calculateFofaHash(buffer) {
    try {
        // 步骤1: 获取图标内容 (buffer已经是二进制内容)
        // 步骤2: 进行base64编码并添加换行符
        const base64Data = base64EncodeWithNewlines(buffer);
        
        // 转换为字节数组
        const encoder = new TextEncoder();
        const byteArray = encoder.encode(base64Data);
        
        // 步骤3: 计算32位MurmurHash3
        const hash = murmurhash3_32_gc(byteArray);
        
        // 返回十进制格式的有符号整数
        return hash.toString();
    } catch (error) {
        console.error('计算FOFA哈希失败:', error);
        return null;
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
    const fofaDisplay = document.getElementById('icon-fofa');
    const previewImage = document.getElementById('previewImage');
    const previewSize = document.getElementById('previewSize');
    const previewMd5 = document.getElementById('previewMd5');
    const previewFofa = document.getElementById('previewFofa');
    
    loading.style.display = 'none';
    
    if (url) {
        favicon.src = url;
        favicon.style.display = 'block';
        noIcon.style.display = 'none';
        previewImage.src = url;
        
        if (sizeInfo) {
            sizeDisplay.textContent = sizeInfo;
            sizeDisplay.style.display = 'block';
            previewSize.textContent = `尺寸: ${sizeInfo}`;
        } else {
            previewSize.textContent = `尺寸: 未知`;
        }
        
        sourceDisplay.textContent = `来源: ${source}`;
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            // 计算MD5
            const md5Value = SparkMD5.ArrayBuffer.hash(arrayBuffer);
            md5Display.textContent = `MD5: ${md5Value}`;
            previewMd5.textContent = `MD5: ${md5Value}`;
            
            // 计算FOFA哈希
            const fofaHash = calculateFofaHash(arrayBuffer);
            const fofaDisplay = document.getElementById('icon-fofa');
            const previewFofa = document.getElementById('previewFofa');
            
            
            if (fofaHash) {
                fofaDisplay.textContent = `FOFA: ${fofaHash}`;
                previewFofa.textContent = `FOFA: ${fofaHash}`;
            } else {
                fofaDisplay.textContent = 'FOFA: 计算失败';
                previewFofa.textContent = 'FOFA: 计算失败';
            }
            
            // 保存到历史记录
            saveToHistory(url, sizeInfo, source, md5Value, fofaHash);
        } catch (error) {
            console.error('图标处理失败:', error);
            md5Display.textContent = 'MD5: 获取失败';
            fofaDisplay.textContent = 'FOFA: 获取失败';
            previewMd5.textContent = 'MD5: 获取失败';
            previewFofa.textContent = 'FOFA: 获取失败';
            
            // 保存到历史记录（哈希值为空）
            saveToHistory(url, sizeInfo, source, null, null);
        }
    } else {
        favicon.style.display = 'none';
        noIcon.style.display = 'block';
        sizeDisplay.style.display = 'none';
        sourceDisplay.textContent = '';
        md5Display.textContent = '';
        fofaDisplay.textContent = '';
        previewImage.src = '';
        previewMd5.textContent = '';
        previewFofa.textContent = '';
    }
}


// 保存到历史记录
function saveToHistory(url, sizeInfo, source, md5Value,fofaHash) {
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
        fofa: fofaHash,
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
        icon.title = `${item.title}\n${item.domain}\n尺寸: ${item.sizeInfo || '未知'}\n来源: ${item.source}\nHunter: ${item.md5 || '未计算'}\nFOFA: ${item.fofa || '未计算'}`;

        // 点击历史图标时显示对应的网站图标
        icon.addEventListener('click', () => {
            displayFavicon(item.url, item.sizeInfo, item.source);
            document.getElementById('site-title').textContent = item.title;
            document.getElementById('site-url').textContent = item.domain;
            document.getElementById('icon-source').textContent = `来源: ${item.source}`;
            document.getElementById('icon-md5').textContent = item.md5 ? `Hunter: ${item.md5}` : '';
            document.getElementById('icon-fofa').textContent = item.fofa ? `FOFA: ${item.fofa}` : '';
            document.getElementById('previewMd5').textContent = item.md5 ? `Hunter: ${item.md5}` : '';
            document.getElementById('previewFofa').textContent = item.fofa ? `FOFA: ${item.fofa}` : '';
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
        document.getElementById('copyFofaBtn').addEventListener('click', () => {
        const fofaText = document.getElementById('icon-fofa').textContent.replace('FOFA: ', '');
        if (fofaText && fofaText !== '计算失败') {
            navigator.clipboard.writeText("icon_hash=\""+fofaText+"\"")
        } else {
            alert('没有可复制的FOFA哈希');
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