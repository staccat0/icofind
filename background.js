// 监听浏览器原始页面加载的响应头，供 popup 做 header 指纹匹配
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        // 只处理主框架（主页面），忽略子资源
        if (details.type !== 'main_frame') return;
        if (details.tabId < 0) return;

        const headers = {};
        if (details.responseHeaders) {
            details.responseHeaders.forEach(header => {
                headers[header.name.toLowerCase()] = header.value || '';
            });
        }

        // 存储到 session storage，按 URL 索引，popup 读取
        chrome.storage.session.set({ [details.url + '_headers']: headers }).catch(() => {});
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['responseHeaders']
);
