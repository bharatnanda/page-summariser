(function () {
  function getPageText() {
    return document.body ? document.body.innerText || "" : "";
  }

  const pageText = getPageText();
  chrome.runtime.sendMessage({ action: "summarize", content: pageText });
})();
