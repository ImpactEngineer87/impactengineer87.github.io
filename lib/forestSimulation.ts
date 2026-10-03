export type LeafState = "flying" | "caught";
export type BirdState = "cruise" | "hunt" | "eat";

export interface ForestWind {
  /** Strength from 0 (still) to 1 (a strong gust). */
  power: number;
  /** Air movement in pixels per second. */
  speed: number;
  /** Radians: 0 points right; PI / 2 points down. */
  direction: number;
  x: number;
  y: number;
}

export interface ForestLeaf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  size: number;
  depth: number;
  opacity: number;
  color: number;
  flutterPhase: number;
  state: LeafState;
  caughtBy: number | null;
}

export interface ForestBird {
  id: number;
  x: number;
  y: number;
  heading: number;
  wingPhase: number;
  scale: number;
  state: BirdState;
  targetLeafId: number | null;
}

export interface ForestSimulationOptions {
  leafCount?: number;
  birdCount?: number;
  /** An injectable random source makes the simulation reproducible. */
  random?: () => number;
}

export interface ForestStats {
  caughtLeaves: number;
  consumedLeaves: number;
  respawnedLeaves: number;
}

interface MovingLeaf extends ForestLeaf {
  age: number;
  lifetime: number;
  originalSize: number;
  originalOpacity: number;
  spin: number;
  flutterSpeed: number;
}

interface MovingBird extends ForestBird {
  speed: number;
  destinationX: number;
  destinationY: number;
  timer: number;
  huntCooldown: number;
}

const TWO_PI = Math.PI * 2;
const FIXED_STEP = 1 / 120;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const dimension = (value: number) =>
  Number.isFinite(value) ? Math.max(1, value) : 1;
const turnDifference = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));

/** A small, deterministic-at-a-fixed-seed simulation, independent of the DOM. */
export class ForestSimulation {
  readonly leaves: MovingLeaf[] = [];
  readonly birds: MovingBird[] = [];
  readonly wind: ForestWind = {
    power: 0.38,
    speed: 35,
    direction: -0.12,
    x: 0,
    y: 0,
  };
  readonly stats: ForestStats = {
    caughtLeaves: 0,
    consumedLeaves: 0,
    respawnedLeaves: 0,
  };
  width: number;
  height: number;

  private readonly randomSource: () => number;
  private accumulator = 0;
  private elapsed = 0;
  private windTimer = 0;
  private desiredPower = 0.38;
  private desiredSpeed = 35;
  private desiredDirection = -0.12;

  constructor(width: number, height: number, options: ForestSimulationOptions = {}) {
    this.width = dimension(width);
    this.height = dimension(height);
    this.randomSource = options.random ?? Math.random;
    this.chooseWind();
    this.updateWind(0);

    const leafCount = this.population(options.leafCount, 42, 100);
    const birdCount = this.population(options.birdCount, 5, 12);
    for (let id = 0; id < leafCount; id += 1) {
      const leaf: MovingLeaf = {
        id, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, size: 0,
        depth: 0, opacity: 1, color: 0, flutterPhase: 0,
        state: "flying", caughtBy: null, age: 0, lifetime: 0,
        originalSize: 0, originalOpacity: 1, spin: 0, flutterSpeed: 0,
      };
      this.resetLeaf(leaf, true);
      this.leaves.push(leaf);
    }
    for (let id = 0; id < birdCount; id += 1) {
      const left = id % 2 === 0;
      const bird: MovingBird = {
        id,
        x: this.width * this.between(left ? 0.05 : 0.73, left ? 0.27 : 0.95),
        y: this.height * this.between(0.2, 0.66),
        heading: left ? -0.15 : Math.PI + 0.15,
        wingPhase: this.between(0, TWO_PI),
        scale: this.between(0.7, 1.4),
        state: "cruise",
        targetLeafId: null,
        speed: this.between(66, 100),
        destinationX: 0,
        destinationY: 0,
        timer: this.between(1, 3),
        huntCooldown: this.between(0.7, 3.8),
      };
      this.chooseDestination(bird);
      this.birds.push(bird);
    }
  }

  resize(width: number, height: number) {
    const nextWidth = dimension(width);
    const nextHeight = dimension(height);
    const scaleX = nextWidth / this.width;
    const scaleY = nextHeight / this.height;
    for (const leaf of this.leaves) {
      leaf.x *= scaleX;
      leaf.y *= scaleY;
    }
    for (const bird of this.birds) {
      bird.x *= scaleX;
      bird.y *= scaleY;
      bird.destinationX *= scaleX;
      bird.destinationY *= scaleY;
    }
    this.width = nextWidth;
    this.height = nextHeight;
  }

