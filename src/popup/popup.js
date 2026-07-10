document.getElementById("openHome").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/home/home.html")
  });
});

document.getElementById("openSettings").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/settings/settings.html")
  });
});

document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.tabs.create({
    url: "chrome://extensions/shortcuts"
  });
});
