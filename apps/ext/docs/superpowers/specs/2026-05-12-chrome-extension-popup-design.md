# Chrome Extension Popup UI Design

## Overview

A beautiful, polished popup UI for a Chrome extension built with WXT + React + shadcn/ui (Nova style) + Tailwind v4. The popup acts as a mini-dashboard that showcases shadcn UI components with a clean, modern visual style.

## Visual Style

- Clean and modern with gradient accents, rounded cards, and smooth animations
- Geist Variable font (already configured)
- Dark/light mode toggle using existing `.dark` CSS variables
- White background with `--card` for elevated elements
- Subtle gradient accent line at the top of the header

## Layout

Popup dimensions: 380px wide, vertically scrolling.

### Header

- Extension logo + name "RPP Extension" on the left
- Version badge (e.g., "v1.0") next to the name
- Theme toggle icon (sun/moon) button on the right
- Thin gradient line (accent) at the very top edge
- Subtle bottom border

### Stats Row

Three compact stat cards in a horizontal row with mock data:
- "12 Tabs" — icon: LayoutGrid
- "48 Bookmarks" — icon: Bookmark
- "2.5h Saved" — icon: Clock

Each stat card has: small icon, big number (bold), label underneath (muted text).

### Quick Actions Grid

A 2x2 grid of action cards:
1. **Search** — Icon: Search, includes an Input field for typing queries
2. **Bookmarks** — Icon: BookmarkPlus, shows bookmark count, clickable card
3. **Settings** — Icon: Settings, opens a Dialog with toggle switches
4. **About** — Icon: Info, shows extension info/version

Each card has: icon, title, brief description, subtle hover lift effect (`transition-all`).

### Settings Dialog

- Opened by clicking the Settings action card
- Contains toggle switches for: Dark mode, Notifications, Auto-sync
- Close button (X) in top right
- Uses Label and Dialog components

### Footer

- Small muted text: "Built with shadcn/ui"
- Tiny secondary badge with "Nova" style tag

## Components Used

| Component | Usage |
|-----------|-------|
| Card | Stats row cards, action grid cards |
| Button | Theme toggle, action triggers, dialog actions |
| Badge | Version tag in header, footer credit |
| Input | Search field in the Search action card |
| Label | Form labels in settings dialog |
| Dialog | Settings modal with toggles |

## Technical Details

- Framework: WXT (Web Extension Tools) with React module
- UI Library: shadcn/ui (radix-nova style)
- Styling: Tailwind CSS v4 with CSS variables
- Font: Geist Variable
- All data is mock/static — no real browser API calls needed
- Dark mode toggle adds/removes `.dark` class on the popup root element
- Popup entrypoint: `entrypoints/popup/App.tsx`

## Files to Modify

- `entrypoints/popup/App.tsx` — Main popup layout and all UI sections
- No other files need changes; all shadcn components are already installed
