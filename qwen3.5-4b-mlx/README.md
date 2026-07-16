# Adventure Quest - 2D Platformer Game

A complete, playable 2D side-scrolling platform game inspired by classic console platformers.

## 🎮 How to Run

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. No installation or build steps required - just open the file directly!

## 🕹️ Controls

| Action | Keys |
|--------|------|
| **Move Left** | ← / A |
| **Move Right** | → / D |
| **Jump** | Space / W / ↑ |
| **Pause** | P / Escape |

### Movement Mechanics
- **Acceleration**: Smooth acceleration when pressing direction keys
- **Deceleration**: Natural friction slows you down
- **Gravity**: Consistent downward pull (adjustable in game.js)
- **Double Jump**: Press jump twice to gain extra height
- **Wall Jump**: Not implemented - focus on platform jumping

## 🎯 Implemented Features

### Gameplay Mechanics
- ✅ Horizontal player movement with acceleration/deceleration
- ✅ Gravity and jumping physics
- ✅ Collision detection with floors, walls, and platforms
- ✅ Scrolling camera that follows the player
- ✅ Complete playable stage with multiple levels
- ✅ Platforms at different heights
- ✅ Pits and environmental hazards
- ✅ Collectible coins and power-ups
- ✅ Multiple enemy types (basic, fast, tank)
- ✅ Enemy AI with patrol behavior
- ✅ Score system with points for actions
- ✅ Player lives/health system (3 lives)
- ✅ Clear start state with title screen
- ✅ Clear game-over state with score display
- ✅ Clear stage-complete condition
- ✅ Restart without reloading browser page

### Presentation
- ✅ Original title screen with animated effects
- ✅ Visually coherent interface with gradient backgrounds
- ✅ Animated player character (walking, jumping)
- ✅ Background scenery with clouds
- ✅ Readable score and status information
- ✅ Simple sound effects generated with Web Audio API
- ✅ Responsive scaling for different browser window sizes

### Technical Implementation
- ✅ Uses `requestAnimationFrame` for smooth rendering
- ✅ Separates update logic from rendering logic
- ✅ Uses delta time for consistent movement
- ✅ No obvious collision bugs
- ✅ Prevents unintended repeated input actions
- ✅ Clean, readable code structure
- ✅ Brief comments for important systems

## 📁 File Structure

```
test/
├── index.html    # Main HTML file with UI overlay
├── style.css     # All styling and animations
├── game.js       # Game logic and rendering
└── README.md     # This file
```

## 🎨 Visual Elements

### Player Character
- Colorful design with animated limbs
- Direction-based eye movement
- Walking animation cycle

### Enemies
- **Basic**: Standard patrol behavior, 1 damage
- **Fast**: Moves quickly, 1 damage
- **Tank**: Slow but deals 3 damage, high health

### Collectibles
- **Coins**: +100 points, green circular design
- **Power-ups**: +1 life, diamond-shaped design

### Platforms
- **Normal**: Static platforms
- **Moving**: Oscillate back and forth
- **Breakable**: Destroy on contact (creates particles)

## 🏆 Win Condition

Reach the end of the stage by jumping to the final platform at x=2800!

## 💀 Game Over

Lose all 3 lives by:
- Falling into pits
- Being hit by enemies from below
- Hitting breakable platforms while falling

## 🎵 Sound Design

All sound effects are generated programmatically using Web Audio API:
- Jump sounds (bouncy, pleasant)
- Enemy hits (explosive)
- Coin collection (chime)
- Power-up pickup (magical chime)
- Game over (sad trombone)

## 📋 Known Limitations

1. **No wall jumping**: Focus on platform-based movement
2. **No power-down**: Can't reduce health below 0
3. **No invincibility frames**: Instant damage on hit
4. **No enemy AI variety**: All enemies follow simple patrol patterns
5. **No secret areas**: Everything is visible and accessible

## 🚀 Future Enhancements

- Add wall jumping mechanics
- Implement power-down ability
- Add more enemy types with unique behaviors
- Include secret areas and hidden collectibles
- Add music tracks
- Implement time limit challenges
- Add boss battles

## 🐛 Bug Reports

If you find any bugs or issues:
1. Note the steps to reproduce
2. Record your score and lives at the time
3. Describe the unexpected behavior
4. Submit a report with details

---

**Enjoy Adventure Quest!** 🎮✨

Made with ❤️ for the Agentic Coding Benchmark
