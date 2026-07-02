// 从页面中提取图标信息
function getFaviconInfo() {
    const icons = [];
    const iconTypes = [
        'icon', 'shortcut icon', 'apple-touch-icon', 
        'apple-touch-icon-precomposed', 'fluid-icon',
        'mask-icon'
    ];
    
    // 查找所有可能的图标链接
    iconTypes.forEach(type => {
        const links = document.querySelectorAll(`link[rel*="${type}"]`);
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const sizes = link.getAttribute('sizes') || '未知尺寸';
                const mimeType = link.getAttribute('type') || '';
                let absoluteUrl;
                
                try {
                    absoluteUrl = new URL(href, window.location.href).href;
                } catch (e) {
                    console.error(`Invalid URL: ${href}`, e);
                    return;
                }
                
                icons.push({
                    url: absoluteUrl,
                    type: type,
                    sizes: sizes,
                    mimeType: mimeType,
                    source: "link标签"
                });
            }
        });
    });
    
    // 尝试查找默认的 favicon（支持多种常见格式）
    const defaultFormats = ['/favicon.ico', '/favicon.png', '/favicon.svg', '/favicon.jpg', '/favicon.jpeg', '/favicon.gif', '/favicon.webp'];
    defaultFormats.forEach(path => {
        icons.push({
            url: new URL(path, window.location.origin).href,
            type: 'default',
            sizes: '未知尺寸',
            mimeType: '',
            source: '默认' + path.replace('/favicon', '')
        });
    });
    
    // 尝试查找 Open Graph 协议的图标
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content) {
            try {
                const ogUrl = new URL(content, window.location.href).href;
                icons.push({
                    url: ogUrl,
                    type: 'og:image',
                    sizes: '未知尺寸',
                    mimeType: '',
                    source: "Open Graph协议"
                });
            } catch (e) {
                console.error(`Invalid Open Graph image URL: ${content}`, e);
            }
        }
    }
    
    // 尝试查找 Twitter 协议的图标
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
        const content = twitterImage.getAttribute('content');
        if (content) {
            try {
                const twitterUrl = new URL(content, window.location.href).href;
                icons.push({
                    url: twitterUrl,
                    type: 'twitter:image',
                    sizes: '未知尺寸',
                    mimeType: '',
                    source: "Twitter协议"
                });
            } catch (e) {
                console.error(`Invalid Twitter image URL: ${content}`, e);
            }
        }
    }
    
    // 尝试查找 Windows Tiles 图标
    const tileImage = document.querySelector('meta[name="msapplication-TileImage"]');
    if (tileImage) {
        const content = tileImage.getAttribute('content');
        if (content) {
            try {
                const tileUrl = new URL(content, window.location.href).href;
                icons.push({
                    url: tileUrl,
                    type: 'ms-tile',
                    sizes: '未知尺寸',
                    mimeType: '',
                    source: "Windows Tile"
                });
            } catch (e) {
                console.error(`Invalid Tile image URL: ${content}`, e);
            }
        }
    }
    
    // 按可能的质量排序（优先选择：已知尺寸的 > 大尺寸的 > 非默认ico的）
    icons.sort((a, b) => {
        // 优先选择有明确尺寸的
        const aKnown = a.sizes !== '未知尺寸' ? 1 : 0;
        const bKnown = b.sizes !== '未知尺寸' ? 1 : 0;
        if (aKnown !== bKnown) return bKnown - aKnown;
        
        // 其次按尺寸（面积）
        const aSize = parseSize(a.sizes);
        const bSize = parseSize(b.sizes);
        if (aSize !== bSize) return bSize - aSize;
        
        // .ico 格式优先
        const aIsIco = a.url.toLowerCase().endsWith('.ico');
        const bIsIco = b.url.toLowerCase().endsWith('.ico');
        if (aIsIco && !bIsIco) return -1;
        if (!aIsIco && bIsIco) return 1;
        
        return 0;
    });
    
    // 返回前5个有效图标
    const result = [];
    for (const icon of icons) {
        if (isValidUrl(icon.url)) {
            result.push({
                faviconUrl: icon.url,
                sizeInfo: icon.sizes === '未知尺寸' ? '未知尺寸' : icon.sizes,
                source: icon.source
            });
            if (result.length >= 5) break;
        }
    }
    
    return result.length > 0 ? result : null;
}

// 解析尺寸字符串
function parseSize(sizeStr) {
    if (!sizeStr || sizeStr === 'any' || sizeStr === '未知尺寸') return 0;
    
    const match = sizeStr.match(/(\d+)x(\d+)/i);
    if (match) {
        return parseInt(match[1]) * parseInt(match[2]);
    }
    
    return 0;
}

// 验证URL是否有效
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// 页面加载后主动提取图标信息存入 storage，popup 打开时直接读取，跳过消息通信
const iconInfo = getFaviconInfo();
if (iconInfo) {
    chrome.storage.session.set({ [location.href]: iconInfo }).catch(() => {});
}

// 同时存储页面内容供关键词匹配使用
const pageContent = (function() {
    const html = document.documentElement ? document.documentElement.innerHTML : '';
    const title = document.title || '';
    return { body: html.substring(0, 200000), title: title };
})();
chrome.storage.session.set({ [location.href + '_page']: pageContent }).catch(() => {});

// 监听来自弹出窗口的消息（作为 storage 读取失败的兜底）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getFavicon") {
        sendResponse(iconInfo);
    }
    if (request.action === "getPageContent") {
        sendResponse(pageContent);
    }
    return true;
});
