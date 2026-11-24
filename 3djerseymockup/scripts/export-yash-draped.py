"""
Exports the YASH 24 jersey from the supplied Blender template in its draped,
sleeves-down pose.

The template's cloth motion lives in `Animation Cache.abc`; it is sampled at
FRAME and baked into a static GLB. The front design texture is the 4096px JPEG
extracted from the original web model and kept in `models/yash24-texture.jpg`.

Usage (Blender 5.x):
  blender -b "models/3D Mockup Template - Copy.blend" --python scripts/export-yash-draped.py

Output: .cache/yash24-draped.glb
"""

import bpy
import os
from mathutils import Matrix, Vector

FRAME = 50
TARGET_HEIGHT = 3.3

models_dir = os.path.dirname(bpy.data.filepath)
texture_path = os.path.join(models_dir, "yash24-texture.jpg")
output_path = os.path.join(models_dir, "..", ".cache", "yash24-draped.glb")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

scene = bpy.context.scene
scene.frame_set(FRAME)

source = bpy.data.objects["Polo"]
if source.animation_data:
    source.animation_data_clear()
source.rotation_euler = (0.0, 0.0, 0.0)
source.location = (0.0, 0.0, 0.0)
source.scale = (1.0, 1.0, 1.0)
bpy.context.view_layer.update()

depsgraph = bpy.context.evaluated_depsgraph_get()
depsgraph.update()
baked = bpy.data.meshes.new_from_object(
    source.evaluated_get(depsgraph),
    preserve_all_data_layers=True,
    depsgraph=depsgraph,
)
print(f"Baked {len(baked.vertices)} verts / {len(baked.polygons)} polys")

# Normalize to the same height used by the site and put the hem at Z=0.
baked.update()
mins = Vector((min(v.co.x for v in baked.vertices), min(v.co.y for v in baked.vertices), min(v.co.z for v in baked.vertices)))
maxs = Vector((max(v.co.x for v in baked.vertices), max(v.co.y for v in baked.vertices), max(v.co.z for v in baked.vertices)))
scale = TARGET_HEIGHT / (maxs.z - mins.z)
baked.transform(Matrix.Diagonal((scale, scale, scale, 1.0)))
baked.update()
mins = Vector((min(v.co.x for v in baked.vertices), min(v.co.y for v in baked.vertices), min(v.co.z for v in baked.vertices)))
maxs = Vector((max(v.co.x for v in baked.vertices), max(v.co.y for v in baked.vertices), max(v.co.z for v in baked.vertices)))
baked.transform(
    Matrix.Translation(
        (
            -(mins.x + maxs.x) / 2,
            -(mins.y + maxs.y) / 2,
            -mins.z,
        )
    )
)
baked.update()

export_obj = bpy.data.objects.new("Polo", baked)
scene.collection.objects.link(export_obj)
export_obj.matrix_world = Matrix.Identity(4)

# Rename the template's materials first so the web materials keep exact names.
for name in ("Main Design", "Button Colour", "Sleeve End Colour"):
    existing = bpy.data.materials.get(name)
    if existing:
        existing.name = f"{name} (source)"

image = bpy.data.images.load(texture_path, check_existing=False)
image.colorspace_settings.name = "sRGB"

main_mat = bpy.data.materials.new("Main Design")
main_mat.use_nodes = True
nodes = main_mat.node_tree.nodes
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
output.location = (400, 0)
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.location = (100, 0)
bsdf.inputs["Roughness"].default_value = 0.78
bsdf.inputs["Metallic"].default_value = 0.06
texture = nodes.new("ShaderNodeTexImage")
texture.location = (-320, 100)
texture.image = image
main_mat.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
main_mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

button_mat = bpy.data.materials.new("Button Colour")
button_mat.use_nodes = True
button_bsdf = button_mat.node_tree.nodes["Principled BSDF"]
button_bsdf.inputs["Base Color"].default_value = (1.0, 0.899, 0.994, 1.0)
button_bsdf.inputs["Metallic"].default_value = 0.69
button_bsdf.inputs["Roughness"].default_value = 0.53

sleeve_mat = bpy.data.materials.new("Sleeve End Colour")
sleeve_mat.use_nodes = True
sleeve_bsdf = sleeve_mat.node_tree.nodes["Principled BSDF"]
sleeve_bsdf.inputs["Base Color"].default_value = (0.896, 0.807, 0.672, 1.0)
sleeve_bsdf.inputs["Metallic"].default_value = 0.0
sleeve_bsdf.inputs["Roughness"].default_value = 0.5

for index, material in enumerate((main_mat, button_mat, sleeve_mat)):
    if index < len(export_obj.data.materials):
        export_obj.data.materials[index] = material

bpy.ops.object.select_all(action="DESELECT")
export_obj.select_set(True)
bpy.context.view_layer.objects.active = export_obj

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
)

print(f"Wrote {output_path} ({os.path.getsize(output_path)} bytes)")
