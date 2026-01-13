# Task List Prototype

A front-end-only prototype demonstrating a task/routine list UX with week-based scheduling, drag-and-drop reordering, and time travel for testing.

## Stack

- **React 18** + **TypeScript** + **Vite**
- **React Router** for navigation
- **Zustand** for state management with localStorage persistence
- **dnd-kit** for drag-and-drop reordering
- **dayjs** for date/time utilities
- **CSS Variables** for styling (no heavy UI libraries)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Open http://localhost:5173 in your browser.

## Routes

| Route | Description |
|-------|-------------|
| `/tasks` | Main task list (default) |
| `/month` | Month zoom overlay for navigation |
| `/completed` | All completed items (historical view) |

## Using the DevPanel

A **🛠 Dev** button in the bottom-left corner opens the Developer Panel:

### Time Travel
- **+1/+3/+7 days**: Advance simulated time forward
- **-1 day**: Go back in time

### Sunday Rollover
Click **Simulate Rollover** to execute the weekly rollover logic:
- Advances time to next Sunday midnight
- Incomplete items from the old "present week" carry into the new week
- Pre-scheduled items for the new week appear after carried-over items

### Uncomplete Toggle
Enable **"Allow uncomplete (within 7 days)"** to let you uncheck completed items. When unchecked, items move to the bottom of the present week's incomplete list.

### Reseed Data
Click **Reseed Dummy Data** to regenerate all items based on the current simulated time.

## Manual Testing Checklist

### ✅ Complete an Item
1. Click an orange checkbox on an incomplete item
2. Watch it animate up to the completed cluster
3. Use DevPanel to advance time 8+ days
4. Verify item disappears from main list (still visible in `/completed`)

### ✅ Start a Blue Item
1. Find a blue (future week) item with a "Start" button
2. Click Start
3. Watch it move to present week bottom, tint changes to yellow
4. Start button is replaced by progress controls (+15, +30)

### ✅ Drag Reorder
1. Drag an incomplete item by its grip handle
2. Drop it in a different position (even across week boundaries)
3. Verify order updates and tint changes if week changed

### ✅ Weekly Rollover
1. Note which items are in the "present week" (yellow tint)
2. Click **Simulate Rollover** in DevPanel
3. Verify incomplete items carried over to new present week
4. New week's pre-scheduled items appear after carried-over items

### ✅ Month Zoom Navigation
1. Click the calendar icon in the header
2. Tap a month in the grid
3. Verify list scrolls to that month's first week

### ✅ All Completed View
1. Click the checklist icon in the header
2. Verify all completed items are shown (including those >7 days old)
3. Items are in reverse chronological order with timestamps

### ✅ Jump to Today
1. Scroll far away from the present week
2. FAB appears: "↑ Today"
3. Click it to scroll back to present week

## Key Concepts

### Week Keys
Weeks are identified by `YYYY-Www` format (e.g., `2026-W05`), calculated with **Sunday as the start** of each week.

### Item Tints
- **Yellow** (`--wk-present`): Present week items
- **Blue** (`--wk-future`): Future week items  
- **Gray** (`--wk-past`): Past week completed items still within 7-day visibility

### Status Colors
- **Orange** (`--status-pending`): Incomplete items
- **Green** (`--status-complete`): Completed items

### Visibility Rules
- Incomplete items are always visible
- Completed items are visible for 7 days after completion in main list
- All completed items (including >7 days) are visible in `/completed`

## Project Structure

```
src/
├── components/
│   ├── TaskCard.tsx      # Individual task card with all states
│   ├── TaskList.tsx      # Main list with drag-and-drop
│   ├── MonthZoom.tsx     # Month navigation overlay
│   ├── CompletedList.tsx # Historical completed view
│   ├── JumpToToday.tsx   # FAB for quick navigation
│   └── DevPanel.tsx      # Time travel controls
├── data/
│   └── dummyData.ts      # Dummy data generator
├── store/
│   └── store.ts          # Zustand store with all actions
├── utils/
│   ├── timeUtils.ts      # Week key and date helpers
│   └── timeUtils.test.ts # Unit tests
├── types.ts              # TypeScript interfaces
├── App.tsx               # Routes and layout
├── main.tsx              # Entry point
└── index.css             # All styles with CSS variables
```

## Accessibility

- Keyboard navigation with visible focus styles
- Tab/Space for checkbox toggling
- Up/Down arrow buttons for keyboard reordering (alternative to drag)
- `aria-live` announcements for reorder operations
