# YoinkIt Design System (Portfolio Persona Edition)

## 1. Direction

YoinkIt adopts the tactical operator dossier aesthetic from Aspen's portfolio, inspired by high-energy editorial UI (Persona 5 style): bold condensed typography, high-contrast panels, hard tactile offset borders, and a strict palette: Deep Space Blue, Navy, Brick Red, Molten Lava, Steel Blue, and Papaya Whip.

## 2. Color Tokens

| Token | Value | Role & Usage |
|---|---:|---|
| Deep Space Blue (`ink`) | `#003049` | Primary canvas background |
| Navy (`navy`) | `#002337` | Secondary surface plane, cards, container frames |
| Deep Navy (`navyDeep`) | `#001927` | Terminal wells, inner preview backgrounds |
| Papaya Whip (`paper`) | `#FDF0D5` | High-contrast chips, selected segment surfaces, labels |
| Pure White (`white`) | `#FFFFFF` | Primary text, titles, contrast badges |
| Brick Red (`brickRed`) | `#C1121F` | Primary actions (`YOINK NOW`), active tabs, highlight prompt |
| Brick Red Hot (`brickRedHot`) | `#E03E3E` | Pressed and active states |
| Molten Lava (`moltenLava`) | `#780000` | Deep offset border shadows, critical indicators |
| Steel Blue (`steelBlue`) | `#669BBC` | Secondary buttons, platform tags, metadata |
| Steel Blue Deep (`steelBlueDeep`) | `#4A7A9A` | Section dividers, input borders, inactive controls |
| Muted Tan (`textMuted`) | `#8B7D6B` | Tertiary metadata copy |
| Green (`success`) | `#50FA7B` | Completed downloads (`[DONE]`) |
| Red (`error`) | `#FF5555` | Failed downloads (`[FAIL]`) |

## 3. Typography & Styling

- Title: Heavy sans-serif display, 44 px, weight 900, tracking -1.5.
- Subtitle: Monospace 12 px, uppercase, tracking 1.5, Steel Blue (`ASPEN // MEDIA EXTRACTION SYSTEM`).
- Interface and metadata: System monospace 10–14 px with bold segment flags.
- Tactical Dossier Badge: Brick Red surface framed with 2 px Papaya Whip border (`DOSSIER v1.2`).

## 4. Spacing and Geometry

- Base inset: 22 px.
- All controls use square corners with 2 px tactile borders and 3–4 px Molten Lava offset depth on primary actions.
- Glassmorphism is strictly forbidden; visual hierarchy is created through flat solid tonal planes and crisp borders.

## 5. Primitives

- `CommandInput`: Navy container, Molten Lava bottom border, Brick Red prompt indicator (`>`), Steel Blue clear action (`[×]`), and solid Brick Red trigger button.
- `TabBar`: Segmented 3-button bar; active tab highlights in solid Brick Red with Papaya Whip bottom border.
- `ScanMetaCard`: Framed dossier card with Papaya Whip badge, Steel Blue metadata, and batch selection controls (`[ALL]`, `[NONE]`, `[INVERT]`).
- `PrimaryAction`: Solid Brick Red with hard Molten Lava tactile bottom edge (`[YOINK NOW]`).
- `SecondaryAction`: Navy with Steel Blue border (`+ ADD TO QUEUE`).
- `TerminalConsole`: Deep Navy background (`#001927`), Steel Blue timestamps, Papaya Whip log lines, and blinking Brick Red cursor.
- `QueueBox`: Tactical queue manager with ASCII progress tracking, per-item retry/cancel, and Brick Red `START EXTRACTION` banner.
