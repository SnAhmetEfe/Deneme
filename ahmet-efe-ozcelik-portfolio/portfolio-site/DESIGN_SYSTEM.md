# UI design system

## Concept

A quiet, premium sustainability-tech identity: editorial typography and generous whitespace meet engineering grids, connected nodes and data-like details. The interface avoids neon/cyberpunk tropes and treats motion as a support layer.

## Color tokens

| Token | Value | Use |
|---|---:|---|
| `--ink` | `#071711` | primary dark canvas |
| `--ink-2` | `#0B2118` | elevated dark surface |
| `--paper` | `#F3F2E9` | warm off-white background |
| `--paper-2` | `#E8E9DD` | alternate light surface |
| `--white` | `#FBFCF7` | high-emphasis content |
| `--forest` | `#0E5A3A` | brand green |
| `--emerald` | `#159767` | interactive/status accent |
| `--lime` | `#B8EF66` | restrained highlight and focus |
| `--muted` | `#8D9C94` | dark-theme secondary text |

Text/background combinations are chosen for practical contrast. Lime is used sparingly for high-salience actions, focus and state—not large reading surfaces.

## Type

- **Display:** Georgia / Times New Roman fallback; editorial and human.
- **UI & body:** native system sans stack; fast and platform-appropriate.
- **Scale:** fluid `clamp()` display sizes, compact uppercase micro-labels and readable body copy.
- No webfont dependency, preventing render-blocking requests and layout shift.

## Grid and shape

- Content width: maximum 1,220 px with responsive page gutters.
- Desktop section pattern: 145 px vertical index + primary content.
- Cards: 1.5 rem radius for major story surfaces; sharp 1 px rules for technical structure.
- Circular nodes/orbits communicate connected systems; rectangular grids communicate industry and process.

## Motion

- Reveal duration: 850 ms, custom smooth deceleration.
- Canvas globe: slow rotation and restrained pointer response.
- Sustainability scene: stage interpolation driven by scroll.
- Hover motion: 3–8 px, never essential to understand content.
- `prefers-reduced-motion` removes non-essential animation and smooth scrolling.
- The canvas loop pauses offscreen; mobile receives a static low-node alternative.

## Components

- Fixed translucent navigation + 3 px scroll progress.
- Hero with procedural energy globe—no model or texture download.
- Reverse-chronological expandable timeline.
- Evidence-aware quality cards.
- Project case-study cards with structured fact grid.
- Interactive skills ecosystem with live detail panel.
- Sticky sustainability storytelling scene on desktop; tappable/stacked cards on smaller screens.
- Education cards and compact certification rows.
- Minimal LinkedIn-only contact CTA.

## Accessibility

- Semantic headings, sections, articles, descriptions and time elements.
- Skip link, visible keyboard focus, native buttons and meaningful link labels.
- Mobile menu exposes `aria-expanded` and closes with Escape.
- Skills panel uses `aria-live`; decorative canvas/SVG scenes are hidden from assistive technology.
- Content remains available when JavaScript is unavailable; JavaScript only adds enhancement.
- Breakpoints create a distinct mobile composition rather than scaling the desktop grid.
