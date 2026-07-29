# assets/sprites/

`scripts/rocket-graph.mjs` currently draws its rocket as inline `<rect>` pixels
(see the `rocketSprite` template string in that file) so the graph works with
zero external assets. Swap in your own Aseprite sprite when ready:

1. Draw the rocket facing **right** (the animation flips direction on
   alternating rows; keep it symmetric or add a mirrored second frame if you
   want it to always face its travel direction).
2. Export as `rocket.png`:
   - Canvas size: **16x16px** (matches the 8x8 rect grid scaled 2x used now;
     go up to 32x32 if you want more detail, just update `CELL`/scale math
     in the script)
   - Format: PNG, indexed or RGBA, **transparent background**
   - No anti-aliasing / no resampling on export (keep hard pixel edges)
3. Save it as `assets/sprites/rocket.png` in this folder.
4. In `scripts/rocket-graph.mjs`, replace the `rocketSprite` template's
   `<rect>` pixels with:
   ```xml
   <image id="rocket-sprite" href="https://raw.githubusercontent.com/Holmes-99/Holmes-99/main/assets/sprites/rocket.png" width="16" height="16" x="-8" y="-8"/>
   ```
   (the `x`/`y` offsets keep the sprite centered on the `<animateMotion>` path,
   same as the current `<g transform="translate(-8,-8)">` wrapper)

Optional: draw a second `rocket-thrust.png` frame and alternate between them
with `<animate attributeName="href" ... calcMode="discrete">` for a simple
2-frame thruster animation.
