# UI/UX Comprehensive Audit Report — MPLADS AI Monitoring
**Evaluation Benchmark**: Smart India Hackathon (SIH 2026) & Ministry Civic Tech Standards  
**Target User Personas**: Ministry Officials (National), State Nodal Authorities, District Collectors / DMs, Members of Parliament (MPs), and Field Audit Officers.  
**Stack**: React 18 (Vite SPA) + TypeScript, Express backend, Recharts, SVG Maps India, Tailwind CSS + custom design tokens.  
**Audit Viewport Tested**: 360px (Mobile), 768px (Tablet), 1280px (Standard Desktop), 1920px (Wide Desktop).

---

## Executive Summary & First Impression

The platform solves a high-impact, real-world governance challenge: **bridging the audit capacity gap across tens of thousands of decentralized MPLADS civil works**. The analytical foundation (unsupervised Isolation Forest anomaly detection, peer cost normalization, and cross-dataset reconciliation) is mathematically grounded and avoids black-box accusations.

However, the UI currently exhibits several critical weaknesses that could undermine judges' evaluations:
1. **Emoji as Icons & Inconsistent Visual Language**: Emojis (🏛️, 👤, 📍, 🗳️, ⚖️, 🔔, 🔑) are sprinkled across headers, buttons, and badges, imparting a "hackathon prototype" feel rather than a credible, sovereign civic platform.
2. **Visual Discordance Across Modules**: The core dashboard uses an authoritative light cream/deep teal palette (`#f4f7f4`, `#11332e`), whereas the Cartel Radar screen switches abruptly to an unstyled dark terminal/cyberpunk aesthetic (`#0b1d1a`, `#071714`), and the Multi-Upload screen introduces conflicting generic blue hues (`#2563eb`).
3. **Typography & Tabular Layouts**: Numerical data (crores, lakhs, percentages, variance) lacks consistent tabular numeral formatting and alignment across several secondary tables, causing optical wobble during data updates.
4. **Mobile & Viewport Deficits (360px & 1920px)**: The 360px mobile view suffers from touch targets under 44px (e.g., 28px sidebar toggles, small table actions), and at 1920px cards stretch excessively without max-width content constraints.
5. **Missing States & Loading Polish**: Multiple screens still rely on raw text strings (`"Loading review reminders..."`) instead of semantic animated skeleton loaders and contextual empty states with actionable recovery paths.

---

## Detailed Audit Findings by Category

### 1. Bugs & Layout Breakages
| ID | Issue Description | Screen / Component | Breakpoint | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **Touch Targets Under 44px**: Sidebar toggle button (`.sidebar-hide-btn`) is 28×28px; mobile burger button has small hit area (~34px), violating WCAG 2.5.5 minimum touch requirements. | App Shell / Topbar | 360px, 768px | **Critical** |
| **BUG-02** | **Horizontal Table Overflow & Clipping**: Project lists and reconciliation tables on mobile push beyond container boundary without explicit horizontal scroll indicators. | ProjectsPage, ReconciliationPage | 360px, 768px | **High** |
| **BUG-03** | **Network Graph Hitbox & Canvas Scaling**: Cartel Radar SVG node click targets are 10–14px radius with no touch target padding, making node inspection difficult on touch devices. | CartelRadarPage | 360px, 768px | **High** |
| **BUG-04** | **Breadcrumb & Search Wrapping Jitter**: At viewport widths between 768px and 900px, topbar breadcrumb and search input collide and cause abrupt vertical jumps. | Topbar | 768px–900px | **Medium** |
| **BUG-05** | **1920px Container Over-Stretching**: Content area has no upper constraint, causing KPI cards and chart panels to stretch across 1800px+ with awkward horizontal whitespace gaps. | DashboardPage, AnalyticsPage | 1920px | **Medium** |

---

### 2. UX & Information Hierarchy
| ID | Issue Description | Screen / Component | Severity |
| :--- | :--- | :--- | :--- |
| **UX-01** | **Unclear Persona / Jurisdiction Context**: When switching roles, users must look closely at small subtext to confirm whether they are in National, Karnataka State, or Bengaluru District scope. Needs an authoritative, prominent scope badge bar. | App Shell, Dashboard | **Critical** |
| **UX-02** | **Cognitive Overload in Filter Bar**: 3 stacked dropdowns without clear active filter chips or count indicators make it tedious to track active drill-down constraints. | FilterBar, RiskPage | **High** |
| **UX-03** | **Audit Trail / Case Creation Flow Friction**: Creating an audit case from a flagged project requires navigating away from the project dossier rather than an integrated slide-over or contextual action modal. | ProjectDetailPage, CasesPage | **High** |
| **UX-04** | **Reconciliation Ambiguity Handling**: Orphaned or ambiguous dataset records lack clear single-click reconciliation actions (e.g., "Assign to Project ID" or "Mark as Variance Exception"). | ReconciliationPage | **Medium** |
| **UX-05** | **Search Usability**: Global search requires hitting `Enter` with no instantaneous suggestion dropdown or autocomplete for project IDs, states, or contractors. | Shell Topbar | **Medium** |

---

