"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, AdditiveBlending, BufferGeometry, CanvasTexture, Color,
  DirectionalLight, DoubleSide, Float32BufferAttribute, FogExp2, Group,
  HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Points,
  PointsMaterial, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from "three";
import { createBirdModel } from "@/lib/forestBirds3D";
import { createForestSimulation3D } from "@/lib/forestSimulation3D";
import { createForestWorld3D, terrainHeight } from "@/lib/forestWorld3D";
import { createGrasslandAnimals3D } from "@/lib/grasslandAnimals3D";
import { createRealisticWildlife3D } from "@/lib/realisticWildlife3D";
import { BRANCH_NAVIGATION, createGrasslandNavigation3D, LEAF_STEM, navigationLeafWidth } from "@/lib/grasslandNavigation3D";
import { paintGrasslandFallback } from "@/lib/grasslandFallback";

export type WindReading = { speed: number; power: number; direction: number };
export type NavigationReading = { id: string; x: number; y: number; scale: number; rotation: number; visible: boolean };
type Props = {
  paused: boolean;
  onWindChange: (reading: WindReading) => void;
  onNavigationPositions?: (readings: NavigationReading[]) => void;
};

const LEAF_COLORS = ["#afbe62", "#85a45a", "#c3a655", "#cfbd76"];

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

