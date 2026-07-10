document.getElementById("openSettings").addEventListener("click", () => {
  window.location.href = chrome.runtime.getURL("src/settings/settings.html");
});

document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.tabs.create({
    url: "chrome://extensions/shortcuts"
  });
});
