# Underwood — scene study

A full-window 3D Underwood typewriter on a dark red woven tablecloth, in a near-black environment with warm three-point studio lighting.

## Run

`npm start` serves the website at http://127.0.0.1:4173. The deployable output is already in `dist/`; no build is needed.

## Current scope

The screen contains only the typewriter and its environment. There are no headings, menus, action buttons, writing controls, sound effects, extra paper, character counters or AI functions. Dragging and scrolling move the viewing camera. Functions will be reconsidered after the scene direction is approved.

The three light roles are a broad warm main light, a narrow contour light, and an upper-right accent targeting the carriage/backplate. Reflection cards correspond to those same three lights. The cloth has a generated weave, a continuous rounded table edge and hanging folds, with shadows from the real model.

## Model and textures

The supplied Underwood geometry and all nine original 4096×4096 texture images are unchanged by this scene redesign. Original source is retained under ignored `source-assets/`. The source archive's Substance Painter project is not needed for playback and was not extracted.

`scripts/prepare-model.mjs` previously exported the FBX as an indexed GLB with normalized coordinates and separated disconnected components. This scene loads those components in their original resting positions; no key or carriage animations are applied.

`scripts/prepare-textures.py` changes only the TGA container to lossless PNG, verifying all nine decoded images are pixel-identical. Original RMA channels remain intact; shaders read R for roughness, G for metalness and B for ambient occlusion. Base color uses sRGB, data maps have no color-space transform, and DirectX normals invert green in the material.

Three.js 0.170.0 is used under MIT, with its license retained at `dist/vendor/THREE-LICENSE.txt`. The user-supplied model retains its own ownership and licensing. No Spline assets or code were copied.
