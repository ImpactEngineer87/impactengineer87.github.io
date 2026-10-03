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
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface ForestWorld3D {
  group: Group;
  leafGeometry: BufferGeometry;
  leafMaterial: MeshStandardMaterial;
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

function terrainHeight(x: number, z: number) {
  const bank = clamp((Math.abs(x - pathCenter(z)) - 1.7) / 5, 0, 1);
  return -0.25 + Math.sin(x * 0.19) * 0.18 + Math.sin(z * 0.09 + x * 0.11) * 0.16
    + Math.sin(x * 0.42 - z * 0.12) * 0.055 + bank * 0.42;
}

/** A curved leaf with a raised midrib; no billboard or alpha-mask is needed. */
function makeLeafGeometry(rows = 9, columns = 3) {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const width = Math.pow(Math.sin(Math.PI * v), 0.77) * 0.27;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns * 2 - 1;
      positions.push(u * width, v - 0.5,
        Math.sin(Math.PI * v) * (0.095 * (1 - u * u) - 0.035 * u * u)
          + Math.sin(v * Math.PI * 3) * u * 0.012);
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

function makeBarkTexture() {
  return canvasTexture(256, 512, (ctx, random) => {
    ctx.fillStyle = "#6b5946";
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 1900; i += 1) {
      ctx.fillStyle = random() > 0.5 ? "rgba(27,20,16,0.12)" : "rgba(224,205,165,0.1)";
      ctx.fillRect(random() * 256, random() * 512, 1 + random() * 4, 2 + random() * 35);
    }
    for (let i = 0; i < 95; i += 1) {
      const x = random() * 256;
      const y = random() * 350 - 30;
      const length = 50 + random() * 250;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 1; step <= 8; step += 1) {
        ctx.lineTo(x + Math.sin(step * 1.6 + i) * (2 + random() * 3), y + length * step / 8);
      }
      ctx.lineWidth = 0.7 + random() * 3;
      ctx.strokeStyle = "rgba(32,24,19,0.5)";
      ctx.stroke();
      ctx.translate(1.3, 0);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(197,174,136,0.3)";
      ctx.stroke();
      ctx.translate(-1.3, 0);
    }
    for (let i = 0; i < 30; i += 1) {
      ctx.fillStyle = "rgba(106,117,64,0.15)";
      ctx.beginPath();
      ctx.ellipse(random() * 256, random() * 512, 5 + random() * 14, 8 + random() * 28, 0, 0, TAU);
      ctx.fill();
    }
  }, 77431);
}

function makeLeafTexture() {
  return canvasTexture(128, 256, (ctx, random) => {
    const gradient = ctx.createLinearGradient(0, 0, 128, 0);
    gradient.addColorStop(0, "#a8af89");
    gradient.addColorStop(0.5, "#e2e4c5");
    gradient.addColorStop(1, "#a5af87");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = random() < 0.5 ? "rgba(68,88,28,0.055)" : "rgba(255,255,210,0.1)";
      ctx.fillRect(random() * 128, random() * 256, 1, 1);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(86,110,43,0.45)";
    ctx.beginPath();
    ctx.moveTo(64, 255);
    ctx.quadraticCurveTo(61, 115, 64, 0);
    ctx.stroke();
    for (let i = 1; i < 11; i += 1) {
      const y = 238 - i * 19;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(64, y);
        ctx.quadraticCurveTo(64 + side * 20, y - 8, 64 + side * 61, y - 35);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(105,125,54,0.4)";
        ctx.stroke();
      }
    }
  }, 8432);
}

