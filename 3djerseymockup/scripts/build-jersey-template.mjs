/**
 * Builds the reusable jersey template and the demo design manifest without Blender.
 *
 * Source: public/models/jersey-yash24.glb (one mesh, three material primitives)
 * Output:
 *   public/models/jersey-template.glb        MainJersey + CollarTrim + PlacketTrim + EndSleeves + JerseyButtons
 *   public/templates/jersey-uv-guide.png     real UV islands over the design canvas
 *   public/designs/**                        demo WebP designs + thumbnails
 *   public/designs/manifest.json             runtime design data
 *
 * Usage: npm run build:template
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_MODEL = path.join(ROOT, "public/models/jersey-yash24.glb");
const SLHS_MODEL = path.join(ROOT, "public/models/slhs.glb");
const OUT_MODEL = path.join(ROOT, "public/models/jersey-template.glb");
const OUT_GUIDE = path.join(ROOT, "public/templates/jersey-uv-guide.png");
const DESIGN_ROOT = path.join(ROOT, "public/designs");
const MANIFEST = path.join(DESIGN_ROOT, "manifest.json");

const GUIDE_SIZE = 2048;
const FULL_SIZE = 1400;
const THUMB_SIZE = 360;
const MAX_GUIDE_DOTS = 12000;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

function findPrimitive(primitives, materialPattern) {
  return primitives.find((prim) => materialPattern.test(prim.getMaterial()?.getName() ?? ""));
}

function clonePrimitive(document, primitive) {
  const copy = document
    .createPrimitive()
    .setMode(primitive.getMode())
    .setIndices(primitive.getIndices())
    .setMaterial(primitive.getMaterial());

  for (const semantic of primitive.listSemantics()) {
    copy.setAttribute(semantic, primitive.getAttribute(semantic));
  }
  for (const target of primitive.listTargets()) {
    copy.addTarget(target);
  }
  return copy;
}

async function extractMainTextureImage(file) {
  const document = await io.read(file);
  for (const material of document.getRoot().listMaterials()) {
    if (!/main design|jerseyfabric|^front$/i.test(material.getName())) continue;
    const texture = material.getBaseColorTexture();
    if (texture) return Buffer.from(texture.getImage());
  }
  return null;
}

async function writeWebpPair(buffer, designId, category) {
  const folder = path.join(DESIGN_ROOT, category);
  await fs.mkdir(folder, { recursive: true });

  // Keep the artwork's aspect ratio: UVs map to the whole image, so any
  // stretch or crop here would misalign the print on the 3D jersey.
  const full = await sharp(buffer)
    .rotate()
    .resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  const thumb = await sharp(buffer)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "fill" })
    .webp({ quality: 78 })
    .toBuffer();

  await fs.writeFile(path.join(folder, `${designId}.webp`), full);
  await fs.writeFile(path.join(folder, `${designId}-thumb.webp`), thumb);

  return {
    image: `/designs/${category}/${designId}.webp`,
    thumb: `/designs/${category}/${designId}-thumb.webp`,
  };
}

function buildUvOverlay(uvAccessor, width, height) {
  const count = uvAccessor.getCount();
  const step = Math.max(1, Math.ceil(count / MAX_GUIDE_DOTS));
  const dots = [];
  const sample = [0, 0];

  for (let index = 0; index < count; index += step) {
    // UVs are normalized UNSIGNED_SHORT. getElement() returns true 0..1 floats;
    // reading getArray() directly would give raw 0..65535 integers.
    uvAccessor.getElement(index, sample);
    const [u, v] = sample;
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    dots.push(
      `<circle cx="${(u * width).toFixed(1)}" cy="${(v * height).toFixed(1)}" r="1.4" fill="#ff5a24" fill-opacity="0.32"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="128" height="128" patternUnits="userSpaceOnUse">
      <path d="M128 0H0V128" fill="none" stroke="#0e0e0e" stroke-opacity="0.10" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#ff5a24" stroke-width="5" stroke-dasharray="22 14"/>
  <rect x="112" y="112" width="${width - 224}" height="${height - 224}" fill="none" stroke="#111111" stroke-width="4"/>
  ${dots.join("")}
  <rect x="0" y="0" width="${width}" height="104" fill="#f4f1ea" fill-opacity="0.94"/>
  <text x="34" y="56" font-family="sans-serif" font-size="40" font-weight="700" fill="#111111">JERSEY UV CANVAS / FRONT + BACK</text>
  <text x="34" y="88" font-family="sans-serif" font-size="24" fill="#555555">Orange dots = real UV islands · dashed edge = bleed · solid box = safe area</text>
  <rect x="0" y="${height - 76}" width="${width}" height="76" fill="#111111" fill-opacity="0.88"/>
  <text x="34" y="${height - 27}" font-family="sans-serif" font-size="24" fill="#f4f1ea">Keep crests, numbers and sponsor marks inside the solid safe box. Identify front/back islands from your artwork.</text>
</svg>`;
}

async function buildGuide(documentImage, uvAccessor) {
  await fs.mkdir(path.dirname(OUT_GUIDE), { recursive: true });

  // Render the guide at the same aspect ratio as the design canvas.
  const meta = await sharp(documentImage).rotate().metadata();
  const width = GUIDE_SIZE;
  const height = Math.round((GUIDE_SIZE * meta.height) / meta.width);

  const base = await sharp({
    create: { width, height, channels: 4, background: "#f4f1ea" },
  })
    .composite([
      {
        input: await sharp(documentImage)
          .rotate()
          .resize(width, height, { fit: "fill" })
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  const overlay = await sharp(Buffer.from(buildUvOverlay(uvAccessor, width, height))).png().toBuffer();
  await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toFile(OUT_GUIDE);
}

async function main() {
  const document = await io.read(SOURCE_MODEL);
  const root = document.getRoot();

  const sourceNode =
    root.listNodes().find((node) => node.getName() === "Polo.001") ??
    root.listNodes().find((node) => node.getMesh() !== null);

  if (!sourceNode?.getMesh()) {
    throw new Error("Could not find the source jersey mesh in " + SOURCE_MODEL);
  }

  const mesh = sourceNode.getMesh();
  const primitives = mesh.listPrimitives();
  const mainPrim =
    findPrimitive(primitives, /^main design$/i) ??
    primitives.find((prim) => prim.getAttribute("TEXCOORD_0") !== null);
  const sleevePrim = findPrimitive(primitives, /sleeve end colour/i);
  const buttonPrim = findPrimitive(primitives, /button colour/i);

  if (!mainPrim) throw new Error("Main Design primitive not found — cannot build a UV template.");

  const uvAccessor = mainPrim.getAttribute("TEXCOORD_0");
  if (!uvAccessor) throw new Error("Main Design primitive has no TEXCOORD_0 UV map.");

  const fabricMaterial = mainPrim.getMaterial();
  const sleeveMaterial = sleevePrim?.getMaterial() ?? null;
  const buttonMaterial = buttonPrim?.getMaterial() ?? null;
  const originalDesignImage = fabricMaterial?.getBaseColorTexture()
    ? Buffer.from(fabricMaterial.getBaseColorTexture().getImage())
    : null;

  // The collar is part of the textured Main Design primitive, and its UVs land
  // on a solid black patch of the artwork. Pull those triangles into their own
  // solid-colour mesh so the runtime can match them to the sleeve accent.
  // Everything above y=0.85 inside radius 0.35 is the neck/collar ring; the
  // shoulders stop at radius 0.35 just below it, so this is a clean separation.
  const posAccessor = mainPrim.getAttribute("POSITION");
  if (posAccessor) {
    const point = [0, 0, 0];
    let maxY = -Infinity;
    for (let i = 0; i < posAccessor.getCount(); i++) {
      posAccessor.getElement(i, point);
      maxY = Math.max(maxY, point[1]);
    }
    const collarY = maxY - 0.15;
    const collarRadius = 0.35;
    const originalIndices = mainPrim.getIndices();

    if (originalIndices) {
      const fabricIndices = [];
      const collarIndices = [];
      // getArray() gives independent scalar values; getElement(index, target)
      // returns the shared target array, which would alias all three indices.
      const originalIndexArray = originalIndices.getArray();
      for (let f = 0; f < originalIndices.getCount(); f += 3) {
        const ids = [originalIndexArray[f], originalIndexArray[f + 1], originalIndexArray[f + 2]];
        let isCollar = true;
        for (const id of ids) {
          posAccessor.getElement(id, point);
          if (!(point[1] > collarY && Math.hypot(point[0], point[2]) < collarRadius)) {
            isCollar = false;
            break;
          }
        }
        (isCollar ? collarIndices : fabricIndices).push(...ids);
      }

      if (collarIndices.length > 0) {
        const makeIndices = (name, values) =>
          document.createAccessor(name).setType("SCALAR").setArray(new Uint32Array(values));

        mainPrim.setIndices(makeIndices("FabricIndices", fabricIndices));

        const collarMaterial = document
          .createMaterial("CollarTrim")
          .setBaseColorFactor([1, 1, 1, 1])
          .setRoughnessFactor(0.78)
          .setMetallicFactor(0.06);
        const collarPrimitive = document
          .createPrimitive()
          .setMode(mainPrim.getMode())
          .setIndices(makeIndices("CollarIndices", collarIndices))
          .setMaterial(collarMaterial);
        for (const semantic of mainPrim.listSemantics()) {
          collarPrimitive.setAttribute(semantic, mainPrim.getAttribute(semantic));
        }
        sourceNode.addChild(
          document
            .createNode("CollarTrim")
            .setMesh(document.createMesh("CollarTrim").addPrimitive(collarPrimitive)),
        );

        console.log(`collar split: ${collarIndices.length / 3} triangles → CollarTrim`);
      }
    }
  }

  // Split the single mesh into the three named objects used by the runtime contract.
  sourceNode.setName("JerseyTemplate");
  sourceNode.setMesh(null);

  const parts = [
    { name: "MainJersey", primitive: mainPrim },
    { name: "EndSleeves", primitive: sleevePrim },
    { name: "JerseyButtons", primitive: buttonPrim },
  ];

  for (const part of parts) {
    if (!part.primitive) continue;
    const partMesh = document.createMesh(part.name).addPrimitive(clonePrimitive(document, part.primitive));
    sourceNode.addChild(document.createNode(part.name).setMesh(partMesh));
  }

  fabricMaterial?.setName("JerseyFabric");
  sleeveMaterial?.setName("SleeveTrim");
  buttonMaterial?.setName("ButtonColour");

  const checkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="#e8e2d6"/>
    <path d="M0 0h128v128H0zm128 128h128v128H128z" fill="#c9c0b0"/>
    <path d="M128 0h128v128H128zM0 128h128v128H0z" fill="#f7f4ee"/>
    <path d="M2 2h252v252H2z" fill="none" stroke="#ff5a24" stroke-width="6" stroke-dasharray="14 10"/>
  </svg>`;
  const checkerPng = await sharp(Buffer.from(checkerSvg)).png().toBuffer();
  const placeholder = document
    .createTexture("JerseyFabricPlaceholder")
    .setImage(checkerPng)
    .setMimeType("image/png");
  fabricMaterial?.setBaseColorTexture(placeholder);

  if (originalDesignImage) {
    await buildGuide(originalDesignImage, uvAccessor);
  }

  await document.transform(dedup(), prune());

  // Keep the split index accessors as plain buffer views. Re-compressing them
  // with meshopt after the split produced incorrect collar geometry.
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === "EXT_meshopt_compression") {
      document.getRoot()._disableExtension(extension);
    }
  }
  const writeIO = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  await writeIO.write(OUT_MODEL, document);

  // Demo designs. Full artwork must be UV-aligned to this template; the
  // extracted textures already are, so they are perfect for testing.
  const yashImage = originalDesignImage ?? (await extractMainTextureImage(SOURCE_MODEL));
  const slhsImage = await extractMainTextureImage(SLHS_MODEL);
  const designs = [];

  if (yashImage) {
    const files = await writeWebpPair(yashImage, "yash24-player", "sports");
    designs.push({
      id: "yash24-player",
      title: "YASH 24 — Player Edition",
      category: "sports",
      accent: "#ff5a24",
      silhouette: "athletic",
      ...files,
    });

    const variantImage = await sharp(yashImage)
      .rotate()
      .modulate({ hue: 155, saturation: 1.15, brightness: 1.02 })
      .png()
      .toBuffer();
    const variantFiles = await writeWebpPair(variantImage, "festival-chevron", "festival");
    designs.push({
      id: "festival-chevron",
      title: "Festival Chevron",
      category: "festival",
      accent: "#7c5cff",
      silhouette: "oversized",
      ...variantFiles,
    });
  }

  if (slhsImage) {
    const files = await writeWebpPair(slhsImage, "slhs-crest", "sports");
    designs.push({
      id: "slhs-crest",
      title: "SLHS 24 — Xavier Edition",
      category: "sports",
      accent: "#8d2438",
      silhouette: "polo",
      ...files,
    });
  }

  for (const category of ["sports", "festival", "commercial"]) {
    await fs.mkdir(path.join(DESIGN_ROOT, category), { recursive: true });
  }
  await fs.writeFile(MANIFEST, JSON.stringify({ designs }, null, 2) + "\n");

  console.log(
    JSON.stringify(
      {
        template: path.relative(ROOT, OUT_MODEL),
        uvGuide: path.relative(ROOT, OUT_GUIDE),
        designs: designs.map(({ id, category }) => ({ id, category })),
      },
      null,
      2,
    ),
  );
}

await main();
