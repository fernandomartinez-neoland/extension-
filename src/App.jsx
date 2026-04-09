import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { Crosshair, Copy, Search, Layers, Sparkles, Tag, Hash } from "lucide-react";
import "./App.css";

const PLAN = "free"; // TODO: conectar con backend en Fase 4

const toCssProperty = (camel) => camel.replace(/([A-Z])/g, '-$1').toLowerCase();

// Sanitiza CSS para evitar @import y otros vectores
const sanitizeCSS = (css) =>
  css
    .replace(/@import[^;]*;/gi, '')
    .replace(/behavior\s*:/gi, 'x-behavior:')
    .replace(/-moz-binding\s*:/gi, 'x-moz-binding:')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(x-js:');

const buildPreviewCSS = (data) => {
  const lines = [];

  if (data.matchedRules?.length > 0) {
    for (const rule of data.matchedRules) {
      lines.push(`${rule.selector} { ${sanitizeCSS(rule.style)} }`);
    }
  } else if (data.previewStyles) {
    // Fallback: estilos computados aplicados al selector del elemento
    const sel = [
      data.tagName ?? '',
      data.id ? `#${data.id}` : '',
      (data.classList ?? []).map(c => `.${c}`).join(''),
    ].join('');
    const props = Object.entries(data.previewStyles)
      .map(([k, v]) => `${toCssProperty(k)}: ${v}`)
      .join('; ');
    lines.push(`${sel} { ${props} }`);
  }

  return lines.join('\n');
};

const buildCSSText = (data) => {
  const blocks = [];

  // 1. Reglas de hojas de estilo (por selector)
  if (data.matchedRules?.length > 0) {
    for (const rule of data.matchedRules) {
      const props = rule.style.split(';').map(s => s.trim()).filter(Boolean);
      if (props.length > 0) {
        blocks.push({ selector: rule.selector, props });
      }
    }
  }

  // 2. Computed styles como bloque del elemento (selector construido de tag + id + clases)
  if (data.computedStyles && Object.keys(data.computedStyles).length > 0) {
    const sel = [
      data.tagName,
      data.id ? `#${data.id}` : '',
      data.classList?.map(c => `.${c}`).join('') ?? '',
    ].join('');
    const props = Object.values(data.computedStyles)
      .flatMap(group => Object.entries(group).map(([k, v]) => `${toCssProperty(k)}: ${v}`));
    if (props.length > 0) blocks.push({ selector: `/* computed */ ${sel}`, props });
  }

  return blocks;
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AdBanner() {
  return (
    <div className="ad-banner">
      <p className="ad-banner-text">
        <strong>Elimina los anuncios.</strong> Actualiza a Pro por $3/mes.
      </p>
      <button className="ad-upgrade-btn">Upgrade</button>
    </div>
  );
}

function App() {
  const [data, setData]           = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const previewRef                = useRef(null);

  useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) fetchUserInfo(token);
      else setLoading(false);
    });

    chrome.storage.local.get(["lastElement"], (result) => {
      if (result?.lastElement) setData(result.lastElement);
    });

    const listener = (request) => {
      if (request.action === "elemento_seleccionado") setData(request.data);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!data || !previewRef.current) return;
    const container = previewRef.current;
    // Shadow DOM para aislar estilos del preview del resto del popup
    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    shadow.innerHTML = "";

    // Estilos base del contenedor preview
    const baseStyle = document.createElement("style");
    baseStyle.textContent = `
      :host {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        background: #ffffff;
        width: 100%;
        box-sizing: border-box;
        min-height: 80px;
      }
      * { box-sizing: border-box; max-width: 100%; }
    `;
    shadow.appendChild(baseStyle);

    // Estilos del elemento (reglas CSS reales o fallback de computed styles)
    const cssText = buildPreviewCSS(data);
    if (cssText) {
      const styleEl = document.createElement("style");
      styleEl.textContent = cssText;
      shadow.appendChild(styleEl);
    }

    // HTML sanitizado del elemento
    const temp = document.createElement("div");
    temp.innerHTML = DOMPurify.sanitize(data.html, {
      FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "base"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
      ALLOW_DATA_ATTR: false,
    });

    const element = temp.firstElementChild;
    if (element) {
      element.style.margin = "0";
      element.style.transform = "none";
      shadow.appendChild(element);
    }
  }, [data, loading]);

  const fetchUserInfo = (token) => {
    fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`)
      .then((res) => res.json())
      .then((info) => { setUser(info); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loginConGoogle = () => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) return;
      fetchUserInfo(token);
    });
  };

  const activarPicker = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Intentar enviar mensaje; si el content script no está inyectado aún, inyectarlo primero
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "activar_picker" });
    } catch {
      try {
        const contentScriptFile = chrome.runtime.getManifest().content_scripts[0].js[0];
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [contentScriptFile],
        });
        await chrome.tabs.sendMessage(tab.id, { action: "activar_picker" });
      } catch {
        // La página no admite scripts (chrome://, edge://, etc.)
        return;
      }
    }
    window.close();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopyStatus("Copiado");
    setTimeout(() => setCopyStatus(""), 2000);
  };

  if (loading) {
    return (
      <div className="loading">
        <Sparkles size={14} />
        Cargando…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container login-screen">
        <div className="login-logo">
          <Search size={18} />
          StyleInspector Pro
        </div>
        <h2 className="login-title">Inspecciona cualquier elemento</h2>
        <p className="login-subtitle">
          Extrae estilos CSS de cualquier web con un solo clic.
        </p>
        <button className="google-button" onClick={loginConGoogle}>
          <GoogleIcon />
          Continuar con Google
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon"><Search size={14} /></span>
          StyleInspector
          <span className="plan-badge">{PLAN === "pro" ? "Pro" : "Free"}</span>
        </div>
        <div className="header-right">
          {copyStatus && <span className="copy-feedback">{copyStatus}</span>}
          <img src={user.picture} className="avatar" title={user.email} alt="avatar" />
        </div>
      </header>

      <button className="main-button" onClick={activarPicker}>
        <Crosshair size={14} />
        Seleccionar elemento
      </button>

      {data ? (
        <div className="content">
          {/* Element info: tag + id + classes */}
          <div className="card">
            <div className="card-header">
              <span className="card-label">Elemento</span>
              <button className="copy-btn" onClick={() => copyToClipboard(data.html)}>
                <Copy size={11} />
              </button>
            </div>
            <div className="card-body element-info">
              <span className="el-tag">
                <Tag size={10} />
                {data.tagName}
              </span>
              {data.id && (
                <span className="el-id">
                  <Hash size={10} />
                  {data.id}
                </span>
              )}
              {data.classList?.map((cls) => (
                <span key={cls} className="el-class">.{cls}</span>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <div className="card-header">
              <span className="card-label">Preview</span>
              <Layers size={12} color="var(--text-muted)" />
            </div>
            <div className="preview-area" ref={previewRef} />
          </div>

          {/* Estilos en sintaxis CSS */}
          {(() => {
            const blocks = buildCSSText(data);
            if (!blocks.length) return null;
            const cssText = blocks.map(b => `${b.selector} {\n${b.props.map(p => `  ${p};`).join('\n')}\n}`).join('\n\n');
            return (
              <div className="card">
                <div className="card-header">
                  <span className="card-label">
                    Styles
                    <span className="rules-count">{blocks.length}</span>
                  </span>
                  <button className="copy-btn" onClick={() => copyToClipboard(cssText)}>
                    <Copy size={11} />
                  </button>
                </div>
                <div className="card-body">
                  <div className="scroll-area">
                    {blocks.map((block, i) => (
                      <div key={i} className="rule-box">
                        <span className="rule-selector">{block.selector}</span> {'{'}
                        <div style={{ paddingLeft: '14px' }}>
                          {block.props.map((prop, j) => {
                            const [key, ...rest] = prop.split(':');
                            return (
                              <div key={j} className="css-prop-row">
                                <span className="css-prop-key">{key.trim()}:</span>
                                <span className="css-prop-val">{rest.join(':').trim()};</span>
                              </div>
                            );
                          })}
                        </div>
                        {'}'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {PLAN === "free" && <AdBanner />}
        </div>
      ) : (
        <div className="empty-state">
          <Crosshair size={32} color="var(--text-muted)" />
          <p>Haz clic en <strong>"Seleccionar elemento"</strong> y luego en cualquier elemento de la página.</p>
        </div>
      )}
    </div>
  );
}

export default App;
