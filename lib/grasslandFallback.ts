import { BRANCH_NAVIGATION, LEAF_STEM, navigationLeafWidth } from "@/lib/grasslandNavigation3D";
import { scanAnimalBounds, WILDLIFE_ATLAS_FRAMES } from "@/lib/realisticWildlife3D";

/** A deterministic, fully local grassland scene for browsers without WebGL. */
export function paintGrasslandFallback(canvas: HTMLCanvasElement, width: number, height: number, wildlifeAtlas?: HTMLImageElement, barkTexture?: HTMLImageElement): void {
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return;
  const w = canvas.width;
  const h = canvas.height;
  const mobile = w <= 650;
  let seed = 13471;
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string, angle = 0) => {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    context.fill();
  };
  const stroke = (color: string, thickness: number, draw: () => void) => {
    context.strokeStyle = color;
    context.lineWidth = thickness;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    draw();
    context.stroke();
  };
  const sky = context.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#c9d6ba");
  sky.addColorStop(.38, "#f4efd4");
  sky.addColorStop(.60, "#e9dfb5");
  sky.addColorStop(1, "#b6b46b");
  context.fillStyle = sky;
  context.fillRect(0, 0, w, h);
  const sunlight = context.createRadialGradient(w * .56, h * .28, 0, w * .56, h * .28, w * .55);
  sunlight.addColorStop(0, "rgba(255,250,225,.72)");
  sunlight.addColorStop(1, "rgba(255,250,225,0)");
  context.fillStyle = sunlight;
  context.fillRect(0, 0, w, h);

  // Soft overlapping hills give the grassland depth without obscuring the title.
  for (let layer = 0; layer < 3; layer++) {
    context.fillStyle = ["#c5c59a", "#b4b57f", "#a0a66b"][layer];
    context.beginPath();
    context.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) {
      const y = h * (.525 + layer * .047) + Math.sin(x / w * 6 + layer * 1.8) * h * .018;
      context.lineTo(x, y);
    }
    context.lineTo(w, h);
    context.closePath();
    context.fill();
  }
  const ground = context.createLinearGradient(0, h * .58, 0, h);
  ground.addColorStop(0, "rgba(146,156,93,0)");
  ground.addColorStop(.35, "#89944e");
  ground.addColorStop(1, "#4b6338");
  context.fillStyle = ground;
  context.fillRect(0, h * .58, w, h * .42);

  const acacia = (x: number, bottom: number, size: number, distant = true) => {
    const trunk = distant ? "#7c8561" : "#685c38";
    stroke(trunk, size * .058, () => {
      context.moveTo(x, bottom);
      context.bezierCurveTo(x + size * .04, bottom - size * .35, x - size * .03, bottom - size * .55, x + size * .04, bottom - size * .82);
      context.moveTo(x, bottom - size * .51);
      context.lineTo(x - size * .30, bottom - size * .83);
      context.moveTo(x + size * .015, bottom - size * .6);
      context.lineTo(x + size * .30, bottom - size * .85);
    });
    for (let index = 0; index < 12; index++) {
      const part = index / 11;
      const sprayX = x + (part - .5) * size * 1.2;
      const sprayY = bottom - size * (.82 + Math.sin(part * Math.PI) * .13);
      for (let leaf = 0; leaf < 28; leaf++) {
        const angle = random() * Math.PI * 2;
        ellipse(sprayX + Math.cos(angle) * random() * size * .18,
          sprayY + Math.sin(angle) * random() * size * .075,
          Math.max(1, size * (.012 + random() * .018)), Math.max(.7, size * .009),
          distant ? ["#768b5c", "#879969", "#a0af7e"][leaf % 3] : ["#3e6030", "#5c7d3c", "#8b9d56"][leaf % 3], angle);
      }
    }
  };
  for (let index = 0; index < (mobile ? 8 : 14); index++) {
    const x = (index + .15 + random() * .7) / (mobile ? 8 : 14) * w;
    acacia(x, h * (.58 + random() * .07), Math.min(w * .07, h * .10) * (.55 + random() * .7));
  }
  acacia(w * .10, h * .73, Math.min(w * .16, h * .18), false);
  acacia(w * .92, h * .73, Math.min(w * .16, h * .18), false);

  // A narrow trail opens out toward the viewer between the animals.
  context.beginPath();
  context.moveTo(w * .505, h * .54);
  context.bezierCurveTo(w * .54, h * .68, w * .40, h * .75, w * .37, h);
  context.lineTo(w * .64, h);
  context.bezierCurveTo(w * .49, h * .80, w * .58, h * .65, w * .52, h * .54);
  context.closePath();
  const path = context.createLinearGradient(0, h * .54, 0, h);
  path.addColorStop(0, "#c9bc8f");
  path.addColorStop(1, "#ad945c");
  context.fillStyle = path;
  context.fill();
  context.save();
  context.clip();
  for (let index = 0; index < 380; index++) {
    const y = h * (.55 + random() * .45);
    ellipse(random() * w, y, 1 + random() * 3, .4 + random(), index % 3 ? "#bfa773" : "#9c8552");
  }
  context.restore();

  const grass = (count: number, minimumY: number, maximumY: number) => {
    for (let index = 0; index < count; index++) {
      const x = random() * w;
      const y = h * (minimumY + random() * (maximumY - minimumY));
      const depth = (y / h - .52) / .48;
      // Keep the earthen path legible through the center.
      if (x > w * (.485 - depth * .10) && x < w * (.54 + depth * .09)) continue;
      const size = (4 + random() * 15) * (.4 + depth * 1.5);
      stroke(["#c5c48c", "#b5bc7c", "#809453", "#627940"][index % 4], Math.max(.6, size * .055), () => {
        context.moveTo(x, y);
        context.quadraticCurveTo(x - size * .20, y - size * .6, x - size * .32, y - size);
        context.moveTo(x, y);
        context.quadraticCurveTo(x + size * .18, y - size * .6, x + size * .4, y - size * .82);
        context.moveTo(x, y);
        context.lineTo(x + size * .03, y - size * 1.14);
      });
    }
  };
  grass(mobile ? 250 : 580, .62, 1);

  const shadow = (x: number, y: number, size: number) => ellipse(x, y + size * .02, size * .63, size * .13, "rgba(45,55,25,.23)");
  const cat = (x: number, y: number, size: number, tiger: boolean) => {
    shadow(x, y, size);
    context.save();
    context.translate(x, y);
    context.scale(size, size);
    const fur = tiger ? "#ce8740" : "#cda662";
    const lightFur = tiger ? "#e9b971" : "#e1c486";
    stroke(fur, .055, () => {
      context.moveTo(.41, -.32);
      context.bezierCurveTo(.73, -.25, .80, -.7, .61, -.68);
    });
    if (!tiger) ellipse(.63, -.67, .065, .085, "#594323", -.3);
    for (const leg of [-.37, -.20, .24, .39]) {
      stroke(leg === -.20 || leg === .39 ? "#a77b43" : fur, .105, () => {
        context.moveTo(leg, -.29);
        context.lineTo(leg + .014, -.06);
      });
      ellipse(leg - .025, -.045, .075, .039, lightFur);
    }
    ellipse(.04, -.35, .47, .20, fur);
    ellipse(-.02, -.39, .37, .12, lightFur, -.045);
    if (tiger) {
      for (let index = 0; index < 8; index++) {
        const stripeX = -.27 + index * .085;
        stroke("#493822", .026, () => {
          context.moveTo(stripeX, -.51);
          context.quadraticCurveTo(stripeX - .035, -.4, stripeX + .027, -.27);
        });
      }
      for (const leg of [-.37, .24, .39]) {
        stroke("#493822", .026, () => {
          context.moveTo(leg - .035, -.20); context.lineTo(leg + .04, -.17);
        });
      }
    } else {
      ellipse(-.42, -.43, .23, .27, "#805629", -.06);
      for (let tuft = 0; tuft < 14; tuft++) {
        const angle = tuft / 14 * Math.PI * 2;
        ellipse(-.42 + Math.cos(angle) * .175, -.43 + Math.sin(angle) * .215, .053, .076,
          tuft % 2 ? "#a37737" : "#89602d", angle - .7);
      }
    }
    ellipse(-.43, -.46, .145, .165, lightFur);
    ellipse(-.54, -.58, .049, .049, fur);
    ellipse(-.34, -.61, .049, .049, fur);
    ellipse(-.54, -.58, .026, .026, "#725032");
    ellipse(-.34, -.61, .026, .026, "#725032");
    if (tiger) {
      stroke("#493822", .025, () => {
        context.moveTo(-.44, -.62); context.lineTo(-.43, -.52);
        context.moveTo(-.55, -.49); context.lineTo(-.50, -.46);
        context.moveTo(-.32, -.48); context.lineTo(-.37, -.45);
      });
    }
    ellipse(-.49, -.40, .064, .052, "#f0ddac");
    ellipse(-.39, -.40, .064, .052, "#f0ddac");
    ellipse(-.44, -.432, .033, .020, "#493726");
    ellipse(-.50, -.50, .013, .013, "#392e20");
    ellipse(-.37, -.50, .013, .013, "#392e20");
    stroke("#775333", .010, () => {
      context.moveTo(-.44, -.412); context.lineTo(-.44, -.379);
      context.moveTo(-.49, -.375); context.quadraticCurveTo(-.44, -.35, -.39, -.375);
    });
    context.restore();
  };
  const giraffe = (x: number, y: number, size: number) => {
    shadow(x, y, size);
    context.save();
    context.translate(x, y);
    context.scale(size, size);
    for (const leg of [-.30, -.13, .21, .35]) {
      stroke(leg === -.13 || leg === .35 ? "#b58d4d" : "#d9b46d", .063, () => {
        context.moveTo(leg, -.58); context.lineTo(leg + .022, -.03);
      });
      ellipse(leg + .025, -.021, .047, .026, "#5f482d");
    }
    stroke("#bb9458", .035, () => {
      context.moveTo(.37, -.67); context.quadraticCurveTo(.60, -.42, .48, -.30);
    });
    ellipse(.48, -.29, .035, .06, "#6d512f");
    ellipse(.03, -.69, .39, .18, "#dabb79");
    stroke("#ddbd76", .145, () => {
      context.moveTo(-.26, -.70); context.lineTo(-.37, -1.60);
    });
    stroke("#7f6238", .024, () => {
      context.moveTo(-.20, -.78); context.lineTo(-.31, -1.60);
    });
    ellipse(-.41, -1.64, .15, .068, "#e1c488", .1);
    ellipse(-.51, -1.625, .055, .050, "#cab17d");
    ellipse(-.35, -1.73, .057, .026, "#dabb79", -.9);
    ellipse(-.46, -1.72, .051, .025, "#dabb79", -2.1);
    for (const horn of [-.39, -.43]) {
      stroke("#b79961", .024, () => {
        context.moveTo(horn, -1.69); context.lineTo(horn - .003, -1.79);
      });
      ellipse(horn - .003, -1.80, .018, .021, "#705334");
    }
    ellipse(-.45, -1.66, .011, .013, "#463724");
    ellipse(-.54, -1.63, .01, .008, "#6d512f");
    for (let index = 0; index < 15; index++) {
      const px = -.27 + (index % 5) * .13;
      const py = -.76 + Math.floor(index / 5) * .072;
      ellipse(px, py, .035, .027, index % 2 ? "#aa7940" : "#966a37", index * .67);
    }
    for (let index = 0; index < 8; index++) {
      const py = -.80 - index * .092;
      const px = -.26 - (index * .092) / .90 * .11;
      ellipse(px, py, .036, .028, "#a7763c", index * .9);
    }
    context.restore();
  };
  const animalSize = Math.min(w, h) * (mobile ? .19 : .17);
  if (wildlifeAtlas) {
    const imageWidth = wildlifeAtlas.naturalWidth;
    const imageHeight = wildlifeAtlas.naturalHeight;
    const placements = [
      { name: "lion" as const, x: mobile ? .26 : .36, y: mobile ? .74 : .78, height: mobile ? .10 : .14 },
      { name: "tiger" as const, x: mobile ? .75 : .65, y: mobile ? .73 : .74, height: mobile ? .085 : .11 },
      { name: "giraffe" as const, x: mobile ? .51 : .67, y: mobile ? .69 : .69, height: mobile ? .17 : .23 },
      ...(!mobile ? [{ name: "zebra" as const, x: .29, y: .66, height: .075 }] : []),
    ];
    for (const placement of placements) {
      const crop = scanAnimalBounds(wildlifeAtlas, WILDLIFE_ATLAS_FRAMES[placement.name]);
      const sourceWidth = crop.bounds.width * imageWidth;
      const sourceHeight = crop.bounds.height * imageHeight;
      const drawHeight = h * placement.height;
      const drawWidth = drawHeight * sourceWidth / sourceHeight;
      const x = w * placement.x;
      const y = h * placement.y;
      shadow(x, y, drawWidth * .66);
      context.drawImage(wildlifeAtlas, crop.bounds.x * imageWidth, crop.bounds.y * imageHeight,
        sourceWidth, sourceHeight, x - drawWidth / 2, y - drawHeight * crop.footBaseline, drawWidth, drawHeight);
    }
  } else {
    giraffe(w * (mobile ? .52 : .68), h * (mobile ? .69 : .74), animalSize * .82);
    cat(w * (mobile ? .27 : .36), h * (mobile ? .73 : .79), animalSize, false);
    cat(w * (mobile ? .74 : .66), h * (mobile ? .73 : .77), animalSize * .91, true);
  }

  // Foreground trunks frame the view. Their crowns stay near the outer corners.
  const trunkWidth = Math.max(20, Math.min(w * .067, 100));
  for (const side of [-1, 1]) {
    const x = w * (side < 0 ? .045 : .95);
    const bark = context.createLinearGradient(x - trunkWidth, 0, x + trunkWidth, 0);
    bark.addColorStop(0, "#493f2b");
    bark.addColorStop(.48, "#82714a");
    bark.addColorStop(.73, "#685734");
    bark.addColorStop(1, "#403d27");
    context.fillStyle = bark;
    context.beginPath();
    context.moveTo(x - trunkWidth * .55, h * .97);
    context.bezierCurveTo(x - trunkWidth * .20, h * .70, x - trunkWidth * .50, h * .38, x - trunkWidth * .36, 0);
    context.lineTo(x + trunkWidth * .45, 0);
    context.bezierCurveTo(x + trunkWidth * .70, h * .32, x + trunkWidth * .25, h * .77, x + trunkWidth * .72, h * .98);
    context.closePath();
    context.fill();
    if (barkTexture) {
      context.save();
      context.clip();
      const pattern = context.createPattern(barkTexture, "repeat");
      if (pattern) {
        pattern.setTransform(new DOMMatrix().scale(trunkWidth * 1.7 / barkTexture.naturalWidth, h / (barkTexture.naturalHeight * 3)));
        context.fillStyle = pattern;
        context.fillRect(x - trunkWidth, 0, trunkWidth * 2, h);
        context.globalAlpha = .28;
        context.fillStyle = bark;
        context.fillRect(x - trunkWidth, 0, trunkWidth * 2, h);
      }
      context.restore();
    }
    for (let index = 0; index < 14; index++) {
      const stripeX = x + (random() - .5) * trunkWidth * .78;
      stroke(index % 2 ? "rgba(42,37,23,.28)" : "rgba(176,153,91,.25)", 1 + random() * 2, () => {
        context.moveTo(stripeX, 0);
        context.bezierCurveTo(stripeX + trunkWidth * .15, h * .3, stripeX - trunkWidth * .11, h * .66, stripeX + trunkWidth * .14, h * .95);
      });
    }
    stroke("#665837", trunkWidth * .25, () => {
      context.moveTo(x, h * .27);
      context.quadraticCurveTo(x - side * w * .08, h * .15, x - side * w * .12, h * .015);
    });
    for (let index = 0; index < (mobile ? 320 : 650); index++) {
      const crownX = x + (random() - .5) * w * .25;
      const crownY = random() * h * .11;
      const length = Math.min(w * .017, 17) * (.55 + random() * .7);
      ellipse(crownX, crownY, length, length * .33, ["#3f6031", "#617f43", "#8c9c5f"][index % 3], (random() - .5) * Math.PI);
    }
  }

  // Leaf center, rotated local stem, and branch tip share the navigation module.
  const leafWidth = navigationLeafWidth(w);
  const leafHeight = leafWidth / 1.6;
  for (const leaf of BRANCH_NAVIGATION) {
    const [centerX, centerY] = mobile ? leaf.mobile : leaf.desktop;
    const angle = leaf.angle * Math.PI / 180;
    const dx = (.5 - LEAF_STEM.x) * leafWidth;
    const dy = (.5 - LEAF_STEM.y) * leafHeight;
    const tipX = centerX * w - (dx * Math.cos(angle) - dy * Math.sin(angle));
    const tipY = centerY * h - (dx * Math.sin(angle) + dy * Math.cos(angle));
    const side = mobile && leaf.id === "contact" ? -1 : leaf.side;
    const rootX = w * (side < 0 ? .05 : .95);
    const rootY = tipY - h * .045;
    const middleX = rootX + (tipX - rootX) * .55;
    const middleY = rootY + (tipY - rootY) * .45 - h * .013;
    // Filled taper keeps the terminal twig fine enough to meet the SVG petiole.
    const thickness = Math.max(5, Math.min(w * .012, 18));
    context.fillStyle = "#645533";
    context.beginPath();
    context.moveTo(rootX, rootY - thickness * .55);
    context.quadraticCurveTo(middleX, middleY - thickness * .24, tipX, tipY - .7);
    context.lineTo(tipX, tipY + .7);
    context.quadraticCurveTo(middleX, middleY + thickness * .24, rootX, rootY + thickness * .55);
    context.closePath();
    context.fill();
    stroke("#a08c59", Math.max(1, thickness * .14), () => {
      context.moveTo(rootX, rootY - thickness * .22);
      context.quadraticCurveTo(middleX, middleY - thickness * .10, tipX, tipY);
    });
    const twigX = rootX + (tipX - rootX) * .45;
    const twigY = rootY + (tipY - rootY) * .30;
    stroke("#70603c", 2, () => {
      context.moveTo(twigX, twigY);
      context.quadraticCurveTo(twigX - side * 11, twigY - 15, twigX - side * 19, twigY - 24);
    });
    ellipse(twigX - side * 20, twigY - 25, 10, 4, "#8c9c56", side * -.65);
  }
  // The closest tufts soften the tree roots and anchor animals to the ground.
  grass(mobile ? 35 : 90, .91, 1);
}
