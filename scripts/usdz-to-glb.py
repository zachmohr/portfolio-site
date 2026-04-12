#!/usr/bin/env python3
"""
Convert a USDZ file to GLB using Blender (headless).

Usage:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/usdz-to-glb.py -- input.usdz [output.glb]

If output is omitted, writes to the same path with a .glb extension.
"""

import sys
import os

# Blender passes args after "--"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

if not argv:
    print("Usage: blender --background --python scripts/usdz-to-glb.py -- <input.usdz> [output.glb]")
    sys.exit(1)

input_path = os.path.abspath(argv[0])
if len(argv) > 1:
    output_path = os.path.abspath(argv[1])
else:
    output_path = os.path.splitext(input_path)[0] + ".glb"

print(f"Converting: {input_path}")
print(f"Output:     {output_path}")

import bpy

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import USDZ (Blender treats it as USD)
bpy.ops.wm.usd_import(filepath=input_path)

# Select all mesh objects and apply transforms so geometry is baked
# at identity scale/rotation/translation
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Join all mesh objects into a single object to flatten the hierarchy
# and eliminate per-node transforms entirely
mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if mesh_objects:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.object.join()

print(f"Objects after join: {len(bpy.context.scene.objects)}")

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format='WEBP',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
)

size_mb = os.path.getsize(output_path) / 1024 / 1024
print(f"Done — {size_mb:.2f} MB")
