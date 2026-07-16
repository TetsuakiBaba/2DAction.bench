# Skyline Sprout

Skyline Sprout is a small original 2D side-scrolling platform game built with only HTML, CSS, and vanilla JavaScript. It uses Canvas for hand-drawn graphics and Web Audio API oscillators for simple sound effects.

## How to run

Open `index.html` directly in a modern browser. No install step, server, build tool, package manager, CDN, or external asset is required.

## Controls

- Move: Left / Right arrow keys or A / D
- Jump: Space, W, or Up arrow
- Pause: P or Escape
- Restart: Use the on-screen button after game over or stage clear

## Implemented features

- Title, pause, game-over, and stage-complete states
- Horizontal movement with acceleration and deceleration
- Gravity, jumping, coyote time, and jump buffering
- Collision with ground, walls, and raised platforms
- Side-scrolling camera
- One complete stage with gaps, hazards, varied platform heights, collectibles, patrol enemies, and a beacon goal
- Score, lives, collectible counter, and responsive canvas scaling
- Enemies can be avoided or defeated by jumping on them
- Generated visual style and generated sound effects with no external assets

## File structure

- `index.html`: Page shell, canvas, overlay, and control display
- `style.css`: Responsive layout and interface styling
- `game.js`: Game state, input, physics, collision, rendering, audio, and restart logic
- `README.md`: Project notes and controls

## Known limitations

- The game contains a single handcrafted stage.
- Sound effects are intentionally simple oscillator tones.
- Touch controls are not implemented.
