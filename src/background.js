chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch_external_css") {
    fetch(request.url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(text => sendResponse({ css: text }))
      .catch(err => {
        console.error("Error en fetch de background:", err);
        sendResponse({ error: err.message });
      });
    return true; // Mantiene el canal abierto para la respuesta asíncrona
  }
});