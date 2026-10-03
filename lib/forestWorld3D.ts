import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface ForestWorld3D {
  group: Group;
  leafGeometry: BufferGeometry;
  leafMaterial: MeshStandardMaterial;
  barkMaterial: MeshStandardMaterial;
  update(time: number, power: number): void;
  dispose(): void;
}

interface LeafPlacement {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  color: Color;
}

const UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function seededRandom(seed: number) {
  return () => {
    let n = seed += 0x6d2b79f5;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function pathCenter(z: number) {
  return Math.sin(z * 0.075) * 1.3 + Math.sin(z * 0.16) * 0.5;
}

export function terrainHeight(x: number, z: number) {
  const bank = clamp((Math.abs(x - pathCenter(z)) - 1.7) / 5, 0, 1);
  const distance = clamp((-z - 18) / 72, 0, 1);
  const hills = distance * (1.5 + Math.sin(x * 0.056 + z * 0.018) * 1.3
    + Math.cos(x * 0.082 - z * 0.047) * 0.75);
  return -0.25 + Math.sin(x * 0.19) * 0.18 + Math.sin(z * 0.09 + x * 0.11) * 0.16
    + Math.sin(x * 0.42 - z * 0.12) * 0.055 + bank * 0.22 + hills;
}

/** A curved leaf with a raised midrib; no billboard or alpha-mask is needed. */
function makeLeafGeometry(rows = 12, columns = 6) {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    // Slightly uneven margins and a gently rolled edge keep individual leaves
    // organic in silhouette, including when viewed against the bright sky.
    const width = Math.pow(Math.sin(Math.PI * v), 0.79) * 0.29
      * (1 + Math.sin(v * Math.PI * 13) * 0.016);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns * 2 - 1;
      positions.push(u * width + Math.sin(v * Math.PI) * 0.018, v - 0.5,
        Math.sin(Math.PI * v) * (0.074 * (1 - Math.abs(u)) - 0.052 * u * u)
          + Math.sin(v * Math.PI * 2.1) * u * 0.021
          + Math.pow(v, 4) * 0.073);
      uv.push((u + 1) * 0.5, v);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function canvasTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, random: () => number) => void,
  seed: number,
) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paint(ctx, seededRandom(seed));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeBarkTexture(heightMap = false) {
  return canvasTexture(512, 1024, (ctx, random) => {
    ctx.fillStyle = heightMap ? "#252525" : "#514b3d";
    ctx.fillRect(0, 0, 512, 1024);
    // Slender winding ridges fade into one another; only longitudinal fissures
    // are outlined, avoiding a tiled or bricklike surface in the fallback.
    for (let strip = -1; strip < 48; strip += 1) {
      const centerX = strip * 11 + random() * 7;
      let y = -random() * 150;
      while (y < 1060) {
        const width = 5 + random() * 12;
        const length = 75 + random() * 225;
        const shift = (random() - 0.5) * 12;
        const light = 39 + random() * 27;
        const gradient = ctx.createLinearGradient(centerX - width / 2, 0, centerX + width / 2, 0);
        gradient.addColorStop(0, heightMap ? "#4a4a4a" : `hsl(33 8% ${light * 0.65}%)`);
        gradient.addColorStop(0.27, heightMap ? "#d4d4d4" : `hsl(34 9% ${light * 0.94}%)`);
        gradient.addColorStop(0.65, heightMap ? "#b0b0b0" : `hsl(36 7% ${light * 0.84}%)`);
        gradient.addColorStop(1, heightMap ? "#404040" : `hsl(30 9% ${light * 0.57}%)`);
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(centerX - width * 0.42, y + length * 0.17);
        ctx.lineTo(centerX - width * 0.25 + shift, y + length * 0.42);
        ctx.lineTo(centerX - width * 0.42 + shift, y + length * 0.74);
        ctx.lineTo(centerX + shift, y + length);
        ctx.lineTo(centerX + width * 0.25 + shift, y + length * 0.68);
        ctx.lineTo(centerX + width * 0.48, y + length * 0.27);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = heightMap ? "#1b1b1b" : "rgba(35,29,22,0.72)";
        ctx.lineWidth = 0.5 + random() * 1;
        ctx.beginPath();
        ctx.moveTo(centerX - width * 0.42, y + length * 0.17);
        ctx.lineTo(centerX - width * 0.25 + shift, y + length * 0.42);
        ctx.lineTo(centerX - width * 0.42 + shift, y + length * 0.74);
        ctx.stroke();
        y += length * (0.8 + random() * 0.16);
      }
    }
    for (let i = 0; i < 8000; i += 1) {
      ctx.fillStyle = heightMap
        ? random() > 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)"
        : random() > 0.5 ? "rgba(230,218,184,0.12)" : "rgba(30,25,20,0.14)";
      ctx.fillRect(random() * 512, random() * 1024, 0.7 + random() * 1.7, 1 + random() * 10);
    }
    for (let i = 0; i < 160; i += 1) {
      const x = random() * 512;
      const y = random() * 1024;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const length = 15 + random() * 80;
      for (let step = 1; step < 7; step += 1) {
        ctx.lineTo(x + Math.sin(step * 1.4 + i) * 3, y + length * step / 6);
      }
      ctx.strokeStyle = heightMap ? "rgba(0,0,0,0.65)" : "rgba(35,31,26,0.64)";
      ctx.lineWidth = 0.6 + random() * 1.5;
      ctx.stroke();
    }
    if (!heightMap) {
      for (let i = 0; i < 520; i += 1) {
        ctx.fillStyle = random() > 0.35 ? "rgba(144,158,126,0.18)" : "rgba(191,189,158,0.2)";
        ctx.beginPath();
        ctx.ellipse(random() * 512, random() * 1024, 1 + random() * 5, 2 + random() * 7, random(), 0, TAU);
        ctx.fill();
      }
    }
  }, 77431);
}

