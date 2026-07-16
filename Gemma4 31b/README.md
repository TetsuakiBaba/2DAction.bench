# Neon Nexus

A high-contrast, cyber-themed 2D platformer built with vanilla JavaScript.

## How to Run
1. Download the project files.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
3. No server or installation is required.

## Controls
- **Move**: Left/Right Arrow keys or A/D keys
- **Jump**: Space, W, or Up Arrow key
- **Pause**: P or Escape key

## Implemented Features
- **Physics Engine**: Includes acceleration, deceleration, gravity, and axis-aligned bounding box (AABB) collision detection.
- **Camera System**: Smooth horizontal and vertical scrolling that follows the player.
- **Gameplay Elements**: 
  - Multiple platforms at varying heights.
  - Collectible data chips (coins) to increase score.
  - Moving sentinel enemies.
  - Environmental hazards (purple laser floors).
  - A clear goal gate to complete the stage.
- **Sound Design**: Dynamic sound effects generated in real-time using the Web Audio API (no external assets).
- **Game States**: Fully implemented Title Screen, Pause Menu, Game Over, and Mission Complete states.
- **UI/UX**: Neon-style HUD showing lives and score, with a responsive layout that adapts to window size.

## File Structure
- `index.html`: The main entry point, containing the canvas and UI overlays.
- `style.css`: Styling for the cyber-theme and responsive layout.
- `game.js`: The core game logic, including physics, entity management, and rendering.
- `README.md`: Project documentation.

## Known Limitations
- Single level implementation.
- Basic AABB collisions may occasionally feel "snappy" on very thin platforms.
