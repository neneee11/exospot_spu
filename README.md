# ExoSpot Product Studio

Interactive 3D page for **ExoSpot**, a wearable spine that tells lifters when their back is rounding.
Team ExoSpot, KMUTT · TED Youth Startup Fund (KX-TECHBITE).

One static page, no build step. Three.js ships in `vendor/`, so the 3D view works without a CDN.

## What's on the page

| Tab | What it does |
| --- | --- |
| **01 Overview** | Key numbers and the green / yellow / red rules (0–60% / 60–80% / 80%+ of the lifter's max flexion). |
| **02 Mechanical** | Exploded view of the 18 segments, ball joints and flexure strips; toggle flexure and straps; spec table. |
| **03 Circuit** | X-ray view of the electronics pod and sensor wiring; hover a block to highlight the part; draft ESP32 pin map. |
| **04 Enclosure** | Pick the electronics shell material (PETG, PA12, ABS, PC, TPU), finish and wall thickness; shows shell weight, ratings and cautions; copy the spec. |

Under the 3D view: a flexion slider and a **Play 3 reps** demo. The LEDs and six sensor bars respond the way the firmware is planned to.

Link straight to a tab: `/#mechanical`, `/#circuit`, `/#enclosure`.

## Files

```
exospot-studio/
├── index.html            # the page (HTML, CSS, JS)
├── vendor/
│   ├── three.min.js      # Three.js r128
│   └── OrbitControls.js  # camera controls for r128
├── vercel.json           # clean URLs, basic security headers
└── README.md
```

## Run it locally

Serve the folder (double-clicking `index.html` also works in most browsers):

```bash
npx serve .
# or
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy to Vercel

**CLI**

```bash
npm i -g vercel@latest
vercel login            # confirm in the browser
cd exospot-studio
vercel --prod           # framework: Other, no build command
```

No login? Create a token at vercel.com › Account Settings › Tokens and run `vercel --prod --token <TOKEN>`.

**GitHub + dashboard**

1. Push this folder to a GitHub repository.
2. vercel.com › **Add New › Project** › import the repo.
3. Framework preset **Other**, build command empty, output directory `.`.
4. **Deploy**.

## If the 3D view shows a message instead of the model

- *"The 3D library did not load"*: a blocker stopped `vendor/three.min.js`, or the `vendor/` folder was not uploaded. Check that it exists in the deployment.
- *"3D graphics (WebGL) are turned off"*: in Chrome or Edge go to Settings › System and turn on **Use graphics acceleration when available**, then relaunch. Check the browser at https://get.webgl.org.

## Editing

- **Enclosure materials:** `MATS` near the top of the script (density g/cm³, heat deflection, process, stage, five 1–5 ratings, caution).
- **Finish colours:** `FINS`.
- **Pod size for the weight:** `L=70, Wd=45, H=22` (mm) in `initPanels()`.
- **Segment sizes:** the chain loop `for (let i=0;i<18;i++)`. Units are 100 mm; lumbar `.35`, thoracic `.23`.
- **Light thresholds:** `status()`: green under 60, yellow 60–80, red 80 and over.
- **Colours and fonts:** CSS tokens at the top of `<style>`. Light and dark follow the visitor's system setting.

Fonts load from Google Fonts; without internet the page falls back to system fonts.

## Notes

- The 3D model is built in code from the team's sketch, not from the CAD file. To show the real CAD, export `.glb` and load it with Three.js `GLTFLoader`.
- Material values are typical for unfilled grades. Check the datasheet of the exact filament or powder before ordering.
- The pin map is a draft for the hardware developer to confirm on the bench.
