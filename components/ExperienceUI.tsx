"use client";

import { useEffect, useRef } from "react";

export default function ExperienceUI() {
  const progress = useRef<HTMLDivElement>(null);
  const drop = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (progress.current) progress.current.style.transform = `scaleX(${ratio})`;
        if (drop.current) drop.current.style.left = `${ratio * 100}%`;
      });
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealObserver = reduceMotion ? null : new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -45px 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver?.observe(element));
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      revealObserver?.disconnect();
    };
  }, []);

  return <div className="page-progress" aria-hidden="true"><div ref={progress} /><span className="progress-drop" ref={drop} /></div>;
}
