# Neon Ascent

A complete, playable 2D side-scrolling platform game built with only HTML, CSS, and vanilla JavaScript.

## How to Run

Open `index.html` directly in any modern web browser (Chrome, Firefox, Edge, Safari). No build step, server, or external dependencies are required.

## Controls

| Action | Keys |
|--------|------|
| Move left / right | Arrow keys ← → or A / D |
| Jump | Space, W, or ↑ |
| Pause / Resume | P or Escape |

## Gameplay

- Guide the player character through a scrolling stage filled with platforms, pits, and enemies.
- Collect blue crystals to increase your score.
- Defeat red patrol enemies by jumping on top of them.
- Avoid touching enemies from the side or falling into pits and red spikes.
- Reach the glowing purple portal at the end of the stage to win.
- The game can be restarted from the game-over or win screen without reloading the page.

## Implemented Features

- Horizontal movement with acceleration, deceleration, and a maximum speed cap
- Gravity, jumping, and variable jump height on release
- Coyote-time jump grace period and jump-input buffering
- Axis-aligned bounding box (AABB) collision detection with floors, walls, and platforms
- Moving enemies with patrol behavior and stomp-to-defeat mechanic
- Web Audio API generated sound effects for jumping, collecting crystals, stomping enemies, taking damage, winning, and game over
- Particle effects for jumps, collectibles, enemy defeats, and damage
- Scrolling camera that smoothly follows the player
- Original title screen, pause screen, game-over screen, and win screen
- Score and lives HUD with stage-progress indicator
- Responsive CSS scaling for different browser window sizes
- `requestAnimationFrame` game loop with delta-time physics updates
- Separated update and rendering logic

## File Structure

```
.
├── index.html   # Game markup and UI screens
├── style.css    # Styling, layout, responsive scaling, and screen transitions
├── game.js      # Game engine, physics, entities, audio, and loop
└── README.md    # This file
```

## Known Limitations

- Only a single stage is included.
- The Web Audio API may be silent until the user interacts with the page (browser policy).
- Very high frame-rate dips could slightly affect physics consistency; delta time is capped to mitigate this.
