// 获取当前活动标签页的网站信息
async function getCurrentSiteInfo() {
    try {
        showLoading();
        hideError();
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url) {
            showError("没有活动的标签页");
            return;
        }
        
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        document.getElementById('site-title').textContent = tab.title || domain;
        document.getElementById('site-url').textContent = domain;
        document.getElementById('previewDomain').textContent = domain;
        
        updateStatusIndicator('active');

        // 检查是否有缓存的完整状态（同页面重新打开无需重新计算）
        const cacheKey = tab.url + '_popup';
        try {
            const cached = await STORE.get(cacheKey);
            if (cached && cached[cacheKey] && cached[cacheKey].icons) {
                const state = cached[cacheKey];
                _currentIcons = state.icons;
                _currentHashes = state.hashes;
                _curIconIdx = state.curIdx;
                restorePopupState(state);
                return;
            }
        } catch (e) {}

        // 从 storage.session 读取图标列表
        try {
            const stored = await chrome.storage.session.get(tab.url);
            if (stored && stored[tab.url]) {
                const data = stored[tab.url];
                const icons = Array.isArray(data) ? data : [data];
                if (icons.length > 0 && icons[0].faviconUrl) {
                    _currentPageUrl = tab.url;
                    displayFavicon(icons);
                    return;
                }
            }
        } catch (e) {}
        
        // storage 未命中，走消息通信兜底
        chrome.tabs.sendMessage(tab.id, { action: "getFavicon" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                showError("无法访问当前页面内容");
                return;
            }
            
            if (response) {
                const icons = Array.isArray(response) ? response : [response];
                if (icons.length > 0 && icons[0].faviconUrl) {
                    _currentPageUrl = tab.url;
                    displayFavicon(icons);
                    return;
                }
            }
            showError("未找到图标信息");
        });
        
    } catch (error) {
        console.error('获取网站信息失败:', error);
        showError("发生未知错误");
    }
}

// 从缓存恢复 popup 完整状态（无需重新计算）
function restorePopupState(state) {
    const icons = state.icons;
    const hashes = state.hashes;
    const idx = state.curIdx || 0;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('favicon').style.display = 'block';
    document.getElementById('no-icon').style.display = 'none';

    if (icons[idx]) {
        document.getElementById('favicon').src = icons[idx].faviconUrl;
        document.getElementById('previewImage').src = icons[idx].faviconUrl;
        updateIconSource(idx, icons.length, icons[idx].source);

        if (icons[idx].sizeInfo && icons[idx].sizeInfo !== '未知尺寸') {
            document.getElementById('icon-size').textContent = icons[idx].sizeInfo;
            document.getElementById('icon-size').style.display = 'block';
            document.getElementById('previewSize').textContent = '尺寸: ' + icons[idx].sizeInfo;
        }
    }

    if (hashes[idx]) {
        document.getElementById('icon-md5').textContent = hashes[idx].md5 || '获取失败';
        document.getElementById('icon-fofa').textContent = hashes[idx].fofa || '获取失败';
        document.getElementById('icon-quake').textContent = hashes[idx].md5 || '获取失败';
        document.getElementById('previewMd5').textContent = 'Hunter: ' + (hashes[idx].md5 || '获取失败');
        document.getElementById('previewFofa').textContent = 'FOFA: ' + (hashes[idx].fofa || '获取失败');
    }

    if (state.matchedHTML) {
        document.getElementById('site-match').innerHTML = state.matchedHTML;
    }

    if (icons.length > 1) {
        document.getElementById('iconPrev').classList.add('show');
        document.getElementById('iconNext').classList.add('show');
    }
}

function base64EncodeWithNewlines(buffer) {
    const byteArray = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < byteArray.length; i++) {
        binaryString += String.fromCharCode(byteArray[i]);
    }
    
    const base64Data = btoa(binaryString);
    
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
    
    let i = 0;
    while (i <= length - 4) {
        let k1 = 
            (key[i] & 0xff) |
            ((key[i + 1] & 0xff) << 8) |
            ((key[i + 2] & 0xff) << 16) |
            ((key[i + 3] & 0xff) << 24);
        
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, c2);
        
        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1 = Math.imul(h1, 5) + 0xe6546b64;
        
        i += 4;
    }
    
    let k1 = 0;
    const tail = length % 4;
    if (tail === 3) k1 ^= (key[i + 2] & 0xff) << 16;
    if (tail >= 2) k1 ^= (key[i + 1] & 0xff) << 8;
    if (tail >= 1) k1 ^= (key[i] & 0xff);
    
    if (tail > 0) {
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, c2);
        h1 ^= k1;
    }
    
    h1 ^= length;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;
    
    return h1 | 0;
}

