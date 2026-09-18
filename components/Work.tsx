import Image from "next/image";
import Link from "next/link";

type Project = {
  number: string;
  id: "vertigo" | "force" | "wordpress" | "powerbi" | "trading";
  title: string;
  category: string;
  description: string;
  scope: string[];
  link: string | null;
  screenshot: string | null;
  screenshotAlt?: string;
};

const projects: Project[] = [
  {
    number: "01",
    id: "vertigo",
    title: "Vertigo Clinical System",
    category: "CLINICAL SOFTWARE",
    description: "A vestibular examination platform connecting video, sensor, and bedside observations in one clinical case. My work spans the application, backend, and Windows software.",
    scope: ["Application development", "Backend", "Windows application"],
    link: "https://portal.vertigolink.com",
    screenshot: "/work/vertigo.png",
    screenshotAlt: "Vertigo clinical system homepage showing its vestibular examination overview",
  },
  {
    number: "02",
    id: "force",
    title: "Force Life Med Bed",
    category: "AI & INTEGRATIONS",
    description: "An AI assistant and visual experience connected with social media and CRM workflows.",
    scope: ["AI assistant", "Visualization", "Social media", "CRM integration"],
    link: "https://workforce.lifeforcemedbed.com",
    screenshot: null,
  },
  {
    number: "03",
    id: "wordpress",
    title: "WordPress Plugin Suite",
    category: "PLATFORM ENGINEERING",
    description: "WordPress plugin work covering coupons, text, image, and video reviews, with external storage.",
    scope: ["Coupons", "Multimedia reviews", "External storage"],
    link: null,
    screenshot: null,
  },
  {
    number: "04",
    id: "powerbi",
    title: "Power BI Experience",
    category: "DATA & REPORTING",
    description: "Reporting and visualization in Power BI, drawing on AxisCare, SharePoint, and other sources.",
    scope: ["Power BI", "AxisCare", "SharePoint"],
    link: null,
    screenshot: null,
  },
  {
    number: "05",
    id: "trading",
    title: "Trading Bot Development",
    category: "AUTOMATION",
    description: "An algorithmic trading control surface bringing signals, open positions, broker reconciliation, risk limits, and order sizing into one view.",
    scope: ["Trading automation", "Risk controls", "Broker integration", "Dashboard UI"],
    link: null,
    screenshot: null,
  },
];

function ProjectIllustration({ id }: { id: Project["id"] }) {
  switch (id) {
    case "vertigo":
      return (
        <div className="visual visual-vertigo" aria-hidden="true">
          <div className="clinical-app"><span className="visual-kicker">01 / CLINICAL SYSTEM</span><strong>Application</strong><i /><i /><i /></div>
          <div className="clinical-connector" />
          <div className="clinical-stack"><div><span>02 / SERVICE LAYER</span><strong>Backend</strong></div><div><span>03 / DESKTOP</span><strong>Windows application</strong></div></div>
        </div>
      );
    case "force":
      return (
        <div className="visual visual-force" aria-hidden="true">
          <div className="force-orbit force-orbit-one" /><div className="force-orbit force-orbit-two" />
          <div className="force-assistant"><span>AI ASSISTANT</span><strong>How can I help?</strong><i /><i /></div>
          <div className="force-pulse"><span>VISUALIZATION</span><div><b /><b /><b /><b /><b /><b /><b /></div></div>
          <div className="force-integrations"><span>CONNECTED TO</span><strong>CRM</strong><strong>Social media</strong></div>
        </div>
      );
    case "wordpress":
      return (
        <div className="visual visual-wordpress" aria-hidden="true">
          <div className="plugin-ticket"><span>WORDPRESS / COUPONS</span><strong>COUPON</strong><div className="ticket-cut" /></div>
          <div className="plugin-review"><span>REVIEWS / THREE FORMATS</span><div><b>Text</b><b>Image</b><b>Video</b></div></div>
          <div className="plugin-storage"><span>EXTERNAL STORAGE</span><strong>↗</strong></div>
        </div>
      );
    case "powerbi":
      return (
        <div className="visual visual-powerbi" aria-hidden="true">
          <div className="bi-sources"><span>DATA SOURCES</span><strong>AxisCare</strong><strong>SharePoint</strong><small>+ other sources</small></div>
          <div className="bi-line" />
          <div className="bi-report"><span>POWER BI / VISUALIZATION</span><div className="bi-bars"><b /><b /><b /><b /><b /><b /><b /></div><div className="bi-rule" /><div className="bi-rule bi-rule-short" /></div>
        </div>
      );
    case "trading":
      return (
        <div className="visual visual-trading" aria-hidden="true">
          <div className="trading-grid" />
          <svg className="trading-line" viewBox="0 0 500 190" preserveAspectRatio="none"><path d="M0 137 L55 128 L95 145 L145 97 L190 112 L235 70 L285 92 L335 55 L380 78 L430 25 L500 37" /></svg>
          <div className="trading-route"><span>TRADING</span><i>→</i><span>BOT</span><i>→</i><span>AUTOMATION</span></div>
          <div className="trading-title">Trading bot<br /><em>development</em></div>
        </div>
      );
  }
}

