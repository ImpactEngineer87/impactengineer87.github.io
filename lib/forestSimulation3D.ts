export type ForestLeafState3D = "flying" | "caught";
export type ForestBirdState3D = "cruise" | "hunt" | "eat";

export interface ForestWind3D {
  /** Current air speed in km/h. */
  speed: number;
  power: number;
  /** Horizontal yaw: 0 blows along +X; PI / 2 blows along -Z. */
  direction: number;
  /** Horizontal air velocity in world units (metres) per second. */
  x: number;
  z: number;
}

export interface ForestLeaf3D {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  size: number;
  color: number;
  opacity: number;
  state: ForestLeafState3D;
  caughtBy: number | null;
}

export interface ForestBird3D {
  id: number;
  x: number;
  y: number;
  z: number;
  /** +X is the model's forward axis; yaw rotates toward -Z. */
  heading: number;
  /** Positive pitch raises the beak. */
  pitch: number;
  bank: number;
  wingPhase: number;
  /** Flapping blends into glides, rather than running continuously. */
  flapStrength: number;
  scale: number;
  state: ForestBirdState3D;
  targetLeafId: number | null;
}

export interface ForestSimulationOptions3D {
  leafCount?: number;
  birdCount?: number;
  random?: () => number;
}

export interface ForestStats3D {
  caughtLeaves: number;
  consumedLeaves: number;
  respawnedLeaves: number;
}

interface MovingLeaf extends ForestLeaf3D {
  age: number;
  lifetime: number;
  originalSize: number;
  originalOpacity: number;
  flutterPhase: number;
  flutterSpeed: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  windResponse: number;
}

interface MovingBird extends ForestBird3D {
  speed: number;
  cruiseSpeed: number;
  destinationX: number;
  destinationY: number;
  destinationZ: number;
  timer: number;
  huntCooldown: number;
  flapTimer: number;
  gliding: boolean;
}

const TAU = Math.PI * 2;
const FIXED_STEP = 1 / 120;
const EAT_DURATION = 1.35;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const angleDifference = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const blend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** A fixed-step, DOM-free simulation of a small clearing in world coordinates. */
export class ForestSimulation3D {
  readonly leaves: MovingLeaf[] = [];
  readonly birds: MovingBird[] = [];
  readonly wind: ForestWind3D = { speed: 12, power: 0.4, direction: 0, x: 0, z: 0 };
  readonly stats: ForestStats3D = { caughtLeaves: 0, consumedLeaves: 0, respawnedLeaves: 0 };

  private readonly randomSource: () => number;
  private elapsed = 0;
  private accumulator = 0;
  private windTimer = 0;
  private desiredSpeed = 12;
  private desiredPower = 0.4;
  private desiredDirection = 0;

  constructor(options: ForestSimulationOptions3D = {}) {
    this.randomSource = options.random ?? Math.random;
    this.chooseWind(true);
    this.wind.speed = this.desiredSpeed;
    this.wind.power = this.desiredPower;
    this.wind.direction = this.desiredDirection;
    this.updateWind(0);

    const leafCount = this.population(options.leafCount, 54, 100);
    const birdCount = this.population(options.birdCount, 5, 12);
    for (let id = 0; id < leafCount; id += 1) {
      const leaf: MovingLeaf = {
        id, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
        size: 0.2, color: 0, opacity: 1, state: "flying", caughtBy: null,
        age: 0, lifetime: 0, originalSize: 0.2, originalOpacity: 1,
        flutterPhase: 0, flutterSpeed: 0, spinX: 0, spinY: 0, spinZ: 0,
        windResponse: 1,
      };
      this.resetLeaf(leaf, true);
      this.leaves.push(leaf);
    }

    for (let id = 0; id < birdCount; id += 1) {
      const bird: MovingBird = {
        id,
        x: this.between(-7, 7),
        y: this.between(3, 8.5),
        z: this.between(-15, 8),
        heading: this.between(-Math.PI, Math.PI),
        pitch: 0,
        bank: 0,
        wingPhase: this.between(0, TAU),
        flapStrength: 1,
        scale: this.between(0.83, 1.15),
        state: "cruise",
        targetLeafId: null,
        speed: this.between(4.8, 6.4),
        cruiseSpeed: this.between(4.8, 6.4),
        destinationX: 0, destinationY: 0, destinationZ: 0,
        timer: 0,
        huntCooldown: 0.7 + id * 0.85,
        flapTimer: this.between(0.5, 2.5),
        gliding: false,
      };
      this.chooseDestination(bird);
      // Begin already aligned to the route, without a stationary first-frame turn.
      bird.heading = Math.atan2(-(bird.destinationZ - bird.z), bird.destinationX - bird.x);
      this.birds.push(bird);
    }
  }

