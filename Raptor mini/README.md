# Skyline Sprint

Skyline Sprint is an original 2D browser platform game built with HTML, CSS, and vanilla JavaScript. The game runs directly by opening `index.html` in a modern browser.

## How to run

1. Open `index.html` in a browser.
2. Play without installing any tools or packages.

## Controls

- Move left: `A` / `←`
- Move right: `D` / `→`
- Jump: `W` / `↑` / `Space`
- Pause: `P` / `Escape`

## Implemented features

- horizontal movement with acceleration and deceleration
- gravity and jumping
- platform collision and floor collision
- moving enemies
- collectible energy spheres
- hazards and falling out of bounds
- camera follows the player
- start screen, pause screen, game-over screen, and stage-clear screen
- score and health display
- responsive canvas styling
- simple sound effects using Web Audio API

## File structure

- `index.html` — page structure and canvas element
- `style.css` — visual style, layout, and overlay UI
- `game.js` — game logic, update loop, rendering, and input handling
- `README.md` — project overview and instructions

## Known limitations

- only a single stage is implemented
- there is no separate level progression beyond the win screen
- sound toggling is not available in the UI