function ProjectMedia({ project }: { project: Project }) {
  if (project.id === "trading") {
    return (
      <figure className="project-media project-media--trading project-media--dashboard">
        <Link className="project-image-link" href="/work/trading" aria-label="Explore a static preview of the trading dashboard">
          <div className="trading-preview" aria-hidden="true">
            <div className="trading-preview-top"><strong>🤖 &nbsp;GALA10 <span>Chocoletra</span></strong><span>📊 Dashboard &nbsp; ♟ Señales &nbsp; 📈 Trades &nbsp; 🟨 Historial</span><i>● &nbsp; ACTIVO</i></div>
            <div className="trading-preview-body">
              <div className="trading-preview-side"><small>NAVEGACIÓN</small><b>📊 Dashboard</b><span>♟ Señales</span><span>📈 Trades en Vivo</span><span>🟨 Historial</span><span>⚙ Configuración</span><small>ACTIVOS MONITORIZADOS</small><em>AAPL <i>BUY</i></em><em>AMD <i>SELL</i></em><em>NVDA <i>BUY</i></em><em>TSLA <i>SELL</i></em></div>
              <div className="trading-preview-main"><strong>📊 Dashboard de Trading</strong><small>Visión general del sistema en tiempo real</small><div className="trading-preview-metrics"><div><i>●</i><b>4035</b><span>Señales BUY</span></div><div><i>●</i><b>4018</b><span>Señales SELL</span></div><div><i>↗</i><b>16</b><span>Trades Abiertos</span></div><div><i>💰</i><b>$0.58</b><span>PnL PAPER actual</span></div></div><div className="trading-preview-strip">🛡️ Kill Switch diario preparado <span>$2.02</span><span>$-200.00</span><span>$202.02</span></div><div className="trading-preview-status">🔄 Schwab reconciliado · exposición conocida</div><div className="trading-preview-panel"><small>CONTROL DE EJECUCIÓN · V3.3.0</small><b>Tickers y tamaño de las órdenes</b><span>Defina los límites de REAL y guarde la cantidad de cada ticker.</span><div><i>Máximo de tickers REAL<br /><strong>15</strong></i><i>Máximo de acciones por orden REAL<br /><strong>10</strong></i></div></div></div>
            </div>
          </div>
          <span className="project-image-view">EXPLORE INTERFACE ↗</span>
        </Link>
      </figure>
    );
  }

  return (
    <figure className={"project-media project-media--" + project.id + (project.screenshot ? " project-media--screenshot" : "")}>
      {project.screenshot ? (
        <a className="project-image-link" href={project.screenshot} target="_blank" rel="noopener noreferrer" aria-label={"View full screenshot of " + project.title + " in a new tab"}>
          <Image
            src={project.screenshot}
            alt={project.screenshotAlt ?? "Screenshot of " + project.title}
            fill
            sizes="(max-width: 800px) 100vw, 52vw"
            className="project-screenshot"
          />
          <span className="project-image-view">VIEW FULL IMAGE ↗</span>
        </a>
      ) : (
        <div
          className="project-concept"
          role="img"
          aria-label={"Conceptual illustration of " + project.title + ": " + project.scope.join(", ")}
        >
          <div className="concept-top"><span>TT / SELECTED WORK</span><span>{project.number} — 05</span></div>
          <ProjectIllustration id={project.id} />
          <div className="concept-bottom"><span>CONCEPTUAL VIEW</span><span>{project.category}</span></div>
        </div>
      )}
    </figure>
  );
}

export default function Work() {
  return (
    <section className="work-section section" id="work">
      <div className="site-shell">
        <div className="section-intro" data-reveal>
          <p className="eyebrow"><span className="eyebrow-rule" /> 01 / SELECTED WORK</p>
          <div className="section-intro-row">
            <h2>Built for the world<br /><em>outside the mockup.</em></h2>
            <p>Real projects across clinical software, AI, plugins, reporting, and automation. Each one called for a different kind of thinking.</p>
          </div>
        </div>

        <nav className="project-index" aria-label="Jump to a project" data-reveal>
          {projects.map((project) => (
            <a href={`#project-${project.number}`} key={project.number}>
              <span>{project.number}</span>
              <strong>{project.title}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>

        <div className="project-list">
          {projects.map((project) => (
            <article className="case" id={`project-${project.number}`} key={project.number} data-reveal>
              <div className="case-copy">
                <div className="case-meta"><span>PROJECT / {project.number}</span><span>{project.category}</span></div>
                <h3>{project.title}</h3>
                <p className="case-description">{project.description}</p>
                <div className="case-scope">
                  <span className="scope-label">SCOPE</span>
                  <div>{project.scope.map((item) => <span key={item}>{item}</span>)}</div>
                </div>
                {project.link && <a className="case-link" href={project.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.title} portal in a new tab`}>Open project portal <span aria-hidden="true">↗</span></a>}
              </div>
              <ProjectMedia project={project} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
