# Crystal Dash

A 2D side-scrolling space platformer built with vanilla HTML / CSS / JavaScript.

## How to run

Open `index.html` directly in any modern web browser (Chrome, Firefox, Safari, Edge).  
No server, build step, or internet connection required.

## Controls

| Key | Action |
|-----|--------|
| A / ← | Move left |
| D / → | Move right |
| Space / W / ↑ | Jump |
| P / Escape | Pause / resume |

**Stomp enemies** by jumping and landing on top of them.

## Features

- Smooth horizontal movement with acceleration and deceleration
- Variable gravity and jump physics
- AABB collision detection with substep vertical resolution (prevents tunnelling)
- Scrolling camera that follows the player with smooth lerp
- One full stage (~4 500 px wide) with 8 ground gaps of increasing width
- Elevated platforms at multiple heights for exploration and shortcuts
- Two enemy types:
  - **Crawler** (green slime) – horizontal patrol on ground or platforms
  - **Floater** (purple drone) – vertical hover patrol
- Enemies can be defeated by stomping (jumping on top)
- **Crystal gems** as collectibles (50 pts each, +25 bonus at stage clear)
- Score system (enemy stomps = 100 pts, crystals = 50 pts, end-of-stage life bonus)
- 3 lives with temporary invincibility after taking damage
- Parallax background layers (starfield, distant mountains, crystal spires)
- Original sprite art drawn entirely with Canvas 2D API
- Sound effects generated via Web Audio API (jump, land, collect, stomp, hurt, win)
- Game states: Title → Playing → Paused → Game Over / Stage Clear → Title
- Restart from title without reloading the page
- Responsive scaling to any window size (aspect-ratio preserved)

## File structure

```
index.html   – HTML shell with canvas element
style.css    – Minimal styles (black background, canvas scaling)
game.js      – All game logic and rendering (~850 lines)
README.md    – This file
```

## Known limitations

- Single stage (no level progression)
- No high-score persistence (score resets on return to title)
- Audio requires a user interaction before the browser allows it (the title-screen SPACE press counts)
- Very old browsers without `AudioContext` or ES6 support will not work
