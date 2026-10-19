# StumpCast Studio: Looks & Theme Authoring Guide 🎨

StumpCast Studio features a completely decoupled, token-driven **Look System**. Overlay components never have hardcoded colors, gradients, or positions—they read CSS custom properties (`var(--token)`) and a `data-look="look-id"` attribute on the root HTML element.

This means you can design, package, and install completely new broadcast graphics packages without writing or compiling TypeScript code!

---

## 📦 What is a Look?

A Look is defined by a JSON object matching the `LookSchema` in `@stumpcast/shared`. When distributed, it is packaged as a `.stumplook` file (a standard ZIP archive containing `look.json` and optional image assets like crests or stadium backgrounds).

```typescript
interface Look {
  id: string;              // Unique kebab-case slug (e.g. "midnight-glass")
  name: string;            // Display title (e.g. "Midnight Glass")
  tier?: 'free' | 'pro';   // Default tier
  tokens: LookTokens;      // CSS custom property token mappings
  layoutVariant: LayoutVariant;
  motion: MotionTokens;
  assets?: Record<string, string>;
}
```

---

## 🧩 Look Tokens Reference

### 1. Colors & Surfaces
| Token | Description | Example |
|---|---|---|
| `bg` | Primary background color | `#0E1116` |
| `surface` | Card & container background | `#161B22` |
| `surface2` | Secondary accent surface | `#21262D` |
| `border` | Border & divider stroke | `#30363D` |
| `text` | Primary readable typography | `#E6EDF3` |
| `muted` | Secondary labels & subheaders | `#8B949E` |
| `accent` | Brand primary color | `#19D3C5` |
| `accentInk` | Text color when rendered on `accent` | `#0E1116` |
| `coral` | Wicket, danger, and out color | `#FF6B57` |
| `amber` | Milestone, warning, and boundary color | `#FFB020` |

### 2. Typography
| Token | Description | Recommended Font |
|---|---|---|
| `fontHeading` | Title, team names, card headers | `'Space Grotesk', sans-serif` |
| `fontBody` | Commentary, captions, details | `'Inter', sans-serif` |
| `fontNumbers` | Runs, overs, wickets, strike rate | `'Barlow Condensed', sans-serif` |

### 3. Layout Variant (`layoutVariant`)
Defines the visual architecture of the scoreboard and player cards:
- **`scorePosition`**: `'top'` | `'bottom'`
- **`scoreBarShape`**: `'flat'` | `'pill'` | `'notched'` | `'slanted'` | `'split'`
- **`playerCardStyle`**: `'cutout'` (translucent photo with drop shadow) | `'badge'` (circular or square framed avatar)
- **`boundaryStyle`**: `'flash'` | `'burst'` | `'sweep'` | `'gold-flare'`

### 4. Motion (`motion`)
GSAP animation curves and entrance trajectories:
- **`entrance`**: `'slide-up'` | `'slide-down'` | `'fade'` | `'zoom'` | `'flip'` | `'curtain'`
- **`duration`**: Number in seconds (default `0.35`)
- **`ease`**: Standard GSAP easing curve (e.g. `'power3.out'`, `'back.out(1.4)'`)

---

## 🛠️ Complete Example: `midnight-glass.json`

```json
{
  "id": "midnight-glass",
  "name": "Midnight Glass",
  "tier": "pro",
  "tokens": {
    "bg": "rgba(10, 16, 28, 0.85)",
    "surface": "rgba(22, 34, 56, 0.7)",
    "surface2": "rgba(35, 52, 85, 0.6)",
    "border": "rgba(56, 189, 248, 0.35)",
    "text": "#F8FAFC",
    "muted": "#94A3B8",
    "accent": "#38BDF8",
    "accentInk": "#030712",
    "coral": "#F43F5E",
    "amber": "#FBBF24",
    "fontHeading": "'Space Grotesk', system-ui, sans-serif",
    "fontBody": "'Inter', system-ui, sans-serif",
    "fontNumbers": "'Barlow Condensed', sans-serif",
    "cardRadius": "16px",
    "cardShadow": "0 20px 40px rgba(0, 0, 0, 0.6)"
  },
  "layoutVariant": {
    "scorePosition": "top",
    "scoreBarShape": "pill",
    "playerCardStyle": "cutout",
    "boundaryStyle": "sweep"
  },
  "motion": {
    "entrance": "fade",
    "duration": 0.4,
    "ease": "power3.out"
  }
}
```

---

## 📦 Packaging a `.stumplook`

1. Create a clean working folder containing:
   - `look.json` (Your Look schema definition)
   - `preview.png` (512x288 thumbnail for the Admin gallery)
   - `assets/` *(optional)*: Transparent PNGs or SVG crests.
2. Compress the folder contents into a `.zip` file.
3. Rename the `.zip` extension to `.stumplook`.
4. In StumpCast Studio, go to **Settings > Looks & Themes > Import Look**, and select your `.stumplook` file.
5. StumpCast automatically verifies the JSON schema, checks asset checksums, and makes your theme available instantly!