function calculateFofaHash(buffer) {
    try {
        const base64Data = base64EncodeWithNewlines(buffer);
        const encoder = new TextEncoder();
        const byteArray = encoder.encode(base64Data);
        const hash = murmurhash3_32_gc(byteArray);
        return hash.toString();
    } catch (error) {
        console.error('计算FOFA哈希失败:', error);
        return null;
    }
}

// ===== 存储层：chrome.storage.local（落盘持久化） =====
const STORE = chrome.storage.local;

// 哈希缓存
async function getHashCache(url) {
    try {
        const data = await STORE.get('hashCache');
        return (data.hashCache && data.hashCache[url]) || null;
    } catch (e) {
        return null;
    }
}

async function setHashCache(url, md5, fofa) {
    try {
        const data = await STORE.get('hashCache');
        const cache = data.hashCache || {};
        cache[url] = { md5, fofa };
        const keys = Object.keys(cache);
        if (keys.length > 50) {
            delete cache[keys[0]];
        }
        await STORE.set({ hashCache: cache });
    } catch (e) {}
}

// 指纹库操作
async function getFingerprints() {
    try {
        const data = await STORE.get('fingerprints');
        return data.fingerprints || [];
    } catch (e) {
        return [];
    }
}

async function saveFingerprints(list) {
    await STORE.set({ fingerprints: list });
}

async function addFingerprint(type, hash, name) {
    const list = await getFingerprints();
    list.push({ id: Date.now(), type, hash, name });
    await saveFingerprints(list);
    await renderFingerprints();
}

async function deleteFingerprint(id) {
    const list = (await getFingerprints()).filter(f => f.id !== id);
    await saveFingerprints(list);
    await renderFingerprints();
    await matchAllHashes(_currentHashes, _currentIcons);
}

// 当前图标列表和哈希（用于指纹变更后重新匹配）
let _currentIcons = [];
let _currentHashes = [];
let _curIconIdx = 0;
let _currentPageUrl = '';

// 手动切换到指定图标
function switchToIcon(idx) {
    if (!_currentIcons[idx]) return;
    _curIconIdx = idx;
    const icon = _currentIcons[idx];
    const hash = _currentHashes[idx];

    document.getElementById('favicon').src = icon.faviconUrl;
    document.getElementById('previewImage').src = icon.faviconUrl;
    updateIconSource(idx, _currentIcons.length, icon.source);

    const sizeDisplay = document.getElementById('icon-size');
    const previewSize = document.getElementById('previewSize');
    if (icon.sizeInfo && icon.sizeInfo !== '未知尺寸') {
        sizeDisplay.textContent = icon.sizeInfo;
        sizeDisplay.style.display = 'block';
        previewSize.textContent = '尺寸: ' + icon.sizeInfo;
    }

    if (hash) {
        document.getElementById('icon-md5').textContent = hash.md5 || '获取失败';
        document.getElementById('icon-fofa').textContent = hash.fofa || '获取失败';
        document.getElementById('icon-quake').textContent = hash.md5 || '获取失败';
        document.getElementById('previewMd5').textContent = 'Hunter: ' + (hash.md5 || '获取失败');
        document.getElementById('previewFofa').textContent = 'FOFA: ' + (hash.fofa || '获取失败');
    }
}

