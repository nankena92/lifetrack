/* LifeTrack — Personal Productivity Tracker
   Vanilla JS + LocalStorage. No backend, no libraries. */

'use strict';

var STORAGE_KEY = 'lifetrack_data_v1';

/* ---------------- State ---------------- */

var state = loadState();
var editingTaskId = null;
var editingGoalId = null;
var taskFilter = { status: 'all', priority: 'all', date: todayISO() };
var toastTimer = null;
var confirmResolver = null;

/* ---------------- Date helpers ---------------- */

function toISODate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayISO() { return toISODate(new Date()); }

function addDaysISO(iso, n) {
  var d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function formatDate(iso) {
  var d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function dayShort(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

/* Monday–Sunday of the current week, as ISO dates. */
function currentWeekDays() {
  var now = new Date();
  var day = now.getDay(); // 0 = Sunday
  var diffToMonday = (day + 6) % 7;
  var monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toISODate(d));
  }
  return days;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------- Persistence ---------------- */

function seedData() {
  var t = todayISO();
  return {
    tasks: [
      { id: uid(), title: 'Finish quarterly report draft', description: 'Compile the metrics and send the draft to the team for review.', due: t, priority: 'high', completed: false, seeded: true },
      { id: uid(), title: 'Reply to project emails', description: 'Clear the inbox and flag anything that needs follow-up.', due: t, priority: 'medium', completed: true, seeded: true },
      { id: uid(), title: 'Read 20 pages of Atomic Habits', description: 'Note one idea to apply this week.', due: t, priority: 'medium', completed: false, seeded: true },
      { id: uid(), title: 'Plan weekly meals', description: 'Pick five dinners and write the shopping list.', due: addDaysISO(t, 1), priority: 'low', completed: false, seeded: true },
      { id: uid(), title: 'Book dentist appointment', description: 'Call the clinic and pick a morning slot.', due: addDaysISO(t, 3), priority: 'low', completed: false, seeded: true }
    ],
    habits: [
      { id: uid(), name: 'Exercise', seeded: true },
      { id: uid(), name: 'Reading', seeded: true },
      { id: uid(), name: 'Drink water', seeded: true }
    ],
    goals: [
      { id: uid(), title: 'Read 12 books this year', description: 'One book a month, across fiction and non-fiction.', target: addDaysISO(t, 90), progress: 40, seeded: true },
      { id: uid(), title: 'Run a 5K', description: 'Build up to running 5 km without stopping.', target: addDaysISO(t, 60), progress: 65, seeded: true },
      { id: uid(), title: 'Save $5,000', description: 'Emergency fund, one deposit at a time.', target: addDaysISO(t, 120), progress: 25, seeded: true }
    ],
    habitLogs: {}
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      var fresh = seedData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    var parsed = JSON.parse(raw);
    parsed.tasks = parsed.tasks || [];
    parsed.habits = parsed.habits || [];
    parsed.goals = parsed.goals || [];
    parsed.habitLogs = parsed.habitLogs || {};
    return parsed;
  } catch (e) {
    return seedData();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('Could not save — browser storage may be full.', true);
  }
}

/* ---------------- UI helpers ---------------- */

function $(id) { return document.getElementById(id); }

function showToast(message, isError) {
  var toast = $('toast');
  toast.textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 3200);
}

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

function askConfirm(title, text) {
  return new Promise(function (resolve) {
    $('confirmModalTitle').textContent = title;
    $('confirmModalText').textContent = text;
    confirmResolver = resolve;
    openModal('confirmModal');
  });
}

function showFormError(id, message) {
  var el = $(id);
  el.textContent = message;
  el.classList.remove('hidden');
}
function hideFormError(id) { $(id).classList.add('hidden'); }

function switchView(name) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  $('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-view') === name);
  });
  var titles = { dashboard: 'Dashboard', tasks: 'Tasks', habits: 'Habits', goals: 'Goals' };
  $('pageTitle').textContent = titles[name] || 'Dashboard';
  renderAll();
}

