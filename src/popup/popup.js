document.getElementById("openHome").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/home/home.html")
  });
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
