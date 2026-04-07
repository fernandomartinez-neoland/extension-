console.log("%c [Extension] Content Script cargado y listo", "color: blue; font-weight: bold;");
let overlay = null;
let selectedElement = null;

// 1. Definir funciones primero
const createOverlay = () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = "chrome-extension-overlay"; // ID para evitar seleccionarse a sí mismo
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647'; // El valor máximo posible
    overlay.style.border = '2px solid #007bff';
    overlay.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    overlay.style.transition = 'all 0.05s ease';
    document.body.appendChild(overlay);
};

const onMouseMove = (e) => {
    const el = e.target;
    // Evitar que el picker intente seleccionar el overlay o scripts
    if (el === overlay || el.tagName === 'SCRIPT') return;

    selectedElement = el;
    const rect = el.getBoundingClientRect();

    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
};

const getMatchedCSSRules = async (el) => {
    const matched = [];
    const sheets = Array.from(document.styleSheets);

    for (const sheet of sheets) {
        let rules = null;
        try {
            // Intento normal (mismo dominio)
            rules = Array.from(sheet.cssRules || sheet.rules);
        } catch (e) {
            // Si falla por CORS y hay un href (es externo)
            if (sheet.href) {
                console.log("CORS detectado en CDN, solicitando vía background...");
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: "fetch_external_css",
                        url: sheet.href
                    });

                    if (response && response.css) {
                        // Creamos una hoja virtual para parsear el texto
                        const tempSheet = new CSSStyleSheet();
                        await tempSheet.replace(response.css);
                        rules = Array.from(tempSheet.cssRules);
                    }
                } catch (fetchError) {
                    console.error("No se pudo recuperar el CSS del CDN:", fetchError);
                }
            }
        }

        if (rules) {
            rules.forEach(rule => {
                if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                    matched.push({
                        selector: rule.selectorText,
                        style: rule.style.cssText
                    });
                }
            });
        }
    }
    return matched;
};

const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const el = selectedElement;
    if (!el) return;

    // Esperamos a que el "escáner" termine de descargar y procesar los CSS de CDNs
    const matchedRules = await getMatchedCSSRules(el);

    const dataToSave = {
        html: el.cloneNode(false).outerHTML,
        classes: Array.from(el.classList),
        matchedRules: matchedRules
    };

    chrome.storage.local.set({ lastElement: dataToSave });
    chrome.runtime.sendMessage({ action: "elemento_seleccionado", data: dataToSave }).catch(() => { });

    desactivarPicker();
};

const desactivarPicker = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown); // Nueva línea
    document.body.style.cursor = "default";
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
};

const onKeyDown = (e) => {
    if (e.key === "Escape") {
        desactivarPicker();
        // Avisamos al background que el usuario canceló
        chrome.runtime.sendMessage({ action: "picker_cancelado" });
    }
};



// 2. UN SOLO LISTENER para todo
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "activar_picker") {
        createOverlay();
        // Usamos 'true' en el tercer parámetro para capturar el evento antes que la web
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown); // Escuchar ESC
        document.body.style.cursor = "crosshair";
        sendResponse({ status: "Selecciona un elemento..." });
    }
    return true; // Mantiene el canal abierto para respuestas asíncronas
});

