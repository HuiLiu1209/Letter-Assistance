# A Typed Note

Interactive Underwood typewriter study using the user-supplied `Final Model and Textures.rar`.

## Run

`npm start` serves the standalone website at http://127.0.0.1:4173.
The deployable output is already in `dist/`; it needs no build, CDN or runtime package installation.

## Features

- Real keyboard and clickable 3D keys, Chinese input, Enter, Backspace and paste.
- Independent key travel, typebar strike, animated carriage and paper feed.
- Synthesized key, return and margin-bell sounds; sound toggle.
- Orbit/zoom, front/mechanism/paper views, letter demo, new paper and text download.
- Maximum 18 lines per sheet. Content lives in memory and clears on reload.

## Assets

Original source: `source-assets/Final Model and Textures/SM_Typewriter_01.fbx` and nine 4096px TGA textures, supplied by the user. The archive's Substance Painter project was not extracted because it is unnecessary for playback. Original archive and textures are unchanged.

`scripts/prepare-model.mjs` separates disconnected geometry into keys, typebars and carriage groups, normalizes coordinates and exports an indexed GLB. 47 key groups and 43 typebar groups are individually animated. Motion is a visual approximation, not a mechanically exact linkage simulation.

Textures are converted to 2048px JPEG for browser use. Original RMA channels are remapped from roughness/metalness/AO to AO/roughness/metalness. DirectX normals use an inverted green component.

Third-party assets: Three.js 0.170.0, MIT license, retained at `dist/vendor/THREE-LICENSE.txt`. The model is user-supplied; this project does not claim ownership or attach a new license to it. Code is original, using the Spline example as an interaction reference; no Spline source or assets were copied.

## Implementation limits

Paper printing is a dynamic canvas texture. Chinese characters appear on the paper but do not have matching physical keycaps. The source FBX has three merged meshes and no original rig; components were separated geometrically. Carriage and linkage animations are approximate. No AI service is connected.
