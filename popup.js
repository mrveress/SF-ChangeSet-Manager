document.querySelector("#export-to-csv").addEventListener("click", async (element, event) => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: exportToCsv,
    });
});

document.querySelector("#export-to-json").addEventListener("click", async (element, event) => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: exportToJson,
    });
});

document.querySelector("#import-from-file").addEventListener("click", async (element, event) => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: importFromFile,
    });
})

async function exportToCsv() {
    let changeSetManager = new ChangeSetManager();
    let changeSetNameForFile = changeSetManager.getChangeSetNameForFile();
    let csv = await changeSetManager.getCsv();

    let downloadLink = document.createElement("a");
    let blob = new Blob(["\ufeff", csv]);
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = changeSetNameForFile + ".csv";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

async function exportToJson() {
    let changeSetManager = new ChangeSetManager();
    let changeSetNameForFile = changeSetManager.getChangeSetNameForFile();
    let json = await changeSetManager.getJson();

    let downloadLink = document.createElement("a");
    let blob = new Blob(["\ufeff", json]);
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = changeSetNameForFile + ".json";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

async function importFromFile() {
    let changeSetManager = new ChangeSetManager();
    changeSetManager.importFromFile();
}


