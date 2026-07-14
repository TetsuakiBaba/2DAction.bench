# Neon Jumper

A 2D platforming game built entirely with HTML5 Canvas, CSS, and vanilla JavaScript.

## How to Run
Simply open `index.html` in any modern web browser. No local server or build tools are required.

## Controls
- **Left / Right / A / D**: Move horizontally
- **Space / W / Up**: Jump
- **P / Esc**: Pause or unpause the game
- **Enter**: Start game, restart from Game Over, or continue

## Features
- Custom physics and platforming engine (gravity, acceleration, collisions)
- A scrolling camera tracking the player
- Collectible items (Coins/Crystals) to increase score
- Moving enemies that can be avoided
- Pits and hazards (avoid falling out of bounds or into red lava zones)
- Health/Lives system
- Custom synthesized sound effects using the Web Audio API
- Responsive canvas scaling via CSS

## File Structure
- `index.html`: The main entry point containing the canvas element.
- `style.css`: Basic styles to center the canvas and handle screen resizing.
- `game.js`: The entire game logic, rendering, audio, and physics engine.
- `README.md`: This documentation file.

## Known Limitations
- The Web Audio API requires a user interaction (like a key press) to unlock. Audio will start functioning as soon as the first input is registered.
- Complex polygon collisions are simplified to Axis-Aligned Bounding Box (AABB) checks.
