const capabilities = [
  { number: "01", title: "Product engineering", detail: "Web platforms, Windows applications, backends, and custom plugins." },
  { number: "02", title: "AI & integrations", detail: "Assistants, CRM connections, social platforms, and connected workflows." },
  { number: "03", title: "Data & insight", detail: "Power BI experiences and reporting across operational data sources." },
  { number: "04", title: "Practical automation", detail: "Tools and bots that take on repeatable work with clear purpose." },
];

export default function About() {
  return (
    <>
      <section className="expertise-section section" id="expertise">
        <div className="section-wave" aria-hidden="true">
          <svg viewBox="0 0 2880 84" preserveAspectRatio="none">
            <path d="M0 48 C120 12 240 84 360 48 S600 12 720 48 S960 84 1080 48 S1320 12 1440 48 C1560 12 1680 84 1800 48 S2040 12 2160 48 S2400 84 2520 48 S2760 12 2880 48 L2880 84 L0 84 Z" />
          </svg>
        </div>
        <div className="site-shell expertise-grid">
          <div className="expertise-heading" data-reveal>
            <p className="eyebrow"><span className="eyebrow-rule" /> 02 / EXPERTISE</p>
            <h2>Specialist thinking.<br /><em>Full-system view.</em></h2>
            <p>Good software connects the people, tools, and decisions around it. That&apos;s the part I like solving.</p>
          </div>
          <div className="capability-list">
            {capabilities.map((item) => (
              <div className="capability" key={item.number} data-reveal>
                <span>{item.number}</span>
                <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                <span aria-hidden="true">↗</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section section" id="about">
        <div className="site-shell about-grid" data-reveal>
          <p className="eyebrow"><span className="eyebrow-rule" /> 03 / ABOUT ME</p>
          <div>
            <h2>I like solving the <em>whole problem.</em></h2>
            <div className="about-text">
              <p>I&apos;m Thando Thomo, a software developer working across products, backend systems, integrations, data, and automation.</p>
              <p>My work moves between different industries and tools, but the aim is consistent: understand what matters, build with care, and make complex things easier to use.</p>
            </div>
            <div className="about-footer"><span>PRODUCT THINKING</span><span>ENGINEERING</span><span>CONNECTED SYSTEMS</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
