import LiquidField from "@/components/LiquidField";

export default function Hero() {
  return (
    <section className="hero" id="home">
      <LiquidField />
      <div className="announcement-bar">
        <div className="site-shell announcement-inner">
          <span>INDEPENDENT SOFTWARE ENGINEER & SYSTEMS SPECIALIST</span>
          <span>OPEN TO THOUGHTFUL COLLABORATIONS <span className="status-dot" /></span>
        </div>
      </div>

      <header className="site-header site-shell">
        <a className="brand" href="#home" aria-label="Thando Thomo, back to top">
          <span className="brand-mark">TT<span>.</span></span>
          <span className="brand-name">THANDO<br />THOMO</span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#work">Work</a>
          <a href="#expertise">Expertise</a>
          <a href="#about">About</a>
        </nav>
        <a className="header-contact" href="#contact">Let&apos;s connect <span aria-hidden="true">↗</span></a>
      </header>

      <div className="hero-main site-shell">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-rule" /> ENGINEERING WITH PURPOSE</p>
          <h1>Complex<br />systems.<br /><em>Clear outcomes.</em></h1>
          <p className="hero-description">I&apos;m Thando Thomo. I build useful software where product thinking, engineering, data, and integrations meet.</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#work">Explore selected work <span aria-hidden="true">↘</span></a>
            <a className="underlined-link" href="#expertise">What I specialize in <span aria-hidden="true">↗</span></a>
          </div>
        </div>

        <div className="systems-board" aria-label="Diagram showing product, integration, and data as connected layers">
          <div className="board-topline"><span>SYSTEMS / 001</span><span>THANDO THOMO © 2026</span></div>
          <div className="board-heading">
            <span>THE WORK BEHIND<br />THE EXPERIENCE</span>
            <span className="board-drop" aria-hidden="true"><span className="board-drop-core" /></span>
          </div>
          <div className="board-flow" aria-hidden="true">
            <div className="flow-card flow-card-product"><span>01 / PRODUCT</span><strong>Build the tool</strong><small>WEB · DESKTOP · PLUGINS</small></div>
            <span className="flow-connector">↓</span>
            <div className="flow-card flow-card-connect"><span>02 / CONNECTIONS</span><strong>Make it work together</strong><small>API · CRM · WORKFLOWS</small></div>
            <span className="flow-connector">↓</span>
            <div className="flow-card flow-card-insight"><span>03 / INTELLIGENCE</span><strong>Make it useful</strong><small>AI · DATA · VISUALIZATION</small></div>
          </div>
          <div className="board-foot"><span>ONE CONNECTED SYSTEM</span><span>↗</span></div>
        </div>
      </div>

      <div className="hero-bottom site-shell">
        <a href="#work" className="scroll-link"><span className="scroll-arrow">↓</span> SCROLL TO EXPLORE</a>
        <span>BUILDING ACROSS HEALTHCARE, DATA & AUTOMATION</span>
        <span>01 — 04</span>
      </div>
    </section>
  );
}
