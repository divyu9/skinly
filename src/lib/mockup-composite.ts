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
/** How much of a template's white highlight is laid over the design. */
const SPECULAR = 0.85;


/** Left, right, up, down — the directions the green fill walks in. */
const STEPS: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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
  /*
   * How the template's light is carried onto the design.
   *
   * A chroma-green surface holds its lighting in two separable parts. The
   * green channel above whatever red and blue share is the surface's own
   * colour, and it dims in shade — that part scales the design, the way a
   * shadow does. What red and blue share is white light sitting on top of the
   * green, a reflection or a gloss highlight — that part is added, the way a
   * highlight does, and it cannot be recovered from the green channel alone
   * because the green has already clipped at 255 wherever the surface is
   * bright. Reading only the green channel and only multiplying was why
   * templates came out looking like a flat sticker: the shading it could see
   * was the little the model had left, and every highlight was invisible to
   * it.
   */
  for (let y = minY; y <= maxY; y += 3) {
    for (let x = minX; x <= maxX; x += 3) {
      const i = (y * template.width + x) * 4;
      if (greenness(t[i], t[i + 1], t[i + 2]) > 0.9) greens.push(t[i + 1] - Math.min(t[i], t[i + 2]));
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

  const paint = (i: number, a: number, ux: number, uy: number) => {
    let sx: number, sy: number;
    if (fit) {
      sx = Math.min(Math.max(ux, 0), 1) * (design.width - 1);
      sy = Math.min(Math.max(uy, 0), 1) * (design.height - 1);
    } else if (opts.rotate90) {
      sx = (off.x + (1 - uy) * heightCm) * ppc;
      sy = (off.y + ux * widthCm) * ppc;
    } else {
      sx = (off.x + ux * widthCm) * ppc;
      sy = (off.y + uy * heightCm) * ppc;
    }
    sampleWrap(design, sx, sy, px);
    const spec = Math.min(t[i], t[i + 2]);
    const shade = Math.max(0.3, Math.min(1.3, (t[i + 1] - spec) / neutral));
    for (let k = 0; k < 3; k++) {
      const v = Math.min(255, px[k] * shade + spec * SPECULAR);
      // Rounded here rather than left to the clamped array, which rounds a
      // half to even where the server rounds it up — a one-unit drift that
      // stops the preview and the launch's render being the same picture.
      out.data[i + k] = Math.round(t[i + k] * (1 - a) + v * a);
    }
  };

  /*
   * Every green pixel joined to the marked face, not only the ones inside it —
   * the same fill functions/src/composite.ts runs for the launch pipeline, so
   * a picture made here matches the one the server makes. The corners mark the
   * flat face; the phone's side wrap and rounded edges are green too, and used
   * to stay green, while stretching the corners over them warped the artwork
   * across the face. Reading the design past the corners carries the print on
   * around the edge instead, which is what the real skin does.
   */
  const w = template.width, h = template.height;
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = Math.max(8, Math.round(span * 0.35));
  const boxX0 = Math.max(0, minX - pad), boxX1 = Math.min(w - 1, maxX + pad);
  const boxY0 = Math.max(0, minY - pad), boxY1 = Math.min(h - 1, maxY + pad);

  /*
   * The flood crosses a thin non-green seam.
   *
   * On some device photos the side wrap is drawn as its own patch of green,
   * cut off from the back face by the phone's dark frame edge — a few pixels
   * of not-green. A strict neighbour-by-neighbour flood stopped at that line
   * and left the wrap green on those templates while filling it on others.
   * A step may therefore skip over up to `bridge` pixels to reach the next
   * green one; the pixels skipped are the frame itself and stay untouched.
   */
  const bridge = Math.max(3, Math.min(12, Math.round(span * 0.025)));
  const isGreen = (q: number) => greenness(t[q * 4], t[q * 4 + 1], t[q * 4 + 2]) > 0;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = y * w + x;
      if (seen[p] || !isGreen(p)) continue;
      const u = toUnit(x + 0.5, y + 0.5);
      if (u.x < 0 || u.x > 1 || u.y < 0 || u.y > 1) continue;
      seen[p] = 1;
      stack.push(p);
    }
  }

  for (let head = 0; head < stack.length; head++) {
    const p = stack[head];
    const x = p % w, y = (p - x) / w;
    const i = p * 4;
    const u = toUnit(x + 0.5, y + 0.5);
    paint(i, greenness(t[i], t[i + 1], t[i + 2]), u.x, u.y);
    // Each direction: the nearest green pixel within `bridge` steps, if any.
    for (const [dx, dy] of STEPS) {
      for (let k = 1; k <= bridge; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < boxX0 || nx > boxX1 || ny < boxY0 || ny > boxY1) break;
        const q = ny * w + nx;
        if (!isGreen(q)) continue;
        if (!seen[q]) { seen[q] = 1; stack.push(q); }
        break;
      }
    }
  }
  return out;
}

