# Crystal Caverns

A complete 2D side-scrolling platform game built with vanilla HTML, CSS, and JavaScript.

## How to Run

Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari). No server or build step is required.

## Controls

| Action       | Keys                    |
|------------- |-------------------------|
| Move left    | `←` or `A`              |
| Move right   | `→` or `D`              |
| Jump         | `Space` / `W` / `↑`     |
| Pause        | `P` / `Esc`             |
| Start / Restart | `Space`            |

## Implemented Features

- **Player physics** — acceleration, deceleration, gravity, variable-height jumping, coyote time, and jump buffering for responsive controls.
- **Collision detection** — tile-based resolution with platforms, floors, and walls.
- **Scrolling camera** — smoothly follows the player with clamped bounds.
- **Complete level** — a hand-designed cave stage with platforms at varying heights, pits, and a goal flag.
- **Collectibles** — glowing crystals that award score when collected.
- **Enemies** — crystal slimes that patrol platforms. Stomp them from above to defeat them; touching them from the side costs a life.
- **Score & lives** — score display in the HUD; three lives with invincibility frames after taking damage.
- **Game states** — title screen → playing → paused / game-over / victory, with restart without page reload.
- **Sound effects** — jump, collect, hit, stomp, win, and die sounds via the Web Audio API (no external audio files).
- **Animated sprites** — player character with hat, cape, and leg animation; squishy enemy slimes with crystal spikes; bobbing crystals with glow.
- **Background scenery** — gradient sky, twinkling stars, parallax mountains, stalactites, and ambient cave glow.
- **Particle effects** — burst particles on crystal collection, enemy defeat, and player damage.
- **Responsive scaling** — the canvas scales to fit any browser window while maintaining aspect ratio.
- **Delta-time movement** — all motion uses elapsed time for frame-rate-independent behavior.

## File Structure

| File          | Purpose                                          |
|-------------- |--------------------------------------------------|
| `index.html` | Entry point; loads CSS and game script.           |
| `style.css`  | Global styles, overlay screens, HUD layout.       |
| `game.js`    | All game logic: input, physics, rendering, audio. |
| `README.md`  | This file.                                       |

## Known Limitations

- Only one level is included; extending the game would require adding more level maps.
- Sound requires a user interaction (pressing Space to start) to unlock the Web Audio API, per browser policy.
- No mobile / touch controls — keyboard only.