// 检查所有图标哈希匹配
async function matchAllHashes(iconHashes, icons) {
    _currentIcons = icons;
    _currentHashes = iconHashes;

    const fps = await getFingerprints();
    const allMatched = [];
    let matchedIconIdx = null;

    for (let idx = 0; idx < iconHashes.length; idx++) {
        const h = iconHashes[idx];
        if (!h) continue;
        const matchMd5 = fps.filter(f => f.type === 'md5' && f.hash === h.md5);
        const matchFofa = fps.filter(f => f.type === 'fofa' && f.hash === h.fofa);
        const matches = [...matchMd5, ...matchFofa];
        if (matches.length > 0) {
            allMatched.push(...matches);
            if (matchedIconIdx === null) matchedIconIdx = idx;
        }
    }

    // 有匹配 → 切换到第一个匹配到的图标
    if (matchedIconIdx !== null) {
        switchToIcon(matchedIconIdx);
    }
    // 无匹配且第一个图标无效 → 切到第一个有效图标
    else if (!iconHashes[0]) {
        const firstValid = iconHashes.findIndex(h => h !== null);
        if (firstValid > 0) switchToIcon(firstValid);
        else {
            document.getElementById('icon-md5').textContent = '获取失败';
            document.getElementById('icon-fofa').textContent = '获取失败';
            document.getElementById('icon-quake').textContent = '获取失败';
        }
    }

    // 显示所有匹配到的系统名
    const names = [...new Set(allMatched.map(m => m.name))];
    const siteMatch = document.getElementById('site-match');
    if (siteMatch) {
        if (names.length > 0) {
            siteMatch.innerHTML = names.map(n =>
                '<span class="site-match-tag">&#9878; ' + escapeHtml(n) + '</span>'
            ).join(' ');
        } else {
            siteMatch.innerHTML = '';
        }
    }

    // 保存历史记录（主图标）
    const firstIcon = icons[0];
    const curHash = iconHashes[_curIconIdx];
    if (firstIcon) {
        saveToHistory(firstIcon.faviconUrl, firstIcon.sizeInfo, firstIcon.source, curHash ? curHash.md5 : null, curHash ? curHash.fofa : null);
    }

    // 缓存完整状态，同页面重新打开 popup 无需重新计算
    if (_currentPageUrl) {
        const cacheKey = _currentPageUrl + '_popup';
        STORE.set({
            [cacheKey]: {
                icons: icons,
                hashes: iconHashes,
                curIdx: _curIconIdx,
                matchedHTML: document.getElementById('site-match').innerHTML
            }
        }).catch(() => {});
    }
}

// 计算所有图标的哈希
async function calculateAllHashes(icons) {
    const hashTasks = icons.map(async (icon) => {
        const cached = await getHashCache(icon.faviconUrl);
        if (cached && cached.md5) {
            return { md5: cached.md5, fofa: cached.fofa };
        }
        try {
            const response = await fetch(icon.faviconUrl);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            const md5 = SparkMD5.ArrayBuffer.hash(arrayBuffer);
            const fofa = calculateFofaHash(arrayBuffer);
            await setHashCache(icon.faviconUrl, md5, fofa);
            return { md5, fofa };
        } catch (e) {
            return null;
        }
    });

    const rawHashes = await Promise.all(hashTasks);

    // 按 MD5 去重，保留首次出现的图标
    const seen = new Set();
    const dedupIcons = [];
    const dedupHashes = [];
    for (let i = 0; i < rawHashes.length; i++) {
        const h = rawHashes[i];
        if (h && h.md5 && seen.has(h.md5)) continue;
        if (h && h.md5) seen.add(h.md5);
        dedupIcons.push(icons[i]);
        dedupHashes.push(h);
    }

    await matchAllHashes(dedupHashes, dedupIcons);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 更新来源和图标顺序显示
function updateIconSource(idx, total, source) {
    const parts = [];
    if (source) parts.push('来源: ' + source);
    if (total > 1) parts.push('图标 ' + (idx + 1) + '/' + total);
    document.getElementById('icon-source').textContent = parts.join(' · ');
}

// 显示图标（接受图标数组）
function displayFavicon(icons) {
    const loading = document.getElementById('loading');
    const favicon = document.getElementById('favicon');
    const noIcon = document.getElementById('no-icon');
    const sizeDisplay = document.getElementById('icon-size');
    const previewImage = document.getElementById('previewImage');
    const previewSize = document.getElementById('previewSize');

    loading.style.display = 'none';

    if (icons && icons.length > 0) {
        const first = icons[0];
        favicon.src = first.faviconUrl;
        favicon.style.display = 'block';
        noIcon.style.display = 'none';
        previewImage.src = first.faviconUrl;

        if (first.sizeInfo && first.sizeInfo !== '未知尺寸') {
            sizeDisplay.textContent = first.sizeInfo;
            sizeDisplay.style.display = 'block';
            previewSize.textContent = '尺寸: ' + first.sizeInfo;
        } else {
            sizeDisplay.style.display = 'none';
            previewSize.textContent = '尺寸: 未知';
        }

        updateIconSource(0, icons.length, first.source);

        // 多图标时显示切换箭头
        if (icons.length > 1) {
            document.getElementById('iconPrev').classList.add('show');
            document.getElementById('iconNext').classList.add('show');
        } else {
            document.getElementById('iconPrev').classList.remove('show');
            document.getElementById('iconNext').classList.remove('show');
        }

        calculateAllHashes(icons);
    } else {
        favicon.style.display = 'none';
        noIcon.style.display = 'block';
        sizeDisplay.style.display = 'none';
        document.getElementById('icon-source').textContent = '';
        document.getElementById('icon-md5').textContent = '--';
        document.getElementById('icon-fofa').textContent = '--';
        document.getElementById('icon-quake').textContent = '--';
        previewImage.src = '';
        document.getElementById('previewMd5').textContent = '';
        document.getElementById('previewFofa').textContent = '';
        document.getElementById('site-match').innerHTML = '';
    }
}

// 保存到历史记录
async function saveToHistory(url, sizeInfo, source, md5Value, fofaHash) {
    const domain = document.getElementById('site-url').textContent;
    const title = document.getElementById('site-title').textContent;
    
    const data = await STORE.get('iconHistory');
    const history = data.iconHistory || [];
    
    const existingIndex = history.findIndex(item => item.url === url);
    if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
    }
    
    history.unshift({ 
        domain, 
        title,
        url, 
        sizeInfo,
        source,
        md5: md5Value,
        fofa: fofaHash,
        timestamp: new Date().getTime() 
    });
    
    if (history.length > 10) {
        history.pop();
    }
    
    await STORE.set({ iconHistory: history });
    renderHistory(history);
}

