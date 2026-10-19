# Focusflow

A responsive student assignment dashboard that turns deadlines into a clear daily view. Open `index.html` in a modern browser to use it; no build step, server, or dependencies are required.

## Features

- Create assignments with a title, subject, due date, priority, and completion status.
- Review today's tasks, overdue work, upcoming deadlines, or the full task list.
- Filter by subject and priority, or search assignment titles and subjects.
- Track daily completion with a progress ring and glanceable task counts.
- Drag unfinished tasks between priority columns on the board.
- Switch between light and dark themes; both tasks and theme preference persist in this browser.
- Use a responsive layout and keyboard shortcuts: `N` creates a task, `/` focuses search, and `Esc` closes a dialog.

## State management

`app.js` owns the task array and current view/filter state. Task changes are saved to `localStorage` under `focusflow.tasks.v1`, then the UI is re-rendered from that state. The theme is stored separately under `focusflow.theme.v1`. Invalid saved task records are ignored, and storage read/write errors are reported in the console and surfaced in the UI.

## Source

The complete source is in this repository: `index.html`, `style.css`, and `app.js`.
