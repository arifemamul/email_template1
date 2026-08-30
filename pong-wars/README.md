# Dynamic Pong Wars

A customizable take on [Pong Wars](https://github.com/vnglst/pong-wars): two balls
fight over a shared board, each one flipping the other side's territory to its own
colour and bouncing off it. Nobody ever wins — the frontier just keeps churning.

The whole thing is one `index.html` file. No build step, no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx http-server pong-wars
```

If the repo is published with GitHub Pages, it lives at `/pong-wars/`.

## The interface

The board fills the viewport, with a single monospace readout under it:

```
day 182 | night 218
```

That's the whole default view. Everything else lives behind the **controls**
button in the corner, which slides a panel up over the board.

| Control | Effect |
| --- | --- |
| **Pause / Play** | Freezes the simulation, board and score intact |
| **Reset** | Re-splits the board and re-launches the balls |
| **Day / Night colours** | Recolours the board, the balls and the page gradient live |
| **Palettes** | Six presets, click or cycle with <kbd>C</kbd> |
| **Speed** | 0.2× to 2.5×, applied to balls already in flight |
| **Grid** | 12×12 up to 64×64 cells |
| **Balls per side** | 1 to 4 per team, for a much noisier war |

Keyboard: <kbd>Space</kbd> play/pause, <kbd>R</kbd> reset, <kbd>C</kbd> next
palette, <kbd>Esc</kbd> close the panel. On touch, tap the board to pause or
resume.

## How it works

The board is a flat `Uint8Array` of team ids, split down the middle. Each frame,
every ball samples eight points around its circumference; any cell belonging to
the other team is claimed, and the ball flips its velocity on the axis it was hit
from.

Two details make it behave the way it does:

- **Hits are not deduplicated per frame.** Two opposite hits cancel out, which is
  what lets a ball occasionally punch a tunnel into enemy ground instead of
  bouncing off a flat wall. Deduplicating them makes the frontier stay almost
  straight — most of the churn comes from this.
- **A ball wears the other team's colour**, so it always contrasts with the
  territory it is currently painting.

Velocity is renormalised every frame to the configured speed, with a floor on each
axis, so a ball can never settle into a perfectly horizontal or vertical loop.

The simulation always runs in an 800-unit space; the canvas backing store is sized
to whatever the viewport gives it, times the device pixel ratio. Cell edges are
rounded to whole device pixels and shared between neighbours, so the grid stays
seam-free and crisp at any size instead of showing hairlines between squares.

Colours are stored as team ids rather than colour strings, so changing a colour
repaints the existing board instead of only affecting newly claimed cells. The page
gradient and the control panel are derived from the two team colours, with text
contrast computed from their relative luminance.

## Credits

Inspired by [Koen van Gilst's original Pong Wars](https://github.com/vnglst/pong-wars),
and by [Marko Denic's dynamic-pong-wars](https://github.com/markodenic/dynamic-pong-wars),
which is where the live-customisation idea comes from. This is an independent
implementation.
