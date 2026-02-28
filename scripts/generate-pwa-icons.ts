import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

type Rgba = [number, number, number, number];

function fill(png: PNG, color: Rgba) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
}

function rect(png: PNG, x0: number, y0: number, w: number, h: number, color: Rgba) {
  const x1 = Math.min(png.width, x0 + w);
  const y1 = Math.min(png.height, y0 + h);
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
}

function circle(png: PNG, cx: number, cy: number, r: number, color: Rgba) {
  const r2 = r * r;
  for (let y = Math.max(0, cy - r); y < Math.min(png.height, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x < Math.min(png.width, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (png.width * y + x) << 2;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = color[3];
      }
    }
  }
}

function drawPMark(png: PNG, padding: number) {
  const fg: Rgba = [255, 255, 255, 255];
  const accent: Rgba = [160, 160, 255, 255];

  const cx = Math.floor(png.width / 2);
  const cy = Math.floor(png.height / 2);
  const r = Math.floor((Math.min(png.width, png.height) - padding * 2) / 2);

  circle(png, cx, cy, r, [22, 22, 30, 255]);
  circle(png, cx, cy, Math.floor(r * 0.88), [10, 10, 14, 255]);

  // Simple "P" made from rectangles.
  const base = Math.floor(r * 0.9);
  const stemW = Math.floor(base * 0.18);
  const stemH = Math.floor(base * 0.92);
  const topH = Math.floor(base * 0.22);
  const bowlW = Math.floor(base * 0.56);
  const bowlH = Math.floor(base * 0.44);

  const x = cx - Math.floor(base * 0.28);
  const y = cy - Math.floor(stemH / 2);

  rect(png, x, y, stemW, stemH, fg);
  rect(png, x, y, bowlW, topH, fg);
  rect(png, x, y + Math.floor(bowlH * 0.32), bowlW, Math.floor(base * 0.16), fg);
  rect(png, x + bowlW - stemW, y, stemW, bowlH, accent);
}

function writeIcon(outDir: string, filename: string, size: number, padding: number) {
  const png = new PNG({ width: size, height: size });
  fill(png, [10, 10, 14, 255]);
  drawPMark(png, padding);

  const buf = PNG.sync.write(png, { colorType: 6 });
  writeFileSync(join(outDir, filename), buf);
}

function main() {
  const outDir = join(process.cwd(), "public", "icons");
  mkdirSync(outDir, { recursive: true });

  writeIcon(outDir, "icon-192.png", 192, 16);
  writeIcon(outDir, "icon-512.png", 512, 36);
  writeIcon(outDir, "maskable-192.png", 192, 32);
  writeIcon(outDir, "maskable-512.png", 512, 96);
  writeIcon(outDir, "apple-touch-icon.png", 180, 22);
}

main();

