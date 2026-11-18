# Akta — Refinement UX/UI (phases 1–4)

## Scope and invariants

This iteration deliberately **does not replace** Akta's horizontal navigation, mascot, live-session pill or motion identity. The dashboard's "Ton tableau de bord" header and "Ton flow" timeline remain in their existing order and general composition. The Focus navigation button is moved immediately **before** Synchronisation; the live session remains available to its right.

No mockup-only feature (sidebar, shortcuts, notifications, extra screens) was introduced.

## Changes delivered

### Phase 1 — contrast and accessibility

- Text-bearing accent-gradient controls use the same darkened gradient recipe with white text. The six built-in palettes are checked by `npm run check:ui` against 4.5:1 WCAG AA on both stops.
- Work-session bars on the timeline support focus, Enter / Space and descriptive labels for their billable state.
- Timeline preset buttons and palette swatches expose their selected state; tabs support Home and End keys.
- The animated ECG comet hides under reduced-motion settings; the regular line remains visible. Mascot and Focus motions still animate when movement is allowed.

### Phase 2 — progressive disclosure, not a navbar redesign

- "Ton tableau de bord" and "Ton flow" stay in place; the stats underneath become a responsive labelled group. The zero-duration percentage avoids NaN.
- Activity search appears before maintenance; cleanup/deletion controls move into an expandable maintenance block. The categories summary precedes the detailed sessions list.
- Creating a project starts with name and client; budget, keywords, rate, goal and deadline remain available under advanced options.
- Reports now have a weekly summary heading; analytics metrics adapt to narrower widths.

### Phase 3 — consistency

- Cards, shared stat tiles and Settings panels have lighter, consistent borders and shadow depths.
- Primary badges and Focus timer respond to the selected accent rather than a hardcoded appearance.
- Countdown typography scales across window widths while retaining the existing Focus mascot and animations.

### Phase 4 — polish and validation

- Small palette controls are keyboard focusable, labelled and visually selected.
- The chosen Settings accent has a textual label.
- Timeline zoom choices expose their selection to assistive technology.
- The repository includes a contrast regression check and UI validation workflow.

## Manual QA matrix (not a claim of completed testing)

- [ ] Windows 950×600, 1200×800 and maximized; verify no clipping/overlap in the navbar or Focus timer.
- [ ] All six accents × light/dark mode; verify labels and buttons are readable and the mascot remains visible.
- [ ] Dashboard: header and timeline unchanged structurally; live-session pill visible and operable.
- [ ] Tabs: Focus appears before Sync; changing themes and syncing still work; Focus icon moves/animates as before.
- [ ] Keyboard: Tab / Shift+Tab, Home / End in tabs, Enter / Space on session bars, preset selection, color swatches and disclosure panels.
- [ ] App Focus and mascot animation, timeline ECG animation; verify reduced-motion mode removes only decorative motion.
- [ ] Project creation with and without advanced fields; project/phase color editing; deleting activities through disclosure.
- [ ] Reports, Analytics, Activities and Settings in French, English and German.
- [ ] Windows packaged build / actual Electron screenshots for final visual acceptance.

Automated checks do not replace manual Windows visual QA.
