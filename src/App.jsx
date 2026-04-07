import { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 1. Cargar lo que haya en storage al abrir
    chrome.storage.local.get(["lastElement"], (result) => {
      if (result && result.lastElement) {
        setData(result.lastElement);
      }
    });

    // 2. Escuchar cambios si el popup está abierto mientras seleccionas
    const listener = (request) => {
      if (
        request.action === "elemento_selected" ||
        request.action === "elemento_seleccionado"
      ) {
        setData(request.data);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const activarPicker = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) return;

      if (
        tab.url?.startsWith("chrome://") ||
        tab.url?.startsWith("https://chrome.google.com")
      ) {
        alert("No se puede usar en páginas del sistema Chrome.");
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { action: "activar_picker" });
      window.close();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      alert("Por favor, refresca la página web e intenta de nuevo.");
    }
  };

  const limpiar = () => {
    chrome.storage.local.remove("lastElement");
    setData(null);
  };

  return (
    <div
      style={{
        width: "400px",
        minHeight: "150px",
        padding: "15px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>Style Extractor</h3>
        {data && (
          <button
            onClick={limpiar}
            style={{ fontSize: "10px", cursor: "pointer" }}
          >
            Borrar
          </button>
        )}
      </header>

      <button
        onClick={activarPicker}
        style={{
          width: "100%",
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        🎯 Seleccionar Elemento en la Web
      </button>

      {/* Agregamos el chequeo de "data &&" para que no rompa al inicio */}
      {data && (
        <div style={{ marginTop: "20px" }}>
          <div style={{ marginBottom: "10px" }}>
            <strong>Tag:</strong>
            <code
              style={{
                display: "block",
                background: "#eee",
                padding: "5px",
                borderRadius: "3px",
                fontSize: "11px",
                marginTop: "5px",
                color:"#000"
              }}
            >
              {data.html}
            </code>
          </div>

          {/* ... dentro del componente data && ... */}

          {/* SECCIÓN 1: REGLAS ESPECÍFICAS (Si están disponibles) */}
          {data.matchedRules && data.matchedRules.length > 0 ? (
            <div style={{ marginTop: "15px" }}>
              <strong>Reglas CSS (Clases):</strong>
              {data.matchedRules.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#1e1e1e",
                    color: "#9cdcfe",
                    padding: "10px",
                    marginTop: "5px",
                    borderRadius: "4px",
                    fontSize: "11px",
                  }}
                >
                  <span style={{ color: "#dcdcaa" }}>{rule.selector}</span>{" "}
                  {" {"}
                  {rule.style.split(";").map(
                    (line, i) =>
                      line && (
                        <div key={i} style={{ paddingLeft: "10px" }}>
                          {line.trim()};
                        </div>
                      ),
                  )}
                  {"}"}
                </div>
              ))}
            </div>
          ) : (
            /* SECCIÓN 2: PLAN B - ESTILOS COMPUTADOS */
            <div style={{ marginTop: "15px" }}>
              <strong>Estilos Finales (Computed):</strong>
              <div
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #ddd",
                  padding: "10px",
                  marginTop: "5px",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                {data.computed &&
                  Object.entries(data.computed).map(([prop, val]) => (
                    <div key={prop}>
                      <span style={{ color: "#007bff" }}>{prop}</span>: {val};
                    </div>
                  ))}
              </div>
              <small style={{ color: "#666", fontSize: "9px" }}>
                Nota: Estilos de archivos CSS externos protegidos (CORS).
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
