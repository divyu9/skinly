/**
 * Template mockups: a design laid onto a photographed device by geometry,
 * not by an image model.
 *
 * A template is a photo of a device whose skin area is flat chroma green, plus
 * the four corners of that surface and its real size in centimetres. A roll is
 * made flat once ("calibrated") from a photo in which its full 29.5 cm width is
 * marked. From there a mockup is arithmetic: cut the real-size piece of the
 * design the skin would be, warp it onto the surface, keep everything that is
 * not green (camera module, logo, edges) and carry the template's light and
 * shadow across. It costs nothing per image and the scale is right by
 * construction — the thing an image model kept getting wrong.
 */

export type Point = { x: number; y: number };

/** Solve A·x = b for an 8×8 system (Gaussian elimination, partial pivoting). */
function solve8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/**
 * The projective map taking the four `from` points onto the four `to` points.
 * Returned as a function, for sampling.
 */
export function homography(from: Point[], to: Point[]): (x: number, y: number) => Point {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: X, y: Y } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solve8(A, b);
  return (x, y) => {
    const w = h6 * x + h7 * y + 1;
    return { x: (h0 * x + h1 * y + h2) / w, y: (h3 * x + h4 * y + h5) / w };
  };
}

export function imageToData(img: HTMLImageElement | HTMLCanvasElement): ImageData {
  const c = document.createElement("canvas");
  c.width = "naturalWidth" in img ? img.naturalWidth : img.width;
  c.height = "naturalHeight" in img ? img.naturalHeight : img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function dataToCanvas(data: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = data.width;
  c.height = data.height;
  c.getContext("2d")!.putImageData(data, 0, 0);
  return c;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Bilinear sample with wrap-around, so a pattern tiles past the photo's edge. */
function sampleWrap(src: ImageData, x: number, y: number, out: number[]) {
  const { width: w, height: h, data } = src;
  x = ((x % w) + w) % w;
  y = ((y % h) + h) % h;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  const fx = x - x0, fy = y - y0;
  for (let k = 0; k < 3; k++) {
    const a = data[(y0 * w + x0) * 4 + k], b = data[(y0 * w + x1) * 4 + k];
    const c = data[(y1 * w + x0) * 4 + k], d = data[(y1 * w + x1) * 4 + k];
    out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
}

/**
 * A roll photo made flat: the marked rectangle (TL, TR, BR, BL — TL→TR across
 * the full roll width) rewarped to `pxPerCm` pixels per centimetre.
 */
export function rectifyRoll(
  raw: ImageData,
  corners: Point[],
  widthCm: number,
  lengthCm: number,
  pxPerCm = 40
): ImageData {
  const W = Math.round(widthCm * pxPerCm);
  const H = Math.round(lengthCm * pxPerCm);
  const toRaw = homography(
    [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
    corners
  );
  const out = new ImageData(W, H);
  const px = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = toRaw(x + 0.5, y + 0.5);
      // Inside the photo only; the marked rectangle is.
      sampleWrap(raw, Math.min(Math.max(p.x, 0), raw.width - 1.001), Math.min(Math.max(p.y, 0), raw.height - 1.001), px);
      const i = (y * W + x) * 4;
      out.data[i] = px[0];
      out.data[i + 1] = px[1];
      out.data[i + 2] = px[2];
      out.data[i + 3] = 255;
    }
  }
  return out;
}

export interface TemplateSpec {
  /** Surface corners in the template photo: TL, TR, BR, BL of the skin. */
  quad: Point[];
  /** Real size of that surface, cm: width along TL→TR, height along TL→BL. */
  widthCm: number;
  heightCm: number;
}

export interface CompositeOptions {
  /** Pixels per cm of the flat design; for a cutout sheet, 0 means "fit the sheet". */
  pxPerCm: number;
  /** A phone skin cut across the web shows the design turned a quarter. */
  rotate90?: boolean;
  /** Where on the roll the piece is cut from, cm from the top-left. */
  offsetCm?: { x: number; y: number };
}

/** How green a template pixel is: 0 (not the skin) … 1 (pure key). */
const greenness = (r: number, g: number, b: number) => {
  const spill = g - Math.max(r, b);
  return Math.max(0, Math.min(1, (spill - 25) / 70));
};

/**
 * Lays the design onto the template's green surface.
 *
 * Light: each green pixel's brightness relative to the surface's median green
 * becomes a multiplier on the design, so the template's shading, reflections
 * and edge fall-off carry over. Edges: partial green blends, so the cut line
 * around a camera module stays soft rather than stair-stepped.
 */
export function composite(template: ImageData, spec: TemplateSpec, design: ImageData, opts: CompositeOptions): ImageData {
  const out = new ImageData(new Uint8ClampedArray(template.data), template.width, template.height);
  const { quad, widthCm, heightCm } = spec;
  const toUnit = homography(quad, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);

  // The surface's typical green: the "neutral" light level.
  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 2), maxX = Math.min(template.width - 1, Math.ceil(Math.max(...xs)) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 2), maxY = Math.min(template.height - 1, Math.ceil(Math.max(...ys)) + 2);
  const greens: number[] = [];
  const t = template.data;
  for (let y = minY; y <= maxY; y += 3) {
    for (let x = minX; x <= maxX; x += 3) {
      const i = (y * template.width + x) * 4;
      if (greenness(t[i], t[i + 1], t[i + 2]) > 0.9) greens.push(t[i + 1]);
    }
  }
  if (greens.length < 50) throw new Error("No green skin area found inside the marked corners");
  greens.sort((a, b) => a - b);
  // A little above the median: most of a lit surface reads as the design's own
  // colour, highlights lift it slightly and shade darkens it.
  const neutral = greens[Math.floor(greens.length * 0.7)] || 200;

  // The design as a real-size piece. A cutout sheet (pxPerCm 0) is stretched
  // to the surface, since the sheet is the skin.
  const fit = !opts.pxPerCm;
  const ppc = opts.pxPerCm;
  const off = opts.offsetCm || { x: 0, y: 0 };
  const px = [0, 0, 0];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = (y * template.width + x) * 4;
      const a = greenness(t[i], t[i + 1], t[i + 2]);
      if (a <= 0) continue;
      const u = toUnit(x + 0.5, y + 0.5);
      if (u.x < -0.02 || u.x > 1.02 || u.y < -0.02 || u.y > 1.02) continue;
      let sx: number, sy: number;
      if (fit) {
        sx = Math.min(Math.max(u.x, 0), 1) * (design.width - 1);
        sy = Math.min(Math.max(u.y, 0), 1) * (design.height - 1);
      } else if (opts.rotate90) {
        sx = (off.x + (1 - u.y) * heightCm) * ppc;
        sy = (off.y + u.x * widthCm) * ppc;
      } else {
        sx = (off.x + u.x * widthCm) * ppc;
        sy = (off.y + u.y * heightCm) * ppc;
      }
      sampleWrap(design, sx, sy, px);
      const light = Math.max(0.35, Math.min(1.15, t[i + 1] / neutral));
      for (let k = 0; k < 3; k++) {
        const v = Math.min(255, px[k] * light);
        out.data[i + k] = t[i + k] * (1 - a) + v * a;
      }
    }
  }
  return out;
}

/** A canvas as a base64 data URL in WebP, for upload. */
export const canvasToWebp = (c: HTMLCanvasElement, quality = 0.9) => c.toDataURL("image/webp", quality);

/** A flat solid-green swatch, the reference an image model is given to paint a template's skin. */
export function greenSwatch(size = 512): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(0, 0, size, size);
  return c.toDataURL("image/png");
}