  /** Clamp suspended-tab jumps and integrate at the same rate on every display. */
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP) {
      this.tick(FIXED_STEP);
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
    }
  }

  gust(power = 0.95) {
    const strength = Number.isFinite(power) ? clamp(power, 0, 1) : 0.95;
    this.desiredPower = Math.max(this.wind.power, strength);
    this.desiredSpeed = 5 + this.desiredPower * 19;
    this.desiredDirection = this.wind.direction + this.between(-0.3, 0.3);
    this.windTimer = this.between(1.7, 3.1);
  }

  private population(value: number | undefined, fallback: number, maximum: number) {
    return value === undefined || !Number.isFinite(value)
      ? fallback
      : clamp(Math.floor(value), 0, maximum);
  }

  private random() {
    const n = this.randomSource();
    return Number.isFinite(n) ? clamp(n, 0, 1 - Number.EPSILON) : 0.5;
  }

  private between(min: number, max: number) {
    return min + this.random() * (max - min);
  }

  private chooseWind(initial = false) {
    this.desiredSpeed = this.between(7, 24);
    this.desiredPower = clamp((this.desiredSpeed - 5) / 19, 0, 1);
    this.desiredDirection = initial
      ? this.between(-0.8, 0.8)
      : this.wind.direction + this.between(-0.9, 0.9);
    // Occasionally the breeze changes to the opposite side of the clearing.
    if (!initial && this.random() < 0.12) this.desiredDirection += Math.PI;
    this.windTimer = this.between(3.5, 8);
  }

  private updateWind(dt: number) {
    this.windTimer -= dt;
    if (this.windTimer <= 0) this.chooseWind();
    const amount = blend(0.62, dt);
    this.wind.speed += (this.desiredSpeed - this.wind.speed) * amount;
    this.wind.power += (this.desiredPower - this.wind.power) * amount;
    this.wind.direction = wrapAngle(this.wind.direction
      + angleDifference(this.desiredDirection, this.wind.direction) * amount);
    this.wind.x = Math.cos(this.wind.direction) * this.wind.speed / 3.6;
    this.wind.z = -Math.sin(this.wind.direction) * this.wind.speed / 3.6;
  }

  private resetLeaf(leaf: MovingLeaf, initial = false) {
    // Most leaves enter from nearby branches. A quarter drift across the path
    // close to the camera so their travel and tumbling remain easy to see.
    const foreground = leaf.id % 4 === 0;
    const side = this.random() < 0.5 ? -1 : 1;
    leaf.x = initial ? this.between(-10, 10) : side * this.between(5.5, 10);
    leaf.y = this.between(initial ? 1 : 4.5, foreground ? 8.5 : 11.5);
    leaf.z = foreground ? this.between(0, 11.5) : this.between(-25, 4);
    leaf.originalSize = this.between(0.14, 0.32);
    leaf.size = leaf.originalSize;
    leaf.color = Math.floor(this.between(0, 5));
    leaf.originalOpacity = this.between(0.83, 1);
    leaf.opacity = initial ? leaf.originalOpacity : 0;
    leaf.rx = this.between(-Math.PI, Math.PI);
    leaf.ry = this.between(-Math.PI, Math.PI);
    leaf.rz = this.between(-Math.PI, Math.PI);
    leaf.flutterPhase = this.between(0, TAU);
    leaf.flutterSpeed = this.between(2.2, 5.2);
    leaf.spinX = this.between(-2.1, 2.1);
    leaf.spinY = this.between(-1.2, 1.2);
    leaf.spinZ = this.between(-2.7, 2.7);
    leaf.windResponse = this.between(0.63, 1.05);
    leaf.vx = this.wind.x * leaf.windResponse;
    leaf.vy = this.between(-0.4, 0.4);
    leaf.vz = this.wind.z * leaf.windResponse;
    leaf.age = initial ? this.between(0.8, 3) : 0;
    leaf.lifetime = this.between(13, 22);
    leaf.state = "flying";
    leaf.caughtBy = null;
    if (!initial) this.stats.respawnedLeaves += 1;
  }

  private chooseDestination(bird: MovingBird) {
    bird.destinationX = this.between(-10, 10);
    bird.destinationY = this.between(2.2, 9.5);
    // Alternating depth creates actual foreground / background passes.
    bird.destinationZ = bird.z < -7 ? this.between(3, 11) : this.between(-23, -12);
    bird.timer = this.between(4, 7);
  }

  private findLeaf(bird: MovingBird) {
    let best: MovingLeaf | undefined;
    let bestDistance = Infinity;
    for (const leaf of this.leaves) {
      if (leaf.state !== "flying" || leaf.age < 0.6 || leaf.opacity < 0.5) continue;
      if (leaf.y < 1.1 || leaf.y > 11 || Math.abs(leaf.x) > 11.5 || leaf.z > 12) continue;
      if (this.birds.some((other) => other !== bird && other.targetLeafId === leaf.id)) continue;
      const distance = Math.hypot(leaf.x - bird.x, leaf.y - bird.y, leaf.z - bird.z);
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
    bird.huntCooldown = this.between(3.5, 7);
    this.chooseDestination(bird);
  }

  private beakPosition(bird: MovingBird) {
    // Match the songbird mesh's local beak position and YZX rotation order.
    // Bank rotates local Y into Z before pitch and heading are applied.
    const localY = 0.065 * Math.cos(bird.bank);
    const localZ = 0.065 * Math.sin(bird.bank);
    const pitchedX = 0.24 * Math.cos(bird.pitch) - localY * Math.sin(bird.pitch);
    const pitchedY = 0.24 * Math.sin(bird.pitch) + localY * Math.cos(bird.pitch);
    return {
      x: bird.x + (Math.cos(bird.heading) * pitchedX + Math.sin(bird.heading) * localZ) * bird.scale,
      y: bird.y + pitchedY * bird.scale,
      z: bird.z + (-Math.sin(bird.heading) * pitchedX + Math.cos(bird.heading) * localZ) * bird.scale,
    };
  }

  private tryCatch(bird: MovingBird, leaf: MovingLeaf) {
    const beak = this.beakPosition(bird);
    if (Math.hypot(leaf.x - beak.x, leaf.y - beak.y, leaf.z - beak.z) > 0.28 + leaf.size * 0.45) return;
    bird.state = "eat";
    leaf.state = "caught";
    leaf.caughtBy = bird.id;
    this.stats.caughtLeaves += 1;
    this.chooseDestination(bird);
    bird.timer = EAT_DURATION;
  }

  private tick(dt: number) {
    this.elapsed += dt;
    this.updateWind(dt);
    for (const leaf of this.leaves) {
      if (leaf.state === "caught") continue;
      leaf.age += dt;
      leaf.flutterPhase = (leaf.flutterPhase + leaf.flutterSpeed * dt) % TAU;
      const flutter = Math.sin(leaf.flutterPhase);
      const turbulence = Math.sin(this.elapsed * 1.4 + leaf.z * 0.31 + leaf.id);
      const response = blend(1.45, dt);
      // Horizontal drag, slower gravity and small changing updrafts let leaves
      // rise, arc and settle while travelling several metres each second.
      const desiredVx = this.wind.x * leaf.windResponse + flutter * 0.7;
      const desiredVz = this.wind.z * leaf.windResponse + Math.cos(leaf.flutterPhase * 0.83) * 0.85;
      const desiredVy = -0.32 + this.wind.power * 0.28 + flutter * 0.7 + turbulence * 0.45;
      leaf.vx += (desiredVx - leaf.vx) * response;
      leaf.vy += (desiredVy - leaf.vy) * response;
      leaf.vz += (desiredVz - leaf.vz) * response;
      leaf.x += leaf.vx * dt;
      leaf.y += leaf.vy * dt;
      leaf.z += leaf.vz * dt;
      leaf.rx = wrapAngle(leaf.rx + (leaf.spinX + flutter * this.wind.power) * dt);
      leaf.ry = wrapAngle(leaf.ry + (leaf.spinY + turbulence * 0.8) * dt);
      leaf.rz = wrapAngle(leaf.rz + (leaf.spinZ + flutter * 1.3) * dt);
      const boundaryFade = Math.min(
        clamp((14.5 - Math.abs(leaf.x)) / 2.5, 0, 1),
        clamp((leaf.z + 31) / 4, 0, 1),
        clamp((15 - leaf.z) / 2.5, 0, 1),
        clamp(leaf.y / 0.75, 0, 1),
        clamp((14 - leaf.y) / 2, 0, 1),
        clamp((leaf.lifetime - leaf.age) / 1.1, 0, 1),
      );
      leaf.opacity = leaf.originalOpacity * clamp(leaf.age / 0.65, 0, 1) * boundaryFade;
      if (Math.abs(leaf.x) > 14.5 || leaf.z < -31 || leaf.z > 15 || leaf.y < 0.05
        || leaf.y > 14 || leaf.age > leaf.lifetime) this.resetLeaf(leaf);
    }

    for (const bird of this.birds) {
      bird.timer -= dt;
      bird.huntCooldown -= dt;
      bird.flapTimer -= dt;
      let targetX = bird.destinationX;
      let targetY = bird.destinationY;
      let targetZ = bird.destinationZ;
      let desiredSpeed = bird.cruiseSpeed;
      let leaf = bird.targetLeafId === null ? undefined : this.leaves[bird.targetLeafId];

      if (bird.state === "cruise" && bird.huntCooldown <= 0) {
        leaf = this.findLeaf(bird);
        if (leaf) {
          bird.state = "hunt";
          bird.targetLeafId = leaf.id;
          bird.timer = 7;
        } else bird.huntCooldown = 0.7;
      }

      if (bird.state === "hunt") {
        if (!leaf || leaf.state !== "flying" || leaf.opacity < 0.15 || bird.timer <= 0) {
          this.releaseBird(bird);
          leaf = undefined;
        } else {
          const distance = Math.hypot(leaf.x - bird.x, leaf.y - bird.y, leaf.z - bird.z);
          desiredSpeed = Math.max(bird.cruiseSpeed * 1.45, Math.hypot(leaf.vx, leaf.vy, leaf.vz) + 3.8);
          const leadTime = clamp(distance / desiredSpeed * 0.45, 0.015, 0.45);
          targetX = leaf.x + leaf.vx * leadTime;
          targetY = leaf.y + leaf.vy * leadTime;
          targetZ = leaf.z + leaf.vz * leadTime;
          this.tryCatch(bird, leaf);
        }
      }

      if (bird.state === "eat") {
        desiredSpeed = bird.cruiseSpeed * 0.67;
        targetX = bird.destinationX;
        targetY = bird.destinationY;
        targetZ = bird.destinationZ;
        if (!leaf) this.releaseBird(bird);
        else if (bird.timer <= 0) {
          this.stats.consumedLeaves += 1;
          this.resetLeaf(leaf);
          this.releaseBird(bird);
          leaf = undefined;
        }
      }

      if (bird.state === "cruise" && (bird.timer <= 0
        || Math.hypot(targetX - bird.x, targetY - bird.y, targetZ - bird.z) < 1.8)) {
        this.chooseDestination(bird);
        targetX = bird.destinationX;
        targetY = bird.destinationY;
        targetZ = bird.destinationZ;
      }

      const dx = targetX - bird.x;
      const dy = targetY - bird.y;
      const dz = targetZ - bird.z;
      const desiredHeading = Math.atan2(-dz, dx);
      const headingError = angleDifference(desiredHeading, bird.heading);
      const turnRate = bird.state === "hunt" ? 4.2 : 1.7;
      const yawStep = clamp(headingError * 3.2, -turnRate, turnRate) * dt;
      bird.heading = wrapAngle(bird.heading + yawStep);
      const desiredPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.75, 0.75);
      bird.pitch += (desiredPitch - bird.pitch) * blend(bird.state === "hunt" ? 6 : 3, dt);
      bird.bank += (clamp(-yawStep / dt * 0.23, -0.7, 0.7) - bird.bank) * blend(4.5, dt);
      bird.speed += (desiredSpeed - bird.speed) * blend(3, dt);
      const horizontalSpeed = Math.cos(bird.pitch) * bird.speed;
      bird.x += (Math.cos(bird.heading) * horizontalSpeed + this.wind.x * 0.035) * dt;
      bird.y += (Math.sin(bird.pitch) * bird.speed + Math.sin(this.elapsed * 2.4 + bird.id) * 0.09) * dt;
      bird.z += (-Math.sin(bird.heading) * horizontalSpeed + this.wind.z * 0.035) * dt;

      if (bird.flapTimer <= 0) {
        bird.gliding = !bird.gliding;
        bird.flapTimer = bird.gliding ? this.between(0.6, 1.8) : this.between(1.4, 3.2);
      }
      const flapTarget = bird.state === "hunt" ? 1 : bird.gliding ? 0.08 : 0.86;
      bird.flapStrength += (flapTarget - bird.flapStrength) * blend(5, dt);
      bird.wingPhase = (bird.wingPhase + dt * (bird.state === "hunt" ? 15 : 11.5)) % TAU;
      bird.x = clamp(bird.x, -15, 15);
      bird.y = clamp(bird.y, 0.8, 12.5);
      bird.z = clamp(bird.z, -29, 14);

      // Check after movement too: the beak can reach a leaf this integration step.
      if (bird.state === "hunt" && leaf?.state === "flying") this.tryCatch(bird, leaf);
      if (bird.state === "eat" && leaf) {
        const remaining = clamp(bird.timer / EAT_DURATION, 0, 1);
        const beak = this.beakPosition(bird);
        leaf.x = beak.x;
        leaf.y = beak.y;
        leaf.z = beak.z;
        leaf.size = leaf.originalSize * (0.12 + remaining * 0.88);
        leaf.opacity = leaf.originalOpacity * clamp(remaining * 2.5, 0, 1);
        leaf.rx = bird.pitch + Math.sin(this.elapsed * 20) * 0.2;
        leaf.ry = bird.heading;
        leaf.rz = Math.sin(this.elapsed * 17) * 0.15;
        leaf.vx = 0;
        leaf.vy = 0;
        leaf.vz = 0;
      }
    }
  }
}

export function createForestSimulation3D(options: ForestSimulationOptions3D = {}) {
  return new ForestSimulation3D(options);
}
