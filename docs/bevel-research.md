# Scene-aware bevel shading

Public references:

- [Toolbag Surface module: Bevel](https://docs.marmoset.co/docs/bevel-mode-surface-module/)
- [Marmoset's bevel workflow guide](https://marmoset.co/posts/revolutionize-your-3d-workflow-with-toolbags-bevel-shader/)

The documentation establishes ray-traced rounded-normal shading, physical width, an angle limit, a sample-quality setting, authored hard-edge control, optional restriction to the same object, vertex-color width masks, and normal-map baking. It also describes per-material widths and material-layer masks. It does not disclose Toolbag's internal implementation. We cannot infer its exact sampling distribution, weighting, or acceleration structure from these pages.

Gouache's independent implementation casts short chords through a sphere around a surface point, using the existing mesh BVH. It samples three orthogonal directions and weights normal contributions by projected area and a radial kernel. Probes use the whole source mesh, so unrelated triangles, material boundaries, and intersections can contribute. Same-surface filtering uses object identity, independent of the baker's name-match filter. Opposite faces are rejected to keep thin walls from canceling the normal. This sampling/weighting choice is our implementation, not a claim about Marmoset's private algorithm.

Hard edges are detected from discontinuities in imported corner normals. A typed edge table runs in a worker for larger meshes; the retained result is one byte per face. A dedicated viewport surface pass computes normals in tiles and reuses the material's normal sampler, avoiding a seventeenth fragment sampler on Windows. It uses the same probe shader as baking, preserves incoming normal detail, and avoids expanding every triangle corner into a second large mesh buffer. High-poly preview uses material lighting so rounded specular highlights can be assessed.

Validation covers synthetic convex/concave corners, triangulation changes, thin panels, intersecting objects, duplicate high-object names, millimeter scale conversion, masks, incoming normal detail, normal-map outputs, shader limits, and actual low/high preview pixels. Local validation additionally runs through the NVIDIA RTX 4080/D3D11 driver and the material-preview mesh referenced by the user's Red dot project.

Remaining differences: global bake width rather than per-material width/layer masks, the approximate profile produced by this kernel, and finite local intersection traversal (up to eight hits per chord). Sampling quality can change the result. There is no silhouette/geometry modification. Visual equivalence to Toolbag has not been established with matched Toolbag reference renders.
