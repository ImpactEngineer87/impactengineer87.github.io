"use client";

import { useEffect, useRef } from "react";

type FallingDrop = {
  x: number;
  age: number;
  duration: number;
  size: number;
  label: string;
};

type Ripple = {
  x: number;
  age: number;
  strength: number;
};

const RIPPLE_LIFE = 4.2;
const STACK_LABELS = ["Next.js", "React", "TypeScript", "WordPress", "Power BI", "SharePoint", "Windows"];

export default function LiquidField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !hero || !context) return;

    const ctx = context;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drops: FallingDrop[] = [];
    const ripples: Ripple[] = [];
    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastTime = 0;
    let spawnTimer = 0.9;
    let nextStackIndex = Math.floor(Math.random() * STACK_LABELS.length);
    let visible = false;
    let impacting = false;

    const waterTop = () => height - Math.min(width < 700 ? 150 : 190, height * 0.24);
    const impactY = () => waterTop() + (height - waterTop()) * 0.44;

    const spawnDrop = (x = width * (0.11 + Math.random() * 0.78)) => {
      drops.push({
        x,
        age: 0,
        duration: 1.75 + Math.random() * 0.45,
        size: Math.max(33, Math.min(52, width * (0.028 + Math.random() * 0.007))),
        label: STACK_LABELS[nextStackIndex],
      });
      nextStackIndex = (nextStackIndex + 1) % STACK_LABELS.length;
      spawnTimer = 3.2 + Math.random() * 2.5;
    };

    const drawWater = () => {
      const top = waterTop();
      const depth = height - top;
      const fill = ctx.createLinearGradient(0, top, 0, height);
      fill.addColorStop(0, "rgba(240, 249, 243, 0.86)");
      fill.addColorStop(0.42, "rgba(191, 221, 202, 0.55)");
      fill.addColorStop(1, "rgba(111, 166, 137, 0.52)");
      ctx.fillStyle = fill;
      ctx.fillRect(0, top, width, depth);

      // Broken reflections recede toward the far edge of the surface.
      for (let row = 1; row < 12; row++) {
        const ratio = row / 12;
        const y = top + depth * Math.pow(ratio, 1.28);
        const glints = Math.ceil(width / 150);
        for (let index = 0; index < glints; index++) {
          const x = (index * 157 + row * 83) % width;
          const length = 11 + ((index * 29 + row * 17) % 42);
          ctx.beginPath();
          ctx.moveTo(x, y + Math.sin(index + row) * 1.4);
          ctx.lineTo(Math.min(width, x + length), y + Math.sin(index + row) * 1.4);
          ctx.strokeStyle = "rgba(255, 255, 255, " + (0.13 + ratio * 0.19) + ")";
          ctx.lineWidth = 1 + ratio * 0.8;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.moveTo(0, top + 0.5);
      ctx.lineTo(width, top + 0.5);
      ctx.strokeStyle = "rgba(70, 133, 102, 0.58)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, top + 3);
      ctx.lineTo(width, top + 3);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const drawRing = (x: number, y: number, radius: number, opacity: number) => {
      const ry = Math.max(3, radius * 0.18);
      const gradient = ctx.createLinearGradient(0, y - ry, 0, y + ry);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      gradient.addColorStop(0.43, "rgba(105, 174, 135, 0.65)");
      gradient.addColorStop(0.58, "rgba(48, 123, 91, 0.82)");
      gradient.addColorStop(1, "rgba(232, 255, 240, 0.94)");

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.ellipse(x, y + radius * 0.018, radius, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(42, 111, 78, 0.55)";
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(x, y, radius, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(x, y - 3, radius, ry, 0, Math.PI * 1.06, Math.PI * 1.94);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    };

    const drawRipple = (ripple: Ripple) => {
      if (ripple.age >= RIPPLE_LIFE) return;
      const age = ripple.age;
      const fade = Math.pow(1 - age / RIPPLE_LIFE, 1.15) * ripple.strength;
      const speed = Math.max(205, Math.min(315, width * 0.2));
      const radius = 10 + age * speed;
      const centerY = impactY();

      // The lens-like centre sits below the raised wave rims.
      if (age < 1.25) {
        ctx.save();
        ctx.globalAlpha = (1 - age / 1.25) * 0.3;
        ctx.translate(ripple.x, centerY);
        ctx.scale(1, 0.28);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(45, radius * 0.95));
        glow.addColorStop(0, "rgba(255,255,255,0.88)");
        glow.addColorStop(0.58, "rgba(84,155,115,0.23)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(45, radius * 0.95), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let band = 2; band >= 0; band--) {
        const bandRadius = radius - band * 51;
        if (bandRadius > 8) {
          drawRing(ripple.x, centerY, bandRadius, fade * (1 - band * 0.24));
        }
      }
    };

    const drawDrop = (x: number, y: number, size: number, opacity: number, label: string) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.shadowColor = "rgba(36, 102, 74, 0.22)";
      ctx.shadowBlur = 17;
      ctx.shadowOffsetY = 7;

      ctx.beginPath();
      ctx.moveTo(x, y - size * 1.7);
      ctx.bezierCurveTo(x - size * 0.18, y - size * 1.02, x - size, y - size * 0.28, x - size, y + size * 0.31);
      ctx.bezierCurveTo(x - size, y + size * 1.38, x + size, y + size * 1.38, x + size, y + size * 0.31);
      ctx.bezierCurveTo(x + size, y - size * 0.28, x + size * 0.18, y - size * 1.02, x, y - size * 1.7);
      ctx.closePath();
      const glass = ctx.createRadialGradient(x - size * 0.42, y - size * 0.2, size * 0.1, x + size * 0.35, y + size * 0.4, size * 1.65);
      glass.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      glass.addColorStop(0.22, "rgba(191, 235, 211, 0.98)");
      glass.addColorStop(0.65, "rgba(78, 158, 117, 0.95)");
      glass.addColorStop(1, "rgba(29, 104, 73, 0.98)");
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(37, 108, 76, 0.58)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(x - size * 0.37, y + size * 0.05, size * 0.13, size * 0.43, -0.42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + size * 0.32, y + size * 0.43, size * 0.09, size * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(12, 93, 62, 0.2)";
      ctx.fill();

      // Fit the stack name inside the rounded body of the glass drop.
      let fontSize = Math.min(13, size * 0.32);
      ctx.font = "800 " + fontSize + "px Arial, Helvetica, sans-serif";
      while (ctx.measureText(label).width > size * 1.72 && fontSize > 8) {
        fontSize -= 0.5;
        ctx.font = "800 " + fontSize + "px Arial, Helvetica, sans-serif";
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = "rgba(20, 69, 49, 0.86)";
      ctx.strokeText(label, x, y + size * 0.34);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x, y + size * 0.34);
      ctx.restore();
    };

    const drawSplash = (ripple: Ripple) => {
      if (ripple.age >= 0.62) return;
      const age = ripple.age;
      const fade = 1 - age / 0.62;
      const x = ripple.x;
      const y = impactY();

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.ellipse(x, y, 22 + age * 45, 5 + age * 9, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.93)";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * 5, y);
        ctx.bezierCurveTo(x + side * 16, y - 43 * fade, x + side * (31 + age * 65), y - 47 * fade, x + side * (42 + age * 75), y - 9 * fade);
        ctx.strokeStyle = "rgba(45, 139, 94, 0.8)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + side * (24 + age * 85), y - (24 + age * 18) * fade, 4 * fade, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(105, 181, 135, 0.85)";
        ctx.fill();
      }
      ctx.restore();
    };

    const render = () => {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);
      drawWater();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, waterTop(), width, height - waterTop());
      ctx.clip();
      for (const ripple of ripples) drawRipple(ripple);
      ctx.restore();

      for (const ripple of ripples) drawSplash(ripple);
      for (const drop of drops) {
        const progress = Math.min(1, drop.age / drop.duration);
        const eased = progress * progress;
        const startY = Math.min(145, height * 0.12);
        const endY = impactY() - drop.size * 0.6;
        const y = startY + (endY - startY) * eased;
        drawDrop(drop.x, y, drop.size, Math.min(1, progress * 4), drop.label);
      }
    };

    const measure = () => {
      width = hero.clientWidth;
      height = hero.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    };

    const tick = (now: number) => {
      frameId = 0;
      if (!visible || document.hidden) return;
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      spawnTimer -= delta;
      if (spawnTimer <= 0) spawnDrop();

      for (let index = drops.length - 1; index >= 0; index--) {
        drops[index].age += delta;
        if (drops[index].age >= drops[index].duration) {
          ripples.push({ x: drops[index].x, age: 0, strength: 0.85 + Math.random() * 0.15 });
          drops.splice(index, 1);
        }
      }
      for (let index = ripples.length - 1; index >= 0; index--) {
        ripples[index].age += delta;
        if (ripples[index].age >= RIPPLE_LIFE) ripples.splice(index, 1);
      }

      const nextImpacting = ripples.some((ripple) => ripple.age < 0.8);
      if (nextImpacting !== impacting) {
        impacting = nextImpacting;
        hero.classList.toggle("is-impacting", impacting);
      }
      render();
      frameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduceMotion || frameId || !visible || document.hidden) return;
      lastTime = performance.now();
      frameId = requestAnimationFrame(tick);
    };

    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a, button")) return;
      const bounds = hero.getBoundingClientRect();
      const x = Math.max(width * 0.08, Math.min(width * 0.92, event.clientX - bounds.left));
      spawnDrop(x);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    });
    const resizeObserver = new ResizeObserver(measure);
    measure();
    resizeObserver.observe(hero);
    observer.observe(hero);
    if (!reduceMotion) {
      hero.addEventListener("click", onClick);
      document.addEventListener("visibilitychange", start);
    }

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
      hero.classList.remove("is-impacting");
      hero.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return <canvas className="liquid-field" ref={canvasRef} role="img" aria-label="Water-drop visual featuring Next.js, React, TypeScript, WordPress, Power BI, SharePoint, and Windows" />;
}
