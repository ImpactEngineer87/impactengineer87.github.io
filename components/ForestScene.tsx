"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping, AdditiveBlending, BufferGeometry, CanvasTexture, Color,
  DirectionalLight, DoubleSide, Float32BufferAttribute, FogExp2, Group,
  HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Points,
  PointsMaterial, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from "three";
import { createBirdModel } from "@/lib/forestBirds3D";
import { createForestSimulation3D } from "@/lib/forestSimulation3D";
import { createForestWorld3D } from "@/lib/forestWorld3D";

export type WindReading = { speed: number; power: number; direction: number };
export type NavigationReading = { id: string; x: number; y: number; scale: number; rotation: number; visible: boolean };
type Props = {
  paused: boolean;
  onWindChange: (reading: WindReading) => void;
  onNavigationPositions?: (readings: NavigationReading[]) => void;
};

const LEAF_COLORS = ["#afbe62", "#85a45a", "#c3a655", "#cfbd76"];
const NAVIGATION = [
  { id: "home", desktop: [.16, .46], mobile: [.23, .39], depth: 10 },
  { id: "about", desktop: [.21, .7], mobile: [.24, .58], depth: 9 },
  { id: "experience", desktop: [.82, .45], mobile: [.76, .46], depth: 11 },
  { id: "work", desktop: [.78, .64], mobile: [.76, .69], depth: 8.5 },
  { id: "contact", desktop: [.85, .8], mobile: [.29, .8], depth: 9.5 },
];

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,248,208,1)");
    gradient.addColorStop(.2, "rgba(255,245,190,.6)");
    gradient.addColorStop(1, "rgba(255,245,190,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

function lightShafts() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(64, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 64; x++) {
        const index = (y * 64 + x) * 4;
        const cross = Math.pow(Math.sin(x / 63 * Math.PI), 2);
        const fade = Math.pow(Math.sin(y / 255 * Math.PI), .7);
        image.data[index] = image.data[index + 1] = image.data[index + 2] = 255;
        image.data[index + 3] = Math.round(cross * fade * 255);
      }
    }
    context.putImageData(image, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({ color: "#ffe0a4", map: texture, transparent: true, opacity: .075, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: true });
  const geometry = new PlaneGeometry(1.6, 28);
  const group = new Group();
  for (let index = 0; index < 4; index++) {
    const start = new Vector3(-12 + index * 2.2, 22, -17 - index * 4);
    const end = new Vector3(5 + index * 2, .1, 5 - index * 6);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), start.clone().sub(end).normalize());
    group.add(mesh);
  }
  return { group, dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); } };
}

