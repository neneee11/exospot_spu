# ExoSpot Product Studio

Interactive 3D page for **ExoSpot**, a wearable spine that tells lifters when their back is rounding.
Team ExoSpot, KMUTT · TED Youth Startup Fund (KX-TECHBITE).

It is one static page with no build step. Three.js loads from a CDN.

## What's on the page

| Tab | What it does |
| --- | --- |
| **01 Overview** | Key numbers and the green / yellow / red rules (0–60% / 60–80% / 80%+ of the lifter's max flexion). |
| **02 Mechanical** | Exploded view of the 18 segments, ball joints and flexure strips; toggle the flexure and the straps; spec table. |
| **03 Circuit** | X-ray view of the electronics pod and sensor wiring; hover a block to highlight the part; draft ESP32 pin map. |
| **04 Enclosure** | Pick the electronics shell material (PETG, PA12, ABS, PC, TPU), finish and wall thickness; shows shell weight, ratings and cautions; copy the spec. |

Under the 3D view there is a flexion slider and a **Play 3 reps** demo. The LEDs and the six sensor bars respond the way the firmware is planned to.

You can link straight to a tab: `/#mechanical`, `/#circuit`, `/#enclosure`.

## Files

```
exospot-studio/
├── index.html    # the whole page (HTML, CSS, JS)
├── vercel.json   # clean URLs and basic security headers
└── README.md
```

## Run it locally

Open `index.html` in a browser. To test it the way Vercel serves it, start a local server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy to Vercel

**Option A: Vercel CLI**

```bash
npm i -g vercel
cd exospot-studio
vercel          # first run: answer the prompts, framework = "Other"
vercel --prod   # publish to production
```

**Option B: GitHub + Vercel dashboard**

1. Push this folder to a GitHub repository.
2. On vercel.com choose **Add New → Project** and import the repo.
3. Framework preset: **Other**. Build command: leave empty. Output directory: `.` (root).
4. Click **Deploy**.

**Option C: drag and drop.** Run `vercel deploy` from the folder, or upload the folder in the Vercel dashboard.

## External resources

The page needs internet access for:

- Three.js r128: `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- OrbitControls: `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`
- Fonts from Google Fonts: Archivo, Instrument Sans, JetBrains Mono

To run fully offline, download those two scripts into a `vendor/` folder and change the two `<script src>` lines at the bottom of `index.html`.

## Editing

- **Enclosure materials:** the `MATS` object near the top of the script. Each entry has density (g/cm³), heat deflection, process, stage, five ratings (1–5) and a caution.
- **Finish colours:** the `FINS` object.
- **Pod size for the weight calculation:** `L=70, Wd=45, H=22` (mm) in `initPanels()`.
- **Segment sizes:** the chain loop (`for (let i=0;i<18;i++)`). Units are 100 mm; lumbar height `.35`, thoracic `.23`.
- **Light thresholds:** `status()`. Green under 60, yellow 60–80, red 80 and over.
- **Colours and fonts:** the CSS tokens at the top of `<style>`. Light and dark themes follow the visitor's system setting.

## Notes

- The 3D model is built in code from the team's sketch, not from the CAD file. To show the real CAD, export it as `.glb` and load it with Three.js `GLTFLoader`.
- Material values are typical for unfilled grades. Check the datasheet of the exact filament or powder before ordering.
- The pin map is a draft for the hardware developer to confirm on the bench.
