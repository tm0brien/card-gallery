# Slab extraction pipeline

Automatically derives transparent-plastic rendering data from graded-card
scans that were captured against a white scanner background.

For each source texture the pipeline produces:

```
source texture
├── opaque color texture      (card + label + retained slab markings, RGBA)
├── plastic transmission mask (0 = opaque, 1 = background shows through)
├── plastic highlight map     (thin bright structure: bevels, ridges, scratches)
└── plastic shadow map        (thin dark structure: seams, recesses)
```

The rendered result is composed as:

```
physically rendered transparent plastic
+ original opaque card and label
+ bright scanned slab details   (Screen blend, Fresnel-modulated)
+ subtle dark scanned slab details (Multiply blend)
```

The pipeline does **not** locate or align the slab; supplied images are
assumed to be already cropped, oriented, and mapped (the existing
`normalize-card-scans` output).

## Diagnostic page

```
/dev/slab-extraction
```

- Shows Original / Opaque texture / Transmission mask / Highlight map /
  Shadow map / Protected mask / 2D composite / 3D preview for one source
  image (sample cards or an uploaded file, front or back face).
- Preview background: white, black, mid-gray, brown gradient (approximates
  the "study" viewer backdrop), checkerboard, red, blue.
- The 2D composite has a draggable before/after divider (original opaque
  rendering vs extracted transparent rendering). The 3D preview has an
  `original` / `extracted` mode toggle.
- Protected rectangles are edited directly on the Original preview: drag the
  body to move, drag corners to resize; overlay can be hidden.
- All settings persist to `localStorage`, keyed per card + face, so front and
  back scans keep independent rectangles. `Reset defaults`, `Copy JSON`,
  `Load JSON`, and `Download maps` (PNG per map + composite) are in the
  Config section.
- The header line reports the processing resolution, last pipeline runtime,
  and the estimated scanner-white color.

`scripts/screenshot-workbench.mjs` and `scripts/verify-workbench.mjs` are
optional dev helpers that capture the page headlessly
(`npm i -D --no-save puppeteer-core` first; they use the system Chrome).

## Module layout

```
src/slab-extraction/
  types.ts             config + buffer types (Float32Array images)
  color.ts             luminance, chroma, smoothstep, clamp, mix
  blur.ts              fast 3-pass box approximation of Gaussian blur
  morphology.ts        grayscale erode/dilate (signed "morphology" control)
  white-estimation.ts  scanner-white estimation from corner/edge patches
  protected-regions.ts feathered card/label mask from normalized rects
  transmission.ts      per-pixel plastic likelihood + final mask filtering
  high-pass.ts         signed detail = luminance − blur, highlight/shadow split
  opaque-texture.ts    RGBA opaque color texture with derived alpha
  compositor.ts        deterministic 2D reference compositor
  pipeline.ts          staged runner with per-stage memoization
  presets.ts           defaults + verified sample preset + config merge
  browser.ts           DOM helpers (image IO, backgrounds, downloads) — not
                       imported by the core so tests stay node-only
  index.ts             public exports
src/components/slab-extraction/
  SlabExtractionWorkbench.tsx  page orchestration + controls
  ProtectedRegionEditor.tsx    draggable/resizable normalized rects
  MaskPreview.tsx              labelled canvas tile
  CompositePreview.tsx         2D compositor + before/after divider
  Slab3DPreview.tsx            Three.js layer stack
```

Everything in `src/slab-extraction/` except `browser.ts` is pure TypeScript
over `Float32Array`s — no DOM — and is covered by vitest
(`npm test`, fixtures generated in code).

## How the algorithm works

1. **Scanner white** (`white-estimation.ts`) — the clear plastic near the
   slab's outer corners is a direct sample of the scanner backlight. Eight
   small patches (4 corners + 4 edge midpoints, inset 2%) are averaged; the
   darkest half is discarded (corners can land on molded seams) and the
   per-channel median of the rest is the scanner-white estimate. No
   hardcoded RGB value; a floor of 0.25 per channel guards division.

2. **Protected mask** (`protected-regions.ts`) — two normalized rectangles
   (card, label) rasterized with a linear feather (`featherPx`, default 2)
   centered on the rect boundary. 1 = must stay opaque, 0 = plastic-eligible.

