# LifeTrack — Personal Productivity Tracker

A complete, modern, responsive web app for organizing daily activities, tracking
personal habits, managing goals, and monitoring productivity.

**No backend. No paid APIs. No frameworks.** Just HTML, CSS, and vanilla
JavaScript, with all data stored in the browser's LocalStorage.

## Features

### Dashboard
- Today's tasks at a glance
- Completed / pending task counts
- Daily task completion percentage with a progress bar
- Active goals with progress bars
- Habit completion summary and a weekly check-in bar chart

### Task management
- Add, edit, and delete tasks (title, description, due date, priority)
- Mark tasks as completed
- Filter by status (all / pending / completed), priority, and date
- View tasks for any selected date

### Habit tracker
- Create and delete habits — Exercise, Reading, and Drink Water are included as samples
- Check a habit off for each day
- Weekly grid (Monday–Sunday) with per-habit completion progress
- One completion entry per habit per day — duplicates are impossible by design

### Personal goals
- Create, edit, and delete goals (title, description, target date, progress)
- Update progress with a slider or +10 / −10 buttons
- Progress bar for every goal

### Data storage
- Everything (tasks, habits, goals, habit check-ins) lives in LocalStorage
- Data survives browser refreshes
- All inputs are validated; destructive actions ask for confirmation first

### Sample data
- A few fictional tasks, habits, and goals are included so you can explore immediately
- Use **Clear sample data** in the sidebar to remove only the samples — your own
  items are never touched

## Project files

| File         | Purpose                              |
| ------------ | ------------------------------------ |
| `index.html` | App structure and all views          |
| `style.css`  | Calm, minimal, responsive styling    |
| `script.js`  | All app logic and LocalStorage code  |
| `README.md`  | This file                            |

## Run it locally

Just open `index.html` in any modern browser. Or serve the folder:

```bash
cd lifetrack
python3 -m http.server 8000
