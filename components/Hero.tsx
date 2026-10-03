"use client";

import { useCallback, useRef, useState } from "react";
import ForestScene, { type WindReading } from "@/components/ForestScene";

type NavigationReading = {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  visible: boolean;
};

const destinations = [
  { label: "Home", href: "#home", position: "home", color: "sage", number: "01" },
  { label: "About me", href: "#about", position: "about", color: "moss", number: "02" },
  { label: "Experience", href: "#expertise", position: "experience", color: "olive", number: "03" },
  { label: "My work", href: "#work", position: "work", color: "gold", number: "04" },
  { label: "Contact me", href: "#contact", position: "contact", color: "amber", number: "05" },
];

const mobileNavigationLanes: Record<string, { side: "left" | "right"; sourceX: number; sourceY: number; y: number }> = {
  home: { side: "left", sourceX: .23, sourceY: .39, y: .39 },
  experience: { side: "right", sourceX: .76, sourceY: .46, y: .49 },
  about: { side: "left", sourceX: .24, sourceY: .58, y: .60 },
  work: { side: "right", sourceX: .76, sourceY: .69, y: .70 },
  contact: { side: "left", sourceX: .29, sourceY: .80, y: .80 },
};

function NavigationLeaf({ color, id }: { color: string; id: string }) {
  return (
    <svg className="navigation-leaf-art" viewBox="0 0 240 150" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="47" y1="130" x2="178" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor={`var(--${color}-shadow)`} />
          <stop offset=".45" stopColor={`var(--${color}-base)`} />
          <stop offset="1" stopColor={`var(--${color}-light)`} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="92" y1="29" x2="128" y2="109" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity=".34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-fold`} x1="100" y1="50" x2="134" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34421d" stopOpacity="0" />
          <stop offset=".49" stopColor="#34421d" stopOpacity=".13" />
          <stop offset=".52" stopColor="#ffffff" stopOpacity=".23" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 137C15 123 28 112 43 103" stroke={`var(--${color}-shadow)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M29 108C34 72 56 38 94 24C133 9 183 14 230 19C213 43 215 64 192 87C161 118 112 137 77 131C56 127 42 119 29 108Z" fill={`url(#${id}-fill)`} stroke={`var(--${color}-shadow)`} strokeOpacity=".35" />
      <path d="M29 108C80 93 153 59 230 19C198 54 185 84 155 103C112 130 64 132 29 108Z" fill={`url(#${id}-shine)`} />
      <path d="M29 108C34 72 56 38 94 24C133 9 183 14 230 19C213 43 215 64 192 87C161 118 112 137 77 131C56 127 42 119 29 108Z" fill={`url(#${id}-fold)`} />
      <g stroke="#f9f2cb" strokeOpacity=".24" strokeLinecap="round">
        <path d="M27 111C86 92 163 54 222 23" strokeWidth="1.8" />
        <path d="M55 101C53 77 67 53 79 39M80 91C78 65 89 44 105 28M108 78C110 53 118 36 133 22M139 62C143 43 154 30 166 21M166 47C174 33 185 25 199 21" />
        <path d="M55 101C67 116 83 123 103 126M80 91C92 108 110 117 130 117M108 78C124 94 138 101 159 102M139 62C154 78 167 85 183 85M166 47C181 60 192 63 207 59" />
      </g>
      <path d="M44 102C57 66 72 43 99 33" stroke="#fffbe2" strokeOpacity=".13" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M3 10h15c6 0 6-7 2-7-2 0-3 1-3 3M3 15h20M7 20h9c6 0 6 6 2 6-2 0-3-1-3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const navigationRefs = useRef(new Map<string, HTMLAnchorElement>());
  const heldLeaves = useRef(new Set<string>());
  const navigationFrames = useRef(new Map<string, NavigationReading>());
  const navigationViewport = useRef({ width: 0, height: 0 });
  const motionPaused = useRef(false);
  const [paused, setPaused] = useState(false);
  const [wind, setWind] = useState<WindReading | null>(null);

  const updateWind = useCallback((reading: WindReading) => {
    setWind(reading);
    const hero = heroRef.current;
    if (hero) {
      hero.style.setProperty("--wind-sway", `${1.2 + reading.power * 3.2}deg`);
      const drift = 2 + reading.power * 5;
      hero.style.setProperty("--wind-x", `${Math.cos(reading.direction) * drift}px`);
      hero.style.setProperty("--wind-y", `${Math.sin(reading.direction) * drift}px`);
    }
  }, []);

  const updateNavigation = useCallback((readings: NavigationReading[]) => {
    const hero = heroRef.current;
    if (!hero) return;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const resized = width !== navigationViewport.current.width || height !== navigationViewport.current.height;
    if (motionPaused.current && hero.dataset.navigationReady === "true" && !resized) return;
    navigationViewport.current = { width, height };
    if (resized) navigationFrames.current.clear();
    hero.dataset.navigationReady = "true";
    const halfLeaf = width <= 650 ? Math.max(136, Math.min(width * .39, 185)) / 2 : width <= 1000 ? 98 : Math.max(175, Math.min(width * .175, 245)) / 2;
    for (const reading of readings) {
      const leaf = navigationRefs.current.get(reading.id);
      if (!leaf || (!resized && heldLeaves.current.has(reading.id))) continue;
      let bounded = {
        ...reading,
        x: Math.max(halfLeaf + 12, Math.min(width - halfLeaf - 12, reading.x)),
        y: Math.max(height * .37, Math.min(height * .84, reading.y)),
        scale: Math.max(.82, Math.min(1.13, reading.scale)),
      };
      const mobileLane = width <= 650 ? mobileNavigationLanes[reading.id] : undefined;
      if (mobileLane) {
        // Keep the breeze inside separate lanes on narrow screens.
        const margin = halfLeaf * 1.1 + 6;
        const leftCenter = Math.max(margin + 18, width * .255);
        const center = mobileLane.side === "left" ? leftCenter : width - leftCenter;
        const driftX = Math.tanh((reading.x - width * mobileLane.sourceX) / 55) * 18;
        const driftY = Math.tanh((reading.y - height * mobileLane.sourceY) / 65) * 4;
        bounded = {
          ...reading,
          x: Math.max(margin, Math.min(width - margin, center + driftX)),
          y: height * mobileLane.y + driftY,
          scale: Math.max(.86, Math.min(.92, .89 + (reading.scale - 1) * .14)),
          rotation: Math.tanh(reading.rotation / 16) * 5,
        };
      }
      const previous = navigationFrames.current.get(reading.id);
      // Ease back into the breeze after the visitor releases a leaf.
      const frame = previous ? {
        ...bounded,
        x: previous.x + (bounded.x - previous.x) * .16,
        y: previous.y + (bounded.y - previous.y) * .16,
        scale: previous.scale + (bounded.scale - previous.scale) * .16,
        rotation: previous.rotation + (bounded.rotation - previous.rotation) * .16,
      } : bounded;
      navigationFrames.current.set(reading.id, frame);
      leaf.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0) translate(-50%, -50%) rotate(${frame.rotation}deg) rotateY(${frame.rotation * .4}deg) rotateX(${(frame.scale - 1) * 35}deg) scale(${frame.scale})`;
      // Navigation stays reachable even when its world anchor is behind a tree.
      leaf.style.opacity = frame.visible ? "1" : ".8";
    }
  }, []);

  const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const windDirection = wind ? directions[((Math.round(wind.direction / (Math.PI / 4)) % 8) + 8) % 8] : "E";
  const windDescription = !wind ? "A little moment in nature" : wind.speed === 0 ? "Still air. A little quiet." : wind.speed < 8 ? "A gentle breeze" : wind.speed < 16 ? "Leaves on the move" : "A passing gust";

  return (
    <section className={`forest-hero${paused ? " is-paused" : ""}`} id="home" ref={heroRef} aria-labelledby="forest-title">
      <ForestScene paused={paused} onWindChange={updateWind} onNavigationPositions={updateNavigation} />
      <div className="forest-atmosphere" aria-hidden="true" />
      <header className="forest-header">
        <a className="forest-brand" href="#home" aria-label="Thando Thomo, home">
          <span className="forest-monogram">tt<span>.</span></span>
          <span>Thando Thomo<small>SOFTWARE ENGINEER</small></span>
        </a>
        <a className="forest-availability" href="#contact"><span className="forest-status-dot" /> Open to thoughtful collaborations <span aria-hidden="true">↗</span></a>
      </header>
      <div className="forest-intro">
        <p className="forest-kicker"><span /> A LITTLE NATURE. A LOT OF POSSIBILITY. <span /></p>
        <h1 id="forest-title">Rooted in curiosity.<br /><em>Built with purpose.</em></h1>
        <p className="forest-description">I&apos;m Thando. I build thoughtful software<br className="forest-desktop-break" /> that brings people, ideas, and systems together.</p>
      </div>
      <nav className="forest-navigation" aria-label="Explore my portfolio">
        {destinations.map((destination) => (
          <a
            className={`navigation-leaf navigation-leaf--${destination.position} navigation-leaf--${destination.color}`}
            href={destination.href}
            key={destination.position}
            ref={(node) => {
              if (node) navigationRefs.current.set(destination.position, node);
              else navigationRefs.current.delete(destination.position);
            }}
            onPointerEnter={() => heldLeaves.current.add(destination.position)}
            onPointerLeave={(event) => {
              if (document.activeElement !== event.currentTarget) heldLeaves.current.delete(destination.position);
            }}
            onFocus={() => heldLeaves.current.add(destination.position)}
            onBlur={(event) => {
              if (!event.currentTarget.matches(":hover")) heldLeaves.current.delete(destination.position);
            }}
          >
            <span className="navigation-leaf-body">
              <NavigationLeaf color={destination.color} id={`nav-leaf-${destination.position}`} />
              <span className="navigation-leaf-caption"><small>{destination.number}</small><span>{destination.label} <span className="leaf-link-arrow" aria-hidden="true">↗</span></span></span>
            </span>
          </a>
        ))}
      </nav>
      <p className="forest-invitation"><span className="forest-invitation-line" /> Every leaf leads somewhere.<small>Catch a leaf. Follow your curiosity.</small><span className="forest-look-hint">Move your pointer to look around.</span></p>
      <div className="forest-footer">
        <div className="forest-weather"><WindIcon /><div><span>{paused ? "A MOMENT OF STILLNESS" : wind ? `WIND ${windDirection} · ${Math.round(wind.speed)} KM/H` : "THE WOODLAND IS WAKING"}</span><small>{paused ? "Take your time. Stay a while." : windDescription}</small></div></div>
        <a className="forest-scroll" href="#expertise" aria-label="Follow the path to my experience"><span>FOLLOW THE PATH</span><span aria-hidden="true">↓</span></a>
        <button className="forest-motion-button" type="button" onClick={() => {
          motionPaused.current = !paused;
          setPaused(!paused);
        }} aria-pressed={paused} aria-label={paused ? "Resume woodland animation" : "Pause woodland animation"}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{paused ? <path d="m7 4 9 6-9 6V4Z" fill="currentColor" /> : <><path d="M7 4v12M13 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}</svg>
          <span>{paused ? "Resume scene" : "Pause scene"}</span>
        </button>
      </div>
    </section>
  );
}
