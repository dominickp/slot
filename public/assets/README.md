# Asset Pipeline Guide

Drop your custom art and sound files under this folder and keep the paths in `src/games/luckyscape/config.js` → `assets` in sync.

## Recommended image format

- **Use PNG (recommended)** for symbol art with transparency.
- Suggested size: **512x512** (or larger square like 1024x1024).
- Keep important details centered; renderer scales images into tile bounds.
- WebP also works in modern browsers, but PNG is safest for production consistency.
- SVG is not required. Raster formats are currently the easiest path with the Pixi sprite setup.

## Recommended audio format

- Primary: **OGG** (`.ogg`) for efficient web playback.
- Optional fallback: keep matching `.mp3` versions if you want broadest compatibility.
- Short one-shot SFX should ideally be under ~1 second.

## Expected symbol files (current config)

Create these files in `public/assets/symbols/`:

- `10.png`
- `J.png`
- `Q.png`
- `K.png`
- `A.png`
- `wild.png`
- `scatter_fs.png`
- `reveal_clover.png`
- `rainbow.png`
- `reveal_pot.png`
- `trap.png`
- `cheese.png`
- `beer.png`
- `bread.png`
- `top_hat.png`
- `coin_bronze.png`
- `coin_silver.png`
- `coin_gold.png`

## Expected sound files (current config)

Create these files in `public/assets/audio/`:

- `ui_button.ogg`
- `spin_start.ogg`
- `cascade.ogg`
- `win.ogg`
- `bonus_start.ogg`
- `free_spin_start.ogg`
- `rainbow.ogg`
- `clover_multiply.ogg`
- `collector_collect.ogg`
- `collector_pop.ogg`
- `big_win.ogg`
- `background_music.ogg`

## How fallback works

- If an image path is missing, renderer uses the built-in placeholder tile.
- If a sound file is missing, `SoundManager` uses synthesized placeholder tones.
- If background music is provided (`bg-music`), it starts automatically after first user interaction.
- If background music is missing, gameplay continues normally without music.

That means you can replace assets incrementally without breaking the game.
