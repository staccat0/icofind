// 从页面中提取图标信息
function getFaviconInfo() {
    const icons = [];
    const iconTypes = [
        'icon', 'shortcut icon', 'apple-touch-icon', 
        'apple-touch-icon-precomposed', 'fluid-icon'
    ];
    
    // 查找所有可能的图标链接
    iconTypes.forEach(type => {
        const links = document.querySelectorAll(`link[rel*="${type}"]`);
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const sizes = link.getAttribute('sizes') || '未知尺寸';
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
                    source: "link标签"
                });
            }
        });
    });
    
    // 尝试查找默认的favicon.ico
    const defaultIcon = new URL('/favicon.ico', window.location.origin).href;
    
    // 检查默认图标是否存在
    icons.push({
        url: defaultIcon,
        type: 'default',
        sizes: '未知尺寸',
        source: "默认favicon.ico"
    });
    
    // 尝试查找Open Graph协议的图标
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
                    source: "Open Graph协议"
                });
            } catch (e) {
                console.error(`Invalid Open Graph image URL: ${content}`, e);
            }
        }
    }
    
    // 尝试查找Twitter协议的图标
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
                    source: "Twitter协议"
                });
            } catch (e) {
                console.error(`Invalid Twitter image URL: ${content}`, e);
            }
        }
    }
    
    // 按可能的质量排序（优先选择大尺寸图标）
    icons.sort((a, b) => {
        const aSize = parseSize(a.sizes);
        const bSize = parseSize(b.sizes);
        return bSize - aSize;
    });
    
    // 返回第一个有效的图标
    for (const icon of icons) {
        // 验证URL
        if (isValidUrl(icon.url)) {
            return {
                faviconUrl: icon.url,
                sizeInfo: icon.sizes === '未知尺寸' ? '未知尺寸' : icon.sizes,
                source: icon.source
            };
        }
    }
    
    // 如果所有方法都失败，返回空
    return null;
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

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getFavicon") {
        const iconInfo = getFaviconInfo();
        sendResponse(iconInfo);
    }
    return true; // 保持消息通道开放
});