# Letter Assistance

An Underwood typewriter on a dark red cloth with warm three-point lighting. The interface follows the supplied [Figma design](https://www.figma.com/design/92HDuPvzQd3dD5tLyaorC8/DesComp?node-id=0-1): collapsible Role Card and Letters sections, a System Diagram, and the bottom composer.

`main` preserves the approved scene-only baseline. `feat/figma-letter-workspace` contains the writing interface and printing flow.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
cp .env.example .env.local
# Add your Gemini API key to .env.local.
npm start
```

Open http://127.0.0.1:4173. Without a key, the scene, Role Cards and saved-letter viewer work; submitting a request gives a connection setup message and retains the request. No generated reply is fabricated.

## Writing flow

1. Open Role Card and click a preset to select it immediately. General Letter is the default preset for any kind of letter; Resignation Letter and Thank-You Letter remain available as focused presets. New Role Card opens the eight-field custom card form; the pencil beside an existing custom row edits it.
2. Describe the letter in the bottom composer. Enter submits; Shift+Enter adds a line. Before text reaches the compact input width, the composer keeps its width and grows upward through a GSAP height transition into a two-row layout: full-width text above, model and send controls together at the bottom right. Its bottom edge stays fixed. The Send arrow brightens only for non-blank input.
3. Only the leading edge of a full-size paper sheet emerges from the roller. Gemini receives the selected Role Card as its system instruction and the current request as user input. Letters are concise by default (30–60 English words or 40–90 Chinese characters, unless a different length is requested); missing dates, names, projects and contact details are omitted rather than filled with placeholders. Its streaming text is queued as it arrives, without a chat or review step. The paper wraps around the original roller and exits toward the Underwood backplate. Each character depresses its key, swings a typebar to the fixed print point, stamps the glyph, and advances the carriage. Each new line returns the carriage and feeds the sheet upward; neither the paper nor its ink is stretched.
4. GSAP animates line feed, camera framing, key presses, incremental printing, accordion sections and dialogs. The Platen bell rings on non-empty line returns. Reduced-motion preferences skip movement and progressive typing.
5. Completed letters are saved in localStorage and opened read-only through Letters. Changing a Role Card never changes an existing letter. Requests that fail are retained in the composer and do not create saved letters.

There is no conversation history, letter editing, cloud database, upload or STT. The browser stores custom Role Cards, finished letters (including the original request and Role Card snapshot), selected role and the next request draft. Clearing browser data removes these records. Storage failures display a notice instead of claiming a save succeeded.

System Diagram explains the implemented flow and what is sent to Google. The model picker currently contains the single model shown in Figma, `gemini-3.5-flash-lite`.

## Sample mode

Open http://127.0.0.1:4173/?demo=1 to test paper insertion, progressive printing and read-only saved letters without a key. The model picker explicitly says **Sample letter**, with a visible sample-mode note. Press Send to print the fixed example corresponding to the selected preset. Requests and custom instructions do not change the example, and no API call is made. Sample letters are marked in the saved-letter viewer.

Use the model picker to switch back to Gemini (the normal URL without `?demo=1`) after configuring the key. This is an explicit preview mode, never an automatic fallback for failed Gemini requests.

## API and deployment

`server.mjs` serves `dist/` and handles `POST /api/chat`. The Gemini API key is read only on the server from `GEMINI_API_KEY`; `.env.local` is ignored by Git. Never put a key in browser JavaScript, localStorage, a screenshot or a commit.

`api/chat.js` and `vercel.json` provide the same handler for Vercel. Import the repository, select this feature branch, and set `GEMINI_API_KEY` in the deployment environment. The project has no build step beyond JavaScript checks. A purely static host can display the scene/UI, but needs a server route at `/api/chat` to generate letters. This branch does not replace the approved scene-only site automatically.

The handler validates all eight fields and request size, allows only the configured model, applies a timeout, forwards Gemini `streamGenerateContent` SSE chunks without collecting the whole response, and surfaces missing credentials, quota failures, blocked responses and incomplete output without exposing upstream diagnostics. Finished letters are returned as text; the browser displays user/model text through `textContent` or canvas, never as executable HTML.

## Validation

```sh
npm run check
npm test
```

The automated tests cover the real HTTP handler with a stubbed Gemini transport: request/system-instruction separation, required fields, unsupported models, missing keys, quota/timeout/blocked/truncated failures, browser-storage recovery and snapshots, SSE chunk boundaries, Unicode, incomplete streams, incremental layout, delivery of the first model chunk before completion, all 43 typebar impact points, carriage/body separation, unchanged resting mesh bounds, and the paper path over the backplate.

`node tests/preview-server.mjs` runs an explicitly isolated UI fixture at http://127.0.0.1:4174. It returns a fixed example in paced SSE chunks and is only for checking printing and saved-letter interactions; it is not used by `npm start` or the deployed API. Live Gemini generation must be checked after supplying a valid key.

## Model, textures and libraries

The approved lighting, source geometry and nine original 4096×4096 textures remain unchanged. The GLB export separates the existing roller component for rotation, retaining its original vertices and UVs. Printing adds a separate paper mesh and animates the upper carriage, roller, typebars, key positions and camera framing. Typebar hinges are calibrated so every rigid slug reaches the same fixed printing point; the body and feet stay fixed. The scene stays as approved before a letter is requested.

Original source is retained under ignored `source-assets/`. `scripts/prepare-model.mjs` exports indexed GLB geometry with disconnected components separated for animation. `scripts/prepare-textures.py` only changes the TGA container to lossless PNG, verifying pixel-identical decoded images. The shaders read the original RMA channels: R roughness, G metalness, B ambient occlusion. Base color uses sRGB; data maps remain linear; DirectX normals invert green in the material.

Three.js 0.170.0 (MIT), GSAP 3.15.1 ([standard license](https://gsap.com/standard-license)), and IBM Plex Serif (SIL Open Font License) are served locally with license notices. The UI SVGs were exported from the supplied Figma file. The user-supplied model retains its own ownership and licensing. No Spline assets or code were copied.

## Platen reference and bell attribution

Paper feed follows the roller-path / page-coordinate approach observed in [Platen](https://github.com/winchxyz/platen). This project uses its original procedural audio engine for the bell (portable profile), not a substituted audio recording. The engine and its utility module are retained in `dist/vendor/platen/` with the upstream MIT license, copyright © 2026 winch. Reference commit: `f7497c83dee41f660443ebaf23f64bae15886ca3`. No Platen model or UI was imported.

Audio is unlocked by the Send gesture. A blocked audio device never prevents printing. Reduced-motion mode skips key movement and progressive feed. Sample mode uses paced local chunks; real Gemini mode uses actual upstream streaming, and partial / failed streams are never saved as completed letters.
