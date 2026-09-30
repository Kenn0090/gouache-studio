The 3D Paint viewport gets a layout strip, and texture sets get an eyeball.

- **Viewport strip:** a small pill at the bottom of the 3D Paint area switches between **3D**, **Split** and **2D**, and turns the **UV** layout on and off. In Split the two views start the same size, and you can drag the divider. The flat texture keeps its own zoom.
- **UV layout on by default** over the flat texture in 3D Paint, so you can see where things land.
- **Eyeball on each texture set:** hide a set and the parts of the model that use it disappear from the 3D view. It is saved with the project. The Bake mesh maps window leaves hidden sets unticked, so you can bake in groups.
- **File menu in 3D Paint** now has **Import a model** and **Bake mesh maps** in it.
- **Update a saved smart material or smart mask:** right-click a folder that came from your saved smart material (or a layer whose mask came from your saved smart mask) and choose **Update smart material “name” in Materials** (or the mask one). It asks first, then puts your changes back into the library. The built-in ones can't be overwritten: use Save as to keep your own version.
