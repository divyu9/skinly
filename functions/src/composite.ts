import sharp from "sharp";

/**
 * Template mockups, server side — the same geometry as the studio's
 * src/lib/mockup-composite.ts, over raw RGBA buffers from sharp, so the launch
 * pipeline can make them with no browser open. Keep the two in step.
 */

export type Point = { x: number; y: number };

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

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

function homography(from: Point[], to: Point[]) {
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
  return (x: number, y: number): Point => {
    const w = h6 * x + h7 * y + 1;
    return { x: (h0 * x + h1 * y + h2) / w, y: (h3 * x + h4 * y + h5) / w };
  };
}

function sampleWrap(src: Raw, x: number, y: number, out: number[]) {
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

const greenness = (r: number, g: number, b: number) => Math.max(0, Math.min(1, (g - Math.max(r, b) - 25) / 70));
/** How much of a template's white highlight is laid over the design. */
const SPECULAR = 0.85;


/** Left, right, up, down — the directions the green fill walks in. */
const STEPS: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

async function decode(url: string): Promise<Raw> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export interface TemplateMockupInput {
  templateUrl: string;
  quad: Point[];
  widthCm: number;
  heightCm: number;
  designUrl: string;
  /** Pixels per cm of the flat design; 0 stretches a cutout sheet to the surface. */
  pxPerCm: number;
  designWidthCm?: number;
  designLengthCm?: number;
  rotate90?: boolean;
}

/** Lays a design onto a template photo and returns a WebP. */
export async function renderTemplateMockup(input: TemplateMockupInput): Promise<Buffer> {
  const [tpl, design] = await Promise.all([decode(input.templateUrl), decode(input.designUrl)]);
  const out = Buffer.from(tpl.data);
  const t = tpl.data;
  const { quad, widthCm, heightCm } = input;
  const toUnit = homography(quad, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);

  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 2), maxX = Math.min(tpl.width - 1, Math.ceil(Math.max(...xs)) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 2), maxY = Math.min(tpl.height - 1, Math.ceil(Math.max(...ys)) + 2);
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
  const greens: number[] = [];
  for (let y = minY; y <= maxY; y += 3) {
    for (let x = minX; x <= maxX; x += 3) {
      const i = (y * tpl.width + x) * 4;
      if (greenness(t[i], t[i + 1], t[i + 2]) > 0.9) greens.push(t[i + 1] - Math.min(t[i], t[i + 2]));
    }
  }
  if (greens.length < 50) throw new Error("No green skin area found inside the template's corners");
  greens.sort((a, b) => a - b);
  const neutral = greens[Math.floor(greens.length * 0.7)] || 200;

  const fit = !input.pxPerCm;
  const ppc = input.pxPerCm;
  const pieceW = input.rotate90 ? heightCm : widthCm;
  const pieceH = input.rotate90 ? widthCm : heightCm;
  const rollW = input.designWidthCm || design.width / (ppc || 1);
  const rollL = input.designLengthCm || design.height / (ppc || 1);
  // The middle of the photographed stretch, where the photo is sharpest.
  const off = { x: Math.max(0, (rollW - pieceW) / 2), y: Math.max(0, (rollL - pieceH) / 2) };
  const px = [0, 0, 0];

  const paint = (i: number, a: number, ux: number, uy: number) => {
    let sx: number, sy: number;
    if (fit) {
      sx = Math.min(Math.max(ux, 0), 1) * (design.width - 1);
      sy = Math.min(Math.max(uy, 0), 1) * (design.height - 1);
    } else if (input.rotate90) {
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
      out[i + k] = Math.round(t[i + k] * (1 - a) + v * a);
    }
  };

  /*
   * The whole green skin, not only the part inside the marked corners.
   *
   * The corners mark one flat face, and the paint used to stop dead at them,
   * so a phone photographed at an angle kept its green side wrap and its green
   * rounded edges — and stretching the corners out over the sides to cover
   * them warped the artwork across the face instead, because a flat four-point
   * warp cannot bend around a corner. Filling every green pixel that is joined
   * to the marked face, and reading the design beyond the corners where the
   * wrap goes, gives both: the face at true scale, and the wrap carrying the
   * same print on past the edge, which is what the real skin does.
   *
   * Connectivity is the safeguard — a green prop elsewhere in the frame is
   * never touched — with a generous box around the face as a second one.
   */
  const w = tpl.width, h = tpl.height;
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
  return sharp(out, { raw: { width: tpl.width, height: tpl.height, channels: 4 } }).webp({ quality: 90 }).toBuffer();
}

export interface TrueSizeCropInput {
  /** The calibrated, flattened roll photo: x across the roll, y along it. */
  designUrl: string;
  pxPerCm: number;
  /** The device face, upright (a phone is width × height in portrait). */
  widthCm: number;
  heightCm: number;
  /** Cut across the roll: the piece is turned a quarter turn onto the device. */
  rotate90?: boolean;
}

/**
 * The exact piece of vinyl that goes on a device, at its true size and
 * turned upright, as a JPEG for the image model. Given the whole roll photo
 * the model guesses how big the motifs are and usually shrinks them; given
 * the piece itself, edge to edge, it has nothing to guess. Takes the same
 * stretch as the template mockups (the middle of the photo) and repeats the
 * roll where the photo is smaller than the piece.
 */
export async function renderTrueSizeCrop(input: TrueSizeCropInput): Promise<Buffer> {
  const design = await decode(input.designUrl);
  const ppc = input.pxPerCm || 40;
  const pieceW = input.rotate90 ? input.heightCm : input.widthCm;
  const pieceH = input.rotate90 ? input.widthCm : input.heightCm;
  const w = Math.max(1, Math.round(pieceW * ppc));
  const h = Math.max(1, Math.round(pieceH * ppc));
  const ox = Math.round(Math.max(0, design.width - w) / 2);
  const oy = Math.round(Math.max(0, design.height - h) / 2);
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = (oy + y) % design.height;
    for (let x = 0; x < w; x++) {
      const sx = (ox + x) % design.width;
      const i = (sy * design.width + sx) * 4;
      const o = (y * w + x) * 3;
      out[o] = design.data[i];
      out[o + 1] = design.data[i + 1];
      out[o + 2] = design.data[i + 2];
    }
  }
  let img = sharp(out, { raw: { width: w, height: h, channels: 3 } });
  // Upright on the device: the rotation the template mockup uses, read back.
  if (input.rotate90) img = sharp(await img.rotate(270).png().toBuffer());
  // Upright, the piece is taller than wide for a phone; the long side goes to
  // 1024 px, a size the image models read detail from comfortably.
  const [fw, fh] = input.rotate90 ? [h, w] : [w, h];
  return img
    .resize(fh >= fw ? { height: 1024 } : { width: 1024 })
    .jpeg({ quality: 92 })
    .toBuffer();
}
