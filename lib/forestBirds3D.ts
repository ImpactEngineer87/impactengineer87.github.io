import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";

export interface BirdModel {
  /** The bird faces +X; its wings spread along Z, with Y pointing up. */
  group: Group;
  /** Time is seconds and flapRate is complete wingbeats per second. */
  animate(time: number, flapRate: number, gliding?: boolean, eating?: boolean): void;
  dispose(): void;
}

type Feather = {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  yaw: number;
  arch?: number;
};

/** Fine barb marks follow the shaft rather than resembling a flat wing decal. */
function createFeatherTexture(): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#d9cbae";
  context.fillRect(0, 0, 128, 256);
  const edge = context.createLinearGradient(0, 0, 128, 0);
  edge.addColorStop(0, "rgba(77, 61, 42, .28)");
  edge.addColorStop(0.43, "rgba(245, 237, 217, .08)");
  edge.addColorStop(0.55, "rgba(244, 235, 215, .14)");
  edge.addColorStop(1, "rgba(74, 58, 41, .35)");
  context.fillStyle = edge;
  context.fillRect(0, 0, 128, 256);
  for (let row = -32; row < 270; row += 4) {
    const variation = 0.12 + (Math.sin(row * 1.37) + 1) * 0.055;
    context.strokeStyle = `rgba(77, 61, 42, ${variation})`;
    context.lineWidth = 0.7;
    context.beginPath();
    context.moveTo(64, row);
    context.bezierCurveTo(47, row + 4, 22, row + 14, 0, row + 29);
    context.moveTo(64, row);
    context.bezierCurveTo(83, row + 4, 109, row + 16, 128, row + 30);
    context.stroke();
  }
  context.strokeStyle = "rgba(250, 240, 214, .58)";
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(64, 0);
  context.lineTo(64, 256);
  context.stroke();
  const tip = context.createLinearGradient(0, 0, 0, 64);
  tip.addColorStop(0, "rgba(246, 232, 200, .34)");
  tip.addColorStop(1, "rgba(246, 232, 200, 0)");
  context.fillStyle = tip;
  context.fillRect(0, 0, 128, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createPlumageTexture(): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#e0dbcc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = -1; row < 13; row++) {
    for (let column = -1; column < 27; column++) {
      const x = column * 10 + (row % 2) * 5;
      const y = row * 11;
      const variation = Math.sin(column * 6.3 + row * 1.8);
      context.fillStyle = `rgba(80, 68, 49, ${0.06 + (variation + 1) * 0.035})`;
      context.beginPath();
      context.moveTo(x - 5, y);
      context.quadraticCurveTo(x - 6, y + 11, x, y + 14);
      context.quadraticCurveTo(x + 6, y + 11, x + 5, y);
      context.fill();
      context.strokeStyle = "rgba(252, 247, 228, .26)";
      context.lineWidth = 0.6;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + 12);
      for (let barb = 2; barb < 11; barb += 2) {
        context.moveTo(x - 4, y + barb - 2);
        context.lineTo(x, y + barb);
        context.lineTo(x + 4, y + barb - 2);
      }
      context.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Bake the overlapping feathers into one draw call per articulated wing part. */
function featherGeometry(feathers: Feather[]): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = 10;
  const columns = 4;
  const point = new Vector3();
  const transform = new Matrix4();

  for (const feather of feathers) {
    const offset = positions.length / 3;
    transform.makeRotationY(feather.yaw);
    transform.setPosition(feather.x, feather.y, feather.z);
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const outline = Math.pow(Math.sin(Math.PI * (0.13 + t * 0.87)), 0.65);
      const halfWidth = feather.width * 0.5 * outline;
      for (let column = 0; column <= columns; column++) {
        const across = (column / columns) * 2 - 1;
        const rib = (1 - across * across) * 0.003 * Math.sin(Math.PI * t);
        point.set(
          across * halfWidth,
          Math.sin(Math.PI * t) * (feather.arch ?? 0.007) + rib,
          t * feather.length,
        ).applyMatrix4(transform);
        positions.push(point.x, point.y, point.z);
        const tint = 0.88 + t * 0.12 - Math.abs(across) * 0.08;
        colors.push(tint, tint, tint);
        uvs.push(column / columns, t);
        if (row < rows && column < columns) {
          const a = offset + row * (columns + 1) + column;
          const b = a + columns + 1;
          // Wound upwards so the feather's convex side catches the skylight.
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A small brown songbird with a feathered, articulated flight silhouette. */
export function createBirdModel(): BirdModel {
  const group = new Group();
  group.name = "songbird";
  const texture = createFeatherTexture();
  const plumageTexture = createPlumageTexture();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshStandardMaterial>();
  const unitSphere = new SphereGeometry(1, 18, 12);
  geometries.add(unitSphere);

  const material = (color: string, feathered = false, roughness = 0.86) => {
    const result = new MeshStandardMaterial({
      color: new Color(color),
      roughness,
      metalness: 0,
      vertexColors: feathered,
      ...(feathered ? { side: DoubleSide, ...(texture ? { map: texture } : {}) } : {}),
    });
    materials.add(result);
    return result;
  };
  const back = material("#796b58");
  const cap = material("#655847");
  const breast = material("#d8cdb3");
  const cheek = material("#c7b595");
  const flight = material("#967c5c", true);
  const coverts = material("#a18d70", true);
  const tailMaterial = material("#826b50", true);
  const beakMaterial = material("#ad8a50", false, 0.59);
  const eyeMaterial = material("#171b16", false, 0.18);
  const eyeRim = material("#beaa88", false, 0.72);
  const footMaterial = material("#806450", false, 0.7);
  if (plumageTexture) {
    for (const surface of [back, cap, breast, cheek]) surface.map = plumageTexture;
  }

  function mesh(geometry: BufferGeometry, surface: MeshStandardMaterial, parent = group) {
    geometries.add(geometry);
    const result = new Mesh(geometry, surface);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function ellipsoid(
    parent: Group,
    surface: MeshStandardMaterial,
    position: [number, number, number],
    scale: [number, number, number],
  ) {
    const result = mesh(unitSphere, surface, parent);
    result.position.set(...position);
    result.scale.set(...scale);
    return result;
  }

  // The overlapping breast and back keep the thorax full, tapering into the tail.
  ellipsoid(group, back, [-0.029, 0.015, 0], [0.152, 0.08, 0.075]);
  ellipsoid(group, breast, [0.008, -0.009, 0], [0.121, 0.071, 0.069]);
  ellipsoid(group, back, [-0.101, 0.022, 0], [0.078, 0.051, 0.056]);
  const mantle: Feather[] = [];
  for (let row = 0; row < 3; row++) {
    for (let column = -2; column <= 2; column++) {
      const z = column * 0.022;
      mantle.push({
        x: 0.053 - row * 0.041,
        y: 0.099 - Math.abs(column) * 0.004 - row * 0.001,
        z,
        length: 0.064,
        width: 0.03,
        yaw: -Math.PI / 2,
        arch: 0.002,
      });
    }
  }
  mesh(featherGeometry(mantle), coverts);

  const head = new Group();
  head.position.set(0.101, 0.078, 0);
  group.add(head);
  ellipsoid(head, cap, [0.023, 0.008, 0], [0.058, 0.052, 0.051]);
  ellipsoid(head, breast, [0.034, -0.022, 0], [0.047, 0.03, 0.04]);
  for (const side of [-1, 1]) {
    ellipsoid(head, cheek, [0.04, -0.011, side * 0.042], [0.027, 0.015, 0.008]);
    ellipsoid(head, eyeRim, [0.045, 0.018, side * 0.045], [0.01, 0.01, 0.004]);
    ellipsoid(head, eyeMaterial, [0.046, 0.018, side * 0.048], [0.0078, 0.0078, 0.004]);
    // A pale eyebrow and warm cheek remain readable when the bird banks.
    const brow = ellipsoid(head, cheek, [0.037, 0.033, side * 0.04], [0.026, 0.003, 0.003]);
    brow.rotation.z = -0.12;
  }
  const upperBeak = mesh(new ConeGeometry(0.018, 0.053, 5), beakMaterial, head);
  upperBeak.rotation.z = -Math.PI / 2;
  upperBeak.position.set(0.104, -0.004, 0);
  upperBeak.scale.z = 0.76;
  const lowerBeakHinge = new Group();
  lowerBeakHinge.name = "beak-hinge";
  lowerBeakHinge.position.set(0.0805, -0.0145, 0);
  head.add(lowerBeakHinge);
  const lowerBeak = mesh(new ConeGeometry(0.0105, 0.043, 5), beakMaterial, lowerBeakHinge);
  lowerBeak.rotation.z = -Math.PI / 2;
  lowerBeak.position.set(0.0215, -0.0025, 0);
  lowerBeak.scale.z = 0.92;

  const wings: { shoulder: Group; elbow: Group; side: number }[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.name = side === 1 ? "right-shoulder" : "left-shoulder";
    shoulder.position.set(-0.018, 0.044, side * 0.057);
    shoulder.scale.z = side;
    group.add(shoulder);
    ellipsoid(shoulder, back, [-0.017, 0.009, 0.097], [0.065, 0.018, 0.112]);

    const secondary: Feather[] = [];
    for (let i = 0; i < 7; i++) {
      secondary.push({
        x: 0.025 - i * 0.004,
        y: 0.004 + i * 0.0005,
        z: 0.016 + i * 0.028,
        length: 0.137 + Math.sin((i / 6) * Math.PI) * 0.018,
        width: 0.043,
        yaw: -1.21 + i * 0.055,
        arch: 0.008,
      });
    }
    mesh(featherGeometry(secondary), flight, shoulder);

    const upperCoverts: Feather[] = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 8; i++) {
        upperCoverts.push({
          x: 0.044 - row * 0.044 - i * 0.003,
          y: 0.022 + row * 0.003,
          z: 0.018 + i * 0.024,
          length: 0.071,
          width: 0.037,
          yaw: -1.12,
          arch: 0.005,
        });
      }
    }
    mesh(featherGeometry(upperCoverts), coverts, shoulder);

    const elbow = new Group();
    elbow.name = "outer-wing";
    elbow.position.set(0.014, 0.005, 0.197);
    shoulder.add(elbow);
    ellipsoid(elbow, back, [0.002, 0.005, 0.062], [0.046, 0.012, 0.077]);
    const primary: Feather[] = [];
    for (let i = 0; i < 9; i++) {
      primary.push({
        x: 0.033 - i * 0.009,
        y: 0.003 + i * 0.00055,
        z: 0.018 + i * 0.014,
        length: 0.211 + Math.sin((i / 9) * Math.PI) * 0.069,
        width: 0.035 + Math.sin((i / 8) * Math.PI) * 0.006,
        yaw: -0.20 - i * 0.059,
        arch: 0.013,
      });
    }
    mesh(featherGeometry(primary), flight, elbow);
    const outerCoverts: Feather[] = [];
    for (let i = 0; i < 8; i++) {
      outerCoverts.push({
        x: 0.039 - i * 0.009,
        y: 0.02,
        z: 0.019 + i * 0.016,
        length: 0.102,
        width: 0.033,
        yaw: -0.36 - i * 0.037,
        arch: 0.006,
      });
    }
    mesh(featherGeometry(outerCoverts), coverts, elbow);
    wings.push({ shoulder, elbow, side });
  }

  const tail = new Group();
  tail.name = "tail-fan";
  tail.position.set(-0.145, 0.018, 0);
  group.add(tail);
  mesh(featherGeometry(Array.from({ length: 7 }, (_, i) => ({
    x: 0,
    y: Math.abs(i - 3) * 0.001,
    z: (i - 3) * 0.008,
    length: 0.12 + (1 - Math.abs(i - 3) / 3) * 0.014,
    width: 0.029,
    yaw: -Math.PI / 2 + (i - 3) * 0.077,
    arch: 0.003,
  }))), tailMaterial, tail);

  // Legs are drawn back under the body, with toes tucked during flight.
  for (const side of [-1, 1]) {
    const leg = mesh(new CylinderGeometry(0.003, 0.0024, 0.04, 5), footMaterial);
    leg.position.set(-0.035, -0.061, side * 0.026);
    leg.rotation.z = -0.66;
    for (let toe = 0; toe < 3; toe++) {
      const foot = mesh(new CylinderGeometry(0.0017, 0.001, 0.021, 4), footMaterial);
      foot.position.set(-0.058, -0.078, side * 0.024 + (toe - 1) * 0.004);
      foot.rotation.z = 1.33;
      foot.rotation.x = (toe - 1) * 0.21;
    }
  }

  let disposed = false;
  const animate = (time: number, flapRate: number, gliding = false, eating = false) => {
    const seconds = Number.isFinite(time) ? time : 0;
    const frequency = Number.isFinite(flapRate) ? Math.max(0, flapRate) : 5;
    const phase = seconds * frequency * Math.PI * 2;
    const beat = Math.sin(phase);
    const upstroke = Math.max(0, -beat);
    const wingAngle = gliding ? -0.09 + Math.sin(seconds * 2.7) * 0.025 : beat * 0.70 - 0.10;
    for (const { shoulder, elbow, side } of wings) {
      shoulder.rotation.x = side * wingAngle;
      shoulder.rotation.y = side * (gliding ? 0.035 : 0.035 + upstroke * 0.16);
      // The wrist folds on the recovery stroke, then opens for the power stroke.
      elbow.rotation.y = gliding ? -0.025 : -upstroke * 0.48;
      elbow.rotation.x = gliding ? 0.02 : -0.09 * Math.sin(phase - 0.6);
    }
    tail.rotation.z = 0.09 + Math.sin(seconds * 2.2) * 0.032;
    tail.rotation.x = Math.sin(seconds * 1.3) * 0.055;
    head.rotation.y = Math.sin(seconds * 0.9) * 0.045;
    head.rotation.z = Math.sin(seconds * 1.5) * 0.026 - (eating ? Math.sin(seconds * 12) * 0.025 : 0);
    lowerBeakHinge.rotation.z = eating ? -0.18 - (Math.sin(seconds * 24) + 1) * 0.08 : 0;
  };
  animate(0, 5, true);

  return {
    group,
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
      texture?.dispose();
      plumageTexture?.dispose();
    },
  };
}