function makeSoilTexture(path: boolean) {
  return canvasTexture(256, 256, (ctx, random) => {
    ctx.fillStyle = path ? "#968369" : "#666e43";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14000; i += 1) {
      const light = random() > 0.45;
      ctx.fillStyle = path
        ? light ? "rgba(227,214,180,0.14)" : "rgba(41,35,22,0.18)"
        : light ? "rgba(124,143,70,0.18)" : "rgba(29,38,20,0.19)";
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
        + Math.sin(theta * 5 - phase) * 0.03);
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

export function createForestWorld3D(mobile: boolean): ForestWorld3D {
  const group = new Group();
  group.name = "Natural forest, winding path and undergrowth";
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
  const leafTexture = ownTexture(makeLeafTexture());
  const soilTexture = ownTexture(makeSoilTexture(false));
  const pathTexture = ownTexture(makeSoilTexture(true));
  const woodTexture = ownTexture(makeWoodTexture());
  if (soilTexture) soilTexture.repeat.set(15, 27);

  const leafGeometry = ownGeometry(makeLeafGeometry());
  // Small canopy leaves retain their curved midrib with fewer surface segments.
  const canopyGeometry = ownGeometry(makeLeafGeometry(6, 2));
  const leafMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xffffff, map: leafTexture, bumpMap: leafTexture, bumpScale: 0.014,
    roughness: 0.83, metalness: 0, side: DoubleSide,
  }));
  const barkMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xcac2af, map: barkTexture, bumpMap: barkTexture, bumpScale: 0.15,
    roughness: 0.98,
  }));
  const groundMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xa8ae85, map: soilTexture, bumpMap: soilTexture, bumpScale: 0.045,
    roughness: 1, vertexColors: true,
  }));
  const pathMaterial = ownMaterial(new MeshStandardMaterial({
    color: 0xc8b590, map: pathTexture, bumpMap: pathTexture, bumpScale: 0.032,
    roughness: 1, vertexColors: true,
  }));
  const uniforms = { time: { value: 0 }, power: { value: 0.4 } };
  const canopyMaterial = ownMaterial(leafMaterial.clone());
  canopyMaterial.emissive.set(0x223110);
  canopyMaterial.emissiveIntensity = 0.14;
  addWind(canopyMaterial, uniforms, false);

  // The entire forest floor is a continuous height field with raised banks.
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
      const shade = 0.7 + Math.sin(x * 0.6 + z * 0.27) * 0.07 + random() * 0.12;
      groundColors.push(shade * 0.82, shade, shade * 0.63);
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
  const greenPalette = [0x456e29, 0x557d31, 0x638a36, 0x708d3d, 0x436731, 0x75974a];
  const leafColor = () => new Color(greenPalette[Math.floor(random() * greenPalette.length)]);
  const radialSides = mobile ? 8 : 11;

  const addCluster = (tip: Vector3, size: number, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const radius = Math.sqrt(random()) * size;
      const position = tip.clone().add(new Vector3(
        Math.cos(angle) * radius, between(-0.5, 0.65) * size, Math.sin(angle) * radius,
      ));
      // Retain the bright view up the path between the arching crowns.
      if (Math.abs(position.x - pathCenter(position.z)) < 2.15 && position.z > -38 && position.y > 7.5) continue;
      const rotation = new Quaternion().setFromAxisAngle(UP, angle + between(-0.9, 0.9));
      rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), between(-1.4, 1.4)));
      rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), between(-1.3, 1.3)));
      const length = between(0.48, 0.92);
      foliage.push({ position, rotation, scale: new Vector3(length * between(0.83, 1.18), length, length), color: leafColor() });
    }
  };

  const addTree = (x: number, z: number, height: number, radius: number, index: number) => {
    const groundY = terrainHeight(x, z);
    const bendX = between(-0.6, 0.6);
    const bendZ = between(-0.5, 0.5);
    const trunk: Vector3[] = [];
    const radii: number[] = [];
    for (let ring = 0; ring <= 7; ring += 1) {
      const f = ring / 7;
      trunk.push(new Vector3(x + bendX * f * f + Math.sin(f * 4 + index) * f * 0.16,
        groundY + f * height, z + bendZ * f * f));
      radii.push(radius * Math.pow(1 - f * 0.93, 0.8) * (ring === 0 ? 1.45 : 1));
    }
    branches.push(branchGeometry(trunk, radii, radialSides, index));

    for (let root = 0; root < 5; root += 1) {
      const angle = root / 5 * TAU + index * 0.7;
      const length = radius * between(2, 3.8);
      const endX = x + Math.cos(angle) * length;
      const endZ = z + Math.sin(angle) * length;
      const points = [new Vector3(x, groundY + radius * 0.35, z),
        new Vector3(x + Math.cos(angle) * length * 0.43, groundY + 0.13, z + Math.sin(angle) * length * 0.43),
        new Vector3(endX, terrainHeight(endX, endZ) + 0.015, endZ)];
      branches.push(branchGeometry(points, [radius * 0.32, radius * 0.16, 0.025], 6, root));
    }

    const mainCount = 7;
    for (let branch = 0; branch < mainCount; branch += 1) {
      const angle = branch / mainCount * TAU + index * 1.31 + between(-0.25, 0.25);
      const fraction = 0.39 + branch / mainCount * 0.39;
      const start = new Vector3(x + bendX * fraction * fraction, groundY + height * fraction, z + bendZ * fraction * fraction);
      const length = between(3.2, 5.1) * (1.05 - fraction * 0.35) * height / 14;
      const end = start.clone().add(new Vector3(Math.cos(angle) * length, between(2.1, 4.4), Math.sin(angle) * length));
      const mid = start.clone().lerp(end, 0.5).add(new Vector3(0, -0.45, 0));
      const branchRadius = radius * (0.29 - branch * 0.014);
      branches.push(branchGeometry([start, mid, end], [branchRadius, branchRadius * 0.58, 0.04], 7, angle));
      for (let twig = 0; twig < 3; twig += 1) {
        const twigAngle = angle + (twig - 1) * 0.85;
        const twigStart = mid.clone().lerp(end, 0.3 + twig * 0.26);
        const twigEnd = twigStart.clone().add(new Vector3(
          Math.cos(twigAngle) * between(1.1, 2.15), between(0.8, 2.1), Math.sin(twigAngle) * between(1.1, 2.15),
        ));
        const twigMid = twigStart.clone().lerp(twigEnd, 0.55).add(new Vector3(0, 0.12, 0));
        branches.push(branchGeometry([twigStart, twigMid, twigEnd], [0.055, 0.033, 0.012], 5, twigAngle));
        addCluster(twigEnd, between(0.95, 1.45), mobile ? 14 : 22);
      }
    }
    addCluster(trunk[7], 1.1, mobile ? 20 : 28);
  };

  // Large foreground trunks frame the view. More distant trees overlap in depth.
  addTree(mobile ? -2.95 : -6.2, 3, 14.3, 0.76, 0);
  addTree(mobile ? 3.05 : 6.55, 1.2, 15.2, 0.86, 1);
  const rows = mobile ? 8 : 11;
  let treeIndex = 2;
  for (let row = 0; row < rows; row += 1) {
    const z = -7 - row * 8.3;
    for (const side of [-1, 1]) {
      const x = side * between(row < 3 ? 4.3 : 5.6, row < 3 ? 6.7 : 11.5) + pathCenter(z);
      addTree(x, z + between(-2.1, 2.1), between(12.4, 17.8), between(0.32, 0.62), treeIndex++);
    }
  }
  const outerCount = mobile ? 6 : 12;
  for (let i = 0; i < outerCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    addTree(side * between(12, 26), between(-100, -4), between(14, 20), between(0.4, 0.75), treeIndex++);
  }

  // Fallen timber retains bark on the outside and growth rings on its cut ends.
  const logEnds: BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = [2, -9, -18, -32][i];
    const x = side * (mobile ? between(3.8, 5.7) : between(5.2, 8));
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

  // Fern fronds grow in pairs of small, outward-facing leaflets along each arch.
  const fernCount = mobile ? 18 : 32;
  for (let fern = 0; fern < fernCount; fern += 1) {
    const z = between(-28, 11);
    const side = fern % 2 === 0 ? -1 : 1;
    const x = pathCenter(z) + side * between(2.05, mobile ? 5.5 : 8.5);
    const base = new Vector3(x, terrainHeight(x, z) + 0.06, z);
    const plantScale = between(0.65, 1.2);
    for (let frond = 0; frond < 6; frond += 1) {
      const angle = frond / 6 * TAU + fern;
      const length = between(0.65, 1.1) * plantScale;
      for (let pair = 1; pair <= 8; pair += 1) {
        const f = pair / 9;
        const along = length * f;
        const height = Math.sin(f * Math.PI * 0.84) * plantScale * 0.63;
        for (const side of [-1, 1]) {
          const direction = new Vector3(Math.cos(angle + side * 0.75), 0.18, Math.sin(angle + side * 0.75)).normalize();
          const position = base.clone().add(new Vector3(Math.cos(angle) * along, height, Math.sin(angle) * along));
          const rotation = new Quaternion().setFromUnitVectors(UP, direction);
          const size = (0.34 * (1 - f) + 0.07) * plantScale;
          foliage.push({ position, rotation, scale: new Vector3(size * 0.55, size, size), color: new Color(fern % 3 === 0 ? 0x436b31 : 0x537c35) });
        }
      }
    }
  }

  const matrix = new Matrix4();
  const canopy = new InstancedMesh(canopyGeometry, canopyMaterial, foliage.length);
  canopy.name = "Individual curved canopy leaves and fern leaflets";
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
  grassGeometry.setAttribute("position", new BufferAttribute(new Float32Array([
    -0.035, 0, 0, 0.035, 0, 0,
    -0.018, 0.36, 0.025, 0.03, 0.36, 0.025,
    0.02, 0.72, 0.08, 0.045, 0.72, 0.08,
    0.09, 1, 0.14,
  ]), 3));
  grassGeometry.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 0.36, 1, 0.36, 0, 0.72, 1, 0.72, 0.5, 1]), 2));
  grassGeometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  grassGeometry.computeVertexNormals();
  const grassMaterial = ownMaterial(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: DoubleSide }));
  addWind(grassMaterial, uniforms, true);
  const grassCount = mobile ? 2500 : 5000;
  const grass = new InstancedMesh(grassGeometry, grassMaterial, grassCount);
  grass.name = "Wind-bent grass along the path";
  for (let index = 0; index < grassCount; index += 1) {
    const near = index < grassCount * 0.82;
    const z = between(near ? -42 : -100, near ? 20 : -20);
    const side = random() < 0.5 ? -1 : 1;
    const x = pathCenter(z) + side * between(1.74, near ? 9 : 25);
    const position = new Vector3(x, terrainHeight(x, z) + 0.01, z);
    const rotation = new Quaternion().setFromAxisAngle(UP, random() * TAU);
    const height = between(0.19, 0.68) * (0.8 + Math.sin(x * 1.8 + z * 0.7) * 0.25);
    matrix.compose(position, rotation, new Vector3(between(0.55, 1.5), height, 1));
    grass.setMatrixAt(index, matrix);
    grass.setColorAt(index, new Color().setHSL(between(0.19, 0.26), between(0.32, 0.5), between(0.19, 0.35)));
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
  const rockCount = mobile ? 80 : 150;
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
  const fallenCount = mobile ? 100 : 220;
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

  let disposed = false;
  return {
    group,
    leafGeometry,
    leafMaterial,
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
