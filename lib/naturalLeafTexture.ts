type Point = { x: number; y: number };
type LeafPalette = {
  body: [number, number, number];
  vein: string;
  shadow: string;
  dry?: boolean;
};

const WIDTH = 960;
const HEIGHT = 600;
const SCALE = 4;
const surfaces = new Map<string, string>();
const palettes: Record<string, LeafPalette> = {
  sage: { body: [132, 163, 81], vein: "#c9d995", shadow: "#314c1e" },
  moss: { body: [88, 134, 61], vein: "#b9cf88", shadow: "#203d17" },
  olive: { body: [142, 158, 64], vein: "#d4d694", shadow: "#454f1b" },
  gold: { body: [195, 166, 66], vein: "#e7cf94", shadow: "#756026", dry: true },
  amber: { body: [201, 146, 61], vein: "#eed09b", shadow: "#805326", dry: true },
};

function seededRandom(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function bezier(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

const outlineCurves: [Point, Point, Point, Point][] = [
  [{ x: 29, y: 108 }, { x: 34, y: 72 }, { x: 56, y: 38 }, { x: 94, y: 24 }],
  [{ x: 94, y: 24 }, { x: 133, y: 9 }, { x: 183, y: 14 }, { x: 230, y: 19 }],
  [{ x: 230, y: 19 }, { x: 213, y: 43 }, { x: 215, y: 64 }, { x: 192, y: 87 }],
  [{ x: 192, y: 87 }, { x: 161, y: 118 }, { x: 112, y: 137 }, { x: 77, y: 131 }],
  [{ x: 77, y: 131 }, { x: 56, y: 127 }, { x: 42, y: 119 }, { x: 29, y: 108 }],
];
const outline = outlineCurves.flatMap((curve) =>
  Array.from({ length: 16 }, (_, index) => bezier(...curve, index / 16)));

function insideLeaf(point: Point) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function traceOutline(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.moveTo(29, 108);
  for (const [, b, c, d] of outlineCurves) context.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y);
  context.closePath();
}

function makeNoiseGrid(columns: number, rows: number, random: () => number) {
  const values = Float32Array.from({ length: (columns + 1) * (rows + 1) }, random);
  return { columns, rows, values };
}

function sampleNoise(grid: ReturnType<typeof makeNoiseGrid>, x: number, y: number) {
  const gx = x * grid.columns / WIDTH;
  const gy = y * grid.rows / HEIGHT;
  const column = Math.floor(gx);
  const row = Math.floor(gy);
  const sx = gx - column;
  const sy = gy - row;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);
  const a = row * (grid.columns + 1) + column;
  const b = a + grid.columns + 1;
  const top = grid.values[a] + (grid.values[a + 1] - grid.values[a]) * u;
  const bottom = grid.values[b] + (grid.values[b + 1] - grid.values[b]) * u;
  return top + (bottom - top) * v;
}

let leafField: { shade: Float32Array; warmth: Float32Array } | null = null;

/** Reuse the microscopic structure across pigments instead of rebuilding it five times. */
function getLeafField() {
  if (leafField) return leafField;
  const random = seededRandom(924718);
  const broad = makeNoiseGrid(16, 10, random);
  const mottling = makeNoiseGrid(49, 31, random);
  const fine = makeNoiseGrid(133, 83, random);
  const spacing = 11;
  const columns = Math.ceil(WIDTH / spacing) + 3;
  const rows = Math.ceil(HEIGHT / spacing) + 3;
  const cellX = new Float32Array(columns * rows);
  const cellY = new Float32Array(columns * rows);
  const cellShade = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      cellX[index] = (column - 1 + .12 + random() * .76) * spacing;
      cellY[index] = (row - 1 + .12 + random() * .76) * spacing;
      cellShade[index] = random() - .5;
    }
  }
  const shade = new Float32Array(WIDTH * HEIGHT);
  const warmth = new Float32Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const column = Math.floor(x / spacing) + 1;
      const row = Math.floor(y / spacing) + 1;
      let nearest = Infinity;
      let next = Infinity;
      let pigment = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const index = (row + dy) * columns + column + dx;
          const deltaX = x - cellX[index];
          const deltaY = (y - cellY[index]) * 1.18;
          const distance = deltaX * deltaX + deltaY * deltaY;
          if (distance < nearest) {
            next = nearest;
            nearest = distance;
            pigment = cellShade[index];
          } else if (distance < next) next = distance;
        }
      }
      // Thin, irregular cell walls are far subtler than the major vein network.
      const wall = Math.max(0, 1 - (next - nearest) / 12);
      const cloudy = sampleNoise(broad, x, y);
      const patch = sampleNoise(mottling, x, y);
      const texture = sampleNoise(fine, x, y);
      const index = y * WIDTH + x;
      shade[index] = .81 + cloudy * .19 + (patch - .5) * .13
        + (texture - .5) * .055 + pigment * .035 - wall * .034 + (random() - .5) * .045;
      warmth[index] = (patch - .5) * 1.15 + (cloudy - .5) * .55;
    }
  }
  leafField = { shade, warmth };
  return leafField;
}

