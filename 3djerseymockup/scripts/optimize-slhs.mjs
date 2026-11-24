import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

// The SLHS source is the same 427,302-vertex jersey mesh as YASH 24, but its
// sleeves are still in the flat T-pose. Reuse the settled YASH bake as the pose
// base and swap the design texture, so the sleeves hang like the other kits.
const POSE_INPUT = fs.existsSync(".cache/yash24-draped.glb")
  ? ".cache/yash24-draped.glb"
  : "public/models/jersey-yash24.glb";
const DESIGN_INPUT = process.argv[2] ?? "models/SLHSrender.glb";
const OUTPUT = process.argv[3] ?? "public/models/slhs.glb";

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

const poseDocument = await io.read(POSE_INPUT);
const designDocument = await io.read(DESIGN_INPUT);

const poseRoot = poseDocument.getRoot();
const designRoot = designDocument.getRoot();

const designMain = designRoot.listMaterials().find((material) => material.getName() === "Main Design");
const poseMain = poseRoot.listMaterials().find((material) => material.getName() === "Main Design");

if (!designMain || !poseMain) {
  throw new Error("Expected a Main Design material in both the pose and design models.");
}

const designTexture = designMain.getBaseColorTexture();
const poseTexture = poseMain.getBaseColorTexture();

if (!designTexture || !poseTexture) {
  throw new Error("Expected a base color texture on both Main Design materials.");
}

poseTexture
  .setImage(new Uint8Array(designTexture.getImage()))
  .setMimeType(designTexture.getMimeType())
  .setName(designTexture.getName());

// Carry the SLHS material colours (collar buttons, cuff trim) across too.
for (const poseMaterial of poseRoot.listMaterials()) {
  const designMaterial = designRoot
    .listMaterials()
    .find((material) => material.getName() === poseMaterial.getName());

  if (!designMaterial) continue;

  poseMaterial
    .setBaseColorFactor(designMaterial.getBaseColorFactor())
    .setMetallicFactor(designMaterial.getMetallicFactor())
    .setRoughnessFactor(designMaterial.getRoughnessFactor());
}

for (const animation of poseRoot.listAnimations()) {
  animation.dispose();
}

designRoot.dispose();

await poseDocument.transform(
  dedup(),
  prune(),
  textureCompress({
    encoder: sharp,
    targetFormat: "jpeg",
    resize: [4096, 4096],
    quality: 90,
    chromaSubsampling: "4:4:4",
  }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

await io.write(OUTPUT, poseDocument);

const report = {
  poseSource: POSE_INPUT,
  designSource: DESIGN_INPUT,
  outputBytes: fs.statSync(OUTPUT).size,
  vertices: poseRoot.listMeshes().flatMap((mesh) => mesh.listPrimitives().map((primitive) => primitive.getAttribute("POSITION").getCount())),
  textures: poseRoot.listTextures().map((texture) => ({ mime: texture.getMimeType(), size: texture.getSize() })),
  materials: poseRoot.listMaterials().map((material) => material.getName()),
};
console.log(JSON.stringify(report, null, 2));