// 渲染历史记录
function renderHistory(history) {
    const historyContainer = document.getElementById('history-icons');
    const historyCount = document.getElementById('historyCount');
    
    historyCount.textContent = '(' + history.length + ')';
    
    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<div class="history-empty">暂无历史记录</div>';
        return;
    }
    
    historyContainer.innerHTML = '';
    
    history.forEach(item => {
        const icon = document.createElement('img');
        icon.className = 'history-icon';
        icon.src = item.url;
        icon.alt = item.domain;
        icon.title = [
            item.title,
            item.domain,
            '尺寸: ' + (item.sizeInfo || '未知'),
            '来源: ' + (item.source || '未知'),
            'Hunter: ' + (item.md5 || '未计算'),
            'FOFA: ' + (item.fofa || '未计算')
        ].join('\n');

        icon.addEventListener('click', async () => {
            displayFavicon([{ faviconUrl: item.url, sizeInfo: item.sizeInfo, source: item.source }]);
            document.getElementById('site-title').textContent = item.title;
            document.getElementById('site-url').textContent = item.domain;
            document.getElementById('icon-source').textContent = item.source ? '来源: ' + item.source : '';
        });
        
        historyContainer.appendChild(icon);
    });
}

// 显示错误
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorContainer').style.display = 'block';
    hideLoading();
    updateStatusIndicator('error');
}

function hideError() {
    document.getElementById('errorContainer').style.display = 'none';
}

// 显示加载
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('favicon').style.display = 'none';
    document.getElementById('no-icon').style.display = 'none';
    document.getElementById('icon-size').style.display = 'none';
    document.getElementById('icon-md5').textContent = '等待计算...';
    document.getElementById('icon-fofa').textContent = '等待计算...';
    document.getElementById('icon-quake').textContent = '等待计算...';
    document.getElementById('previewMd5').textContent = '';
    document.getElementById('previewFofa').textContent = '';
    document.getElementById('site-match').innerHTML = '';
    _currentIcons = [];
    _currentHashes = [];
    _curIconIdx = 0;
    _currentPageUrl = '';
}

// 更新状态指示器（使用 CSS class）
function updateStatusIndicator(status) {
    const indicator = document.getElementById('statusIndicator');
    indicator.classList.remove('error', 'warning');
    if (status === 'error') {
        indicator.classList.add('error');
    } else if (status === 'warning') {
        indicator.classList.add('warning');
    }
}

// 下载图标
function downloadFavicon(url, filename) {
    if (!url) {
        alert('没有可下载的图标');
        return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || document.getElementById('site-url').textContent + '-favicon.ico';
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

// 复制到剪贴板并显示视觉反馈
function copyToClipboard(text, btn) {
    if (!text) {
        alert('没有可复制的值');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1200);
    });
}