function makeLeafTexture() {
  return canvasTexture(256, 512, (ctx, random) => {
    const gradient = ctx.createLinearGradient(0, 0, 256, 512);
    gradient.addColorStop(0, "#6d913b");
    gradient.addColorStop(0.42, "#bbcf80");
    gradient.addColorStop(0.66, "#a9c86c");
    gradient.addColorStop(1, "#719d43");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 5200; i += 1) {
      ctx.fillStyle = random() < 0.5 ? "rgba(35,79,22,0.09)" : "rgba(243,255,176,0.12)";
      ctx.fillRect(random() * 256, random() * 512, 0.8 + random() * 2, 0.8 + random() * 2);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(220,235,156,0.72)";
    ctx.beginPath();
    ctx.moveTo(128, 512);
    ctx.quadraticCurveTo(124, 230, 128, 0);
    ctx.stroke();
    for (let i = 1; i < 15; i += 1) {
      const y = 506 - i * 32;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(128, y);
        ctx.quadraticCurveTo(128 + side * 43, y - 18, 128 + side * 125, y - 59);
        ctx.lineWidth = 1.15;
        ctx.strokeStyle = "rgba(198,224,139,0.56)";
        ctx.stroke();
        for (let split = 1; split < 4; split += 1) {
          const fromX = 128 + side * split * 27;
          const fromY = y - split * 12;
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.quadraticCurveTo(fromX + side * 8, fromY - 22, fromX + side * 22, fromY - 40);
          ctx.lineWidth = 0.55;
          ctx.strokeStyle = "rgba(188,213,135,0.4)";
          ctx.stroke();
        }
      }
    }
  }, 8432);
}

function makeSoilTexture(path: boolean) {
  return canvasTexture(256, 256, (ctx, random) => {
    ctx.fillStyle = path ? "#c3ae84" : "#a3a16b";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14000; i += 1) {
      const light = random() > 0.45;
      ctx.fillStyle = path
        ? light ? "rgba(255,237,194,0.16)" : "rgba(104,86,48,0.13)"
        : light ? "rgba(216,211,137,0.16)" : "rgba(79,96,50,0.12)";
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 3);
    }
    for (let i = 0; i < 140; i += 1) {
      const size = 0.8 + random() * 2.2;
      ctx.beginPath();
      ctx.ellipse(random() * 256, random() * 256, size * 1.4, size, random() * TAU, 0, TAU);
      ctx.fillStyle = path ? "rgba(52,49,38,0.35)" : "rgba(164,135,85,0.2)";
      ctx.fill();
    }
  }, path ? 77347 : 7341);
}

function makeWoodTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#b19b6d";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 1; i <= 14; i += 1) {
      ctx.beginPath();
      ctx.ellipse(62, 68, i * 5, i * 4.2, 0.13, 0, TAU);
      ctx.strokeStyle = "rgba(74,53,27,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(61, 69);
    ctx.lineTo(24, 15);
    ctx.strokeStyle = "rgba(50,38,23,0.6)";
    ctx.stroke();
  }, 44831);
}

