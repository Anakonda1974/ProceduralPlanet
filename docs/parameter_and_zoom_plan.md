# Plan for User Parameters and Zoom-Based Detail

This document outlines how to expose planet generation parameters to the user and how to make zooming seamlessly increase surface detail.

## Parameter Controls

1. **UI Sliders/Inputs**
   - A quick solution is to use `dat.GUI` with controls for common parameters:
     - Noise seed
     - Elevation scale
     - Noise frequency and octaves
     - Ocean level
  - Bind these inputs to reactive variables so changes immediately update the shader uniforms.
  - A more polished Vuetify-based UI can later replace the `dat.GUI` panel.

2. **Persistence**
   - Store current parameter values in `localStorage` to preserve settings across sessions.
   - Optionally allow sharing a parameter preset via URL query parameters.

3. **Validation and Defaults**
   - Provide sensible default values and ranges.
   - Validate user input to avoid unrealistic or unstable values.

## Zoom-Dependent Detail

1. **Adaptive Geometry**
   - Swap the planet mesh for a version with more segments when the camera zooms in.
   - Use `THREE.SphereGeometry` with different resolutions (e.g. 128/256/512 segments).

2. **Dynamic Noise Scale**
   - Increase the frequency of the noise functions as the camera gets closer.
   - Update shader uniforms based on `camera.position` or current zoom distance.

3. **Smooth Transitions**
   - Fade between geometry levels or interpolate noise parameters to avoid popping artifacts.
   - Consider using `LOD` (level of detail) helpers in Three.js for automatic switching.

Implementing these steps will allow users to experiment with generation settings while ensuring that zooming reveals additional detail without noticeable transitions.
