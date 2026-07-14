# Agentic Coding Benchmark: 2D Platform Game

Create a complete, playable 2D side-scrolling platform game inspired by classic console platformers.

The game must be implemented as a browser application using only:

- HTML
- CSS
- Vanilla JavaScript

## General requirements

- Do not use frameworks, libraries, build tools, npm packages, or CDNs.
- Do not use external images, audio files, fonts, or other assets.
- The game must run by opening `index.html` directly in a modern browser.
- Create all necessary files in the current project folder.
- Do not ask the user questions.
- Make reasonable design decisions independently.
- Test and improve the implementation before finishing.

## Intellectual property

Do not reproduce copyrighted characters, graphics, sounds, music, level layouts, names, or other identifiable assets from existing games.

Create an original:

- player character
- visual theme
- enemies
- stage layout
- sound design
- title

The game may use familiar 2D platform-game mechanics, but its presentation must be original.

## Required gameplay

The game must include:

- horizontal player movement
- acceleration and deceleration
- gravity
- jumping
- collision detection with floors, walls, and platforms
- a scrolling camera that follows the player
- at least one complete playable stage
- platforms at different heights
- pits or other environmental hazards
- collectible items
- at least one type of moving enemy
- the ability to defeat or avoid enemies
- a score system
- player lives or health
- a clear start state
- a clear game-over state
- a clear stage-complete condition
- the ability to restart without reloading the browser page

## Controls

Support keyboard controls:

- Left / Right arrow keys or A / D: move
- Space, W, or Up arrow: jump
- P or Escape: pause

Display the controls inside the game interface.

## Presentation

The game should include:

- an original title screen
- a visually coherent interface
- animated player and enemies
- background scenery
- readable score and status information
- simple sound effects generated with the Web Audio API
- responsive scaling for different browser-window sizes

Do not rely on emoji as the main game graphics.

## Technical quality

The implementation should:

- use `requestAnimationFrame`
- separate update logic from rendering logic
- use delta time or another suitable method to keep movement reasonably consistent
- avoid obvious collision bugs
- prevent unintended repeated input actions
- keep the code readable and reasonably structured
- include brief comments for important systems
- avoid unnecessary complexity

## Deliverables

Create:

- `index.html`
- `style.css`
- `game.js`
- `README.md`

The `README.md` must briefly explain:

- how to run the game
- controls
- implemented features
- file structure
- known limitations, if any

## Final validation

Before finishing:

1. Inspect all created files.
2. Check for syntax errors and missing references.
3. Verify that the game can start, be played, completed, lost, and restarted.
4. Fix any problems you find.
5. Do not merely describe the implementation; create the working game files.