### 3. Visual Inconsistencies & Anti-Slop Violations
| ID | Issue Description | Screen / Component | Severity |
| :--- | :--- | :--- | :--- |
| **VIS-01** | **Emoji Used as Icons**: Unprofessional emoji usage (`🏛️`, `👤`, `📍`, `🗳️`, `⚖️`, `🔔`, `🔑`, `★`) across headers, buttons, and cards. Violates government design standards. | LandingPage, LoginPage, Shell | **Critical** |
| **VIS-02** | **Dual Palette Schism**: CartelRadarPage uses a dark cyberpunk green (`#0b1d1a`), while Dashboard and Detail pages use a light government cream/slate (`#f4f7f4`). Needs single coherent design language. | CartelRadarPage | **Critical** |
| **VIS-03** | **Fragmented Color Tokens**: Inline hex values (`#238f82`, `#10b981`, `#ecfdf5`, `#1b4a40`, `#e4774c`, `#d95b67`) scattered throughout JSX instead of CSS variable tokens. | App.tsx, RoleDashboardSection | **High** |
| **VIS-04** | **Pill Badge Clutter**: Multiple stacked pill capsules on project cards and metric headers violate zero-pill typographic discipline. Metadata should use clean typographic separators (`·`). | ProjectOverview, AlertsPage | **High** |
| **VIS-05** | **Inconsistent Spacing & Radii**: Border radius ranges arbitrarily from 4px, 8px, 12px, 20px, to `999px` without an explicit scale. | Global CSS | **Medium** |

---

### 4. Accessibility (WCAG 2.1 AA)
| ID | Issue Description | Screen / Component | Severity |
| :--- | :--- | :--- | :--- |
| **A11Y-01** | **Missing Form Labels**: Global search input and several filter selects rely solely on placeholders or default option text without `<label>` or `aria-label`. | Topbar, FilterBar | **Critical** |
| **A11Y-02** | **Contrast Ratios on Subdued Text**: Muted text tokens (`var(--muted)`, `#647a72`, and `rgba(255,255,255,0.7)`) on light grey or dark green backgrounds drop below 4.5:1. | Shell, Cards, Tables | **High** |
| **A11Y-03** | **Icon-Only Buttons Missing ARIA**: Notification bell, mobile menu toggle, and expand/collapse icons lack `aria-label` attributes for screen readers. | Shell Header | **High** |
| **A11Y-04** | **Focus State Inconsistency**: Several custom buttons and interactive SVG nodes lack visible `:focus-visible` styling during keyboard tab navigation. | Map, Cartel Graph, Persona Chips | **Medium** |

---

### 5. Missing States & Resilience
| ID | Issue Description | Screen / Component | Severity |
| :--- | :--- | :--- | :--- |
| **STA-01** | **Crude Text Loading States**: Raw text strings like `"Loading review reminders..."` and `"Checking secure session..."` cause layout shift (CLS). | CasesPage, AlertsPage, RootRoute | **High** |
| **STA-02** | **Empty States Lack Actionable Guidance**: Empty alerts or case lists show passive notices with no direct CTA to trigger analysis or inspect recent projects. | AlertsPage, CasesPage | **Medium** |
| **STA-03** | **Offline / Degradation Notification**: When backend API is unreachable or slow, buttons freeze without clear disabling states or retry banners. | MultiUploadPage, LoginPage | **Medium** |

---

## Proposed Design Direction & Tokens (Phase 2 & 3 Plan)

### 1. Typography System
* **Display / Brand / Headings**: `Plus Jakarta Sans` or refined `DM Sans` (600 SemiBold / 700 Bold), tracking `-0.02em` for authoritative governmental stature.
* **Body Prose**: `Plus Jakarta Sans` / `DM Sans` (400 Regular / 500 Medium), line-height 1.5–1.6, measure 65–75ch.
* **Data, Figures & Telemetry**: `JetBrains Mono` or tabular numerals (`tabular-nums`) for currency (₹ Crores / Lakhs), project counts, percentages, and IDs.

### 2. Sovereign Civic Color Palette (WCAG AA Certified)
* **Primary Deep**: `#0f2922` (Deep Forest Ink — National Authority, Header & Sidebar anchors).
* **Primary Accent / Brand**: `#126255` (Sovereign Pine Teal — active navigation, primary CTAs, interactive highlights).
* **Neutral Canvas (60%)**: `#f7faf8` (Clean, crisp civic paper background, eliminating dingy grey tones).
* **Surface Containers (30%)**: `#ffffff` (Pure white card surfaces with 1px hairline border `#dce5e0` and single-elevation soft shadow).
* **Semantic Signals (10%)**:
  * **Critical Risk / Anomaly**: `#b91c1c` (Text/Icon on `#fef2f2`, border `#fecaca`).
  * **High Risk / Alert**: `#c2410c` (Text/Icon on `#fff7ed`, border `#fed7aa`).
  * **Medium Risk / Caution**: `#b45309` (Text/Icon on `#fefce8`, border `#fef08a`).
  * **Low Risk / Normal / Verified**: `#047857` (Text/Icon on `#ecfdf5`, border `#a7f3d0`).

### 3. Layout & Component Architecture
* **Top Bar Contract**: Strict 1-row, 3-zone header: Brand Wordmark / Scope Breadcrumb + Search / Notifications + Timestamp + Officer Profile.
* **Anti-Slop Cleanliness**: Replace all emojis with crisp, consistent Lucide-style inline SVGs.
* **Unified Light Theme**: Harmonize Cartel Radar into the clean civic light system with crisp SVG node styling and high-contrast edges.
* **Universal 4px/8px Spacing Scale**: All padding, margins, and gaps adhere to `4px, 8px, 12px, 16px, 20px, 24px, 32px`.
* **Touch Target Enforcement**: All mobile buttons, pills, and toggles have $\ge 44\text{px}$ hit areas.