const ribCurve: [Point, Point, Point, Point] = [
  { x: 27, y: 111 }, { x: 86, y: 92 }, { x: 163, y: 54 }, { x: 230, y: 19 },
];

function traceCurve(context: CanvasRenderingContext2D, curve: [Point, Point, Point, Point], offset = 0) {
  context.beginPath();
  context.moveTo(curve[0].x + offset, curve[0].y + offset);
  context.bezierCurveTo(curve[1].x + offset, curve[1].y + offset,
    curve[2].x + offset, curve[2].y + offset, curve[3].x + offset, curve[3].y + offset);
}

function paintVeins(context: CanvasRenderingContext2D, palette: LeafPalette, random: () => number) {
  context.lineCap = "round";
  context.lineJoin = "round";
  // A tiny shadow beside each vein gives the tissue a raised, uneven surface.
  const strokeVein = (curve: [Point, Point, Point, Point], thickness: number, opacity: number) => {
    context.globalAlpha = opacity * .53;
    context.strokeStyle = palette.shadow;
    context.lineWidth = thickness * 1.85;
    traceCurve(context, curve, .2);
    context.stroke();
    context.globalAlpha = opacity;
    context.strokeStyle = palette.vein;
    context.lineWidth = thickness;
    traceCurve(context, curve, -.11);
    context.stroke();
  };
  for (const side of [-1, 1]) {
    const count = side < 0 ? 11 : 10;
    for (let index = 0; index < count; index++) {
      const t = .072 + index / count * .87 + (random() - .5) * .025;
      const start = bezier(...ribCurve, t);
      const ahead = bezier(...ribCurve, Math.min(1, t + .02));
      const magnitude = Math.hypot(ahead.x - start.x, ahead.y - start.y);
      const tangent = { x: (ahead.x - start.x) / magnitude, y: (ahead.y - start.y) / magnitude };
      const normal = { x: -tangent.y * side, y: tangent.x * side };
      const lean = .15 + random() * .27;
      let extent = .5;
      for (let distance = 1; distance < 85; distance += .5) {
        if (!insideLeaf({ x: start.x + (normal.x + tangent.x * lean) * distance,
          y: start.y + (normal.y + tangent.y * lean) * distance })) break;
        extent = distance;
      }
      extent *= .92 + random() * .04;
      if (extent < 2) continue;
      const end = { x: start.x + (normal.x + tangent.x * lean) * extent,
        y: start.y + (normal.y + tangent.y * lean) * extent };
      const curve: [Point, Point, Point, Point] = [start,
        { x: start.x + normal.x * extent * .23 + tangent.x * extent * .30,
          y: start.y + normal.y * extent * .23 + tangent.y * extent * .30 },
        { x: end.x - normal.x * extent * .25 - tangent.x * extent * .11,
          y: end.y - normal.y * extent * .25 - tangent.y * extent * .11 }, end];
      strokeVein(curve, .29 + (1 - t) * .32 + random() * .13, .33 + random() * .18);
      // Successive forks form a reticulate network instead of parallel painted stripes.
      for (let fork = 0; fork < 4; fork++) {
        const f = .20 + fork * .18 + (random() - .5) * .08;
        const root = bezier(...curve, f);
        const next = bezier(...curve, Math.min(1, f + .025));
        const length = Math.hypot(next.x - root.x, next.y - root.y);
        const direction = { x: (next.x - root.x) / length, y: (next.y - root.y) / length };
        for (const branchSide of [-1, 1]) {
          const twigLength = Math.min(extent * (.1 + random() * .09), 8.5);
          const tip = { x: root.x + (direction.x * .45 - direction.y * branchSide) * twigLength,
            y: root.y + (direction.y * .45 + direction.x * branchSide) * twigLength };
          const twig: [Point, Point, Point, Point] = [root,
            { x: root.x + direction.x * twigLength * .45, y: root.y + direction.y * twigLength * .45 },
            { x: tip.x - direction.x * twigLength * .25, y: tip.y - direction.y * twigLength * .25 }, tip];
          strokeVein(twig, .12 + random() * .08, .19 + random() * .12);
          const junction = bezier(...twig, .58 + random() * .2);
          const tinyTip = { x: junction.x + direction.x * twigLength * .43,
            y: junction.y + direction.y * twigLength * .43 };
          strokeVein([junction, { x: junction.x + direction.x, y: junction.y + direction.y },
            { x: tinyTip.x - direction.y * .3, y: tinyTip.y + direction.x * .3 }, tinyTip], .09, .15);
        }
      }
    }
  }
  // The midrib tapers continuously from the petiole into the pointed tip.
  for (let index = 0; index < 38; index++) {
    const start = bezier(...ribCurve, index / 38);
    const end = bezier(...ribCurve, (index + 1) / 38);
    const middle = { x: (start.x + end.x) * .5, y: (start.y + end.y) * .5 };
    strokeVein([start, middle, middle, end], 1.28 * Math.pow(1 - index / 38, .6) + .12, .66);
  }
  context.globalAlpha = 1;
}

