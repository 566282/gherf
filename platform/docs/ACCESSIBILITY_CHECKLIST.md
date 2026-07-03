# Accessibility Checklist

## Baseline Targets

- Aim for WCAG 2.2 AA compliance across the app shell and feature pages.
- Verify keyboard-only use for navigation, forms, dialogs, and tables.
- Ensure visible focus states on every interactive control.

## Components

- Use semantic landmarks: `header`, `nav`, `main`, and `footer` where appropriate.
- Prefer `Link` or `button` for interactive elements instead of raw anchors for internal app transitions.
- Provide accessible names for icon-only buttons and controls.
- Keep contrast levels high enough for text, borders, and disabled states.

## Forms and Feedback

- Every input needs a programmatic label.
- Validation errors should be announced and tied to the relevant field.
- Loading states should be exposed with text, not color alone.

## Media and Layout

- Use descriptive `alt` text for meaningful images.
- Mark decorative images as decorative.
- Check responsive layouts at narrow mobile widths and large desktop widths.

## Verification

- Run keyboard tab-order checks on the main flows.
- Test screen-reader reading order for public, auth, and admin layouts.
- Recheck after each UI refactor or new component addition.
