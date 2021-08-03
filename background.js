chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status == 'complete') {
        console.log(tab);
        if (tab.url.indexOf("ChangeSetDetailPage.apexp") != -1) {
            chrome.scripting.executeScript({
                target: { "tabId" : tabId },
                files: ["runtime/common.js"],
            });
        }
    }
});