function priorityRank(p) { return p === 'high' ? 0 : p === 'medium' ? 1 : 2; }

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  var today = todayISO();
  $('todayLine').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  var todays = state.tasks.filter(function (t) { return t.due === today; });
  var done = todays.filter(function (t) { return t.completed; }).length;
  var pending = todays.length - done;
  var pct = todays.length === 0 ? 0 : Math.round((done / todays.length) * 100);

  $('statTotal').textContent = todays.length;
  $('statDone').textContent = done;
  $('statPending').textContent = pending;
  $('statPct').textContent = pct + '%';
  $('todayProgressFill').style.width = pct + '%';
  $('progressText').textContent = done + ' of ' + todays.length + ' tasks done';

  // Today's tasks
  var sorted = todays.slice().sort(function (a, b) {
    return priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title);
  });
  $('dashTaskList').innerHTML = sorted.map(function (t) {
    return '<li class="mini-item' + (t.completed ? ' done' : '') + '">' +
      '<input type="checkbox" data-task-toggle="' + t.id + '"' + (t.completed ? ' checked' : '') + ' aria-label="Mark ' + escapeHtml(t.title) + ' complete">' +
      '<div><div class="mini-title">' + escapeHtml(t.title) + '</div>' +
      '<div class="mini-desc">' + escapeHtml(t.description || '') + '</div></div>' +
      '<span class="pill ' + t.priority + '">' + t.priority + '</span></li>';
  }).join('');
  $('dashTaskEmpty').classList.toggle('hidden', sorted.length > 0);

  // Today's habits
  var doneHabits = state.habits.filter(function (h) {
    return state.habitLogs[h.id] && state.habitLogs[h.id][today];
  }).length;
  $('dashHabitSummary').textContent = state.habits.length === 0
    ? '' : doneHabits + ' of ' + state.habits.length + ' habits done today';
  $('dashHabitList').innerHTML = state.habits.map(function (h) {
    var checked = !!(state.habitLogs[h.id] && state.habitLogs[h.id][today]);
    return '<li class="mini-item' + (checked ? ' done' : '') + '">' +
      '<input type="checkbox" data-habit-today="' + h.id + '"' + (checked ? ' checked' : '') + ' aria-label="Mark ' + escapeHtml(h.name) + ' done today">' +
      '<div class="mini-title">' + escapeHtml(h.name) + '</div></li>';
  }).join('');
  $('dashHabitEmpty').classList.toggle('hidden', state.habits.length > 0);

  // Active goals (progress < 100)
  var active = state.goals.filter(function (g) { return g.progress < 100; });
  $('dashGoalList').innerHTML = active.map(function (g) {
    return '<div style="margin-bottom:14px"><div class="progress-row"><span style="flex:1;font-weight:600">' + escapeHtml(g.title) + '</span>' +
      '<span class="progress-pct">' + g.progress + '%</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + g.progress + '%"></div></div>' +
      '<div class="muted small">Target: ' + formatDate(g.target) + '</div></div>';
  }).join('');
  $('dashGoalEmpty').classList.toggle('hidden', active.length > 0);

  // Week chart: habit check-ins per day (Mon-Sun)
  var week = currentWeekDays();
  var max = Math.max(state.habits.length, 1);
  $('weekChart').innerHTML = week.map(function (d) {
    var count = state.habits.filter(function (h) {
      return state.habitLogs[h.id] && state.habitLogs[h.id][d];
    }).length;
    var height = state.habits.length === 0 ? 0 : Math.round((count / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + Math.max(height, 3) + '%" title="' + count + ' check-ins"></div>' +
      '<span>' + dayShort(d) + '</span></div>';
  }).join('');
}

/* ---------------- Tasks ---------------- */

function renderTasks() {
  var list = state.tasks.filter(function (t) {
    if (taskFilter.status === 'pending' && t.completed) return false;
    if (taskFilter.status === 'completed' && !t.completed) return false;
    if (taskFilter.priority !== 'all' && t.priority !== taskFilter.priority) return false;
    if (taskFilter.date && t.due !== taskFilter.date) return false;
    return true;
  });
  list.sort(function (a, b) {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return priorityRank(a.priority) - priorityRank(b.priority);
  });

  $('taskList').innerHTML = list.map(function (t) {
    return '<div class="task-item' + (t.completed ? ' done' : '') + '">' +
      '<input type="checkbox" data-task-toggle="' + t.id + '"' + (t.completed ? ' checked' : '') + ' aria-label="Mark ' + escapeHtml(t.title) + ' complete">' +
      '<div class="task-main"><div class="task-title">' + escapeHtml(t.title) + '</div>' +
      (t.description ? '<p class="task-desc">' + escapeHtml(t.description) + '</p>' : '') +
      '<div class="task-meta"><span class="pill ' + t.priority + '">' + t.priority + '</span>' +
      '<span class="pill">Due ' + formatDate(t.due) + '</span>' +
      (t.seeded ? '<span class="pill">Sample</span>' : '') + '</div></div>' +
      '<div class="task-actions">' +
      '<button class="btn btn-sm" type="button" data-task-edit="' + t.id + '">Edit</button>' +
      '<button class="btn btn-sm btn-danger" type="button" data-task-delete="' + t.id + '">Delete</button>' +
      '</div></div>';
  }).join('');
  $('taskEmpty').classList.toggle('hidden', list.length > 0);
}

function openTaskModal(task) {
  editingTaskId = task ? task.id : null;
  $('taskModalTitle').textContent = task ? 'Edit task' : 'Add task';
  $('taskTitle').value = task ? task.title : '';
  $('taskDesc').value = task ? (task.description || '') : '';
  $('taskDue').value = task ? task.due : todayISO();
  $('taskPriority').value = task ? task.priority : 'medium';
  hideFormError('taskFormError');
  openModal('taskModal');
  $('taskTitle').focus();
}

function saveTask(e) {
  e.preventDefault();
  var title = $('taskTitle').value.trim();
  var due = $('taskDue').value;
  if (!title) { showFormError('taskFormError', 'Please enter a task title.'); return; }
  if (!due) { showFormError('taskFormError', 'Please choose a due date.'); return; }
  var data = {
    title: title,
    description: $('taskDesc').value.trim(),
    due: due,
    priority: $('taskPriority').value
  };
  if (editingTaskId) {
    var t = state.tasks.find(function (x) { return x.id === editingTaskId; });
    if (t) { t.title = data.title; t.description = data.description; t.due = data.due; t.priority = data.priority; }
    showToast('Task updated.');
  } else {
    state.tasks.push(Object.assign({ id: uid(), completed: false, seeded: false }, data));
    showToast('Task added.');
  }
  saveState();
  closeModal('taskModal');
  renderAll();
}

/* ---------------- Habits ---------------- */

function renderHabits() {
  var week = currentWeekDays();
  var today = todayISO();
  $('habitList').innerHTML = state.habits.map(function (h) {
    var logs = state.habitLogs[h.id] || {};
    var elapsed = week.filter(function (d) { return d <= today; }).length;
    var doneCount = week.filter(function (d) { return logs[d]; }).length;
    var pct = elapsed === 0 ? 0 : Math.round((doneCount / elapsed) * 100);
    var cells = week.map(function (d) {
      var isFuture = d > today;
      var cls = 'day-cell' + (logs[d] ? ' done' : '') + (d === today ? ' today' : '') + (isFuture ? ' future' : '');
      var dateObj = new Date(d + 'T12:00:00');
      return '<div class="' + cls + '" data-habit-day="' + h.id + '|' + d + '" role="button" tabindex="0" aria-label="' + escapeHtml(h.name) + ' on ' + formatDate(d) + '">' +
        '<span class="day-label">' + dayShort(d) + '</span><span class="day-num">' + dateObj.getDate() + '</span></div>';
    }).join('');
    return '<div class="habit-card"><div class="habit-top"><span class="habit-name">' + escapeHtml(h.name) + '</span>' +
      '<span>' + (h.seeded ? '<span class="pill">Sample</span> ' : '') +
      '<button class="btn btn-sm btn-danger" type="button" data-habit-delete="' + h.id + '">Delete</button></span></div>' +
      '<div class="week-grid">' + cells + '</div>' +
      '<div class="week-pct">This week: ' + doneCount + ' of ' + elapsed + ' days so far (' + pct + '%)</div></div>';
  }).join('');
  $('habitEmpty').classList.toggle('hidden', state.habits.length > 0);
}

function toggleHabitDay(habitId, dateISO) {
  if (dateISO > todayISO()) { showToast('Future days cannot be checked yet.', true); return; }
  state.habitLogs[habitId] = state.habitLogs[habitId] || {};
  if (state.habitLogs[habitId][dateISO]) {
    delete state.habitLogs[habitId][dateISO];
  } else {
    state.habitLogs[habitId][dateISO] = true; // one entry per habit per day — duplicates impossible
  }
  saveState();
  renderAll();
}

function toggleHabitToday(habitId, checked) {
  var today = todayISO();
  state.habitLogs[habitId] = state.habitLogs[habitId] || {};
  if (checked) state.habitLogs[habitId][today] = true;
  else delete state.habitLogs[habitId][today];
  saveState();
  renderAll();
}

/* ---------------- Goals ---------------- */

function renderGoals() {
  var sorted = state.goals.slice().sort(function (a, b) {
    return a.target < b.target ? -1 : 1;
  });
  $('goalList').innerHTML = sorted.map(function (g) {
    return '<div class="goal-card"><div class="goal-top"><span class="goal-title">' + escapeHtml(g.title) + '</span>' +
      '<span>' + (g.seeded ? '<span class="pill">Sample</span> ' : '') +
      '<button class="btn btn-sm" type="button" data-goal-edit="' + g.id + '">Edit</button> ' +
      '<button class="btn btn-sm btn-danger" type="button" data-goal-delete="' + g.id + '">Delete</button></span></div>' +
      (g.description ? '<p class="goal-desc">' + escapeHtml(g.description) + '</p>' : '') +
      '<div class="muted small">Target: ' + formatDate(g.target) + '</div>' +
      '<div class="goal-controls">' +
      '<input type="range" min="0" max="100" value="' + g.progress + '" data-goal-range="' + g.id + '" aria-label="Progress for ' + escapeHtml(g.title) + '">' +
      '<span class="progress-pct">' + g.progress + '%</span>' +
      '<button class="btn btn-sm" type="button" data-goal-minus="' + g.id + '">−10</button>' +
      '<button class="btn btn-sm" type="button" data-goal-plus="' + g.id + '">+10</button>' +
      '</div>' +
      '<div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:' + g.progress + '%"></div></div></div>';
  }).join('');
  $('goalEmpty').classList.toggle('hidden', sorted.length > 0);
}

function openGoalModal(goal) {
  editingGoalId = goal ? goal.id : null;
  $('goalModalTitle').textContent = goal ? 'Edit goal' : 'Add goal';
  $('goalTitle').value = goal ? goal.title : '';
  $('goalDesc').value = goal ? (goal.description || '') : '';
  $('goalTarget').value = goal ? goal.target : addDaysISO(todayISO(), 30);
  $('goalProgress').value = goal ? goal.progress : 0;
  hideFormError('goalFormError');
  openModal('goalModal');
  $('goalTitle').focus();
}

function saveGoal(e) {
  e.preventDefault();
  var title = $('goalTitle').value.trim();
  var target = $('goalTarget').value;
  var progress = parseInt($('goalProgress').value, 10);
  if (!title) { showFormError('goalFormError', 'Please enter a goal title.'); return; }
  if (!target) { showFormError('goalFormError', 'Please choose a target date.'); return; }
  if (isNaN(progress) || progress < 0 || progress > 100) {
    showFormError('goalFormError', 'Progress must be a number between 0 and 100.'); return;
  }
  if (editingGoalId) {
    var g = state.goals.find(function (x) { return x.id === editingGoalId; });
    if (g) { g.title = title; g.description = $('goalDesc').value.trim(); g.target = target; g.progress = progress; }
    showToast('Goal updated.');
  } else {
    state.goals.push({ id: uid(), title: title, description: $('goalDesc').value.trim(), target: target, progress: progress, seeded: false });
    showToast('Goal added.');
  }
  saveState();
  closeModal('goalModal');
  renderAll();
}

/* ---------------- Sample data ---------------- */

function clearSampleData() {
  askConfirm('Clear sample data?', 'This removes only the sample tasks, habits, and goals that came with LifeTrack. Your own items will stay.').then(function (ok) {
    if (!ok) return;
    var sampleHabitIds = state.habits.filter(function (h) { return h.seeded; }).map(function (h) { return h.id; });
    state.tasks = state.tasks.filter(function (t) { return !t.seeded; });
    state.habits = state.habits.filter(function (h) { return !h.seeded; });
    state.goals = state.goals.filter(function (g) { return !g.seeded; });
    sampleHabitIds.forEach(function (id) { delete state.habitLogs[id]; });
    saveState();
    renderAll();
    showToast('Sample data cleared. Your items are untouched.');
  });
}

/* ---------------- Render all ---------------- */

function renderAll() {
  renderDashboard();
  renderTasks();
  renderHabits();
  renderGoals();
}

/* ---------------- Events ---------------- */

function init() {
  $('filterDate').value = taskFilter.date;

  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); });
  });
  document.querySelectorAll('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.getAttribute('data-goto')); });
  });

  $('quickAddBtn').addEventListener('click', function () { openTaskModal(null); });
  $('addTaskBtn').addEventListener('click', function () { openTaskModal(null); });
  $('taskForm').addEventListener('submit', saveTask);
  $('goalForm').addEventListener('submit', saveGoal);
  $('addGoalBtn').addEventListener('click', function () { openGoalModal(null); });

  $('habitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('habitName').value.trim();
    if (!name) { showToast('Please enter a habit name.', true); return; }
    state.habits.push({ id: uid(), name: name, seeded: false });
    $('habitName').value = '';
    saveState();
    renderAll();
    showToast('Habit added.');
  });

  $('filterStatus').addEventListener('change', function (e) { taskFilter.status = e.target.value; renderTasks(); });
  $('filterPriority').addEventListener('change', function (e) { taskFilter.priority = e.target.value; renderTasks(); });
  $('filterDate').addEventListener('change', function (e) { taskFilter.date = e.target.value; renderTasks(); });
  $('filterTodayBtn').addEventListener('click', function () {
    taskFilter.date = todayISO();
    $('filterDate').value = taskFilter.date;
    renderTasks();
  });

  $('clearSampleBtn').addEventListener('click', clearSampleData);

  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function (bd) {
    bd.addEventListener('click', function (e) {
      if (e.target === bd) bd.classList.add('hidden');
    });
  });

  $('confirmCancel').addEventListener('click', function () {
    closeModal('confirmModal');
    if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
  });
  $('confirmOk').addEventListener('click', function () {
    closeModal('confirmModal');
    if (confirmResolver) { confirmResolver(true); confirmResolver = null; }
  });

  // Delegated actions (lists re-render, so listeners live on document)
  document.addEventListener('change', function (e) {
    var toggle = e.target.getAttribute('data-task-toggle');
    if (toggle) {
      var t = state.tasks.find(function (x) { return x.id === toggle; });
      if (t) { t.completed = e.target.checked; saveState(); renderAll(); }
      return;
    }
    var ht = e.target.getAttribute('data-habit-today');
    if (ht) { toggleHabitToday(ht, e.target.checked); return; }
    var range = e.target.getAttribute('data-goal-range');
    if (range) {
      var g = state.goals.find(function (x) { return x.id === range; });
      if (g) { g.progress = parseInt(e.target.value, 10); saveState(); renderAll(); }
    }
  });

  document.addEventListener('click', function (e) {
    var el = e.target;
    var editTask = el.getAttribute('data-task-edit');
    var delTask = el.getAttribute('data-task-delete');
    var delHabit = el.getAttribute('data-habit-delete');
    var editGoal = el.getAttribute('data-goal-edit');
    var delGoal = el.getAttribute('data-goal-delete');
    var plus = el.getAttribute('data-goal-plus');
    var minus = el.getAttribute('data-goal-minus');
    var dayCell = el.closest ? el.closest('[data-habit-day]') : null;

    if (editTask) {
      var t = state.tasks.find(function (x) { return x.id === editTask; });
      if (t) openTaskModal(t);
    } else if (delTask) {
      var td = state.tasks.find(function (x) { return x.id === delTask; });
      if (td) askConfirm('Delete task?', '“' + td.title + '” will be permanently deleted.').then(function (ok) {
        if (!ok) return;
        state.tasks = state.tasks.filter(function (x) { return x.id !== delTask; });
        saveState(); renderAll(); showToast('Task deleted.');
      });
    } else if (delHabit) {
      var hd = state.habits.find(function (x) { return x.id === delHabit; });
      if (hd) askConfirm('Delete habit?', '“' + hd.name + '” and its history will be permanently deleted.').then(function (ok) {
        if (!ok) return;
        state.habits = state.habits.filter(function (x) { return x.id !== delHabit; });
        delete state.habitLogs[delHabit];
        saveState(); renderAll(); showToast('Habit deleted.');
      });
    } else if (editGoal) {
      var g = state.goals.find(function (x) { return x.id === editGoal; });
      if (g) openGoalModal(g);
    } else if (delGoal) {
      var gd = state.goals.find(function (x) { return x.id === delGoal; });
      if (gd) askConfirm('Delete goal?', '“' + gd.title + '” will be permanently deleted.').then(function (ok) {
        if (!ok) return;
        state.goals = state.goals.filter(function (x) { return x.id !== delGoal; });
        saveState(); renderAll(); showToast('Goal deleted.');
      });
    } else if (plus || minus) {
      var gg = state.goals.find(function (x) { return x.id === (plus || minus); });
      if (gg) {
        gg.progress = Math.max(0, Math.min(100, gg.progress + (plus ? 10 : -10)));
        saveState(); renderAll();
      }
    } else if (dayCell) {
      var parts = dayCell.getAttribute('data-habit-day').split('|');
      toggleHabitDay(parts[0], parts[1]);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(function (bd) { bd.classList.add('hidden'); });
    }
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
