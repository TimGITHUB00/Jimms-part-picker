# Jimms Part Picker

A lightweight PCPartPicker-style build list that uses Jimms.fi component category pages as its product and price source.

## Run

```powershell
npm start
```

Open `http://localhost:4173`.

## Notes

- The browser calls this local Node server, and the server fetches Jimms.fi category pages to avoid browser CORS issues.
- If Jimms.fi blocks a request or changes the page markup, the app falls back to bundled sample data from Jimms.fi category listings so the interface remains usable.
- Category links open the relevant Jimms.fi pages for checkout and verification.
- Game FPS estimates now come from a bundled local dataset in [data/local-benchmarks.json](C:/Users/timib/Documents/__projects/PCPARTPICKER_WESBITE_CLONE/data/local-benchmarks.json), seeded from public benchmark datasets so the feature works without any paid API.
- GPU value and thermal guidance now comes from [data/gpu-market-data.json](C:/Users/timib/Documents/__projects/PCPARTPICKER_WESBITE_CLONE/data/gpu-market-data.json), then gets combined with live Jimms pricing to estimate price/performance tiers.
