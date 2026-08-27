---
name: BKI Academy CMS
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered for a Certificate Management System (CMS), prioritizing high-density information display, trust, and operational efficiency. The aesthetic is a fusion of **Corporate Modern** and **Minimalism**, heavily inspired by the utilitarian precision of developer-centric tools.

The brand personality is authoritative yet frictionless. It utilizes heavy whitespace to manage cognitive load in complex data environments, paired with sharp, high-contrast interactive elements. The emotional response should be one of "controlled clarity"—where the user feels in total command of large-scale certification data.

## Colors
This design system utilizes a foundation of Deep Navy for institutional presence, contrasted with Indigo for primary interaction points. 

- **Primary (#0F172A):** Used for navigation sidebars, heavy headings, and core brand moments.
- **Action (#3B82F6):** Reserved strictly for primary buttons and active states to guide the eye.
- **Grays:** A meticulous scale from `#F8FAFC` (Background) to `#E2E8F0` (Borders) to `#64748B` (Secondary Text).
- **Functional Palette:** High-saturation tokens for status indicators. Success, Warning, and Danger colors are paired with 10% opacity backgrounds for badge treatments to ensure legibility without visual noise.

## Typography
The typography system relies exclusively on **Inter** to achieve a technical, systematic feel. It utilizes a slightly tight letter-spacing for headlines to mimic high-end editorial software.

- **Scale:** Information density is maintained by using a base body size of 14px, dropping to 13px for data tables and metadata.
- **Hierarchy:** Use `Deep Navy` for display and titles, and `Slate 500` for supporting body text.
- **Labels:** Small, uppercase labels with increased tracking (letter-spacing) are used for table headers and section dividers to provide structure without bulk.

## Layout & Spacing
The layout follows a **Fixed-Fluid hybrid** model. Navigation is fixed to a 240px left-hand sidebar, while the content area utilizes a fluid 12-column grid that maxes out at 1440px to prevent excessive line lengths in data tables.

- **Rhythm:** An 8px linear scale is used for general layout, with 4px increments for tight component internals (e.g., input padding).
- **Density:** High-density mode is the default. Gutters are kept at 16px to allow more columns of data to be visible simultaneously.
- **Mobile:** On screens smaller than 1024px, the sidebar collapses into a drawer, and container padding reduces from 24px to 16px.

## Elevation & Depth
This design system uses **Tonal Layering** supplemented by **Ambient Shadows**. Depth is used sparingly to signify interactivity or temporary overlays.

- **Level 0 (Base):** Background color `#F8FAFC`. Used for the main canvas.
- **Level 1 (Surface):** White `#FFFFFF` with a 1px border of `#E2E8F0`. Used for cards, table rows, and secondary navigation elements.
- **Level 2 (Elevated):** Subtle shadow (0px 4px 6px -1px rgba(0, 0, 0, 0.05)). Used for dropdown menus and hover states on interactive cards.
- **Level 3 (Overlay):** Pronounced shadow (0px 20px 25px -5px rgba(0, 0, 0, 0.1)). Reserved for modals and certificate previews.

## Shapes
The shape language is professional and approachable. A standard radius of 8px (`rounded-md`) is used for buttons and inputs, while larger containers like cards and modals utilize 12px (`rounded-lg`) to create a softer, modern framing for complex data. 

Status badges use a fully rounded `9999px` pill shape to distinguish them clearly from rectangular interactive elements.

## Components
- **Buttons:** Primary buttons use `#3B82F6` with white text and a subtle 1px inner light stroke. Secondary buttons are ghost-style with `#E2E8F0` borders.
- **Status Badges:** Use a "soft-fill" approach. For example, a "Completed" badge uses a `#D1FAE5` (Green 100) background with `#065F46` (Green 800) text.
- **Data Tables:** Row height is set to 48px for high density. Headers use `label-caps` typography with a subtle bottom border.
- **Inputs:** Default state uses a 1px border of `#E2E8F0`. On focus, the border shifts to `#3B82F6` with a 2px soft indigo outer glow (ring).
- **Cards:** White background, 12px border radius, and a 1px `#E2E8F0` border. No shadow in resting state; subtle shadow on hover if the card is clickable.
- **Certificate Preview:** A specialized component using a slight `Level 3` elevation and a distinctive "paper" aspect ratio to differentiate actual certificates from UI elements.