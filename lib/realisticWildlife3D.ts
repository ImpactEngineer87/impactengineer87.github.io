import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

type AnimalName = "lion" | "tiger" | "giraffe" | "zebra";

/** Coordinates use the source image's top-left origin, normalized from 0 to 1. */
export interface WildlifeAtlasRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WildlifeAtlasFrame {
  frame: WildlifeAtlasRectangle;
  /** Optional tight crop in atlas coordinates, useful for a replacement atlas. */
  bounds?: WildlifeAtlasRectangle;
  /** Feet's vertical position within the crop; alpha scanning normally finds this. */
  footBaseline: number;
  width: number;
  height?: number;
  position: [x: number, z: number];
  mobilePosition?: [x: number, z: number];
}

/** Keep the photographic atlas and its world placement inspectable in one place. */
const ATLAS_ROW_SPLIT = 530 / 1280;

export const WILDLIFE_ATLAS_FRAMES: Record<AnimalName, WildlifeAtlasFrame> = {
  lion: {
    frame: { x: 0, y: 0, width: 0.5, height: ATLAS_ROW_SPLIT },
    footBaseline: 0.92,
    width: 3,
    height: 1.85,
    position: [-3.2, -1],
    mobilePosition: [-1.7, -0.7],
  },
  tiger: {
    frame: { x: 0.5, y: 0, width: 0.5, height: ATLAS_ROW_SPLIT },
    footBaseline: 0.92,
    width: 3,
    height: 1.5,
    position: [3.5, -4],
    mobilePosition: [1.65, -1.3],
  },
  giraffe: {
    frame: { x: 0, y: ATLAS_ROW_SPLIT, width: 0.5, height: 1 - ATLAS_ROW_SPLIT },
    footBaseline: 0.92,
    width: 1.8,
    height: 4.4,
    position: [5.6, -12],
    mobilePosition: [0.45, -9],
  },
  zebra: {
    frame: { x: 0.5, y: ATLAS_ROW_SPLIT, width: 0.5, height: 1 - ATLAS_ROW_SPLIT },
    footBaseline: 0.92,
    width: 2.6,
    height: 1.8,
    position: [-5.8, -15.5],
  },
};

export interface RealisticWildlife3D {
  group: Group;
  readonly ready: boolean;
  update(time: number, power?: number): void;
  dispose(): void;
}

interface AnimalPlane {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  width: number;
  height: number;
  groundY: number;
  footBaseline: number;
  phase: number;
}

interface CroppedFrame {
  bounds: WildlifeAtlasRectangle;
  footBaseline: number;
}

/** Read alpha only; the saved photograph and its transparency remain untouched. */
export function scanAnimalBounds(
  image: HTMLImageElement,
  frame: WildlifeAtlasFrame,
): CroppedFrame {
  if (frame.bounds) return { bounds: frame.bounds, footBaseline: frame.footBaseline };

  const fallback = { bounds: frame.frame, footBaseline: frame.footBaseline };
  if (typeof document === "undefined") return fallback;

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const frameX = Math.round(frame.frame.x * imageWidth);
  const frameY = Math.round(frame.frame.y * imageHeight);
  const frameWidth = Math.round(frame.frame.width * imageWidth);
  const frameHeight = Math.round(frame.frame.height * imageHeight);
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !frameWidth || !frameHeight) return fallback;

  try {
    context.drawImage(image, frameX, frameY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    const { data } = context.getImageData(0, 0, frameWidth, frameHeight);
    let left = frameWidth;
    let top = frameHeight;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        if (data[(y * frameWidth + x) * 4 + 3] < 32) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) return fallback;

    // Two pixels retain fine fur and antialiasing while removing empty atlas space.
    const cropLeft = Math.max(0, left - 2);
    const cropTop = Math.max(0, top - 2);
    const cropRight = Math.min(frameWidth, right + 3);
    const cropBottom = Math.min(frameHeight, bottom + 3);
    return {
      bounds: {
        x: (frameX + cropLeft) / imageWidth,
        y: (frameY + cropTop) / imageHeight,
        width: (cropRight - cropLeft) / imageWidth,
        height: (cropBottom - cropTop) / imageHeight,
      },
      footBaseline: (bottom + 1 - cropTop) / (cropBottom - cropTop),
    };
  } catch {
    // Same-origin assets allow scanning; explicit atlas frames also work without it.
    return fallback;
  }
}