function paintFallback(canvas: HTMLCanvasElement, width: number, height: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.width = width;
  canvas.height = height;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#d7e1c9");
  sky.addColorStop(.4, "#f0edda");
  sky.addColorStop(1, "#344c32");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#c2b38e";
  context.beginPath();
  context.moveTo(width * .55, height * .45);
  context.bezierCurveTo(width * .58, height * .68, width * .3, height * .78, width * .36, height);
  context.lineTo(width * .68, height);
  context.bezierCurveTo(width * .45, height * .78, width * .63, height * .67, width * .56, height * .45);
  context.fill();
  for (let side = 0; side < 2; side++) {
    const x = width * (side ? .86 : .12);
    context.strokeStyle = "#4b5037";
    context.lineWidth = width * .055;
    context.beginPath();
    context.moveTo(x, height);
    context.bezierCurveTo(x - width * .03, height * .72, x + width * .025, height * .28, x, 0);
    context.stroke();
    for (let index = 0; index < 75; index++) {
      const phase = index * 2.399;
      const fx = x + Math.sin(phase) * width * .15;
      const fy = (index % 15) / 15 * height * .4;
      context.fillStyle = ["#557249", "#6b814f", "#8b995b"][index % 3];
      context.beginPath();
      context.ellipse(fx, fy, width * .032, height * .018, phase, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export default function ForestScene({ paused, onWindChange, onNavigationPositions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onWindChange, onNavigationPositions });
  const updateActivityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    updateActivityRef.current?.();
  }, [paused]);
  useEffect(() => { callbacksRef.current = { onWindChange, onNavigationPositions }; }, [onWindChange, onNavigationPositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    let width = container.clientWidth;
    let height = container.clientHeight;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "high-performance" });
    if (!gl) {
      canvas.dataset.renderMode = "fallback";
      paintFallback(canvas, width, height);
      const fallbackResize = new ResizeObserver(() => paintFallback(canvas, container.clientWidth, container.clientHeight));
      fallbackResize.observe(container);
      callbacksRef.current.onWindChange({ speed: 0, power: 0, direction: 0 });
      return () => fallbackResize.disconnect();
    }

    const renderer = new WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    const mobile = width <= 650;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    canvas.dataset.renderMode = "webgl2";

    const scene = new Scene();
    scene.background = new Color("#dce6d5");
    scene.fog = new FogExp2("#d2dec4", .028);
    const camera = new PerspectiveCamera(mobile ? 62 : 52, width / height, .1, 180);
    camera.position.set(0, 3.3, 16);
    camera.lookAt(0, 5, -20);
    camera.updateMatrixWorld();
    scene.add(new HemisphereLight("#e6f0e3", "#4a5430", 1.8));
    const sunlight = new DirectionalLight("#fff0cf", 3.2);
    sunlight.position.set(-15, 26, 9);
    sunlight.target.position.set(0, 0, -25);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sunlight.shadow.camera.left = -22;
    sunlight.shadow.camera.right = 22;
    sunlight.shadow.camera.top = 24;
    sunlight.shadow.camera.bottom = -24;
    sunlight.shadow.camera.near = .5;
    sunlight.shadow.camera.far = 100;
    sunlight.shadow.bias = -.0004;
    sunlight.shadow.normalBias = .06;
    sunlight.shadow.radius = 3;
    scene.add(sunlight, sunlight.target);

    const world = createForestWorld3D(mobile);
    scene.add(world.group);
    const shafts = lightShafts();
    scene.add(shafts.group);
    const simulation = createForestSimulation3D({ leafCount: mobile ? 42 : 58, birdCount: 5 });
    const flyingGeometry = world.leafGeometry.clone();
    const flyingMaterial = new MeshStandardMaterial({ map: world.leafMaterial.map, color: "#dae1a4", roughness: .82, metalness: 0, side: DoubleSide });
    const flyingLeaves = new InstancedMesh(flyingGeometry, flyingMaterial, simulation.leaves.length);
    flyingLeaves.frustumCulled = false;
    flyingLeaves.castShadow = true;
    scene.add(flyingLeaves);
    const leafDummy = new Object3D();
    const beakOffset = new Vector3();
    const leafColor = new Color();
    const birdModels = simulation.birds.map(() => createBirdModel());
    birdModels.forEach((bird) => scene.add(bird.group));

    const pollenCount = mobile ? 55 : 100;
    const pollenPositions = new Float32Array(pollenCount * 3);
    const pollenOrigins = new Float32Array(pollenCount * 3);
    for (let index = 0; index < pollenCount; index++) {
      pollenOrigins[index * 3] = (Math.random() - .5) * 22;
      pollenOrigins[index * 3 + 1] = 1 + Math.random() * 12;
      pollenOrigins[index * 3 + 2] = 12 - Math.random() * 55;
    }
    const pollenGeometry = new BufferGeometry();
    pollenGeometry.setAttribute("position", new Float32BufferAttribute(pollenPositions, 3));
    const pollenTexture = glowTexture();
    const pollenMaterial = new PointsMaterial({ color: "#fff5c6", map: pollenTexture, size: .07, transparent: true, opacity: .55, depthWrite: false, blending: AdditiveBlending });
    const pollen = new Points(pollenGeometry, pollenMaterial);
    pollen.frustumCulled = false;
    scene.add(pollen);

    let frame = 0;
    let previousTime = 0;
    let elapsed = 0;
    let lastReport = -1;
    let visible = true;
    let disposed = false;
    let contextLost = false;
    let scrollAmount = 0;
    const pointer = new Vector2();
    const smoothPointer = new Vector2();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const projection = new Vector3();
    const up = new Vector3(0, 1, 0);
    const anchors = NAVIGATION.map((item) => ({ ...item, base: new Vector3() }));

    const canAnimate = () => !disposed && !contextLost && !pausedRef.current && !reducedMotion.matches && visible && !document.hidden;
    const measureAnchors = () => {
      const savedPosition = camera.position.clone();
      const savedQuaternion = camera.quaternion.clone();
      camera.position.set(0, 3.3, 16);
      camera.lookAt(0, 5, -20);
      camera.updateMatrixWorld();
      for (const anchor of anchors) {
        const [x, y] = width <= 650 ? anchor.mobile : anchor.desktop;
        anchor.base.set(x * 2 - 1, 1 - y * 2, .5).unproject(camera).sub(camera.position).normalize().multiplyScalar(anchor.depth).add(camera.position);
      }
      camera.position.copy(savedPosition);
      camera.quaternion.copy(savedQuaternion);
      camera.updateMatrixWorld();
    };
    const draw = () => {
      const still = reducedMotion.matches;
      const wind = simulation.wind;
      world.update(elapsed, still ? 0 : wind.power);
      for (let index = 0; index < simulation.birds.length; index++) {
        const bird = simulation.birds[index];
        const model = birdModels[index];
        model.group.position.set(bird.x, bird.y, bird.z);
        model.group.rotation.set(bird.bank, bird.heading, bird.pitch, "YZX");
        model.group.scale.setScalar(bird.scale);
        model.animate(elapsed + index * .53, bird.state === "hunt" ? 5.8 : 4.5, bird.flapStrength < .3 || still, bird.state === "eat" && !still);
      }
      for (let index = 0; index < simulation.leaves.length; index++) {
        const leaf = simulation.leaves[index];
        leafDummy.position.set(leaf.x, leaf.y, leaf.z);
        if (leaf.state === "caught" && leaf.caughtBy !== null) {
          const model = birdModels[leaf.caughtBy].group;
          beakOffset.set(.24, .065, 0).multiplyScalar(model.scale.x).applyQuaternion(model.quaternion).add(model.position);
          leafDummy.position.copy(beakOffset);
        }
        leafDummy.rotation.set(leaf.rx, leaf.ry, leaf.rz);
        leafDummy.scale.setScalar(leaf.opacity < .08 ? 0 : leaf.size * (leaf.state === "caught" ? 1 : 1.25));
        leafDummy.updateMatrix();
        flyingLeaves.setMatrixAt(index, leafDummy.matrix);
        flyingLeaves.setColorAt(index, leafColor.set(LEAF_COLORS[leaf.color % LEAF_COLORS.length]));
      }
      flyingLeaves.instanceMatrix.needsUpdate = true;
      if (flyingLeaves.instanceColor) flyingLeaves.instanceColor.needsUpdate = true;
      for (let index = 0; index < pollenCount; index++) {
        const phase = index * 2.399;
        pollenPositions[index * 3] = pollenOrigins[index * 3] + Math.sin(elapsed * .2 + phase) * 1.2;
        pollenPositions[index * 3 + 1] = pollenOrigins[index * 3 + 1] + Math.sin(elapsed * .13 + phase) * .4;
        pollenPositions[index * 3 + 2] = pollenOrigins[index * 3 + 2] + Math.cos(elapsed * .17 + phase) * .6;
      }
      const position = pollenGeometry.getAttribute("position");
      (position.array as Float32Array).set(pollenPositions);
      position.needsUpdate = true;
      renderer.render(scene, camera);
      const readings = anchors.map((anchor, index) => {
        const phase = index * 1.7;
        const motion = still ? 0 : elapsed;
        const amplitude = still ? 0 : .4 + wind.power * .8;
        projection.copy(anchor.base);
        projection.x += Math.sin(motion * .48 + phase) * amplitude + (still ? 0 : wind.x * .045);
        projection.y += Math.cos(motion * .59 + phase) * amplitude * .65;
        projection.z += Math.sin(motion * .34 + phase) * amplitude * 1.35;
        const distance = camera.position.distanceTo(projection);
        projection.project(camera);
        return { id: anchor.id, x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2, scale: anchor.depth / distance, rotation: still ? 0 : Math.sin(motion * .65 + phase) * (7 + wind.power * 13), visible: projection.z > -1 && projection.z < 1 };
      });
      callbacksRef.current.onNavigationPositions?.(readings);
    };
    const report = () => {
      callbacksRef.current.onWindChange({ speed: reducedMotion.matches ? 0 : simulation.wind.speed, power: reducedMotion.matches ? 0 : simulation.wind.power, direction: simulation.wind.direction });
      canvas.dataset.caughtLeaves = String(simulation.stats.caughtLeaves);
      canvas.dataset.consumedLeaves = String(simulation.stats.consumedLeaves);
      canvas.dataset.sceneTriangles = String(renderer.info.render.triangles);
    };
    const tick = (time: number) => {
      frame = 0;
      if (!canAnimate()) return;
      const dt = previousTime ? Math.min(.1, (time - previousTime) / 1000) : 0;
      previousTime = time;
      elapsed += dt;
      simulation.step(dt);
      smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 2.3));
      camera.position.set(smoothPointer.x * 1.2 + Math.sin(elapsed * .16) * .3, 3.3 - smoothPointer.y * .22 + Math.sin(elapsed * .31) * .045, 16 - scrollAmount * 3.2 + Math.sin(elapsed * .13) * .65);
      camera.up.copy(up);
      camera.lookAt(smoothPointer.x * .25, 5 - smoothPointer.y * .3, -20);
      camera.updateMatrixWorld();
      draw();
      if (elapsed - lastReport > .4) { report(); lastReport = elapsed; }
      frame = requestAnimationFrame(tick);
    };
    const updateActivity = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      if (contextLost || disposed) return;
      draw();
      report();
      if (canAnimate()) frame = requestAnimationFrame(tick);
    };
    updateActivityRef.current = updateActivity;
    const resize = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (!nextWidth || !nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      camera.aspect = width / height;
      camera.fov = width <= 650 ? 62 : 52;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width <= 650 ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
      measureAnchors();
      if (!contextLost) draw();
    };
    const movePointer = (event: PointerEvent) => {
      if (!canAnimate() || event.pointerType === "touch") return;
      const bounds = container.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / width * 2 - 1, (event.clientY - bounds.top) / height * 2 - 1);
    };
    const resetPointer = () => pointer.set(0, 0);
    const gust = (event: PointerEvent) => {
      if (canAnimate() && !(event.target instanceof Element && event.target.closest("a, button"))) simulation.gust(.95);
    };
    const onScroll = () => { scrollAmount = Math.max(0, Math.min(1, -container.getBoundingClientRect().top / height)); };
    const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; if (frame) cancelAnimationFrame(frame); frame = 0; };
    const onContextRestored = () => { contextLost = false; updateActivity(); };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateActivity(); });
    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    reducedMotion.addEventListener("change", updateActivity);
    document.addEventListener("visibilitychange", updateActivity);
    container.addEventListener("pointermove", movePointer);
    container.addEventListener("pointerleave", resetPointer);
    container.addEventListener("pointerdown", gust);
    window.addEventListener("scroll", onScroll, { passive: true });
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    measureAnchors();
    updateActivity();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      updateActivityRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", updateActivity);
      document.removeEventListener("visibilitychange", updateActivity);
      container.removeEventListener("pointermove", movePointer);
      container.removeEventListener("pointerleave", resetPointer);
      container.removeEventListener("pointerdown", gust);
      window.removeEventListener("scroll", onScroll);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      scene.clear();
      birdModels.forEach((bird) => bird.dispose());
      flyingLeaves.dispose();
      flyingGeometry.dispose();
      flyingMaterial.dispose();
      pollenGeometry.dispose();
      pollenMaterial.dispose();
      pollenTexture.dispose();
      shafts.dispose();
      world.dispose();
      sunlight.shadow.map?.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="forest-canvas" role="img" aria-label="An interactive three-dimensional woodland with sunlit trees, a winding dirt road, feathered birds banking between branches, and leaves flying and tumbling through the wind." />;
}
