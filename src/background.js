const MAX_CSS_SIZE = 500_000; // 500 KB

const isValidCssUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Solo aceptar mensajes de content scripts de esta misma extensión
  if (sender.id !== chrome.runtime.id) return false;

  if (request.action === "fetch_external_css") {
    const url = request.url;

    if (!url || !isValidCssUrl(url)) {
      sendResponse({ error: 'URL inválida o protocolo no permitido' });
      return false;
    }

    fetch(url, { method: 'GET' })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(text => {
        sendResponse({ css: text.length > MAX_CSS_SIZE ? text.slice(0, MAX_CSS_SIZE) : text });
      })
      .catch(err => {
        sendResponse({ error: err.message });
      });
    return true; // Mantiene el canal abierto para la respuesta asíncrona
  }
});