# Gouache Studio 0.46.9

- The 3D view keeps unchanged material maps while painting simple single-channel strokes. Small brush changes update just the affected texture area and its smaller mip levels.
- Painting directly on the model uses cached triangle bounds to find the affected texture area. Masks, multi-channel painting, dependent effects, height/normal work and unusual UVs retain full updates where needed.
- Animated film grain reuses the rendered scene, bloom and occlusion while the view stays still, including detached 3D windows. It follows the selected grain frame rate.
- Camera snaps, projection changes and post-processing controls update the view without rebuilding the document's material maps.
- The performance monitor now shows 3D texture work, scene draws and reused post-processing scenes.
