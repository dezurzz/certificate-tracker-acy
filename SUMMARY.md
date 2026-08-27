# BKI Academy CMS - Unified Project Summary

This document summarizes the unified architecture, sitemap, design tokens, and components built for the BKI Academy Certificate Management System (CMS). This serves as the token-saving single source of truth for future modification tasks.

---

## 1. Project Sitemap & Pages (Root Directory)
All screens are unified, responsive, static HTML pages referencing the shared design system.

- **`/` (`index.html`)**: Login screen. Suppresses navigation sidebar/header.
- **`/dashboard` (`dashboard.html`)**: General dashboard overview. Displays unified style KPI cards, bento-style Pipeline progress, and Recent Activities.
- **`/trainings` (`trainings.html`)**: List of training batches with table-specific search, status, and PIC dropdown filters, a proper HTML date selector input, and an inline interactive **Add Training** modal.
- **`/trainings/:id` (`training-detail.html`)**: Batch detail screen containing interactive tabs:
  - **Overview**: Core progress counts and participant status preview.
  - **Participants**: List of attendees with search filters and Excel upload modal.
  - **Certificates**: Interactive Kanban board (Pending, Processing, Printing, Completed) with fully supported **Drag and Drop** actions and clickable card detail modal updates.
  - **Activity Log**: Event history timeline.
- **`/certificates` (`certificates.html`)**: Global certificate list displaying processing age (SLA tracking), search input, and multi-parameter dropdown filters.
- **`/reports` (`reports.html`)**: Performance analytics. Houses SLA completion metrics, custom SVG monthly charts, delay reason bars, and PIC SLA metrics table.
- **`/settings` (Tabbed pages)**:
  - **`settings-profile.html`**: Personal information and avatar upload.
  - **`settings-notifications.html`**: SLA breach & email warnings toggle buttons.
  - **`settings-security.html`**: Password reset form, 2FA settings, and session revoking.
  - **`settings-system.html`**: System configuration (Standard SLA age, template selects).

---

## 2. Design System & CSS Classes (`shared/design-system.css`)
Provides CSS variables and component utility classes for visual consistency.

### A. Color Palette Tokens
- **Navy Colors**: `--color-primary: #0F172A`, `--color-primary-container: #131B2E` (Sidebar backgrounds).
- **Action / Accent Blue**: `--color-secondary: #3B82F6` (Primary interactive buttons/highlights).
- **Slate Grays**: `--color-background: #F8FAFC`, `--color-surface: #FFFFFF` (Canvas/card layers).
- **Functional Status**:
  - `Pending`: Slate gray (`#F1F5F9` bg, `#475569` text)
  - `Processing`: Amber/Yellow (`#FEF3C7` bg, `#D97706` text)
  - `Completed`: Green (`#DCFCE7` bg, `#15803D` text)
  - `Overdue`: Red (`#FEE2E2` bg, `#B91C1C` text)

### B. Common Utility Classes
- `.cms-card`: Standardized borders (`#E2E8F0`), padding, and rounded corners (`12px`). Includes `.cms-card-interactive` for hover shadows.
- `.cms-input`: Standardized text input border, padding, and focus outlines (glow).
- `.cms-btn-primary`, `.cms-btn-secondary`, `.cms-btn-danger`: Styled buttons enforcing border-radii (`8px`) and scaling micro-animations on active tap.
- `.cms-badge-[pending|processing|completed|overdue]`: Status badges in a fully rounded pill shape.
- `.kanban-col` & `.kanban-card`: Clean card layout for drag-and-drop / Kanban workflow visualizations.

---

## 3. Shared Components Logic (`shared/components.js`)
Performs automatic DOM injection on load to ensure 100% shell layout consistency.

- **Dynamic Navigation Shell**:
  - `SideNavBar`: Automatically rendered inside element `#sidebar-container`. Detects path to highlight active page. Displays brand headers and bottom settings/profile info.
  - `TopNavBar`: Automatically rendered inside element `#header-container`. Renders page title, alert badges, help items, and profile dropdown menu. The header search bar is removed to keep query inputs local to data tables.
- **Top Actions Panel**: Handles toggles for user profiles and notification drawers.
- **Global Row Actions Context Menu**: Handles clicks to trigger and toggle row actions dropdown context menus (`.row-actions-btn` and `.row-actions-menu`) globally across tables.
