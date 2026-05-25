# Design System Strategy: The Heritage Minimalist

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Gallery."** 

We are moving away from the "template" look of standard e-commerce. Instead of a shop, we are building a museum for modern Indian craftsmanship. The aesthetic tension lies in the marriage of **Brutalist Precision** (sharp 0px edges, high-contrast monochrome) and **Earthy Soul** (saffron and clay accents). 

By utilizing intentional asymmetry, oversized typography, and deep tonal layering, we ensure the "6K" brand feels like a high-end editorial magazine rather than a generic storefront. We prioritize the product as an artifact, surrounded by generous whitespace that acts as a visual "buffer" for luxury.

---

## 2. Colors: Tonal Depth & The No-Line Rule

Our palette is rooted in a high-contrast base of White (`#ffffff`) and Black (`#1a1c1c`), punctuated by the warmth of Indian heritage.

### The "No-Line" Rule
Standard UI relies on 1px borders to separate sections. This design system **prohibits** structural borders. Separation must be achieved through:
- **Background Shifts:** Moving from `surface` (`#faf9f8`) to `surface_container_low` (`#f4f3f2`).
- **Whitespace:** Using the spacing scale to create distinct visual islands.

### Surface Hierarchy & Nesting
Treat the interface as physical layers of premium paper.
- **Base Layer:** `surface` for the primary page background.
- **Section Layer:** `surface_container_low` for secondary content blocks (e.g., "You May Also Like").
- **Component Layer:** `surface_container_lowest` (#ffffff) for cards or interactive elements to make them "lift" off the tinted background.

### Glass & Gradient Rule
To prevent the UI from feeling "flat," use Glassmorphism for floating navigation and filters.
- **Floating Nav:** `surface_bright` at 80% opacity with a `20px` backdrop-blur.
- **Signature CTAs:** Use a subtle linear gradient from `secondary` (`#775a19`) to `secondary_container` (`#fed488`) at a 45-degree angle to give the gold a metallic, "foiled" depth.

---

## 3. Typography: Editorial Authority

We use a high-contrast type scale to mimic luxury fashion mastheads.

- **Display & Headlines (Manrope):** These are your "Statement" styles. Use `display-lg` and `headline-lg` with tight tracking (-2%) to create a dense, authoritative "Zara-style" look. Use `on_surface` for maximum legibility.
- **Body & Labels (Inter):** This is your "Utility" style. Inter provides a neutral, technical balance to the expressive Manrope.
- **The Identity Shift:** For category headers, use `title-sm` in **ALL CAPS** with increased letter spacing (+10%) to evoke a sense of curated luxury.

---

## 4. Elevation & Depth: Tonal Layering

Shadows and lines are crutches. We use **Tonal Layering** to define importance.

- **The Layering Principle:** A product card (`surface_container_lowest`) placed on a page background (`surface`) creates a natural, soft separation. No shadow required.
- **Ambient Shadows:** When a modal or floating action button requires a "lift," use a shadow that mimics natural light:
    - **Color:** `on_surface` at 5% opacity.
    - **Blur:** 40px to 60px (extra-diffused).
    - **Offset:** Y: 20px.
- **The Ghost Border:** If a boundary is required for accessibility in input fields, use `outline_variant` (`#d1c5b4`) at 20% opacity. **Never use 100% opaque borders.**

---

## 5. Components: Precision & Soul

### Buttons (The Anchor)
- **Primary:** `on_surface` background, `surface` text. **0px radius.** Padding: `16px 32px`.
- **Secondary (Gold):** `secondary` background, `on_secondary` text. Use for "Add to Cart" to draw the eye using the Indian-modern accent.
- **Tertiary:** `surface` background with a "Ghost Border."

### Input Fields
- **Style:** Underline only. Use `outline` (`#7f7667`) for the bottom border (1px). 
- **Focus State:** Transition the border to `secondary` (Gold) and animate the label using `label-sm` above the input.

### Product Cards
- **Architecture:** Zero borders. Image takes up 100% of the card width. 
- **Typography:** Product title in `title-sm`, price in `body-md` using the `tertiary` (Saffron/Clay) color to highlight value without being loud.

### The "6K" Signature Grid
- Avoid perfectly symmetrical 4-column grids. Use a **12-column grid** but place images in "Broken Layouts" (e.g., a large image spanning 7 columns, with text and a smaller image staggered in the remaining 5).

---

## 6. Do’s and Don’ts

### Do
- **DO** use `tertiary` (`#98462d`) for functional accents like "Sale" badges or "Limited Edition" tags. It provides a "clay" earthiness that grounds the luxury.
- **DO** utilize heavy whitespace (e.g., 120px between major sections) to allow the "modern Indian" aesthetic to breathe.
- **DO** use 0px rounding for everything. Precision is our hallmark.

### Don’t
- **DON’T** use standard grey shadows. They look "cheap." Always tint shadows with a hint of the brand’s `on_surface` color.
- **DON’T** use dividers. Use a change in background color (`surface` to `surface_container`) if you need to separate content.
- **DON’T** use "Pure Black" (#000). Use our `on_surface` (`#1a1c1c`) to maintain a premium, ink-like softness.

---

## 7. Design Tokens (Selection)

| Token | Value | Usage |
| :--- | :--- | :--- |
| `radius-none` | `0px` | All buttons, containers, and inputs. |
| `surface-hero` | `#faf9f8` | Primary background for product storytelling. |
| `accent-heritage` | `#98462d` | "Clay" tone for subtle alerts/highlights. |
| `accent-luxury` | `#775a19` | "Muted Gold" for primary conversion points. |
| `type-display` | `Manrope, 3.5rem` | Hero headlines, editorial moments. |
| `type-utility` | `Inter, 0.875rem` | Body descriptions and metadata. |