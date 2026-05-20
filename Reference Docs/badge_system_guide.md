# Badge System & XP Progress Bar Guide

This document explains the implementation of the visual badge system on the dashboard, including how to manage assets and how the UI behaves based on user rank.

## 1. Directory for Assets
All badge images must be placed in the following directory:
`public/assets/badges/`

## 2. Image Naming Convention
The system uses the `rankName` defined in `lib/gamification/xp-rules.ts` to find images. Each rank requires two PNG files:

1.  **Colored Badge:** `<RankName>.png` (Displayed when earned)
2.  **Unrevealed Badge:** `<RankName>_unrevealed.png` (Displayed as a greyed-out target)

### Required Files Checklist:
*   `Beginner.png` / `Beginner_unrevealed.png`
*   `Explorer.png` / `Explorer_unrevealed.png`
*   `Performer.png` / `Performer_unrevealed.png`
*   `Pro.png` / `Pro_unrevealed.png`
*   `Expert.png` / `Expert_unrevealed.png`
*   `Master.png` / `Master_unrevealed.png`
*   `Champion.png` / `Champion_unrevealed.png`
*   `Legend.png` / `Legend_unrevealed.png`

## 3. Dashboard UI Logic

### XP Progress Bar
The bar is now a horizontal row with badges at both ends:
*   **Left Side (Current):** Shows the colored badge for the user's current rank.
    *   *Note:* If the user is a "Starter" (less than 250 XP), the left side is intentionally left empty.
*   **Right Side (Target):** Shows the greyed-out `_unrevealed` version of the next rank the user is working toward.
*   **Center:** Shows the numeric XP progress and the animated liquid-ripple bar.

### Earned Badges Section
Located at the bottom of the left column on the dashboard. This section automatically displays the colored PNG badges for every rank milestone the user has already passed.

## 4. Technical Implementation
*   **Data Logic:** `lib/gamification/xp-rules.ts` defines the XP thresholds and rank names.
*   **XP Bar Component:** `components/dashboard/xp-progress-bar.tsx` handles the horizontal layout and badge image rendering.
*   **Dashboard Page:** `app/org/[orgSlug]/dashboard/page.tsx` passes the rank data and manages the display of earned badges.

## 5. Adding New Ranks
To add a new rank:
1.  Add the new tier to the `RANK_TIERS` array in `lib/gamification/xp-rules.ts`.
2.  Upload the corresponding `.png` and `_unrevealed.png` files to the `public/assets/badges/` folder.
3.  The UI will automatically pick up the new rank and start showing it as a target once the user reaches the preceding rank.