/** A local macro leaf surface, aligned to the existing 240×150 botanical silhouette. */
export function createNavigationLeafSurface(color: string): string | null {
  if (typeof document === "undefined") return null;
  const requested = color.trim().toLowerCase();
  const key = Object.hasOwn(palettes, requested) ? requested : "sage";
  const cached = surfaces.get(key);
  if (cached) return cached;
  const palette = palettes[key];
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const field = getLeafField();
  const pixels = context.createImageData(WIDTH, HEIGHT);
  const [red, green, blue] = palette.body;
  for (let index = 0; index < field.shade.length; index++) {
    const shade = field.shade[index];
    const warmth = field.warmth[index];
    const pixel = index * 4;
    pixels.data[pixel] = red * shade + warmth * (palette.dry ? 11 : 13);
    pixels.data[pixel + 1] = green * shade + warmth * (palette.dry ? 3 : 5);
    pixels.data[pixel + 2] = blue * shade - warmth * 9;
    pixels.data[pixel + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  context.scale(SCALE, SCALE);
  context.save();
  traceOutline(context);
  context.clip();
  const random = seededRandom(58132);

  // Broad, broken reflections mimic wax on gently folded tissue.
  context.filter = "blur(9px)";
  for (let index = 0; index < 7; index++) {
    const x = 49 + random() * 137;
    const y = 30 + random() * 77;
    const reflection = context.createRadialGradient(x, y, 0, x, y, 22 + random() * 12);
    reflection.addColorStop(0, `rgba(242,248,205,${.055 + random() * .08})`);
    reflection.addColorStop(.55, "rgba(234,246,212,.035)");
    reflection.addColorStop(1, "rgba(234,246,212,0)");
    context.fillStyle = reflection;
    context.beginPath();
    context.ellipse(x, y, 29 + random() * 17, 8 + random() * 8, -.42, 0, Math.PI * 2);
    context.fill();
  }
  context.filter = "none";

  // Irregular pigment flecks give dry leaves a little extra age and texture.
  for (let index = 0; index < (palette.dry ? 920 : 520); index++) {
    const x = 29 + random() * 201;
    const y = 15 + random() * 120;
    const radius = .09 + Math.pow(random(), 3) * (palette.dry ? .58 : .36);
    context.fillStyle = index % 4 === 0 ? "rgba(228,232,166,.14)"
      : palette.dry ? "rgba(105,76,29,.15)" : "rgba(32,75,23,.12)";
    context.beginPath();
    context.ellipse(x, y, radius, radius * (.5 + random() * .6), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.filter = "blur(3px)";
  context.globalAlpha = .18;
  context.strokeStyle = palette.shadow;
  context.lineWidth = 4.2;
  traceOutline(context);
  context.stroke();
  context.filter = "none";
  context.globalAlpha = 1;
  paintVeins(context, palette, random);
  context.restore();
  const surface = canvas.toDataURL("image/png");
  surfaces.set(key, surface);
  return surface;
}