3. **Transmission mask** (`transmission.ts`) — per pixel, channels are first
   normalized against scanner white, then:

   ```
   brightnessScore  = smoothstep(brightnessMin, brightnessMax, luminance)
   neutralityScore  = 1 − smoothstep(neutralityMin, neutralityMax, chroma)
   plasticLikelihood = brightnessScore × neutralityScore × plasticEligible
   ```

   The raw mask then gets optional erode/dilate, a Gaussian blur, is
   re-clamped against the protected mask (so blur cannot bleed transmission
   into the card/label), and is scaled by `strength`.

4. **Signed detail** (`high-pass.ts`) —
   `signedDetail = (luminance − gaussianBlur(luminance, radius)) × plasticEligible`.
   The blur removes the broad scanner-white illumination while keeping
   local structure. The radius is expressed relative to image size by
   default (`0.004 × max(width, height)` ≈ 6 px on a 1500 px scan).

5. **Highlight / shadow maps** — thresholded, gained, denoised positive and
   negative halves of the signed detail:

   ```
   highlight = clamp((max(d − highlightThreshold, 0)) × highlightGain, 0, 1)
   shadow    = clamp((max(−d − shadowThreshold, 0)) × shadowGain, 0, 1)
   ```

   Both should read as mostly-black images with thin structure. If either
   looks like a washed-out copy of the scan, the high-pass radius is too
   large or the gains are too high.

6. **Opaque texture** (`opaque-texture.ts`) — RGB is the original scan;
   alpha is `max(protectedMask, (1 − rawPlasticLikelihood) × contentScore)`
   where `contentScore = max(darkness, colorfulness)` keeps clearly-opaque
   slab markings (dark seams, printed marks) but prevents the broad
   not-quite-white plastic field from being resurrected through
   `1 − transmission`. Highlight/shadow detail is *not* baked in.

## Parameter reference

### Protected regions (`config.regions`)

| Parameter | Default | Meaning |
| --- | --- | --- |
| `cardRect` | `{x:0.12, y:0.27, w:0.77, h:0.62}` | Normalized rect that must stay opaque (the card). |
| `labelRect` | `{x:0.05, y:0.02, w:0.9, h:0.15}` | Normalized rect for the grade label. |
| `featherPx` | `2` | Linear feather width (source px) at rect boundaries; avoids visible seams. |

### Transmission (`config.transmission`)

| Parameter | Default | Meaning |
| --- | --- | --- |
| `brightnessMin` | `0.70` | White-normalized luminance where transmission starts ramping up. Below: opaque. |
| `brightnessMax` | `0.96` | Luminance of full transmission candidacy. Lower ⇒ more plastic classified clear. |
| `neutralityMin` | `0.02` | Chroma below this counts as perfectly neutral. |
| `neutralityMax` | `0.18` | Chroma above this is colored content, never plastic. |
| `strength` | `0.95` | Global ceiling of the mask (1 = perfectly clear plastic). |
| `blurRadius` | `1.5` | Gaussian blur (px) on the finished mask; softens classification noise. |
| `morphology` | `0` | Negative erodes (shrinks transmissive area), positive dilates. |

### Detail (`config.detail`)

| Parameter | Default | Meaning |
| --- | --- | --- |
| `radius` | `0.004` | High-pass Gaussian radius. Relative to `max(width, height)` when `radiusRelative` (default `true`). |
| `highlightThreshold` | `0.008` | Signed detail below this is ignored for highlights. |
| `highlightGain` | `4.0` | Multiplier for the highlight map. |
| `shadowThreshold` | `0.008` | Negative detail below this is ignored for shadows. |
| `shadowGain` | `2.0` | Multiplier for the shadow map. |
| `denoise` | `0.004` | Signed-detail magnitudes below this are zeroed (sensor/JPEG noise). |
| `detailBlur` | `0` | Optional small blur (px) on the finished maps. |

### Rendering (`config.render`)