function makeContactShadow(): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(31, 29, 18, 0.62)");
  gradient.addColorStop(0.28, "rgba(31, 29, 18, 0.44)");
  gradient.addColorStop(0.65, "rgba(31, 29, 18, 0.17)");
  gradient.addColorStop(1, "rgba(31, 29, 18, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Photographic, depth-tested wildlife set among the scene's grass and trees. */
export function createRealisticWildlife3D(
  mobile: boolean,
  terrainHeight: (x: number, z: number) => number,
  onReady?: () => void,
): RealisticWildlife3D {
  const group = new Group();
  group.name = "photographic-grassland-wildlife";
  group.visible = false;
  const geometries = new Set<PlaneGeometry>();
  const materials = new Set<MeshBasicMaterial>();
  const textures = new Set<Texture>();
  const animals: AnimalPlane[] = [];
  let disposed = false;
  let ready = false;

  const atlas = new TextureLoader().load("/nature/wildlife-atlas.png", (loaded) => {
    if (disposed) {
      loaded.dispose();
      return;
    }
    loaded.colorSpace = SRGBColorSpace;
    loaded.wrapS = ClampToEdgeWrapping;
    loaded.wrapT = ClampToEdgeWrapping;
    // Atlas mipmaps can borrow neighboring silhouettes at their borders.
    loaded.generateMipmaps = false;
    loaded.minFilter = LinearFilter;
    loaded.magFilter = LinearFilter;
    const image = loaded.image as HTMLImageElement;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const shadowTexture = makeContactShadow();
    if (shadowTexture) textures.add(shadowTexture);
    const names: AnimalName[] = mobile ? ["lion", "tiger", "giraffe"] : ["lion", "tiger", "giraffe", "zebra"];

    names.forEach((name, index) => {
      const spec = WILDLIFE_ATLAS_FRAMES[name];
      const crop = scanAnimalBounds(image, spec);
      const map = loaded.clone();
      map.offset.set(crop.bounds.x, 1 - crop.bounds.y - crop.bounds.height);
      map.repeat.set(crop.bounds.width, crop.bounds.height);
      map.needsUpdate = true;
      textures.add(map);

      const aspect = crop.bounds.width * imageWidth / (crop.bounds.height * imageHeight);
      const height = spec.height ?? spec.width / aspect;
      const width = spec.height ? height * aspect : spec.width;
      const geometry = new PlaneGeometry(1, 1);
      geometry.translate(0, 0.5, 0);
      geometries.add(geometry);
      const material = new MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.035,
        side: DoubleSide,
        depthWrite: true,
        toneMapped: false,
      });
      materials.add(material);
      const mesh = new Mesh(geometry, material);
      mesh.name = `photographic-${name}`;
      const [x, z] = mobile && spec.mobilePosition ? spec.mobilePosition : spec.position;
      const groundY = terrainHeight(x, z) + 0.012;
      mesh.position.set(x, groundY - height * (1 - crop.footBaseline), z);
      // Vertical billboards face the nominal camera, retaining upright anatomy.
      mesh.rotation.y = Math.atan2(-x, 16 - z);
      mesh.scale.set(width, height, 1);
      group.add(mesh);
      animals.push({ mesh, width, height, groundY, footBaseline: crop.footBaseline, phase: index * 1.7 });

      if (shadowTexture) {
        const shadowGeometry = new PlaneGeometry(width * 0.85, Math.max(0.35, width * 0.24), 8, 3);
        shadowGeometry.rotateX(-Math.PI / 2);
        shadowGeometry.rotateY(mesh.rotation.y);
        shadowGeometry.translate(x, 0, z);
        const shadowPositions = shadowGeometry.getAttribute("position");
        for (let vertex = 0; vertex < shadowPositions.count; vertex += 1) {
          shadowPositions.setY(vertex,
            terrainHeight(shadowPositions.getX(vertex), shadowPositions.getZ(vertex)) + 0.024);
        }
        shadowGeometry.computeBoundingSphere();
        geometries.add(shadowGeometry);
        const shadowMaterial = new MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          opacity: name === "giraffe" ? 0.48 : 0.65,
          depthWrite: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        materials.add(shadowMaterial);
        const shadow = new Mesh(shadowGeometry, shadowMaterial);
        shadow.name = `${name}-contact-shadow`;
        group.add(shadow);
      }
    });

    ready = true;
    group.visible = true;
    onReady?.();
  }, undefined, () => {
    // The caller's existing wildlife remains visible when the asset cannot load.
  });
  textures.add(atlas);

  return {
    group,
    get ready() { return ready; },
    update(time, power = 0.4) {
      if (disposed || !ready || !Number.isFinite(time)) return;
      const strength = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0.4;
      for (const animal of animals) {
        const breath = Math.sin(time * 1.3 + animal.phase) * 0.004 * strength;
        const height = animal.height * (1 + breath);
        animal.mesh.scale.set(animal.width * (1 + breath * 0.2), height, 1);
        animal.mesh.position.y = animal.groundY - height * (1 - animal.footBaseline);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ready = false;
      group.removeFromParent();
      group.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      geometries.clear();
      materials.clear();
      textures.clear();
      animals.length = 0;
    },
  };
}
