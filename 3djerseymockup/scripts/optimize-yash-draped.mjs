import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

const INPUT = process.argv[2] ?? ".cache/yash24-draped.glb";
const OUTPUT = process.argv[3] ?? "public/models/jersey-yash24.glb";

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const document = await io.read(INPUT);
const root = document.getRoot();

// Blender leaves .001 suffixes when the source scene already has same-named materials.
for (const material of root.listMaterials()) {
  material.setName(material.getName().replace(/\.\d{3}$/, ""));
}

await document.transform(
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

await io.write(OUTPUT, document);

const report = {
  sourceBytes: fs.statSync(INPUT).size,
  outputBytes: fs.statSync(OUTPUT).size,
  vertices: root.listMeshes().flatMap((m) => m.listPrimitives().map((p) => p.getAttribute("POSITION").getCount())),
  textures: root.listTextures().map((texture) => ({ mime: texture.getMimeType(), size: texture.getSize() })),
  materials: root.listMaterials().map((material) => material.getName()),
};
console.log(JSON.stringify(report, null, 2));