| Parameter | Default | Meaning |
| --- | --- | --- |
| `highlightStrength` | `0.25` | Screen-blend strength of the highlight map (2D + 3D). |
| `shadowStrength` | `0.12` | Multiply-blend strength of the shadow map (2D + 3D). |
| `plasticTint` | `0.08` | 2D only: how much the clear plastic lifts the background toward white. |
| `roughness` | `0.04` | `MeshPhysicalMaterial.roughness` of the plastic (drives transmission blur). |
| `ior` | `1.49` | Index of refraction (acrylic). |
| `thickness` | `0.15` | Refraction volume thickness in scene units (slab depth is `0.18`). |
| `fresnelEnabled` | `true` | Angle-dependent detail visibility (highlights only; molded seams stay visible head-on). |
| `fresnelPower` | `3.0` | Fresnel exponent. |
| `detailHeadOnStrength` | `0.25` | Highlight visibility when viewed straight on. |
| `detailGrazingStrength` | `1.0` | Highlight visibility at grazing angles. |
| `envIntensity` | `0.3` | Environment-map intensity on the plastic. Keep low: a hot overhead panel mirrored off the flat face reads as a milky glare blob. |

## Three.js layer stack (`Slab3DPreview.tsx`)

1. **Opaque card/label plane** — `meshBasicMaterial` (the scan already
   contains the scanner illumination — re-lighting it blows out the white
   label), `alphaTest: 0.5`, `transparent: false`, `depthWrite: true`.
   Rendering it in the opaque pass is what lets three.js's transmission
   buffer "see" it through the plastic. It sits `0.35 × depth` behind the
   front surface for real parallax.
2. **Transparent slab box** — `MeshPhysicalMaterial` with
   `transmission: 1`, `depthWrite: false`. The plastic stays fully
   transmissive everywhere (real slabs have plastic over the card too); the
   card/label opacity comes from layer 1, which satisfies the "card and
   label regions do not use transparent plastic" requirement by geometry
   separation rather than a shader mask.
3. **Shadow overlay plane** — custom `ShaderMaterial`, true multiply via
   `CustomBlending (Zero, OneMinusSrcColor)`, just above the front surface.
4. **Highlight overlay plane** — custom `ShaderMaterial`, true Screen blend
   via `CustomBlending (OneMinusDstColor, One)` (additive was too strong),
   Fresnel-modulated visibility.

Explicit `renderOrder` (card 0 → plastic 1 → shadow 2 → highlight 3) plus
distinct z-offsets prevent sorting flicker and z-fighting at all angles.

The scene uses a PMREM-filtered `RoomEnvironment` (no network fetch). The
environment is rotated (`scene.environmentRotation`) so its brightest panel
is not mirror-reflected straight back at the default camera pose.

## 2D reference compositor (`compositor.ts`)

Deterministic ground truth (no refraction/environment):

```
color = background
color = mix(color, 1.0, transmissionMask × plasticTint)
color = mix(color, opaqueRgb, opaqueAlpha)
color *= 1 − shadowMap × shadowStrength
color = 1 − (1 − color) × (1 − highlightMap × highlightStrength)   // Screen
```

## Performance

- Stages are memoized against exactly the parameters they depend on
  (`pipeline.ts`); e.g. changing `highlightGain` reuses the cached Gaussian
  blur and transmission mask. Cache hits are proven by object-identity unit
  tests.
- Gaussian blur is three box passes with running sums — O(pixels),
  independent of radius.
- Full pipeline on the 759×1200 sample front scan: ~135 ms on the dev VM;
  slider changes that only touch downstream stages are far cheaper. The
  workbench debounces recomputation by 40 ms and offers processing sizes of
  800/1200/1600/2000 px. No workers were needed at these sizes.

## Verified sample

`TED_WILLIAMS_FRONT_PRESET` in `presets.ts` is the configuration verified
against `/assets/1949-ted-williams-leaf-bvg-3/front.png`:

- Broad clear plastic adopts white/black/gray/brown/checker/red/blue
  backgrounds (Test A).
- Card artwork and borders stay opaque, including pale regions (Test B).
- The Beckett label stays opaque and readable (Test C).
- Highlight/shadow toggles restore inner-window edges, molded boundaries and
  the embossed serial without restoring the broad white field (Test D).
- Rotation shows real parallax between plastic and card, no transparency
  sorting or z-fighting artifacts (Tests E/G).
- Edges stay legible against dark backgrounds via env reflection and the
  retained outer-boundary alpha (Test F).

## Known limitations / next steps

- Only the front face is processed end-to-end; back scans work through the
  same pipeline but have their own rects (persisted separately). Edge scans
  are untouched.
- The 3D preview's back side shows the mirrored front card plane (the real
  integration should add a second plane fed from the back scan).
- Protected regions are explicit rectangles, not detected.
- Integration into the production `CardSlab` component is not wired up yet;
  `Slab3DPreview.tsx` is the reference implementation for that work.