/** Tapered, uneven rings follow a curved branch, rather than stacking cones. */
function branchGeometry(points: Vector3[], radii: number[], sides: number, phase: number) {
  const position: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) length += points[i].distanceTo(points[i - 1]);
    const tangent = points[Math.min(i + 1, points.length - 1)].clone()
      .sub(points[Math.max(0, i - 1)]).normalize();
    const orient = new Quaternion().setFromUnitVectors(UP, tangent);
    for (let side = 0; side <= sides; side += 1) {
      const theta = side / sides * TAU;
      const radius = radii[i] * (1 + Math.sin(theta * 3 + phase) * 0.055
        + Math.sin(theta * 7 - phase + length * 0.32) * 0.035
        + Math.cos(theta * 11 + phase - length * 0.22) * 0.018);
      const offset = new Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius).applyQuaternion(orient);
      position.push(points[i].x + offset.x, points[i].y + offset.y, points[i].z + offset.z);
      uv.push(side / sides * 2, length * 0.45);
      if (i < points.length - 1 && side < sides) {
        const a = i * (sides + 1) + side;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addWind(material: MeshStandardMaterial, uniforms: { time: { value: number }; power: { value: number } }, grass: boolean) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.forestTime = uniforms.time;
    shader.uniforms.forestPower = uniforms.power;
    shader.vertexShader = "uniform float forestTime;\nuniform float forestPower;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 forestOrigin = instanceMatrix[3].xyz;
        float forestPhase = forestOrigin.x * 0.36 + forestOrigin.z * 0.19;
        float forestWave = sin(forestTime * 1.45 + forestPhase)
          + sin(forestTime * 2.2 - forestPhase * 1.7) * 0.35;
        float forestBend = ${grass ? "max(position.y, 0.0) * max(position.y, 0.0)" : "uv.y * uv.y"};
        transformed.x += forestWave * forestPower * forestBend * ${grass ? "0.17" : "0.16"};
        transformed.z += cos(forestTime * 1.2 + forestPhase) * forestPower * forestBend * ${grass ? "0.07" : "0.08"};
      #endif
    `);
  };
  material.customProgramCacheKey = () => grass ? "forest-grass-wind-v1" : "forest-leaf-wind-v1";
}

export function createForestWorld3D(mobile: boolean, onTextureReady?: () => void): ForestWorld3D {
  let disposed = false;
  const group = new Group();
  group.name = "Sunlit grassland, acacia trees and a winding trail";
  const random = seededRandom(674813);
  const between = (min: number, max: number) => min + random() * (max - min);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const instances = new Set<InstancedMesh>();
  const ownGeometry = <T extends BufferGeometry>(geometry: T) => { geometries.add(geometry); return geometry; };
  const ownMaterial = <T extends Material>(material: T) => { materials.add(material); return material; };
  const ownTexture = (texture: Texture | null) => { if (texture) textures.add(texture); return texture; };
  const barkTexture = ownTexture(makeBarkTexture());
  const barkHeightTexture = ownTexture(makeBarkTexture(true));
  if (barkHeightTexture) barkHeightTexture.colorSpace = NoColorSpace;
  const leafTexture = ownTexture(makeLeafTexture());
  const soilTexture = ownTexture(makeSoilTexture(false));
  const pathTexture = ownTexture(makeSoilTexture(true));
  const woodTexture = ownTexture(makeWoodTexture());
  if (soilTexture) soilTexture.repeat.set(15, 27);

  const leafGeometry = ownGeometry(makeLeafGeometry());
  // Small canopy leaves retain their curved midrib with fewer surface segments.
  const canopyGeometry = ownGeometry(makeLeafGeometry(mobile ? 4 : 6, 2));
  const leafMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xffffff, map: leafTexture, bumpMap: leafTexture, bumpScale: 0.014,
    roughness: 0.73, metalness: 0, side: DoubleSide,
  }));
  const barkMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xd4c8ac, map: barkTexture, bumpMap: barkHeightTexture, bumpScale: 0.13,
    roughness: 0.96,
  }));
  // The local photographic texture replaces the procedural fallback after it
  // loads. Register it immediately so scene disposal also covers an in-flight
  // image request, and never mutate a material after its scene is torn down.
  const photographicBark = new TextureLoader().load("/nature/acacia-bark.png", (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    barkMaterial.map = texture;
    barkMaterial.bumpMap = texture;
    barkMaterial.bumpScale = 0.065;
    barkMaterial.color.set(0xffffff);
    barkMaterial.needsUpdate = true;
    onTextureReady?.();
  }, undefined, () => {
    // Keep the complete procedural material when a local asset fails to load.
  });
  ownTexture(photographicBark);
  const groundMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xd7cd9c, map: soilTexture, bumpMap: soilTexture, bumpScale: 0.035,
    roughness: 1, vertexColors: true,
  }));
  const pathMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xeee1bc, map: pathTexture, bumpMap: pathTexture, bumpScale: 0.025,
    roughness: 1, vertexColors: true,
  }));
  const uniforms = { time: { value: 0 }, power: { value: 0.4 } };
  const canopyMaterial = ownMaterial(leafMaterial.clone());
  canopyMaterial.emissive.set(0x566633);
  canopyMaterial.emissiveIntensity = 0.035;
  addWind(canopyMaterial, uniforms, false);

  // A continuous meadow rises into soft hills beyond the open animal clearing.
  const groundPositions: number[] = [];
  const groundUV: number[] = [];
  const groundColors: number[] = [];
  const groundIndices: number[] = [];
  const across = mobile ? 64 : 90;
  const along = mobile ? 96 : 140;
  for (let row = 0; row <= along; row += 1) {
    const z = 25 - row / along * 165;
    for (let column = 0; column <= across; column += 1) {
      const x = -45 + column / across * 90;
      groundPositions.push(x, terrainHeight(x, z), z);
      groundUV.push(column / across, row / along);
      const shade = 0.88 + Math.sin(x * 0.18 + z * 0.09) * 0.055 + random() * 0.045;
      groundColors.push(shade, shade * 0.99, shade * 0.83);
      if (row < along && column < across) {
        const a = row * (across + 1) + column;
        const b = a + across + 1;
        groundIndices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const groundGeometry = ownGeometry(new BufferGeometry());
  groundGeometry.setAttribute("position", new BufferAttribute(new Float32Array(groundPositions), 3));
  groundGeometry.setAttribute("uv", new BufferAttribute(new Float32Array(groundUV), 2));
  groundGeometry.setAttribute("color", new BufferAttribute(new Float32Array(groundColors), 3));
  groundGeometry.setIndex(groundIndices);
  groundGeometry.computeVertexNormals();
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;
  group.add(ground);

  // A separate irregular strip follows the same ground, with shallow worn ruts.
  const pathPositions: number[] = [];
  const pathUV: number[] = [];
  const pathColors: number[] = [];
  const pathIndices: number[] = [];
  const pathRows = 220;
  const pathColumns = 8;
  for (let row = 0; row <= pathRows; row += 1) {
    const z = 25 - row / pathRows * 165;
    const center = pathCenter(z);
    const halfWidth = 1.65 + Math.sin(z * 0.31) * 0.12 + Math.sin(z * 0.7) * 0.045;
    for (let column = 0; column <= pathColumns; column += 1) {
      const acrossPath = column / pathColumns * 2 - 1;
      const x = center + acrossPath * halfWidth;
      const rut = Math.exp(-Math.pow((Math.abs(acrossPath) - 0.56) * 8, 2)) * 0.025;
      pathPositions.push(x, terrainHeight(x, z) + 0.042 - rut, z);
      pathUV.push(column / pathColumns * 1.8, z / 4.5);
      const shade = 0.84 + Math.sin(z * 0.61 + column) * 0.025 - Math.abs(acrossPath) * 0.13;
      pathColors.push(shade, shade * 0.96, shade * 0.87);
      if (row < pathRows && column < pathColumns) {
        const a = row * (pathColumns + 1) + column;
        const b = a + pathColumns + 1;
        pathIndices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const pathGeometry = ownGeometry(new BufferGeometry());
  pathGeometry.setAttribute("position", new BufferAttribute(new Float32Array(pathPositions), 3));
  pathGeometry.setAttribute("uv", new BufferAttribute(new Float32Array(pathUV), 2));
  pathGeometry.setAttribute("color", new BufferAttribute(new Float32Array(pathColors), 3));
  pathGeometry.setIndex(pathIndices);
  pathGeometry.computeVertexNormals();
  const path = new Mesh(pathGeometry, pathMaterial);
  path.receiveShadow = true;
  group.add(path);

  const branches: BufferGeometry[] = [];
  const foliage: LeafPlacement[] = [];
  const greenPalette = [0xb5cc99, 0xd8e8b1, 0xaccd8d, 0xe1e8b5, 0xa2bf85, 0xc3d79e];
  const leafColor = () => new Color(greenPalette[Math.floor(random() * greenPalette.length)]);
  const leafNormal = new Vector3(0, 0, 1);

  const addCluster = (tip: Vector3, size: number, foreground: boolean, droop = false) => {
    // Real foliage is air, twigs and individual leaves. Flattened overlapping
    // sprays describe the acacia crown without an opaque mesh beneath them.
    const sprays = foreground ? mobile ? 8 : 13 : mobile ? 6 : 8;
    const pairs = foreground ? mobile ? 8 : 10 : mobile ? 6 : 8;
    for (let spray = 0; spray < sprays; spray += 1) {
      const angle = spray / sprays * TAU + between(-0.35, 0.35);
      const stemLength = size * between(0.46, 1.12);
      const origin = tip.clone().add(new Vector3(
        between(-0.22, 0.22) * size, between(-0.12, 0.17) * size, between(-0.22, 0.22) * size,
      ));
      const direction = new Vector3(Math.cos(angle), droop ? between(-0.6, -0.25) : between(-0.19, 0.26), Math.sin(angle)).normalize();
      const end = origin.clone().addScaledVector(direction, stemLength);
      const middle = origin.clone().lerp(end, 0.48).add(new Vector3(0, size * 0.08, 0));
      const stemRadius = foreground ? between(0.011, 0.024) : between(0.009, 0.017);
      branches.push(branchGeometry([origin, middle, end], [stemRadius, stemRadius * 0.65, 0.003], 5, angle));
      const lateral = new Vector3(-Math.sin(angle), between(-0.1, 0.1), Math.cos(angle)).normalize();
      for (let pair = 0; pair < pairs; pair += 1) {
        const fraction = 0.1 + pair / pairs * 0.85;
        const onStem = origin.clone().lerp(end, fraction);
        onStem.y += Math.sin(fraction * Math.PI) * size * 0.08;
        for (const side of [-1, 1]) {
          // Paired leaflets open out from their actual stem, with a little
          // forward pitch and curl instead of a uniformly flat leaf cloud.
          const leafDirection = lateral.clone().multiplyScalar(side)
            .addScaledVector(direction, between(0.24, 0.64))
            .add(new Vector3(0, between(-0.55, 0.38), 0)).normalize();
          const length = foreground ? between(0.23, 0.45) : between(0.14, 0.28);
          const base = onStem.clone().addScaledVector(lateral, side * stemRadius * 1.2);
          const position = base.clone().addScaledVector(leafDirection, length * 0.5);
          const rotation = new Quaternion().setFromUnitVectors(UP, leafDirection);
          rotation.multiply(new Quaternion().setFromAxisAngle(UP, between(-0.85, 0.85)));
          rotation.multiply(new Quaternion().setFromAxisAngle(leafNormal, between(-0.08, 0.08)));
          foliage.push({
            position, rotation,
            scale: new Vector3(length * (foreground ? between(0.85, 1.18) : between(0.46, 0.73)), length, length),
            color: leafColor().multiplyScalar(between(0.79, 1.13)),
          });
        }
      }
    }
  };

  const addTree = (x: number, z: number, height: number, radius: number, index: number) => {
    const foreground = index < 2;
    const groundY = terrainHeight(x, z);
    const bendX = between(-0.6, 0.6);
    const bendZ = between(-0.5, 0.5);
    const trunk: Vector3[] = [];
    const radii: number[] = [];
    const trunkRings = foreground ? 26 : 14;
    for (let ring = 0; ring <= trunkRings; ring += 1) {
      const f = ring / trunkRings;
      trunk.push(new Vector3(x + bendX * f * f + Math.sin(f * 4 + index) * f * 0.16,
        groundY + f * height, z + bendZ * f * f));
      const rootFlare = 1 + Math.exp(-f * 30) * 0.5;
      radii.push(radius * Math.pow(1 - f * 0.93, 0.8) * rootFlare
        * (1 + Math.sin(f * 21 + index) * 0.018));
    }
    branches.push(branchGeometry(trunk, radii, foreground ? mobile ? 22 : 32 : 14, index));

    for (let root = 0; root < 4; root += 1) {
      const angle = root / 4 * TAU + index * 0.7;
      const length = radius * between(1.8, 2.8);
      const endX = x + Math.cos(angle) * length;
      const endZ = z + Math.sin(angle) * length;
      const points = [new Vector3(x, groundY + radius * 0.35, z),
        new Vector3(x + Math.cos(angle) * length * 0.43, groundY + 0.13, z + Math.sin(angle) * length * 0.43),
        new Vector3(endX, terrainHeight(endX, endZ) + 0.015, endZ)];
      branches.push(branchGeometry(points, [radius * 0.32, radius * 0.16, 0.025], 6, root));
    }

    const mainCount = foreground ? 6 : 5;
    for (let branch = 0; branch < mainCount; branch += 1) {
      const angle = branch / mainCount * TAU + index * 1.31 + between(-0.25, 0.25);
      const fraction = 0.64 + branch / mainCount * 0.12;
      const start = new Vector3(x + bendX * fraction * fraction, groundY + height * fraction, z + bendZ * fraction * fraction);
      const length = height * between(0.27, 0.38);
      const end = new Vector3(start.x + Math.cos(angle) * length,
        groundY + height * between(0.9, 0.98), start.z + Math.sin(angle) * length);
      const mid = start.clone().lerp(end, 0.5).add(new Vector3(between(-0.16, 0.16), 0.25, between(-0.16, 0.16)));
      const branchRadius = radius * (0.32 - branch * 0.014);
      const branchQuarter = start.clone().lerp(mid, 0.5).add(new Vector3(0, -0.1, 0));
      const branchThreeQuarter = mid.clone().lerp(end, 0.5).add(new Vector3(0, 0.09, 0));
      branches.push(branchGeometry([start, branchQuarter, mid, branchThreeQuarter, end],
        [branchRadius, branchRadius * 0.79, branchRadius * 0.57, branchRadius * 0.31, 0.032], foreground ? 14 : 9, angle));
      const twigCount = foreground ? 3 : 2;
      for (let twig = 0; twig < twigCount; twig += 1) {
        const twigAngle = angle + (twig - (twigCount - 1) / 2) * 0.68;
        const twigStart = mid.clone().lerp(end, 0.18 + twig * 0.3);
        const twigEnd = twigStart.clone().add(new Vector3(
          Math.cos(twigAngle) * height * between(0.06, 0.12), height * between(0.02, 0.06),
          Math.sin(twigAngle) * height * between(0.06, 0.12),
        ));
        const twigMid = twigStart.clone().lerp(twigEnd, 0.55).add(new Vector3(0, 0.12, 0));
        branches.push(branchGeometry([twigStart, twigMid, twigEnd], [0.052, 0.026, 0.009], 7, twigAngle));
        addCluster(twigEnd, height * between(0.105, 0.148), foreground);
      }
    }
    addCluster(trunk[trunkRings], height * 0.12, foreground);
    if (foreground) {
      // Lower hanging foliage brings readable leaves into the upper corners.
      // Branches point outward to leave the headline and the trail unobstructed.
      const outward = Math.sign(x);
      for (let bough = 0; bough < 3; bough += 1) {
        const start = new Vector3(x + bendX * 0.45, groundY + height * (0.67 + bough * 0.045), z);
        const end = start.clone().add(new Vector3(outward * between(1.4, 2.65), between(-0.38, 0.15), between(-1.2, 1.2)));
        const mid = start.clone().lerp(end, 0.46).add(new Vector3(0, 0.35, 0));
        branches.push(branchGeometry([start, mid, end], [radius * 0.16, radius * 0.075, 0.016], 10, bough));
        addCluster(end, between(0.75, 1.12), true, true);
      }
    }
  };

  // Two permanent framing trees carry the navigation branches; the clearing stays open.
  addTree(mobile ? -2.95 : -6.2, 3, 11.2, 0.76, 0);
  addTree(mobile ? 3.05 : 6.55, 1.2, 12, 0.86, 1);
  const distantTrees = [
    [-14, -24, 8.1, 0.34], [18, -40, 8.9, 0.35],
    [-25, -59, 9.3, 0.36], [29, -78, 7.8, 0.29],
    [-14, -96, 6.9, 0.24], [14, -115, 7.2, 0.26],
  ];
  distantTrees.slice(0, mobile ? 4 : 6).forEach(([x, z, height, radius], index) =>
    addTree(x, z, height, radius, index + 2));

  // Fallen timber retains bark on the outside and growth rings on its cut ends.
  const logEnds: BufferGeometry[] = [];
  for (let i = 0; i < 2; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = [-28, -49][i];
    const x = side * between(12, 18);
    const radius = between(0.19, 0.32);
    const start = new Vector3(x, terrainHeight(x, z) + radius * 0.65, z);
    const end = start.clone().add(new Vector3(side * between(1.6, 3.1), 0.05, between(-2.8, -1.2)));
    end.y = terrainHeight(end.x, end.z) + radius * 0.7;
    branches.push(branchGeometry([start, start.clone().lerp(end, 0.5), end], [radius, radius * 0.96, radius * 0.82], 9, i));
    for (const [point, r] of [[start, radius], [end, radius * 0.82]] as const) {
      const cap = new CircleGeometry(r, 12);
      const direction = end.clone().sub(start).normalize().multiplyScalar(point === start ? -1 : 1);
      cap.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction));
      cap.translate(point.x, point.y, point.z);
      logEnds.push(cap);
    }
  }
  const mergedBark = mergeGeometries(branches, false);
  for (const geometry of branches) geometry.dispose();
  if (mergedBark) {
    ownGeometry(mergedBark);
    const bark = new Mesh(mergedBark, barkMaterial);
    bark.castShadow = true;
    bark.receiveShadow = true;
    group.add(bark);
  }
  const mergedEnds = mergeGeometries(logEnds, false);
  for (const geometry of logEnds) geometry.dispose();
  if (mergedEnds) {
    ownGeometry(mergedEnds);
    const woodMaterial = ownMaterial(new MeshStandardMaterial({ color: 0xffffff, map: woodTexture, roughness: 1, side: DoubleSide }));
    const ends = new Mesh(mergedEnds, woodMaterial);
    ends.receiveShadow = true;
    group.add(ends);
  }

  const matrix = new Matrix4();
  const canopy = new InstancedMesh(canopyGeometry, canopyMaterial, foliage.length);
  canopy.name = "Individual veined green leaves on fine branching acacia sprays";
  foliage.forEach((leaf, index) => {
    matrix.compose(leaf.position, leaf.rotation, leaf.scale);
    canopy.setMatrixAt(index, matrix);
    canopy.setColorAt(index, leaf.color);
  });
  canopy.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  canopy.castShadow = !mobile;
  canopy.receiveShadow = true;
  canopy.computeBoundingSphere();
  instances.add(canopy);
  group.add(canopy);

  const grassGeometry = ownGeometry(new BufferGeometry());
  const grassPositions: number[] = [];
  const grassUV: number[] = [];
  const grassIndices: number[] = [];
  const grassRows = 7;
  for (let row = 0; row <= grassRows; row += 1) {
    const fraction = row / grassRows;
    const width = Math.pow(1 - fraction, 0.78) * 0.014;
    const lean = fraction * fraction * 0.17;
    const curve = Math.pow(fraction, 2.4) * 0.22;
    grassPositions.push(lean - width, fraction, curve, lean + width, fraction, curve + width * 0.2);
    grassUV.push(0, fraction, 1, fraction);
    if (row < grassRows) {
      const start = row * 2;
      grassIndices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }
  grassGeometry.setAttribute("position", new BufferAttribute(new Float32Array(grassPositions), 3));
  grassGeometry.setAttribute("uv", new BufferAttribute(new Float32Array(grassUV), 2));
  grassGeometry.setIndex(grassIndices);
  grassGeometry.computeVertexNormals();
  const grassMaterial = ownMaterial(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: DoubleSide }));
  addWind(grassMaterial, uniforms, true);
  const grassCount = mobile ? 5200 : 11000;
  const grass = new InstancedMesh(grassGeometry, grassMaterial, grassCount);
  grass.name = "Sage and golden meadow grass, with tall outer tufts";
  let tuftBase: Vector3 | null = null;
  for (let index = 0; index < grassCount; index += 1) {
    const tall = index >= grassCount * 0.78;
    const near = index < grassCount * 0.66 || tall;
    let z = between(near ? -42 : -125, near ? 20 : -30);
    const side = random() < 0.5 ? -1 : 1;
    let x = pathCenter(z) + side * between(1.83, near ? 15 : 39);
    if (tall) {
      if (!tuftBase || index % 9 === 0) {
        const tuftZ = between(-32, 12);
        const tuftX = pathCenter(tuftZ) + side * between(mobile ? 4.2 : 7, 15);
        tuftBase = new Vector3(tuftX, 0, tuftZ);
      }
      x = tuftBase.x + between(-0.14, 0.14);
      z = tuftBase.z + between(-0.14, 0.14);
    }
    const position = new Vector3(x, terrainHeight(x, z) + 0.01, z);
    const rotation = new Quaternion().setFromAxisAngle(UP, random() * TAU);
    const height = tall ? between(0.62, 1.2)
      : between(0.19, 0.52) * (0.9 + Math.sin(x * 1.8 + z * 0.7) * 0.2);
    matrix.compose(position, rotation, new Vector3(between(0.55, 1.5), height, 1));
    grass.setMatrixAt(index, matrix);
    const gold = index % 7 === 0;
    grass.setColorAt(index, new Color().setHSL(gold ? between(0.12, 0.16) : between(0.19, 0.27),
      between(0.29, 0.5), gold ? between(0.38, 0.49) : between(0.2, 0.38)));
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.receiveShadow = true;
  grass.computeBoundingSphere();
  instances.add(grass);
  group.add(grass);

  // Rounded weathered stones, with most of their volume buried in the soil.
  const rockGeometry = ownGeometry(new IcosahedronGeometry(1, 1));
  const rockPositions = rockGeometry.getAttribute("position");
  for (let i = 0; i < rockPositions.count; i += 1) {
    const x = rockPositions.getX(i);
    const y = rockPositions.getY(i);
    const z = rockPositions.getZ(i);
    const uneven = 1 + Math.sin(x * 7 + y * 3) * Math.cos(z * 5) * 0.085;
    rockPositions.setXYZ(i, x * uneven, y * uneven, z * uneven);
  }
  rockGeometry.computeVertexNormals();
  const rockMaterial = ownMaterial(new MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: soilTexture }));
  const rockCount = mobile ? 45 : 85;
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, rockCount);
  for (let i = 0; i < rockCount; i += 1) {
    const z = between(-55, 15);
    const side = random() < 0.5 ? -1 : 1;
    const x = pathCenter(z) + side * between(1.9, 12);
    const radius = i < 12 ? between(0.23, 0.52) : between(0.035, 0.2);
    const position = new Vector3(x, terrainHeight(x, z) + radius * 0.14, z);
    const rotation = new Quaternion().setFromAxisAngle(UP, random() * TAU);
    matrix.compose(position, rotation, new Vector3(radius * 1.25, radius * 0.58, radius * between(0.8, 1.3)));
    rocks.setMatrixAt(i, matrix);
    rocks.setColorAt(i, new Color().setHSL(0.12, between(0.03, 0.12), between(0.35, 0.58)));
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.castShadow = !mobile;
  rocks.receiveShadow = true;
  rocks.computeBoundingSphere();
  instances.add(rocks);
  group.add(rocks);

  const fallenMaterial = ownMaterial(leafMaterial.clone());
  const fallenCount = mobile ? 35 : 70;
  const fallen = new InstancedMesh(leafGeometry, fallenMaterial, fallenCount);
  for (let i = 0; i < fallenCount; i += 1) {
    const z = between(-35, 15);
    const x = pathCenter(z) + between(-6.5, 6.5);
    const position = new Vector3(x, terrainHeight(x, z) + 0.065, z);
    const rotation = new Quaternion().setFromAxisAngle(UP, random() * TAU)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2 + between(-0.08, 0.08)));
    const size = between(0.12, 0.32);
    matrix.compose(position, rotation, new Vector3(size, size, size));
    fallen.setMatrixAt(i, matrix);
    fallen.setColorAt(i, new Color([0x977440, 0x8d672e, 0x766337, 0xa78b42, 0x68713a][i % 5]));
  }
  fallen.instanceMatrix.needsUpdate = true;
  if (fallen.instanceColor) fallen.instanceColor.needsUpdate = true;
  fallen.receiveShadow = true;
  fallen.computeBoundingSphere();
  instances.add(fallen);
  group.add(fallen);

  return {
    group,
    leafGeometry,
    leafMaterial,
    barkMaterial,
    update(time, power) {
      if (disposed) return;
      uniforms.time.value = Number.isFinite(time) ? time : 0;
      uniforms.power.value = Number.isFinite(power) ? clamp(power, 0, 1) : 0.4;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const instance of instances) instance.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      group.clear();
    },
  };
}
