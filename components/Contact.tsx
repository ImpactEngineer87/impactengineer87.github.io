export default function Contact() {
  return (
    <section className="contact-section section" id="contact">
      <div className="site-shell contact-main" data-reveal>
        <p className="eyebrow"><span className="eyebrow-rule" /> 04 / GET IN TOUCH</p>
        <h2>Have something<br /><em>complex to solve?</em></h2>
        <div className="contact-row">
          <p>Tell me what you&apos;re building. I&apos;d be glad to explore how the pieces could work together.</p>
          <a className="button button-light" href="mailto:thandothomo01@gmail.com">Start a conversation <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <footer className="site-footer site-shell">
        <a className="brand" href="#home"><span className="brand-mark">TT<span>.</span></span><span className="brand-name">THANDO<br />THOMO</span></a>
        <span>INDEPENDENT SOFTWARE ENGINEER</span>
        <a href="#home">BACK TO TOP ↑</a>
        <span>© {new Date().getFullYear()} THANDO THOMO</span>
      </footer>
    </section>
  );
}
