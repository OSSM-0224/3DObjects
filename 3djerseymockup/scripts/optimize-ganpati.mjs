import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

const INPUT = "models/GanpatiBlue_roundNeckJersey.glb";
const OUTPUT = "public/models/ganpati-blue.glb";

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const document = await io.read(INPUT);
const root = document.getRoot();

let removed = 0;
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMaterial()?.getName() === "Stitching") {
      mesh.removePrimitive(primitive);
      removed += 1;
    }
  }
}

console.log(`Removed ${removed} stitching primitives`);

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
};
console.log(JSON.stringify(report, null, 2));
