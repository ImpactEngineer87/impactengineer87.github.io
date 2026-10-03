import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, Group, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Quaternion, Vector3,
} from "three";

export const BRANCH_NAVIGATION = [
  { id: "home", desktop: [.21, .48], mobile: [.25, .41], depth: 10, angle: -12, side: -1 },
  { id: "about", desktop: [.24, .70], mobile: [.25, .57], depth: 9, angle: 7, side: -1 },
  { id: "experience", desktop: [.81, .45], mobile: [.75, .46], depth: 11, angle: 8, side: 1 },
  { id: "work", desktop: [.79, .64], mobile: [.75, .57], depth: 9, angle: -8, side: 1 },
  { id: "contact", desktop: [.83, .81], mobile: [.25, .79], depth: 9.5, angle: 4, side: 1 },
];

export const LEAF_STEM = { x: 8 / 240, y: 137 / 150 };

export function navigationLeafWidth(width: number) {
  return width <= 650 ? Math.max(136, Math.min(width * .39, 185))
    : width <= 1000 ? 195 : Math.max(175, Math.min(width * .175, 245));
}

function taperedBranch(points: Vector3[], radius: number) {
  const curve = new CatmullRomCurve3(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rings = 18;
  const sides = 8;
  const up = new Vector3(0, 1, 0);
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const center = curve.getPoint(t);
    const orientation = new Quaternion().setFromUnitVectors(up, curve.getTangent(t));
    const thickness = radius * Math.pow(1 - t, .85) + .012;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const offset = new Vector3(Math.cos(angle) * thickness, 0, Math.sin(angle) * thickness).applyQuaternion(orientation);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      uvs.push(side / sides * 2, t * curve.getLength() * .45);
      if (ring < rings && side < sides) {
        const a = ring * (sides + 1) + side;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** HTML leaf stems and real tree branches use exactly the same world point. */
export function createGrasslandNavigation3D(material: MeshStandardMaterial) {
  const group = new Group();
  group.name = "Five navigation leaves attached to tree branches";
  const anchors = BRANCH_NAVIGATION.map((item) => ({ ...item, base: new Vector3() }));
  const geometries: BufferGeometry[] = [];
  const disposeGeometry = () => {
    geometries.forEach((geometry) => geometry.dispose());
    geometries.length = 0;
    group.clear();
  };
  return {
    group,
    anchors,
    measure(camera: PerspectiveCamera, width: number, height: number) {
      disposeGeometry();
      const mobile = width <= 650;
      const leafWidth = navigationLeafWidth(width);
      const leafHeight = leafWidth / 1.6;
      for (const anchor of anchors) {
        const [x, y] = mobile ? anchor.mobile : anchor.desktop;
        const angle = anchor.angle * Math.PI / 180;
        const dx = (.5 - LEAF_STEM.x) * leafWidth;
        const dy = (.5 - LEAF_STEM.y) * leafHeight;
        const stemX = x * width - (dx * Math.cos(angle) - dy * Math.sin(angle));
        const stemY = y * height - (dx * Math.sin(angle) + dy * Math.cos(angle));
        anchor.base.set(stemX / width * 2 - 1, 1 - stemY / height * 2, .5)
          .unproject(camera).sub(camera.position).normalize().multiplyScalar(anchor.depth).add(camera.position);
        const side = mobile && anchor.id === "contact" ? -1 : anchor.side;
        const trunkX = mobile ? (side < 0 ? -2.95 : 3.05) : (side < 0 ? -6.2 : 6.55);
        const trunkZ = side < 0 ? 3 : 1.2;
        const start = new Vector3(trunkX, Math.max(.65, anchor.base.y + .6), trunkZ);
        const middle = start.clone().lerp(anchor.base, .46).add(new Vector3(-side * .24, .12, -.12));
        const elbow = start.clone().lerp(anchor.base, .78).add(new Vector3(-side * .12, -.08, 0));
        const geometry = taperedBranch([start, middle, elbow, anchor.base], mobile ? .105 : .16);
        geometries.push(geometry);
        const branch = new Mesh(geometry, material);
        branch.name = `${anchor.id}-navigation-branch`;
        branch.castShadow = true;
        branch.receiveShadow = true;
        group.add(branch);
        const twigStart = middle.clone().lerp(elbow, .35);
        const twigEnd = twigStart.clone().add(new Vector3(side * .35, .38, -.2));
        const twigGeometry = taperedBranch([twigStart, twigStart.clone().lerp(twigEnd, .5), twigEnd], .035);
        geometries.push(twigGeometry);
        const twig = new Mesh(twigGeometry, material);
        twig.castShadow = true;
        group.add(twig);
      }
    },
    dispose: disposeGeometry,
  };
}