export default function ForestScene({ paused, onWindChange, onNavigationPositions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onWindChange, onNavigationPositions });
  const updateActivityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    updateActivityRef.current?.();
  }, [paused]);
  useEffect(() => { callbacksRef.current = { onWindChange, onNavigationPositions }; }, [onWindChange, onNavigationPositions]);

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    let mobileLayout = container.clientWidth <= 650;
    const layoutObserver = new ResizeObserver(() => {
      const nextMobileLayout = container.clientWidth <= 650;
      if (nextMobileLayout === mobileLayout) return;
      mobileLayout = nextMobileLayout;
      setLayoutRevision((revision) => revision + 1);
    });
    layoutObserver.observe(container);
    return () => layoutObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    let width = container.clientWidth;
    let height = container.clientHeight;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "high-performance" });
    if (!gl) {
      canvas.dataset.renderMode = "fallback";
      let fallbackDisposed = false;
      let wildlifeAtlas: HTMLImageElement | undefined;
      let barkTexture: HTMLImageElement | undefined;
      const atlasImage = new Image();
      const barkImage = new Image();
      const drawFallback = () => {
        width = container.clientWidth;
        height = container.clientHeight;
        paintGrasslandFallback(canvas, width, height, wildlifeAtlas, barkTexture);
        const leafWidth = navigationLeafWidth(width);
        const leafHeight = leafWidth / 1.6;
        callbacksRef.current.onNavigationPositions?.(BRANCH_NAVIGATION.map((item) => {
          const [x, y] = width <= 650 ? item.mobile : item.desktop;
          const angle = item.angle * Math.PI / 180;
          const dx = (.5 - LEAF_STEM.x) * leafWidth;
          const dy = (.5 - LEAF_STEM.y) * leafHeight;
          return { id: item.id, x: x * width - (dx * Math.cos(angle) - dy * Math.sin(angle)),
            y: y * height - (dx * Math.sin(angle) + dy * Math.cos(angle)), scale: 1, rotation: item.angle, visible: true };
        }));
      };
      atlasImage.onload = () => {
        if (fallbackDisposed) return;
        wildlifeAtlas = atlasImage;
        canvas.dataset.wildlifeDetail = "photographic";
        drawFallback();
      };
      atlasImage.src = "/nature/wildlife-atlas.png";
      barkImage.onload = () => {
        if (fallbackDisposed) return;
        barkTexture = barkImage;
        canvas.dataset.barkDetail = "photographic";
        drawFallback();
      };
      barkImage.src = "/nature/acacia-bark.png";
      drawFallback();
      const fallbackResize = new ResizeObserver(drawFallback);
      fallbackResize.observe(container);
      callbacksRef.current.onWindChange({ speed: 0, power: 0, direction: 0 });
      return () => {
        fallbackDisposed = true;
        atlasImage.onload = null;
        barkImage.onload = null;
        fallbackResize.disconnect();
      };
    }

    const renderer = new WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    const mobile = width <= 650;
    canvas.dataset.layoutMode = mobile ? "mobile" : "desktop";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    canvas.dataset.renderMode = "webgl2";

    const scene = new Scene();
    scene.background = new Color("#e5e6ce");
    scene.fog = new FogExp2("#e3dfbd", .012);
    const camera = new PerspectiveCamera(mobile ? 62 : 52, width / height, .1, 180);
    camera.position.set(0, 3.3, 16);
    camera.lookAt(0, 5, -20);
    camera.updateMatrixWorld();
    scene.add(new HemisphereLight("#fff3dd", "#77724b", 2.1));
    const sunlight = new DirectionalLight("#ffe4ad", 3);
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

    let disposed = false;
    canvas.dataset.barkDetail = "loading";
    const world = createForestWorld3D(mobile, () => {
      if (disposed) return;
      canvas.dataset.barkDetail = "photographic";
      updateActivityRef.current?.();
    });
    scene.add(world.group);
    const wildlife = createGrasslandAnimals3D(mobile, terrainHeight);
    scene.add(wildlife.group);
    canvas.dataset.wildlifeDetail = "loading";
    const realisticWildlife = createRealisticWildlife3D(mobile, terrainHeight, () => {
      if (disposed) return;
      wildlife.group.visible = false;
      canvas.dataset.wildlifeDetail = "photographic";
      updateActivityRef.current?.();
    });
    scene.add(realisticWildlife.group);
    const navigation = createGrasslandNavigation3D(world.barkMaterial);
    scene.add(navigation.group);
    const shafts = lightShafts();
    scene.add(shafts.group);
    const simulation = createForestSimulation3D({ leafCount: mobile ? 24 : 36, birdCount: 5 });
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
    let contextLost = false;
    let scrollAmount = 0;
    const pointer = new Vector2();
    const smoothPointer = new Vector2();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const projection = new Vector3();
    const up = new Vector3(0, 1, 0);
    const anchors = navigation.anchors;

    const canAnimate = () => !disposed && !contextLost && !pausedRef.current && !reducedMotion.matches && visible && !document.hidden;
    const measureAnchors = () => {
      const savedPosition = camera.position.clone();
      const savedQuaternion = camera.quaternion.clone();
      camera.position.set(0, 3.3, 16);
      camera.lookAt(0, 5, -20);
      camera.updateMatrixWorld();
      navigation.measure(camera, width, height);
      camera.position.copy(savedPosition);
      camera.quaternion.copy(savedQuaternion);
      camera.updateMatrixWorld();
    };
    const draw = () => {
      const still = reducedMotion.matches;
      const wind = simulation.wind;
      world.update(elapsed, still ? 0 : wind.power);
      wildlife.update(elapsed, still ? 0 : wind.power);
      realisticWildlife.update(elapsed, still ? 0 : wind.power);
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
        projection.copy(anchor.base);
        const distance = camera.position.distanceTo(projection);
        projection.project(camera);
        return { id: anchor.id, x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2, scale: anchor.depth / distance, rotation: anchor.angle + (still ? 0 : Math.sin(motion * .65 + phase) * (1.2 + wind.power * 2.8)), visible: projection.z > -1 && projection.z < 1 };
      });
      callbacksRef.current.onNavigationPositions?.(readings);
    };
    const report = () => {
      callbacksRef.current.onWindChange({ speed: reducedMotion.matches ? 0 : simulation.wind.speed, power: reducedMotion.matches ? 0 : simulation.wind.power, direction: simulation.wind.direction });
      canvas.dataset.caughtLeaves = String(simulation.stats.caughtLeaves);
      canvas.dataset.consumedLeaves = String(simulation.stats.consumedLeaves);
      canvas.dataset.sceneTriangles = String(renderer.info.render.triangles);
      canvas.dataset.wildlife = "lion tiger giraffe";
      canvas.dataset.attachedLeaves = String(anchors.length);
    };
    const tick = (time: number) => {
      frame = 0;
      if (!canAnimate()) return;
      const dt = previousTime ? Math.min(.1, (time - previousTime) / 1000) : 0;
      previousTime = time;
      elapsed += dt;
      simulation.step(dt);
      smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 2.3));
      camera.position.set(smoothPointer.x * .38 + Math.sin(elapsed * .16) * .08, 3.3 - smoothPointer.y * .12 + Math.sin(elapsed * .31) * .025, 16 - scrollAmount * 1.4 + Math.sin(elapsed * .13) * .18);
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
      navigation.dispose();
      wildlife.dispose();
      realisticWildlife.dispose();
      world.dispose();
      sunlight.shadow.map?.dispose();
      renderer.dispose();
    };
  }, [layoutRevision]);

  return <canvas ref={canvasRef} className="forest-canvas" role="img" aria-label="An interactive sunlit grassland with acacia trees, lions, tigers, giraffes, a winding dirt path, birds, and five navigation leaves growing from tree branches." />;
}
