import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface GrasslandAnimals3D {
  group: Group;
  /** Absolute elapsed seconds; repeated calls with the same time give the same pose. */
  update(time: number, power?: number): void;
  dispose(): void;
}

type Point = [number, number, number];
type AnimalPose = {
  body: Group;
  head: Group;
  tail: Group;
  ears: Group[];
  phase: number;
  headTilt: number;
};
type Pattern = "tiger" | "giraffe" | "zebra";

const UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function seededRandom(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Painted in longitudinal/circumferential UVs, so stripes wrap around the animal. */
function coatTexture(pattern: Pattern): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const random = seededRandom(pattern === "tiger" ? 4107 : pattern === "giraffe" ? 173 : 733);
  context.fillStyle = pattern === "tiger" ? "#c8873a" : pattern === "giraffe" ? "#d8bb78" : "#e6dfc8";
  context.fillRect(0, 0, 512, 256);

  if (pattern === "giraffe") {
    // Staggered, irregular polygon patches with pale channels between them.
    const columns = 12;
    const rows = 7;
    for (let row = -1; row <= rows; row++) {
      for (let column = -1; column <= columns; column++) {
        const x = column * (512 / columns) + (row % 2) * 21 + random() * 8;
        const y = row * (256 / rows) + random() * 7;
        const radiusX = 15 + random() * 7;
        const radiusY = 12 + random() * 5;
        context.fillStyle = ["#8c562b", "#a56732", "#915c2d", "#ae7138"][Math.floor(random() * 4)];
        context.beginPath();
        for (let corner = 0; corner < 6; corner++) {
          const angle = corner / 6 * TAU;
          const px = x + Math.cos(angle) * radiusX * (0.88 + random() * 0.2);
          const py = y + Math.sin(angle) * radiusY * (0.86 + random() * 0.24);
          if (corner === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      }
    }
  } else {
    if (pattern === "tiger") {
      const belly = context.createLinearGradient(0, 0, 0, 256);
      belly.addColorStop(0, "#ede0bc");
      belly.addColorStop(0.17, "rgba(238,221,180,0)");
      belly.addColorStop(0.83, "rgba(238,221,180,0)");
      belly.addColorStop(1, "#ede0bc");
      context.fillStyle = belly;
      context.fillRect(0, 0, 512, 256);
    }
    const count = pattern === "tiger" ? 17 : 25;
    for (let stripe = -1; stripe <= count; stripe++) {
      const startX = stripe / count * 512;
      const width = (pattern === "tiger" ? 8 : 6) + random() * 10;
      const bend = (random() - 0.5) * 28;
      context.fillStyle = pattern === "tiger" ? "#29231d" : "#292b25";
      context.beginPath();
      context.moveTo(startX - width, -10);
      context.bezierCurveTo(startX + bend, 75, startX - bend - width, 145, startX + width * 0.1, 266);
      context.bezierCurveTo(startX + bend + width, 156, startX - bend + width, 83, startX + width * 0.1, -10);
      context.closePath();
      context.fill();
      if (pattern === "tiger" && stripe % 3 === 1) {
        context.beginPath();
        context.moveTo(startX + width * 0.2, 76);
        context.quadraticCurveTo(startX + 27, 108, startX + 24, 161);
        context.quadraticCurveTo(startX + 13, 128, startX - width * 0.2, 98);
        context.fill();
      }
    }
  }

  for (let hair = 0; hair < 4200; hair++) {
    context.strokeStyle = random() > 0.5 ? "rgba(255,240,188,.045)" : "rgba(32,24,17,.055)";
    const x = random() * 512;
    const y = random() * 256;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1 + random() * 2, y + 1);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A small, resource-owned herd, built without model downloads or per-part draw calls. */
export function createGrasslandAnimals3D(
  mobile: boolean,
  terrainHeight: (x: number, z: number) => number,
): GrasslandAnimals3D {
  const group = new Group();
  group.name = "Grassland wildlife";
  const geometries = new Set<BufferGeometry>();
  const textures = new Set<Texture>();
  const materials = new Set<MeshStandardMaterial>();
  const batches = new Map<Group, Map<MeshStandardMaterial, BufferGeometry[]>>();
  const poses: AnimalPose[] = [];
  const sphere = new SphereGeometry(1, mobile ? 14 : 18, mobile ? 9 : 12);
  const smallSphere = new SphereGeometry(1, mobile ? 8 : 10, mobile ? 6 : 8);
  geometries.add(sphere);
  geometries.add(smallSphere);
  const detail = new MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.94 });
  materials.add(detail);

  function patternedMaterial(pattern: Pattern, fallback: string) {
    const texture = coatTexture(pattern);
    if (texture) textures.add(texture);
    const material = new MeshStandardMaterial({
      map: texture ?? null,
      color: texture ? "#ffffff" : fallback,
      vertexColors: true,
      roughness: 0.96,
    });
    materials.add(material);
    return material;
  }
  const tigerCoat = patternedMaterial("tiger", "#c8873a");
  const giraffeCoat = patternedMaterial("giraffe", "#bd915b");
  const zebraCoat = mobile ? undefined : patternedMaterial("zebra", "#c5c3b3");

  function addGeometry(
    parent: Group,
    geometry: BufferGeometry,
    color: string,
    material = detail,
    transform?: Matrix4,
  ) {
    const tint = new Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      colors[index * 3] = tint.r;
      colors[index * 3 + 1] = tint.g;
      colors[index * 3 + 2] = tint.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    if (transform) geometry.applyMatrix4(transform);
    let byMaterial = batches.get(parent);
    if (!byMaterial) {
      byMaterial = new Map();
      batches.set(parent, byMaterial);
    }
    const batch = byMaterial.get(material) ?? [];
    batch.push(geometry);
    byMaterial.set(material, batch);
  }

  function ellipsoid(parent: Group, position: Point, scale: Point, color: string, material = detail, tilt = 0) {
    const geometry = (Math.max(...scale) <= 0.22 ? smallSphere : sphere).clone();
    if (material !== detail) {
      const vertices = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      for (let index = 0; index < vertices.count; index++) {
        uv.setXY(index, (vertices.getX(index) + 1) * 0.5,
          Math.atan2(vertices.getZ(index), vertices.getY(index)) / TAU + 0.5);
      }
    }
    const matrix = new Matrix4().compose(new Vector3(...position),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), tilt), new Vector3(...scale));
    addGeometry(parent, geometry, color, material, matrix);
  }

  function limb(parent: Group, from: Point, to: Point, startRadius: number, endRadius: number,
    color: string, material = detail) {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const axis = b.clone().sub(a);
    const length = axis.length();
    const geometry = new CylinderGeometry(endRadius, startRadius, 1, mobile ? 8 : 12);
    const matrix = new Matrix4().compose(a.add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(UP, axis.normalize()), new Vector3(1, length, 1));
    addGeometry(parent, geometry, color, material, matrix);
  }

  function curvedTail(parent: Group, points: Point[], radius: number, color: string, material = detail) {
    const curve = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));
    const geometry = new TubeGeometry(curve, mobile ? 12 : 18, radius, 6, false);
    addGeometry(parent, geometry, color, material);
  }

  function animal(name: string, x: number, z: number, yaw: number, phase: number, scale = 1) {
    const root = new Group();
    root.name = name;
    root.userData.species = name.toLowerCase();
    root.position.set(x, terrainHeight(x, z) + 0.01, z);
    root.rotation.y = yaw;
    root.scale.setScalar(scale);
    const body = new Group();
    const head = new Group();
    const tail = new Group();
    body.name = `${name} breathing torso`;
    head.name = `${name} head`;
    tail.name = `${name} tail`;
    root.add(body, tail);
    body.add(head);
    group.add(root);
    const pose: AnimalPose = { body, head, tail, ears: [], phase, headTilt: 0 };
    poses.push(pose);
    return { root, ...pose, pose };
  }

  function catLegs(root: Group, coat: MeshStandardMaterial, lion: boolean) {
    const fur = lion ? "#c6a161" : "#ffffff";
    for (const side of [-1, 1]) {
      const z = side * 0.29;
      // The rear hock angles forward; the front legs descend beneath the shoulder.
      ellipsoid(root, [-0.65, 0.96, z], [0.28, 0.39, 0.2], fur, coat);
      limb(root, [-0.7, 0.95, z], [-0.83, 0.52, z], 0.16, 0.11, fur, coat);
      limb(root, [-0.83, 0.52, z], [-0.71, 0.13, z + side * 0.02], 0.1, 0.075, fur, coat);
      ellipsoid(root, [0.67, 1.01, z], [0.21, 0.35, 0.18], fur, coat);
      limb(root, [0.72, 1.01, z], [0.72, 0.51, z], 0.145, 0.105, fur, coat);
      limb(root, [0.72, 0.51, z], [0.78, 0.13, z + side * 0.02], 0.105, 0.085, fur, coat);
      for (const x of [-0.68, 0.82]) {
        ellipsoid(root, [x, 0.105, z + side * 0.02], [0.2, 0.115, 0.135], lion ? "#d1b074" : "#d9c7a1");
        // Small dark toe separations help the broad feet read as paws.
        for (const offset of [-0.045, 0.045]) {
          limb(root, [x + 0.15, 0.11, z + offset], [x + 0.19, 0.075, z + offset],
            0.005, 0.004, "#66553f");
        }
      }
    }
  }

  function catFace(head: Group, tiger: boolean) {
    const cream = tiger ? "#eee1c3" : "#ddc793";
    const faceFur = tiger ? "#ffffff" : "#c9a66b";
    const coat = tiger ? tigerCoat : detail;
    ellipsoid(head, [0.07, 0.06, 0], [0.36, 0.35, 0.31], faceFur, coat);
    ellipsoid(head, [0.3, -0.12, 0], [0.25, 0.17, 0.21], cream);
    for (const side of [-1, 1]) {
      ellipsoid(head, [0.35, -0.1, side * 0.095], [0.14, 0.11, 0.105], cream);
      ellipsoid(head, [0.2, 0.14, side * 0.264], [0.071, 0.052, 0.021], tiger ? "#eee0b5" : "#bba36b");
      ellipsoid(head, [0.226, 0.133, side * 0.281], [0.036, 0.029, 0.012], "#bd9b3b");
      ellipsoid(head, [0.233, 0.134, side * 0.291], [0.016, 0.024, 0.008], "#252a21");
      ellipsoid(head, [0.242, 0.144, side * 0.296], [0.007, 0.007, 0.004], "#fff2c8");
      limb(head, [0.127, 0.204, side * 0.259], [0.255, 0.191, side * 0.26], 0.025, 0.017,
        tiger ? "#342b20" : "#987641");
      for (let whisker = 0; whisker < 3; whisker++) {
        limb(head, [0.34, -0.12 - whisker * 0.018, side * 0.13],
          [0.37 + whisker * 0.04, -0.13 - whisker * 0.025, side * 0.38], 0.0022, 0.001, "#b7ae8b");
      }
    }
    ellipsoid(head, [0.49, -0.052, 0], [0.068, 0.043, 0.095], "#43332a");
    limb(head, [0.491, -0.073, 0], [0.494, -0.136, 0], 0.006, 0.004, "#453a2a");
    ellipsoid(head, [0.27, -0.225, 0], [0.185, 0.055, 0.155], cream);
  }

  function catEars(head: Group, ears: Group[], tiger: boolean) {
    for (const side of [-1, 1]) {
      const ear = new Group();
      ear.position.set(-0.04, 0.32, side * 0.245);
      ear.rotation.x = side * 0.28;
      head.add(ear);
      ears.push(ear);
      ellipsoid(ear, [0, 0.025, 0], [0.093, 0.12, 0.068], tiger ? "#292a20" : "#ac814a");
      ellipsoid(ear, [0.054, 0.03, 0], [0.029, 0.083, 0.049], tiger ? "#d5b790" : "#caae7b");
      if (tiger) ellipsoid(ear, [-0.07, 0.04, 0], [0.023, 0.039, 0.034], "#ead9b5");
    }
  }

  const lion = animal("Lion", mobile ? -1.7 : -3.2, mobile ? -0.7 : -1, -0.12, 0.4, mobile ? 0.9 : 1);
  ellipsoid(lion.body, [-0.13, 1.12, 0], [0.93, 0.39, 0.37], "#b99154");
  ellipsoid(lion.body, [0.53, 1.22, 0], [0.45, 0.48, 0.42], "#c29c5e");
  ellipsoid(lion.body, [-0.06, 0.91, 0], [0.64, 0.21, 0.3], "#cbb07a");
  catLegs(lion.root, detail, true);
  lion.head.position.set(1.06, 1.51, 0);
  // An uneven double mane gives a recognizable silhouette and a darker chest ruff.
  const mane = sphere.clone();
  const manePositions = mane.getAttribute("position");
  for (let index = 0; index < manePositions.count; index++) {
    const x = manePositions.getX(index);
    const y = manePositions.getY(index);
    const z = manePositions.getZ(index);
    const angle = Math.atan2(z, y);
    const ruffle = 1 + 0.045 * Math.sin(angle * 15 + x * 4) + 0.035 * Math.cos(angle * 9 - x * 5);
    manePositions.setXYZ(index, x * 0.4 - 0.2, y * 0.65 * ruffle - 0.04, z * 0.5 * ruffle);
  }
  mane.computeVertexNormals();
  addGeometry(lion.head, mane, "#7a522f");
  ellipsoid(lion.head, [-0.16, 0.1, 0], [0.32, 0.53, 0.43], "#916432");
  const maneRandom = seededRandom(9331);
  for (let tuft = 0; tuft < 44; tuft++) {
    const angle = tuft / 44 * TAU;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const length = 0.06 + maneRandom() * 0.09;
    const x = -0.21 + maneRandom() * 0.17;
    const color = cos < -0.2 ? "#65452e" : tuft % 3 === 0 ? "#ae813e" : "#825731";
    limb(lion.head, [x, cos * 0.57 - 0.04, sin * 0.43],
      [x - 0.035, cos * (0.61 + length) - 0.04, sin * (0.47 + length)], 0.07, 0.006, color);
  }
  catFace(lion.head, false);
  catEars(lion.head, lion.ears, false);
  lion.tail.position.set(-0.98, 1.17, 0);
  curvedTail(lion.tail, [[0, 0, 0], [-0.3, -0.12, 0.07], [-0.47, -0.5, 0.15], [-0.61, -0.7, 0.18]],
    0.035, "#b79356");
  ellipsoid(lion.tail, [-0.62, -0.7, 0.18], [0.083, 0.135, 0.079], "#64492d", detail, -0.35);

  const tiger = animal("Tiger", mobile ? 1.65 : 3.5, mobile ? -1.3 : -4, Math.PI + 0.2, 2.4, mobile ? 0.83 : 1.02);
  ellipsoid(tiger.body, [-0.15, 1.04, 0], [0.99, 0.4, 0.38], "#ffffff", tigerCoat);
  ellipsoid(tiger.body, [0.58, 1.18, 0], [0.39, 0.43, 0.39], "#ffffff", tigerCoat);
  ellipsoid(tiger.body, [-0.12, 0.82, 0], [0.64, 0.17, 0.3], "#decba8");
  catLegs(tiger.root, tigerCoat, false);
  tiger.head.position.set(1.04, 1.38, 0);
  catFace(tiger.head, true);
  catEars(tiger.head, tiger.ears, true);
  tiger.tail.position.set(-1.06, 1.15, 0);
  curvedTail(tiger.tail, [[0, 0, 0], [-0.35, -0.15, 0.02], [-0.65, -0.36, 0.09],
    [-0.86, -0.26, 0.17], [-0.89, -0.04, 0.2]], 0.052, "#ffffff", tigerCoat);
  ellipsoid(tiger.tail, [-0.89, -0.04, 0.2], [0.052, 0.067, 0.051], "#352c24");

  function ungulateLegs(root: Group, material: MeshStandardMaterial, giraffe: boolean) {
    const hipHeight = giraffe ? 1.82 : 1.1;
    const kneeHeight = giraffe ? 0.87 : 0.54;
    for (const side of [-1, 1]) {
      const z = side * (giraffe ? 0.265 : 0.24);
      for (const front of [false, true]) {
        const x = front ? 0.62 : -0.66;
        const kneeX = x + (front ? 0.07 : -0.1);
        ellipsoid(root, [x, hipHeight - 0.1, z], [0.18, giraffe ? 0.36 : 0.27, 0.145], "#ffffff", material);
        limb(root, [x, hipHeight - 0.08, z], [kneeX, kneeHeight, z],
          giraffe ? 0.105 : 0.12, 0.068, "#ffffff", material);
        ellipsoid(root, [kneeX, kneeHeight, z], [0.08, 0.095, 0.075], "#b69e67");
        limb(root, [kneeX, kneeHeight, z], [x + 0.07, 0.1, z + side * 0.015],
          0.052, 0.044, giraffe ? "#ccb984" : "#e0d8ba");
        ellipsoid(root, [x + 0.085, 0.073, z + side * 0.015], [0.1, 0.076, 0.075], "#544937");
        limb(root, [x + 0.17, 0.105, z + side * 0.015], [x + 0.179, 0.025, z + side * 0.015],
          0.003, 0.003, "#27271e");
      }
    }
  }

  const giraffe = animal("Giraffe", mobile ? .45 : 5.6, mobile ? -9 : -12, Math.PI - 0.22, 4.1, mobile ? 0.85 : 1);
  ellipsoid(giraffe.body, [-0.1, 1.88, 0], [0.88, 0.45, 0.36], "#ffffff", giraffeCoat, 0.09);
  ellipsoid(giraffe.body, [0.5, 2.06, 0], [0.39, 0.48, 0.34], "#ffffff", giraffeCoat);
  ellipsoid(giraffe.body, [-0.68, 1.79, 0], [0.32, 0.36, 0.32], "#ffffff", giraffeCoat);
  ungulateLegs(giraffe.root, giraffeCoat, true);
  limb(giraffe.body, [0.54, 2.1, 0], [1.04, 3.79, 0], 0.26, 0.145, "#ffffff", giraffeCoat);
  ellipsoid(giraffe.body, [0.73, 2.7, 0], [0.2, 0.72, 0.2], "#ffffff", giraffeCoat, -0.27);
  // A dark ridge follows the back of the neck without introducing a separate texture.
  for (let bristle = 0; bristle < 20; bristle++) {
    const t = bristle / 19;
    limb(giraffe.body, [0.32 + t * 0.57, 2.14 + t * 1.63, 0],
      [0.235 + t * 0.57, 2.17 + t * 1.63, 0], 0.046, 0.009, "#795834");
  }
  giraffe.head.position.set(1.07, 3.91, 0);
  giraffe.pose.headTilt = -0.13;
  ellipsoid(giraffe.head, [0.05, 0.03, 0], [0.29, 0.23, 0.2], "#ffffff", giraffeCoat);
  ellipsoid(giraffe.head, [0.3, -0.08, 0], [0.26, 0.13, 0.155], "#c9b482");
  ellipsoid(giraffe.head, [0.45, -0.09, 0], [0.1, 0.095, 0.145], "#9e8964");
  for (const side of [-1, 1]) {
    ellipsoid(giraffe.head, [0.115, 0.12, side * 0.187], [0.049, 0.046, 0.018], "#443b2c");
    ellipsoid(giraffe.head, [0.13, 0.134, side * 0.2], [0.01, 0.013, 0.006], "#f5e9c6");
    ellipsoid(giraffe.head, [0.44, -0.046, side * 0.128], [0.034, 0.022, 0.011], "#574c35");
    limb(giraffe.head, [-0.025, 0.2, side * 0.1], [-0.04, 0.43, side * 0.12], 0.034, 0.026, "#bca675");
    ellipsoid(giraffe.head, [-0.04, 0.435, side * 0.12], [0.044, 0.053, 0.043], "#6f5335");
    const ear = new Group();
    ear.position.set(-0.11, 0.12, side * 0.15);
    ear.rotation.x = side * 0.9;
    giraffe.head.add(ear);
    giraffe.ears.push(ear);
    ellipsoid(ear, [-0.025, 0.13, 0], [0.09, 0.18, 0.033], "#c7ae75", detail, 0.18);
    ellipsoid(ear, [-0.005, 0.14, 0.026], [0.052, 0.125, 0.011], "#806947", detail, 0.18);
  }
  giraffe.tail.position.set(-0.93, 1.95, 0);
  curvedTail(giraffe.tail, [[0, 0, 0], [-0.13, -0.3, 0.04], [-0.19, -0.71, 0.055]], 0.025, "#b39a66");
  ellipsoid(giraffe.tail, [-0.19, -0.78, 0.055], [0.061, 0.18, 0.055], "#655039");

  if (zebraCoat) {
    const zebra = animal("Zebra", -5.8, -15.5, -0.2, 5.8, 0.92);
    ellipsoid(zebra.body, [-0.12, 1.11, 0], [0.87, 0.39, 0.33], "#ffffff", zebraCoat);
    ellipsoid(zebra.body, [0.61, 1.37, 0], [0.29, 0.45, 0.26], "#ffffff", zebraCoat, -0.34);
    ungulateLegs(zebra.root, zebraCoat, false);
    limb(zebra.body, [0.58, 1.23, 0], [0.83, 1.78, 0], 0.22, 0.145, "#ffffff", zebraCoat);
    zebra.head.position.set(0.92, 1.75, 0);
    zebra.pose.headTilt = -0.24;
    ellipsoid(zebra.head, [0.02, 0.05, 0], [0.25, 0.23, 0.19], "#ffffff", zebraCoat);
    ellipsoid(zebra.head, [0.23, -0.095, 0], [0.26, 0.14, 0.145], "#ffffff", zebraCoat);
    ellipsoid(zebra.head, [0.43, -0.12, 0], [0.1, 0.11, 0.14], "#514e40");
    for (const side of [-1, 1]) {
      ellipsoid(zebra.head, [0.13, 0.13, side * 0.167], [0.045, 0.039, 0.015], "#282d23");
      const ear = new Group();
      ear.position.set(-0.05, 0.23, side * 0.12);
      ear.rotation.x = side * 0.18;
      zebra.head.add(ear);
      zebra.ears.push(ear);
      ellipsoid(ear, [0, 0.085, 0], [0.056, 0.16, 0.041], "#d0cab2");
      ellipsoid(ear, [0.035, 0.092, 0], [0.024, 0.111, 0.028], "#635c48");
    }
    for (let bristle = 0; bristle < 10; bristle++) {
      const t = bristle / 9;
      limb(zebra.body, [0.41 + t * 0.29, 1.36 + t * 0.47, 0],
        [0.35 + t * 0.29, 1.5 + t * 0.47, 0], 0.051, 0.023, "#3f4032");
    }
    zebra.tail.position.set(-0.94, 1.26, 0);
    curvedTail(zebra.tail, [[0, 0, 0], [-0.22, -0.24, 0.06], [-0.27, -0.56, 0.1]], 0.025, "#bbb49a");
    ellipsoid(zebra.tail, [-0.27, -0.62, 0.1], [0.063, 0.15, 0.055], "#3f4032");
  }

  // Bake parts of each articulated group by material. Hundreds of anatomical pieces
  // become a few meshes, while the head, ears, tail, and torso remain independently movable.
  for (const [parent, byMaterial] of batches) {
    for (const [material, pieces] of byMaterial) {
      const geometry = mergeGeometries(pieces, false);
      for (const piece of pieces) piece.dispose();
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      geometries.add(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  batches.clear();

  const earRest = new Map<Group, number>();
  for (const pose of poses) {
    for (const ear of pose.ears) earRest.set(ear, ear.rotation.x);
  }
  let disposed = false;
  const result: GrasslandAnimals3D = {
    group,
    update(time, power = 0.4) {
      if (disposed || !Number.isFinite(time)) return;
      const breeze = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0.4;
      for (const pose of poses) {
        pose.body.scale.y = 1 + Math.sin(time * 1.65 + pose.phase) * 0.004;
        pose.body.scale.z = 1 + Math.sin(time * 1.65 + pose.phase) * 0.008;
        pose.head.rotation.z = pose.headTilt + Math.sin(time * 0.31 + pose.phase) * 0.035;
        pose.head.rotation.y = Math.sin(time * 0.23 + pose.phase * 1.7) * 0.085;
        pose.tail.rotation.y = Math.sin(time * 0.86 + pose.phase) * (0.15 + breeze * 0.08);
        pose.tail.rotation.z = Math.sin(time * 0.53 + pose.phase) * 0.035;
        pose.ears.forEach((ear, index) => {
          const twitch = Math.pow(Math.max(0, Math.sin(time * 0.73 + pose.phase * 2 + index)), 14);
          ear.rotation.x = (earRest.get(ear) ?? 0) + twitch * (index === 0 ? 0.19 : -0.17);
        });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      geometries.clear();
      materials.clear();
      textures.clear();
      earRest.clear();
      poses.length = 0;
    },
  };
  result.update(0);
  return result;
}
