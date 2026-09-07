# Al Azm Palace 3D Web Exploration (قصر العظم - دمشق)

An interactive, high-fidelity Three.js web application for freely exploring the 3D architectural model of **Al Azm Palace** in Damascus, Syria (built 1749 CE by As'ad Pasha al-Azm).

Built with Three.js, Vite, and Vanilla CSS to allow anyone to walk through the courtyards and study the architecture without needing Blender.

---

## Features

- **Freely Explore Without 3D Software**: Fully self-contained in standard web browsers on desktop, laptop, tablet, and mobile.
- **Dual Camera Navigation Modes**:
  - **Orbit / Aerial Mode (🪐)**: Smooth 360° pan, rotate, and zoom with ground collision constraints.
  - **First-Person Walkthrough Mode (🚶)**: Walk at human eye level (1.65m) using `W`, `A`, `S`, `D` or arrow keys and mouse look (with `Shift` sprint). Includes on-screen touch buttons for smartphones and tablets.
- **Atmospheric Lighting Presets**:
  - ☀️ **Damascus Daylight**: Crisp Mediterranean sun highlighting the alternating black basalt and white limestone (*ablaq*) masonry.
  - 🌅 **Golden Hour**: Warm sunset lighting casting long shadows across carved walnut benches and bougainvillea.
  - 🌙 **Ottoman Night**: Moonlit courtyard illuminated by warm lanterns in the Great Iwan, colonnades, and fountains.
- **Curated Architectural Vantage Points**:
  - 🏛️ **Palace Grand Overview** (Panoramic aerial perspective of courtyards and roofs)
  - 🕌 **Great South Iwan (الإيوان الكبير)** (Monumental arch, painted coffers, raised dais)
  - ⛲ **Octagonal Marble Fountain (النافورة الثمانية)** (Northern courtyard marble mosaic)
  - 💧 **Courtyard Reflection Pool (بركة الفناء)** (Water basin reflecting facade)
  - 🏛️ **North Riwaq Colonnade (رواق الأعمدة)** (Basalt columns and pointed striped arches)
  - 🏺 **Hammam Domes & Rooftops (قباب الحمام)** (Glazed oculi glass domes)
- **Courtyard Sound Ambience (⛲)**: Toggleable procedural gentle trickling fountain water synthesized in real-time via the Web Audio API (no external audio files required).
- **Screenshot Tool (📷)**: One-click high-resolution photo capture tool that exports directly to PNG.
- **Museum Guide & Info (ℹ️)**: Historical context on As'ad Pasha al-Azm, Damascene ablaq masonry, and iwan design.

---

## Running Locally

### Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
```
This generates a static production bundle in the `dist/` directory containing the optimized HTML, JS, CSS, and `palace.glb`.

---

## Sharing & Deploying Online

You can easily deploy the `dist/` folder to free static hosting services to share with colleagues or the public:

### Option 1: GitHub Pages
1. Push this repository to GitHub.
2. Under **Settings > Pages**, select **GitHub Actions** and choose the static Vite deployment template.

### Option 2: Vercel / Netlify / Cloudflare Pages
- Connect your GitHub repository or drag-and-drop the `dist` folder directly onto [Netlify Drop](https://app.netlify.com/drop) or [Vercel](https://vercel.com).
- Build command: `npm run build`
- Output directory: `dist`

### Option 3: Local Network Sharing
To share on your local Wi-Fi with phones or other computers:
```bash
npx vite --host
```
Vite will output a `Network:` URL (e.g. `http://192.168.1.X:3000`) that anyone on your Wi-Fi network can open on their phone or tablet!