  /** Ignore tab-resume jumps; integrate ordinary frame times in fixed steps. */
  step(dtSeconds: number) {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    this.accumulator += Math.min(dtSeconds, 0.25);
    while (this.accumulator + Number.EPSILON >= FIXED_STEP) {
      this.tick(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
  }

  /** Navigation interactions can send a brief breeze through the clearing. */
  gust(strength = 0.85) {
    const power = Number.isFinite(strength) ? clamp(strength, 0, 1) : 0.85;
    this.desiredPower = Math.max(this.wind.power, power);
    this.desiredSpeed = this.between(65, 94) * (0.55 + power * 0.45);
    this.desiredDirection = this.wind.direction + this.between(-0.16, 0.16);
    this.windTimer = this.between(1.4, 2.4);
  }

  private population(value: number | undefined, fallback: number, maximum: number) {
    return value === undefined || !Number.isFinite(value)
      ? fallback
      : clamp(Math.floor(value), 0, maximum);
  }

  private random() {
    const value = this.randomSource();
    return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5;
  }

  private between(minimum: number, maximum: number) {
    return minimum + this.random() * (maximum - minimum);
  }

  private chooseWind() {
    this.desiredPower = this.between(0.15, 0.9);
    this.desiredSpeed = this.between(17, 82);
    this.desiredDirection = (this.random() < 0.78 ? 0 : Math.PI) + this.between(-0.24, 0.16);
    this.windTimer = this.between(3.5, 9);
  }

  private updateWind(dt: number) {
    this.windTimer -= dt;
    if (this.windTimer <= 0) this.chooseWind();
    const blend = 1 - Math.exp(-dt * 0.65);
    this.wind.power += (this.desiredPower - this.wind.power) * blend;
    this.wind.speed += (this.desiredSpeed - this.wind.speed) * blend;
    this.wind.direction += turnDifference(this.desiredDirection, this.wind.direction) * blend;
    this.wind.direction = Math.atan2(Math.sin(this.wind.direction), Math.cos(this.wind.direction));
    this.wind.x = Math.cos(this.wind.direction) * this.wind.power;
    this.wind.y = Math.sin(this.wind.direction) * this.wind.power;
  }

  private resetLeaf(leaf: MovingLeaf, initial = false) {
    const left = this.random() < 0.5;
    // Falling foliage originates from the canopies on either side of the road.
    leaf.x = this.width * this.between(left ? 0.01 : 0.69, left ? 0.32 : 0.99);
    leaf.y = this.height * this.between(initial ? 0.08 : 0.03, initial ? 0.88 : 0.44);
    leaf.depth = this.between(0.2, 1);
    leaf.originalSize = this.between(5, 11) * (0.75 + leaf.depth * 0.45);
    leaf.size = leaf.originalSize;
    leaf.originalOpacity = 0.5 + leaf.depth * 0.42;
    leaf.opacity = initial ? leaf.originalOpacity : 0;
    leaf.color = Math.floor(this.between(0, 4));
    leaf.rotation = this.between(0, TWO_PI);
    leaf.flutterPhase = this.between(0, TWO_PI);
    leaf.flutterSpeed = this.between(1.7, 4.7);
    leaf.spin = this.between(-1.9, 1.9);
    leaf.age = initial ? this.between(0.5, 5) : 0;
    leaf.lifetime = this.between(18, 36);
    leaf.vx = Math.cos(this.wind.direction) * this.wind.speed * (0.5 + leaf.depth * 0.48);
    leaf.vy = 7 + leaf.depth * 10;
    leaf.state = "flying";
    leaf.caughtBy = null;
    if (!initial) this.stats.respawnedLeaves += 1;
  }

  private chooseDestination(bird: MovingBird) {
    const left = this.random() < 0.5;
    bird.destinationX = this.width * this.between(left ? 0.06 : 0.72, left ? 0.3 : 0.95);
    bird.destinationY = this.height * this.between(0.26, 0.78);
    bird.timer = this.between(2.5, 5.5);
  }

  private findLeaf(bird: MovingBird) {
    let best: MovingLeaf | undefined;
    let bestDistance = Infinity;
    for (const leaf of this.leaves) {
      if (leaf.state !== "flying" || leaf.age < 0.65) continue;
      if (leaf.x > this.width * 0.32 && leaf.x < this.width * 0.68 && leaf.y < this.height * 0.4) continue;
      if (leaf.x < 4 || leaf.x > this.width - 4 || leaf.y < 8 || leaf.y > this.height * 0.86) continue;
      if (this.birds.some((other) => other !== bird && other.targetLeafId === leaf.id)) continue;
      const distance = Math.hypot(leaf.x - bird.x, leaf.y - bird.y);
      if (distance < bestDistance) {
        best = leaf;
        bestDistance = distance;
      }
    }
    return best;
  }

  private releaseBird(bird: MovingBird) {
    bird.state = "cruise";
    bird.targetLeafId = null;
    bird.huntCooldown = this.between(4, 9);
    this.chooseDestination(bird);
  }

  private tick(dt: number) {
    this.elapsed += dt;
    this.updateWind(dt);
    for (const leaf of this.leaves) {
      if (leaf.state === "caught") continue;
      leaf.age += dt;
      leaf.flutterPhase = (leaf.flutterPhase + dt * leaf.flutterSpeed) % TWO_PI;
      const flutter = Math.sin(leaf.flutterPhase);
      const breeze = this.wind.speed * (0.5 + leaf.depth * 0.48);
      const desiredVx = Math.cos(this.wind.direction) * breeze + flutter * 9;
      const desiredVy = Math.sin(this.wind.direction) * breeze * 0.45 + 8 + leaf.depth * 13
        + Math.cos(leaf.flutterPhase * 0.8) * 8;
      const drag = 1 - Math.exp(-dt * 1.5);
      leaf.vx += (desiredVx - leaf.vx) * drag;
      leaf.vy += (desiredVy - leaf.vy) * drag;
      leaf.x += leaf.vx * dt;
      leaf.y += leaf.vy * dt;
      leaf.rotation = (leaf.rotation + dt * (leaf.spin + flutter * this.wind.power)) % TWO_PI;
      leaf.opacity = leaf.originalOpacity * clamp(leaf.age / 0.7, 0, 1);
      if (leaf.x < -35 || leaf.x > this.width + 35 || leaf.y > this.height + 35
        || leaf.y < -35 || leaf.age > leaf.lifetime) this.resetLeaf(leaf);
    }

    for (const bird of this.birds) {
      bird.timer -= dt;
      bird.huntCooldown -= dt;
      let targetX = bird.destinationX;
      let targetY = bird.destinationY;
      let speed = bird.speed;
      let leaf = bird.targetLeafId === null ? undefined : this.leaves[bird.targetLeafId];

      if (bird.state === "cruise" && bird.huntCooldown <= 0) {
        leaf = this.findLeaf(bird);
        if (leaf) {
          bird.state = "hunt";
          bird.targetLeafId = leaf.id;
          bird.timer = 9;
        } else bird.huntCooldown = 1.5;
      }

      if (bird.state === "hunt") {
        if (!leaf || leaf.state !== "flying" || bird.timer <= 0) {
          this.releaseBird(bird);
        } else {
          targetX = leaf.x + leaf.vx * 0.18;
          targetY = leaf.y + leaf.vy * 0.18;
          speed = Math.max(bird.speed * 1.32, Math.hypot(leaf.vx, leaf.vy) + 42);
          if (Math.hypot(leaf.x - bird.x, leaf.y - bird.y) < 10 * bird.scale + leaf.size * 0.65) {
            bird.state = "eat";
            bird.timer = 1.05;
            leaf.state = "caught";
            leaf.caughtBy = bird.id;
            this.stats.caughtLeaves += 1;
            this.chooseDestination(bird);
            bird.timer = 1.05;
          }
        }
      }

      if (bird.state === "eat") {
        speed *= 0.56;
        if (leaf) {
          const remaining = clamp(bird.timer / 1.05, 0, 1);
          leaf.size = leaf.originalSize * (0.2 + remaining * 0.8);
          leaf.opacity = leaf.originalOpacity * remaining;
          leaf.rotation = bird.heading + Math.sin(this.elapsed * 17) * 0.25;
          if (bird.timer <= 0) {
            this.stats.consumedLeaves += 1;
            this.resetLeaf(leaf);
            this.releaseBird(bird);
          }
        } else this.releaseBird(bird);
      }

      if (bird.state === "cruise" && (bird.timer <= 0 || Math.hypot(targetX - bird.x, targetY - bird.y) < 35)) {
        this.chooseDestination(bird);
        targetX = bird.destinationX;
        targetY = bird.destinationY;
      }

      const desiredHeading = Math.atan2(targetY - bird.y, targetX - bird.x);
      bird.heading += clamp(turnDifference(desiredHeading, bird.heading), -dt * 3.4, dt * 3.4);
      bird.heading = Math.atan2(Math.sin(bird.heading), Math.cos(bird.heading));
      bird.x += (Math.cos(bird.heading) * speed + this.wind.x * 7) * dt;
      bird.y += (Math.sin(bird.heading) * speed + this.wind.y * 3) * dt;
      bird.wingPhase = (bird.wingPhase + dt * (bird.state === "hunt" ? 13 : 9.5)) % TWO_PI;
      bird.x = clamp(bird.x, -24, this.width + 24);
      bird.y = clamp(bird.y, -24, this.height + 24);

      if (bird.state === "eat" && leaf) {
        leaf.x = bird.x + Math.cos(bird.heading) * bird.scale * 11;
        leaf.y = bird.y + Math.sin(bird.heading) * bird.scale * 11;
        leaf.vx = 0;
        leaf.vy = 0;
      }
    }
  }
}

export function createForestSimulation(
  width: number,
  height: number,
  options: ForestSimulationOptions = {},
) {
  return new ForestSimulation(width, height, options);
}
