// Image conversion with a canvas. This needs a browser, so it is kept apart
// from convert.js (which is tested from Node).
import { IMAGE_FORMATS, encodeBmp } from "./convert.js";

const MIME = Object.fromEntries(IMAGE_FORMATS.map(([id, , mime]) => [id, mime]));

export async function convertImage(file, to, { quality = 0.92 } = {}) {
  if (!MIME[to]) throw new Error(`This browser build writes ${IMAGE_FORMATS.map((f) => f[1]).join(", ")}; ${to} is not one of them.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("The browser could not read this image."));
      img.src = url;
    });
    const width = img.naturalWidth || 1024;
    const height = img.naturalHeight || 1024;
    if (width * height > 100_000_000) throw new Error("This image is larger than 100 megapixels, which is more than a browser canvas can safely hold.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d", { willReadFrequently: to === "bmp" });
    const lossy = [];
    if (to === "jpeg") {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, width, height);
      lossy.push("JPEG has no transparency, so transparent areas became white, and JPEG compression discards some detail.");
    }
    g.drawImage(img, 0, 0, width, height);
    if (to === "webp" && quality < 1) lossy.push("WebP below quality 100 discards some detail.");
    if (to === "png" && /gif|jpeg/.test(file.type)) lossy.push("Converting to PNG keeps the pixels exactly as the source decoded; animation, if any, keeps only the first frame.");
    if (file.type === "image/gif" && to !== "gif") lossy.push("Only the first frame of an animated GIF is kept.");
    let blob;
    if (to === "bmp") {
      const data = g.getImageData(0, 0, width, height);
      blob = new Blob([encodeBmp(width, height, data.data)], { type: MIME.bmp });
    } else {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, MIME[to], quality));
      if (!blob || blob.type !== MIME[to]) throw new Error(`This browser cannot write ${to.toUpperCase()}. Choose another format.`);
    }
    return { blob, lossy, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
