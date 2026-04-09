let overlay = null;
let selectedElement = null;

const createOverlay = () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = "chrome-extension-overlay";
    overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid #6366f1;
        background-color: rgba(99, 102, 241, 0.08);
        transition: all 0.05s ease;
        border-radius: 3px;
    `;
    document.body.appendChild(overlay);
};

const onMouseMove = (e) => {
    const el = e.target;
    if (el === overlay || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    selectedElement = el;
    const rect = el.getBoundingClientRect();
    overlay.style.width  = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top    = `${rect.top}px`;
    overlay.style.left   = `${rect.left}px`;
};

// Recorre reglas CSS recursivamente (maneja @media, @supports, @layer, @container)
const collectMatchingRules = (rules, el, matched) => {
    for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
            try {
                if (el.matches(rule.selectorText)) {
                    matched.push({
                        selector: rule.selectorText,
                        style: rule.style.cssText,
                    });
                }
            } catch {
                // Selector no válido para matches() (pseudo-elements, etc.) — ignorar
            }
        } else if (rule.cssRules) {
            // CSSMediaRule, CSSSupportsRule, CSSLayerBlockRule, CSSContainerRule
            collectMatchingRules(Array.from(rule.cssRules), el, matched);
        }
    }
};

const getMatchedCSSRules = async (el) => {
    const matched = [];

    for (const sheet of Array.from(document.styleSheets)) {
        let rules = null;
        try {
            rules = Array.from(sheet.cssRules || []);
        } catch {
            // CORS: intentar obtener el CSS vía background
            if (sheet.href) {
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: "fetch_external_css",
                        url: sheet.href,
                    });
                    if (response?.css) {
                        const tempSheet = new CSSStyleSheet();
                        await tempSheet.replace(response.css);
                        rules = Array.from(tempSheet.cssRules);
                    }
                } catch {
                    // Fallo silencioso — CDN no accesible
                }
            }
        }

        if (rules) collectMatchingRules(rules, el, matched);
    }

    return matched;
};

const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const el = selectedElement;
    if (!el) return;

    const computed      = window.getComputedStyle(el);
    const matchedRules  = await getMatchedCSSRules(el);

    const STYLE_CATEGORIES = {
        'Layout':     ['display','flexDirection','justifyContent','alignItems','flexWrap','gap','flexDirection','position','zIndex','overflow'],
        'Dimensiones':['padding','margin','width','height','minWidth','maxWidth'],
        'Tipografía': ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','textTransform','color'],
        'Fondo':      ['backgroundColor','opacity'],
        'Borde':      ['border','borderRadius','borderColor','borderWidth','borderStyle','outline'],
        'Efectos':    ['boxShadow','cursor'],
    };

    const SKIP = new Set(['', 'normal', 'auto', 'none', '0px', 'rgba(0, 0, 0, 0)', 'initial', 'inherit']);

    const computedStyles = {};
    for (const [category, props] of Object.entries(STYLE_CATEGORIES)) {
        const entries = {};
        for (const prop of props) {
            const val = computed[prop];
            if (val && !SKIP.has(val)) entries[prop] = val;
        }
        if (Object.keys(entries).length > 0) computedStyles[category] = entries;
    }

    // Estilos mínimos para renderizar el preview (sin width/height para que encaje en el popup)
    const previewStyles = {
        backgroundColor:  computed.backgroundColor,
        color:            computed.color,
        padding:          computed.padding,
        border:           computed.border,
        borderRadius:     computed.borderRadius,
        fontSize:         computed.fontSize,
        fontFamily:       computed.fontFamily,
        fontWeight:       computed.fontWeight,
        display:          ['block','inline-block','flex','inline-flex','grid','inline-grid'].includes(computed.display)
                              ? computed.display : 'block',
        boxShadow:        computed.boxShadow,
        textAlign:        computed.textAlign,
        lineHeight:       computed.lineHeight,
        textTransform:    computed.textTransform,
        letterSpacing:    computed.letterSpacing,
        cursor:           computed.cursor,
    };

    const dataToSave = {
        tagName:   el.tagName.toLowerCase(),
        id:        el.id || null,
        classList: Array.from(el.classList),
        html:      el.cloneNode(true).outerHTML,
        innerText: el.innerText,
        matchedRules,
        computedStyles,
        previewStyles,
    };

    chrome.storage.local.set({ lastElement: dataToSave });
    chrome.runtime.sendMessage({ action: "elemento_seleccionado", data: dataToSave });
    desactivarPicker();
};

const desactivarPicker = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.cursor = "default";
    if (overlay) { overlay.remove(); overlay = null; }
};

const onKeyDown = (e) => {
    if (e.key === "Escape") {
        desactivarPicker();
        chrome.runtime.sendMessage({ action: "picker_cancelado" });
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "activar_picker") {
        createOverlay();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown);
        document.body.style.cursor = "crosshair";
        sendResponse({ status: "ok" });
    }
    return true;
});
