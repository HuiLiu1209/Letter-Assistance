# Letter Assistance

An Underwood typewriter on a dark red cloth with warm three-point lighting. The interface follows the supplied [Figma design](https://www.figma.com/design/92HDuPvzQd3dD5tLyaorC8/DesComp?node-id=0-1): collapsible Instructions / Role Card and Letters sections, a System Diagram, and the bottom composer.

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

1. Open Instructions to view the Role Cards. Resignation Letter and Thank-You Letter are the presets. View all eight fields and choose “Use this role”, or create/edit a custom Role Card.
2. Describe the letter in the bottom composer. Enter submits; Shift+Enter adds a line.
3. A separate paper mesh appears in the typewriter. Gemini receives the selected Role Card as its system instruction and the current request as user input. It returns the finished letter directly, without a chat or review step.
4. GSAP animates the sheet, camera framing, key presses, progressive printing, accordion sections and dialogs. Reduced-motion preferences skip movement and progressive typing.
5. Completed letters are saved in localStorage and opened read-only through Letters. Changing a Role Card never changes an existing letter. Requests that fail are retained in the composer and do not create saved letters.

There is no conversation history, letter editing, cloud database, upload or STT. The browser stores custom Role Cards, finished letters (including the original request and Role Card snapshot), selected role and the next request draft. Clearing browser data removes these records. Storage failures display a notice instead of claiming a save succeeded.

System Diagram explains the implemented flow and what is sent to Google. The model picker currently contains the single model shown in Figma, `gemini-3.5-flash-lite`.

## API and deployment

`server.mjs` serves `dist/` and handles `POST /api/chat`. The Gemini API key is read only on the server from `GEMINI_API_KEY`; `.env.local` is ignored by Git. Never put a key in browser JavaScript, localStorage, a screenshot or a commit.

`api/chat.js` and `vercel.json` provide the same handler for Vercel. Import the repository, select this feature branch, and set `GEMINI_API_KEY` in the deployment environment. The project has no build step beyond JavaScript checks. A purely static host can display the scene/UI, but needs a server route at `/api/chat` to generate letters. This branch does not replace the approved scene-only site automatically.

The handler validates all eight fields and request size, allows only the configured model, applies a timeout, and surfaces missing credentials, quota failures, blocked responses and incomplete output without exposing upstream diagnostics. Finished letters are returned as text; the browser displays user/model text through `textContent` or canvas, never as executable HTML.

## Validation

```sh
npm run check
npm test
```

The seven automated tests cover the real HTTP handler with a stubbed Gemini transport: request/system-instruction separation, required fields, unsupported models, missing keys, quota/timeout/blocked/truncated failures, and browser-storage recovery and snapshots.

`node tests/preview-server.mjs` runs an explicitly isolated UI fixture at http://127.0.0.1:4174. It always returns a fixed example and is only for checking printing and saved-letter interactions; it is not used by `npm start` or the deployed API. Live Gemini generation must be checked after supplying a valid key.

## Model, textures and libraries

The approved lighting, geometry and nine original 4096×4096 textures remain unchanged. Printing adds a separate paper mesh and temporarily animates key positions and camera framing. The scene stays as approved before a letter is requested.

Original source is retained under ignored `source-assets/`. `scripts/prepare-model.mjs` exports indexed GLB geometry with disconnected components separated for animation. `scripts/prepare-textures.py` only changes the TGA container to lossless PNG, verifying pixel-identical decoded images. The shaders read the original RMA channels: R roughness, G metalness, B ambient occlusion. Base color uses sRGB; data maps remain linear; DirectX normals invert green in the material.

Three.js 0.170.0 (MIT), GSAP 3.15.1 ([standard license](https://gsap.com/standard-license)), and IBM Plex Serif (SIL Open Font License) are served locally with license notices. The UI SVGs were exported from the supplied Figma file. The user-supplied model retains its own ownership and licensing. No Spline assets or code were copied.
