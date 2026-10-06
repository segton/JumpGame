# Scenery assets — Cloud Ascent

Generated using the built-in image-generation tool. Transparent PNG alpha is preserved. The runtime loads copies inside this project; nothing references the generator's cache.

## Files

- `public/assets/stage-0-v2.png`: mountain inn valley, starting stage.
- `public/assets/stage-100-v2.png`: high mountain cloud sea.
- `public/assets/stage-300-v2.png`: floating palace realm.
- `public/assets/stage-500-v2.png`: moonlit heaven.
- `public/assets/stage-700-v2.png`: celestial star sea.
- `public/assets/stage-900-v2.png`: radiant summit of heaven.
- `public/assets/celestial-edge-v2.png`: transparent jade/ivory palace edge; crossfades in at floor 300.
- `public/assets/platform-atlas-v2.png`: transparent 2×2 bronze, cloud, cracked wood, and celestial jade platform sheet. Runtime uses per-frame landing anchors to match the collision surface.
- `public/assets/far-mountains-v1.png`: retained earlier mountain backdrop, no longer active.
- `public/assets/temple-pillar-v1.png`: transparent temple cliff, 0.38× camera movement.
- `public/assets/foreground-lantern-v1.png`: retained earlier foreground cutout, replaced in the active renderer by paired inn towers.
- `public/assets/golden-platform-v1.png`: retained earlier gold platform sprite, replaced by the v2 atlas.
- `public/assets/swordsman-v1.png`: retained earlier character sprite.
- `public/assets/swordsman-jump.png`: user-supplied 33-frame animation (256×256 cells), used by the active renderer.
- `public/assets/inn-tower-v1.png`: generated transparent red lacquer Chinese inn facade, mirrored at the screen edges; 0.72× camera parallax.
- `public/assets/rewards-v1.png`: generated transparent 2×2 sheet: coin, hourglass, gold gourd, double-height Lightfoot badge. Runtime crops each quadrant into a texture frame.
- `public/assets/temple-sky-v1.png`: retained earlier background, no longer used by the game.

## Generation prompts

The complete v2 prompt set and generated-source filenames are recorded in `asset-generation-v2.json`. All eight v2 assets were generated with the built-in image tool; no CLI/API fallback was used. Scene art follows the PowerPoint's progression from inn valley to cloud mountains to celestial palaces/star fields. Runtime parallax, periodic edge blending, and stage crossfades are applied to the locally bundled originals.

### Time attack assets (October 1)

Tower: painterly Chinese wuxia red lacquer inn facade, gold ornament, warm lanterns, stacked grey tiled roofs, edge silhouette concentrated on the left, open transparent centre, no text or characters. Generated source `exec-9599f4fb-ca06-47b9-a8de-e05964ee9c85.png`; corrected with image generation to preserve architecture and replace the baked background with true alpha. Final `exec-0652a1b9-3875-4694-bcea-ecf050570e81.png`, copied as `inn-tower-v1.png`.

Rewards: consistent painterly gold/turquoise wuxia objects in isolated equal 2×2 cells, no labels: gold coin, turquoise hourglass, gold gourd and cyan wind badge with upward chevrons. Generated source `exec-7773f710-5a59-4ad4-ab3c-131ab2d7d088.png`; corrected with image generation to replace checkerboard backing with true alpha while preserving object alignment. Final `exec-29410819-f252-4d8a-96b3-9aad6c95b890.png`, copied as `rewards-v1.png`. Both final files were checked for transparent pixels.

### Far mountains

Production game asset, stylized-concept, painterly realistic Chinese wuxia fantasy matching gold ornate platforms and white-robed swordsman. Portrait background 1024x1536. ONLY very distant blue mountains and tiny pagodas in billowing mist below a pale blue sunlit sky. No foreground architecture, no near branches, no characters, no platforms, no text or interface. Low contrast atmospheric perspective, broad open airy center, fine Chinese landscape painting detail. Top and bottom dissolve to the same pale blue cloud haze so vertical repetitions blend softly. Return saved local path.

### Temple pillar

Production transparent PNG parallax scenery asset for a portrait wuxia platform game, painterly realistic Chinese fantasy. One isolated tall slender floating limestone mountain pillar with a cluster of beautiful ancient Chinese pagodas, blue gray roofs, muted gold ornaments, little pine trees. Three quarter view, rich detail but hazy desaturated blue atmospheric perspective for middle distance. Entire object fully in frame, pointed rocky base dissolving into wisps of mist; transparent background around every edge, no ground, no sky rectangle. Tall portrait silhouette. No characters, no game platforms, no text, no UI. Return local path.

### Foreground

Production transparent PNG foreground scenery cutout for a wuxia platform game, detailed painterly realistic Chinese fantasy matching red-gold temples. A single ancient dark pine branch with restrained clusters of needles, extending from the LEFT image edge toward the right, with one beautiful red and warm gold hanging Chinese lantern with tassel beneath it. Upper-left curved carved temple roof corner partly visible at left edge. Compact horizontal composition, object concentrated on left two thirds and tapering delicately to right. Truly transparent background, no opaque sky, no landscape, no people, no words or calligraphy, no UI. This will decorate only outer screen edges, must have a clear graceful silhouette. Return local saved path.

## Consistent-angle tower modules (v3)
`public/assets/tower-modules-v3.png`: built-in image generation, red inn and celestial palace atlas. The renderer repeats a single cropped storey for each material at a constant 48px width, keeping the angled perspective identical throughout the stack. Final prompt and source provenance: `asset-generation-v3.json`. Replaces the v1/v2 tower textures in active rendering.

## Side variants v4
`public/assets/tower-stages-v4.png`: generated 3×2 full-bleed atlas (red inn, green mountain pavilion, ivory palace, silver moon temple, violet observatory, gold summit). Opaque periodic strips remove cutout gaps; depth places them behind platforms and character. Built-in image generation; prompt in `asset-generation-v4.json`.

## Projecting roof architecture v5 (active)
`public/assets/tower-roofs-v5.png`: six transparent dimensional tower variants, with tiled eaves, roof undersides and deep supporting brackets, inspired by the PPTX scene-design reference. Replaces v4 in the renderer. Side strips are 68px wide and remain behind gameplay; continuous posts and a periodic overlap keep the stack connected. Built-in image generation; final prompt in `asset-generation-v5.json`.
