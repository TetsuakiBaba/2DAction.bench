# Pixel Trail: Crystal Hollow

A small, self-contained 2D side-scrolling platformer built with HTML5 Canvas and vanilla JavaScript. No frameworks, no build step, no external assets.

## How to run

1. Open `index.html` in any modern desktop browser (Chrome, Firefox, Safari, Edge).
2. Click the canvas (or press any key) so the page can enable audio.
3. Press **Enter** or **Space** on the title screen to start.

Because the game uses the Web Audio API and keyboard input, opening the file via `file://` is fine, but you can also serve the folder with any static server (for example `python3 -m http.server`).

## Controls

| Action | Keys |
| --- | --- |
| Move left | `←` or `A` |
| Move right | `→` or `D` |
| Jump (variable height) | `Space`, `W`, or `↑` |
| Pause / resume | `P` or `Esc` |
| Start / restart | `Enter`, `Space`, or `R` |

## Implemented features

- Original character, level, and theme (no copyrighted assets).
- Side-scrolling camera that follows the player.
- Acceleration / deceleration, gravity, and variable-height jumping.
- Tile-based solid collision (floors, walls, platforms) and pit hazards.
- One complete stage with platforms at multiple heights, gaps, and a goal portal.
- 39 collectible crystals and 14 patrolling crawler enemies.
- Stomp-to-defeat mechanic and side-contact damage with brief invulnerability.
- Score system with time bonus and life-based respawn.
- Three lives, a clear start state, clear game-over state, and clear stage-complete state.
- Restart without reloading the page (`R` / `Enter` from game-over or clear screens).
- Title screen, pause overlay, and a HUD with score, lives, crystals, and timer.
- All graphics drawn with Canvas primitives; no emoji, images, or fonts required.
- Simple sound effects generated entirely with the Web Audio API.
- `requestAnimationFrame` main loop with delta-time updates capped to prevent huge jumps.
- Responsive canvas that scales to fit the browser window.

## File structure

```
.
├── index.html   # Page shell, canvas, overlay UI, status bar
├── style.css    # Layout and visual styling
├── game.js      # All game logic, rendering, and audio
└── README.md    # This file
```

## Known limitations

- Single fixed stage; no scrolling between multiple areas or levels.
- The level is hand-authored and finite; there is no procedural generation.
- Mobile touch controls are not implemented; the game is keyboard-only.
- Sound effects are simple Web Audio blips and not full music tracks.
- Restarting returns the player to the start of the level; there are no mid-level checkpoints after death.
- Some browsers require a user gesture before audio plays, so the first click or key press resumes the audio context.
