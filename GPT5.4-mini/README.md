# Aether Circuit

`Aether Circuit` is a browser-based 2D side-scrolling platform game built with plain HTML, CSS, and vanilla JavaScript.

## How to run

Open `index.html` directly in a modern browser. No build step or external dependencies are required.

## Controls

- Move: `Left` / `Right` arrow keys or `A` / `D`
- Jump: `Space`, `W`, or `Up` arrow
- Pause: `P` or `Esc`
- Restart: `R`

## Implemented features

- Title screen, pause state, game-over state, and stage-complete state
- Horizontal movement with acceleration and deceleration
- Gravity, jumping, and collision detection with floors, walls, and platforms
- Scrolling camera that follows the player
- One complete hand-built stage with height changes, gaps, and one-way platforms
- Collectible shards
- Moving patrol enemies
- Stomp-based enemy defeat and contact damage
- Score, lives, and shard tracking
- Simple sound effects using the Web Audio API
- Responsive canvas scaling for different browser sizes

## File structure

- `index.html` - Game shell and UI
- `style.css` - Layout and presentation
- `game.js` - Game logic, rendering, input, and audio
- `README.md` - Project notes

## Known limitations

- There is only one handcrafted stage.
- Sound effects are simple synthesized tones rather than full music.
- The game is designed for keyboard play on desktop browsers.