/**
 * The piece of a calibrated roll that goes on one device, at true size and
 * turned upright — the same crop functions/src/composite.ts makes for the
 * launch pipeline, so a picture redone from the studio matches one the server
 * made. The roll repeats where the photographed stretch is smaller than the
 * piece.
 */
export function truePiece(
  design: ImageData,
  opts: { pxPerCm: number; widthCm: number; heightCm: number; rotate90?: boolean }
): ImageData {
  const ppc = opts.pxPerCm || 40;
  const pieceW = opts.rotate90 ? opts.heightCm : opts.widthCm;
  const pieceH = opts.rotate90 ? opts.widthCm : opts.heightCm;
  const w = Math.max(1, Math.round(pieceW * ppc));
  const h = Math.max(1, Math.round(pieceH * ppc));
  // The middle of the photographed stretch, where the photo is sharpest.
  const ox = Math.round(Math.max(0, design.width - w) / 2);
  const oy = Math.round(Math.max(0, design.height - h) / 2);
  const cut = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    const sy = (oy + y) % design.height;
    for (let x = 0; x < w; x++) {
      const sx = (ox + x) % design.width;
      const i = (sy * design.width + sx) * 4;
      const o = (y * w + x) * 4;
      cut.data[o] = design.data[i];
      cut.data[o + 1] = design.data[i + 1];
      cut.data[o + 2] = design.data[i + 2];
      cut.data[o + 3] = 255;
    }
  }
  if (!opts.rotate90) return cut;
  // A quarter turn anticlockwise, which is how the template mockups read a
  // piece cut across the roll: (x, y) -> (y, w - 1 - x).
  const out = new ImageData(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = ((w - 1 - x) * h + y) * 4;
      out.data[o] = cut.data[i];
      out.data[o + 1] = cut.data[i + 1];
      out.data[o + 2] = cut.data[i + 2];
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** A canvas as a base64 data URL in WebP, for upload. */
export const canvasToWebp = (c: HTMLCanvasElement, quality = 0.9) => c.toDataURL("image/webp", quality);

/**
 * The four corners of the largest green patch in a photo: a template's skin
 * area, ready for the admin to nudge.
 *
 * Grouping the green into patches matters. A template photo often holds a
 * second device (a phone shown front-on beside the skinned one) or a plant,
 * each with green of its own, and the extremes of all the green together drew
 * a box around the whole scene instead of the surface.
 */
export function largestGreenQuad(data: ImageData, step = 2): Point[] | null {
  const gw = Math.ceil(data.width / step), gh = Math.ceil(data.height / step);
  const green = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = ((gy * step) * data.width + gx * step) * 4;
      if (data.data[i + 1] - Math.max(data.data[i], data.data[i + 2]) >= 80) green[gy * gw + gx] = 1;
    }
  }
  const seen = new Uint8Array(gw * gh);
  const queue = new Int32Array(gw * gh);
  let best: number[] | null = null;
  for (let start = 0; start < green.length; start++) {
    if (!green[start] || seen[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    const cells: number[] = [];
    while (head < tail) {
      const cell = queue[head++];
      cells.push(cell);
      const cx = cell % gw, cy = (cell - cx) / gw;
      if (cx + 1 < gw) { const n = cell + 1; if (green[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; } }
      if (cx > 0) { const n = cell - 1; if (green[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; } }
      if (cy + 1 < gh) { const n = cell + gw; if (green[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; } }
      if (cy > 0) { const n = cell - gw; if (green[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; } }
    }
    if (!best || cells.length > best.length) best = cells;
  }
  if (!best || best.length < 50) return null;

  let tl: Point | null = null, tr: Point | null = null, br: Point | null = null, bl: Point | null = null;
  let a = Infinity, b = -Infinity, c = -Infinity, d = Infinity;
  for (const cell of best) {
    const gx = cell % gw, gy = (cell - gx) / gw;
    const x = gx * step, y = gy * step;
    if (x + y < a) { a = x + y; tl = { x, y }; }
    if (x - y > b) { b = x - y; tr = { x, y }; }
    if (x + y > c) { c = x + y; br = { x, y }; }
    if (x - y < d) { d = x - y; bl = { x, y }; }
  }
  return tl && tr && br && bl ? [tl, tr, br, bl] : null;
}

/** A flat solid-green swatch, the reference an image model is given to paint a template's skin. */
export function greenSwatch(size = 512): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(0, 0, size, size);
  return c.toDataURL("image/png");
}
