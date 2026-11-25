import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync } from 'fs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const files = process.argv.slice(2);
for (const file of files) {
  console.log('\n===', file, '===');
  try {
    const doc = await io.read(file);
    const root = doc.getRoot();
    console.log('Meshes:');
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial();
        const attrs = prim.listSemantics();
        const uvSets = attrs.filter(s => s.startsWith('TEXCOORD'));
        console.log(`  - mesh.name=${JSON.stringify(mesh.getName())} primAttrs=[${attrs.join(',')}] uvSets=[${uvSets.join(',')}] material=${JSON.stringify(mat?.getName()||null)}`);
        if (mat) {
          const tex = mat.getBaseColorTexture();
          console.log(`    material.baseColorFactor=${JSON.stringify(mat.getBaseColorFactor())} baseColorTex=${JSON.stringify(tex?.getName()||tex?.getURI()||null)} roughness=${mat.getRoughnessFactor()} metallic=${mat.getMetallicFactor()}`);
        }
      }
    }
    console.log('Materials:');
    for (const mat of root.listMaterials()) {
      console.log(`  - ${JSON.stringify(mat.getName())} baseColorTex=${!!mat.getBaseColorTexture()} normal=${!!mat.getNormalTexture()} orm=${!!mat.getMetallicRoughnessTexture()}`);
    }
    console.log('Nodes:');
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      console.log(`  - node=${JSON.stringify(node.getName())} mesh=${JSON.stringify(mesh?.getName()||null)}`);
    }
  } catch (e) {
    console.error('  ERROR', e.message);
  }
}
