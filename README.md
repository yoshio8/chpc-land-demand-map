# NYC New Construction Story Map

## Files
- `config.js` — **edit this**: title, chapter text, camera views, filters, charts
- `story.js` — the engine (map, scroll, filters, charts, popups)
- `index.html`, `style.css` — layout and styling
- `data/nc_prod.geojson` — your data (loaded directly, so no points are dropped)

## Run it
Browsers won't load the GeoJSON if you double-click `index.html`. Instead:

1. Open Terminal, `cd` into this folder
2. Run `python3 -m http.server`
3. Go to http://localhost:8000

(Or open the folder in VS Code and use the Live Server extension.)

## Tips
- To find a camera view: pan the map, then in the browser console run
  `map.getCenter(); map.getZoom()` and paste the values into `config.js`.
- Add a chapter by copying one `{ ... }` block in `config.js`.
- Publish free with GitHub Pages, and restrict your Mapbox token to that URL.
