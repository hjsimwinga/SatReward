import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "public", "icons");
const svg = fs.readFileSync(path.join(root, "icon.svg"));

async function writePng(size, name) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(path.join(root, name));
  console.log("wrote", name);
}

await writePng(192, "icon-192.png");
await writePng(512, "icon-512.png");
await writePng(180, "apple-touch-icon.png");
await writePng(32, "favicon-32.png");
await writePng(16, "favicon-16.png");
