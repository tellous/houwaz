# Invoice Calendar

A compact Vite + React + TypeScript single-page app for tracking billable time and calculating per-day and per-category totals on a month view calendar.

**Quick summary:** pick a month/year, add categories (with a rate), click a category then click calendar days to add hours. The UI shows category-level totals and a grand total, with persistence in `localStorage`.

## Key Features

- Month/year picker with automatic calendar rebuild.
- Create, edit, and delete billing categories.
- Click a category to select it, then click calendar days to add or increment hours.
- Global `hours-per-click` control, with quick +/− buttons, flip (negate) and clear actions.
- Per-day entries support multiple categories per day.
- Per-category totals (hours and dollars) and grand totals.
- Hide a category (eye icon) to exclude it from calculations and hide its day entries.
- Confirmations for destructive actions (delete category, reset week) use the browser `confirm` dialog.
- Keyboard accessible: category items and day cells support `Enter` / `Space`.

## Calculations

- Category amount for an entry = `hours × dailyRate`.
- Category summaries aggregate hours and amount across the month.
- Hidden categories are excluded from totals and from the calendar display.

## Persistence (localStorage)

The app stores state in these keys:

- `invoice-calendar.categories` — saved categories (id, name, rates, hidden flag).
- `invoice-calendar.entries.YYYY-M` — per-month day entries mapping (day number -> entry list).
- `invoice-calendar.view` — last viewed `{ month, year }`.

Note: Categories and entries are saved automatically as you edit the UI.

## UI Notes

- Category selection shows a border around the category card.
- Hover highlighting for category rows is disabled; keyboard focus outline remains for accessibility.
- Icons are provided by `react-icons` (Feather set).

## Getting Started

### Prerequisites

- Node.js (LTS recommended) and npm.

### Install dependencies

```powershell
npm install
```

### Run development server

```powershell
npm run dev
```

Open the local URL printed by Vite in your browser.

### Build for production

```powershell
npm run build
```

Preview the production build locally:

```powershell
npm run preview
```

## Keyboard Shortcuts

Quick reference for built-in keyboard shortcuts:

- `Z`: Select the next visible category (wraps around).
- `X`: Select the previous visible category (wraps around).
- `Alt` (hold): Temporarily flip the `Global Hours` sign while held; release to restore the original sign.
- `Enter` / `Space`: Activate the focused control (toggle category select, add to a day, or trigger a delete button).
- `Backspace`: When a day is focused, removes the entry for the currently selected category on that day (prompts if no category is selected). When a delete button is focused, Backspace also removes that entry.
- `Delete`: When a day is focused, clears all entries for that day.
- `Esc`: Close the hotkeys popup, or deselect the current category and focus the add-category `Name` input when the popup is not open.

## Project Files

- `src/App.tsx` — Main app with calendar, category management, calculations, visibility toggles, and persistence.
- `src/App.css` — Styles for the app (layout, compact UI, calendar grid, cards).
- `package.json` — scripts and dependencies (includes `react-icons`).