// 渲染指纹列表
async function renderFingerprints() {
    const list = await getFingerprints();
    const container = document.getElementById('fpList');
    const countEl = document.getElementById('fpCount');

    countEl.textContent = '(' + list.length + ')';

    if (list.length === 0) {
        container.innerHTML = '<div class="fp-empty">暂无指纹数据</div>';
        return;
    }

    container.innerHTML = list.map(f =>
        '<div class="fp-item">' +
            '<span class="fp-type-badge ' + f.type + '">' + f.type + '</span>' +
            '<span class="fp-item-hash" title="' + escapeHtml(f.hash) + '">' + escapeHtml(f.hash) + '</span>' +
            '<span class="fp-item-name">' + escapeHtml(f.name) + '</span>' +
            '<button class="fp-delete" data-id="' + f.id + '">&times;</button>' +
        '</div>'
    ).join('');
}

// 初始化事件监听器
function initEventListeners() {
    // 下载按钮
    document.getElementById('downloadBtn').addEventListener('click', () => {
        downloadFavicon(document.getElementById('favicon').src);
    });
    
    // 查看源码按钮
    document.getElementById('viewSourceBtn').addEventListener('click', () => {
        viewFaviconSource(document.getElementById('favicon').src);
    });
    
    // 故障排除按钮
    document.getElementById('troubleshootBtn').addEventListener('click', troubleshoot);
    
    // 预览按钮
    document.getElementById('previewBtn').addEventListener('click', showIconPreview);
    
    // 预览下载按钮
    document.getElementById('downloadPreviewBtn').addEventListener('click', () => {
        const url = document.getElementById('previewImage').src;
        const domain = document.getElementById('previewDomain').textContent;
        downloadFavicon(url, domain + '-favicon.ico');
    });
    
    // 复制 Hunter (MD5)
    document.getElementById('copyMd5Btn').addEventListener('click', function() {
        const md5 = document.getElementById('icon-md5').textContent;
        if (md5 && md5 !== '获取失败' && md5 !== '等待计算...') {
            copyToClipboard('web.icon="' + md5 + '"', this);
        } else {
            alert('没有可复制的MD5值');
        }
    });
    
    // 复制 FOFA
    document.getElementById('copyFofaBtn').addEventListener('click', function() {
        const fofa = document.getElementById('icon-fofa').textContent;
        if (fofa && fofa !== '获取失败' && fofa !== '等待计算...') {
            copyToClipboard('icon_hash="' + fofa + '"', this);
        } else {
            alert('没有可复制的FOFA哈希');
        }
    });
    
    // 复制 Quake
    document.getElementById('copyQuakeBtn').addEventListener('click', function() {
        const md5 = document.getElementById('icon-md5').textContent;
        if (md5 && md5 !== '获取失败' && md5 !== '等待计算...') {
            copyToClipboard('favicon: "' + md5 + '"', this);
        } else {
            alert('没有可复制的MD5值');
        }
    });
    
    // 关闭预览
    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('iconPreview').style.display = 'none';
    });

    // 指纹库面板折叠
    document.getElementById('fpToggle').addEventListener('click', () => {
        document.querySelector('.fp-manager').classList.toggle('open');
    });

    // 添加指纹
    document.getElementById('fpAddBtn').addEventListener('click', async () => {
        const type = document.getElementById('fpType').value;
        const hash = document.getElementById('fpHash').value.trim();
        const name = document.getElementById('fpName').value.trim();
        if (!hash || !name) {
            alert('请填写 Hash 值和系统名称');
            return;
        }
        await addFingerprint(type, hash, name);
        document.getElementById('fpHash').value = '';
        document.getElementById('fpName').value = '';
        await matchAllHashes(_currentHashes, _currentIcons);
    });

    // 指纹列表委托删除
    document.getElementById('fpList').addEventListener('click', (e) => {
        if (e.target.classList.contains('fp-delete')) {
            const id = parseInt(e.target.dataset.id);
            if (id) deleteFingerprint(id);
        }
    });

    // 导出指纹
    document.getElementById('fpExportBtn').addEventListener('click', async () => {
        const list = await getFingerprints();
        if (list.length === 0) {
            alert('指纹库为空，无需导出');
            return;
        }
        const json = JSON.stringify(list, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'icofind_fingerprints.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // 导入指纹
    document.getElementById('fpImportBtn').addEventListener('click', () => {
        document.getElementById('fpFileInput').click();
    });

    document.getElementById('fpFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            if (!Array.isArray(imported)) throw new Error('格式错误');
            
            const current = await getFingerprints();
            const existingIds = new Set(current.map(f => f.id));
            let added = 0;
            for (const item of imported) {
                if (!item.type || !item.hash || !item.name) continue;
                if (!existingIds.has(item.id)) {
                    current.push({ id: item.id || Date.now() + Math.random(), type: item.type, hash: item.hash, name: item.name });
                    added++;
                }
            }
            await saveFingerprints(current);
            await renderFingerprints();
            
            await matchAllHashes(_currentHashes, _currentIcons);
            
            alert('导入完成，新增 ' + added + ' 条指纹');
        } catch (err) {
            alert('导入失败：文件格式不正确');
        }
        e.target.value = '';
    });

    // 图标左右切换
    document.getElementById('iconPrev').addEventListener('click', () => {
        if (_currentIcons.length > 1) {
            const newIdx = (_curIconIdx - 1 + _currentIcons.length) % _currentIcons.length;
            switchToIcon(newIdx);
        }
    });

    document.getElementById('iconNext').addEventListener('click', () => {
        if (_currentIcons.length > 1) {
            const newIdx = (_curIconIdx + 1) % _currentIcons.length;
            switchToIcon(newIdx);
        }
    });

    // 清除缓存
    document.getElementById('clearCacheBtn').addEventListener('click', async () => {
        // 清除哈希缓存
        await STORE.remove('hashCache');
        // 获取所有 key 并清除 _popup 缓存
        const all = await new Promise(resolve => chrome.storage.local.get(null, resolve));
        const keysToRemove = Object.keys(all).filter(k => k.endsWith('_popup'));
        if (keysToRemove.length > 0) {
            await new Promise(resolve => chrome.storage.local.remove(keysToRemove, resolve));
        }
        // 重置内存状态并重新加载
        _currentIcons = [];
        _currentHashes = [];
        _curIconIdx = 0;
        _currentPageUrl = '';
        getCurrentSiteInfo();
    });

    // 自定义 URL 计算
    document.getElementById('customUrlBtn').addEventListener('click', async () => {
        const rawUrl = document.getElementById('customUrlInput').value.trim();
        if (!rawUrl) { alert('请输入图标 URL'); return; }

        let url;
        try { url = new URL(rawUrl).href; } catch (e) { alert('URL 格式不正确'); return; }

        showLoading();
        hideError();
        document.getElementById('icon-source').textContent = '来源: 手动输入';

        try {
            const response = await fetch(url);
            if (!response.ok) { showError('请求失败，状态码: ' + response.status); return; }
            const arrayBuffer = await response.arrayBuffer();
            const md5 = SparkMD5.ArrayBuffer.hash(arrayBuffer);
            const fofa = calculateFofaHash(arrayBuffer);

            _currentIcons = [{ faviconUrl: url, sizeInfo: '未知尺寸', source: '手动输入' }];
            _currentHashes = [{ md5, fofa }];
            _curIconIdx = 0;
            _currentPageUrl = '';

            document.getElementById('loading').style.display = 'none';
            document.getElementById('favicon').style.display = 'block';
            document.getElementById('no-icon').style.display = 'none';
            document.getElementById('favicon').src = url;
            document.getElementById('previewImage').src = url;
            document.getElementById('icon-size').style.display = 'none';
            document.getElementById('previewSize').textContent = '尺寸: 未知';

            document.getElementById('icon-md5').textContent = md5;
            document.getElementById('icon-fofa').textContent = fofa || '获取失败';
            document.getElementById('icon-quake').textContent = md5;
            document.getElementById('previewMd5').textContent = 'Hunter: ' + md5;
            document.getElementById('previewFofa').textContent = 'FOFA: ' + (fofa || '获取失败');

            // 匹配指纹库
            const fps = await getFingerprints();
            const matchMd5 = fps.filter(f => f.type === 'md5' && f.hash === md5);
            const matchFofa = fps.filter(f => f.type === 'fofa' && f.hash === fofa);
            const allMatched = [...matchMd5, ...matchFofa];
            const names = [...new Set(allMatched.map(m => m.name))];
            const siteMatch = document.getElementById('site-match');
            if (siteMatch) {
                if (names.length > 0) {
                    siteMatch.innerHTML = names.map(n =>
                        '<span class="site-match-tag">&#9878; ' + escapeHtml(n) + '</span>'
                    ).join(' ');
                } else {
                    siteMatch.innerHTML = '';
                }
            }

            document.getElementById('iconPrev').classList.remove('show');
            document.getElementById('iconNext').classList.remove('show');
            updateStatusIndicator('active');
        } catch (e) {
            showError('请求失败: ' + e.message);
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    getCurrentSiteInfo();
    
    const data = await STORE.get('iconHistory');
    renderHistory(data.iconHistory || []);

    await renderFingerprints();
});
