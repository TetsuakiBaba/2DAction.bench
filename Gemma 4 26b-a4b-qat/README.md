# Neon Runner - 2D Platformer

A complete, playable 2D side-scrolling platformer built with vanilla HTML, CSS, and JavaScript.

## How to Run

1.  Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
2.  Click the **START GAME** button on the title screen.

## Controls

| Action | Keyboard Input |
| :--- | :--- |
| Move Left | `A` or `Left Arrow` |
| Move Right | `D` or `Right Arrow` |
| Jump | `W`, `Space`, or `Up Arrow` |
| Pause | `P` or `Esc` |

## Implemented Features

- **Gameplay Mechanics**:
    - Horizontal movement with acceleration and deceleration.
    - Physics-based jumping with gravity.
    - Collision detection for platforms and enemies.
    - Scrolling camera that follows the player.
    - Score system for collecting items.
    - Lives/Health system.
    - Win and Lose states.
    - Restart functionality without page reload.
- **Visuals**:
    - Neon-themed aesthetic using CSS and Canvas API.
    - Animated player and enemies (via procedural movement).
    - Responsive canvas scaling.
- **Audio**:
    - Procedural sound effects using the Web Audio API (jump, collect, death, win/loss).

## File Structure

- `index.html`: The core structure of the game application.
- `style.css`: Styling for the game interface and UI overlays.
- `game.js`: The main game engine, including physics, rendering, and logic.
- `README.md`: This documentation file.

## Known Limitations

- No complex level editor (levels are hardcoded in `game.js`).
- Simple procedural sound effects (no external audio files).
- Single level implementation.
