const monitored = [
  ["AAPL", "BUY"], ["AMD", "SELL"], ["AMZN", "SELL"], ["BA", "SELL"],
  ["META", "SELL"], ["NVDA", "BUY"], ["RCL", "BUY"], ["UAL", "BUY"],
  ["TSLA", "SELL"], ["UNH", "BUY"], ["PINS", "SELL"], ["NCLH", "BUY"],
  ["MSFT", "SELL"], ["NKE", "SELL"], ["PYPL", "BUY"], ["NFLX", "SELL"],
  ["ADBE", "SELL"],
] as const;

const tabs = [
  ["📊", "Dashboard", "dashboard"],
  ["♟", "Señales", "signals"],
  ["📈", "Trades", "trades"],
  ["🟨", "Historial", "history"],
  ["📋", "Logs", "logs"],
  ["⚙", "Config", "config"],
] as const;

const metrics = [
  { icon: "●", value: "4035", label: "Señales BUY", tone: "buy" },
  { icon: "●", value: "4018", label: "Señales SELL", tone: "sell" },
  { icon: "↗", value: "16", label: "Trades Abiertos", detail: "PAPER 12 · REAL 4", tone: "trades" },
  { icon: "💰", value: "$0.58", label: "PnL PAPER actual", detail: "Abierto $11.15 · Cerrado hoy $-10.57", tone: "profit" },
] as const;

export default function TradingDashboard() {
  return (
    <div className="trading-ui">
      <header className="trading-topbar">
        <div className="trading-brand"><span className="trading-bot" aria-hidden="true">🤖</span><span><strong>GALA10 Chocoletra</strong><small>Trading Algorítmico v3.3.0</small></span></div>
        <div className="trading-topnav" role="group" aria-label="Sections shown in the interface preview">
          {tabs.map(([icon, name, id], index) => <span key={id} className={index === 0 ? "active" : ""}><span aria-hidden="true">{icon}</span> {name}</span>)}
        </div>
        <div className="trading-session"><span><i /> Schwab ✓</span><span className="trading-time">11:22:21 NY</span><strong>ACTIVO</strong><span className="trading-switch" aria-label="Motor activo" /><span className="trading-admin">admin ⌄</span></div>
      </header>

      <div className="trading-body">
        <aside className="trading-sidebar">
          <div className="trading-side-heading">NAVEGACIÓN</div>
          <div className="trading-side-links" role="group" aria-label="Sections shown in the interface preview">
            {tabs.map(([icon, name, id], index) => <span key={id} className={index === 0 ? "active" : ""}><span aria-hidden="true">{icon}</span> {name === "Trades" ? "Trades en Vivo" : name === "Historial" ? "Historial de Operaciones" : name === "Logs" ? "Logs del Bot" : name === "Config" ? "Configuración" : name}</span>)}
          </div>
          <div className="trading-side-heading trading-assets-heading">ACTIVOS MONITORIZADOS</div>
          <div className="trading-assets">
            {monitored.map(([symbol, side]) => <div className="trading-asset" key={symbol}><strong>{symbol}</strong><span className={side === "BUY" ? "buy" : "sell"}>{side}</span><span className="trading-remove" aria-hidden="true">×</span></div>)}
          </div>
        </aside>

        <main className="trading-content" id="trading-dashboard">
          <div className="trading-heading"><h1>📊 Dashboard de Trading</h1><p>Visión general del sistema en tiempo real</p></div>

          <div className="trading-metrics">
            {metrics.map((metric) => <div className={`trading-metric ${metric.tone}`} key={metric.label}><span className="trading-metric-icon" aria-hidden="true">{metric.icon}</span><strong>{metric.value}</strong><span>{metric.label}</span>{"detail" in metric && <small>{metric.detail}</small>}</div>)}
          </div>

          <section className="trading-risk" aria-label="Daily risk status">
            <div><strong>🛡️ Kill Switch diario preparado</strong><small>REAL · Realizado $0.00 · No realizado $2.02</small></div>
            <div><strong className="positive">$2.02</strong><small>PnL neto de hoy</small></div>
            <div><strong>$-200.00</strong><small>Límite del modo</small></div>
            <div><strong>$202.02</strong><small>Margen restante</small></div>
          </section>

          <section className="trading-broker" aria-label="Broker reconciliation status">
            <div><strong>🔄 Schwab reconciliado · exposición conocida</strong><small>Broker sincronizado; exposición REAL conocida · Posiciones: NVDA SELL 3 · Actualizado 2026-09-18T10:50:05</small></div>
            <p>Últimos rechazos: META: Prior exit is unresolved; no duplicate order sent | NKE: Prior exit is unresolved; no duplicate order sent | NVDA: No se confirmó el cierre de la posición anterior</p>
            <span>Verificar Schwab (solo lectura)</span>
          </section>

          <section className="trading-control">
            <div className="trading-control-heading"><div><span>CONTROL DE EJECUCIÓN · V3.3.0 · EDITOR 5</span><h2>Tickers y tamaño de las órdenes</h2><p>Defina los límites de REAL y guarde la cantidad de cada ticker.</p></div><div className="trading-control-actions"><span>Tickers REAL 4/15 · 13 PAPER</span><span>Calidad de ejecución ↗</span></div></div>
            <div className="trading-setting-grid">
              <div className="trading-setting"><strong>Máximo de tickers REAL</strong><p>Cuántos símbolos permite seleccionar en REAL. Puede reservar cupos para nuevos tickers.</p><div><span>15</span><span className="trading-save">Guardar tickers</span></div><small>Guardado: 15 tickers REAL como máximo</small></div>
              <div className="trading-setting"><strong>Máximo de acciones por orden REAL</strong><p>Tope permitido. Cada ticker conserva su propia cantidad.</p><div><span>10</span><span className="trading-save">Guardar acciones</span></div><small>Guardado: 10 acciones como máximo por orden REAL</small></div>
            </div>
            <div className="trading-saved"><div><strong>4 tickers guardados en REAL</strong><span>11 cupos libres · Límite guardado: 15</span></div><div className="trading-chips"><span>META</span><span>NVDA</span><span>TSLA</span><span>NKE</span></div><p>Para cambiar los tickers seleccionados, elija REAL o PAPER en cada fila y pulse Guardar. Guardar el máximo no activa tickers ni cambia las acciones por orden.</p></div>
            <div className="trading-motor"><strong>Motor activo · Deténgalo para editar</strong><span>Capacity reserved · Poder de compra $95167.02</span></div>
            <div className="trading-table-head"><span>TICKER</span><span>EJECUCIÓN</span><span>ACCIONES POR ORDEN</span><span>SALIDA PARCIAL</span><span>IA / MODELO</span><span>CAMBIOS</span></div>
          </section>
        </main>
      </div>
    </div>
  );
}
