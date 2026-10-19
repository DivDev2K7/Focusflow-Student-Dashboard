const STORAGE_KEY = "focusflow.tasks.v1";
const THEME_KEY = "focusflow.theme.v1";
const SUBJECT_COLORS = ["#8274e8", "#e78f70", "#63a9c6", "#d5a34f", "#75af83", "#db83ad", "#748fca", "#a388c7"];
const PRIORITIES = ["high", "medium", "low"];
const $ = (selector) => document.querySelector(selector);
const els = {
  list: $("#task-list"),
  empty: $("#empty-state"),
  dialog: $("#task-dialog"),
  form: $("#task-form"),
  board: $("#board-panel"),
  boardColumns: $("#board-columns"),
  search: $("#search"),
  subjectFilter: $("#subject-filter"),
  priorityFilter: $("#priority-filter"),
};

let toastTimer;
let tasks = loadTasks();
let view = "today";
let subjectView = "";

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved tasks are not a list.");
    return saved.filter((task) =>
      task && typeof task.id === "string" && typeof task.title === "string" &&
      typeof task.subject === "string" && typeof task.deadline === "string" &&
      PRIORITIES.includes(task.priority) && typeof task.completed === "boolean"
    );
  } catch (error) {
    console.error("Could not load saved tasks.", error);
    showToast("Saved tasks could not be loaded.");
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Could not save tasks.", error);
    showToast("Changes couldn't be saved. Check your browser storage.");
  }
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffset(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(...localDateString().split("-").map(Number))) / 86400000);
}

function formattedDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function subjectColor(subject) {
  let hash = 0;
  for (const character of subject.toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

function getSubjects() {
  return [...new Set(tasks.map((task) => task.subject.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function tasksForView() {
  const today = localDateString();
  if (view === "today") return tasks.filter((task) => task.deadline === today);
  if (view === "overdue") return tasks.filter((task) => task.deadline < today && !task.completed);
  if (view === "upcoming") return tasks.filter((task) => task.deadline > today);
  return tasks;
}

function filteredTasks() {
  const query = els.search.value.trim().toLocaleLowerCase();
  return tasksForView().filter((task) => {
    const matchesSubject = !subjectView || task.subject === subjectView;
    const matchesFilter = !els.subjectFilter.value || task.subject === els.subjectFilter.value;
    const matchesPriority = !els.priorityFilter.value || task.priority === els.priorityFilter.value;
    const matchesQuery = !query || `${task.title} ${task.subject}`.toLocaleLowerCase().includes(query);
    return matchesSubject && matchesFilter && matchesPriority && matchesQuery;
  }).sort((a, b) => a.deadline.localeCompare(b.deadline) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
}

function updateSummaries() {
  const today = localDateString();
  const todayTasks = tasks.filter((task) => task.deadline === today);
  const overdue = tasks.filter((task) => task.deadline < today && !task.completed).length;
  const upcoming = tasks.filter((task) => {
    const offset = dateOffset(task.deadline);
    return offset > 0 && offset <= 7 && !task.completed;
  }).length;
  const doneToday = todayTasks.filter((task) => task.completed).length;
  const percentage = todayTasks.length ? Math.round(doneToday / todayTasks.length * 100) : 0;
  $("#today-count").textContent = todayTasks.filter((task) => !task.completed).length;
  $("#overdue-count").textContent = overdue;
  $("#stat-today").textContent = todayTasks.length;
  $("#stat-overdue").textContent = overdue;
  $("#stat-upcoming").textContent = upcoming;
  $("#stat-completed").textContent = tasks.filter((task) => task.completed).length;
  $("#progress-percent").textContent = `${percentage}%`;
  $("#progress-count").textContent = `${doneToday} of ${todayTasks.length} tasks`;
  $("#progress-ring").style.background = `conic-gradient(var(--accent) ${percentage}%, var(--line) ${percentage}% 100%)`;
  $("#progress-ring").setAttribute("aria-label", `${percentage}% of today's tasks complete`);
}

function updateSubjectControls() {
  const subjects = getSubjects();
  const selected = els.subjectFilter.value;
  els.subjectFilter.replaceChildren(new Option("All subjects", ""));
  for (const subject of subjects) els.subjectFilter.add(new Option(subject, subject));
  if (subjects.includes(selected)) els.subjectFilter.value = selected;

  const subjectList = $("#subject-list");
  subjectList.replaceChildren();
  subjects.forEach((subject) => {
    const button = document.createElement("button");
    button.className = `subject-item${subjectView === subject ? " selected" : ""}`;
    button.style.setProperty("--subject-color", subjectColor(subject));
    button.innerHTML = `<span class="subject-dot"></span><span></span><small></small>`;
    button.children[1].textContent = subject;
    button.children[2].textContent = tasks.filter((task) => task.subject === subject && !task.completed).length;
    button.addEventListener("click", () => {
      subjectView = subjectView === subject ? "" : subject;
      els.subjectFilter.value = "";
      render();
    });
    subjectList.append(button);
  });
  $("#subject-options").replaceChildren(...subjects.map((subject) => new Option(subject, subject)));
}

function renderTask(task) {
  const row = document.createElement("article");
  const dayOffset = dateOffset(task.deadline);
  const dueLabel = dayOffset < 0 ? `${Math.abs(dayOffset)}d overdue` : dayOffset === 0 ? "Today" : formattedDate(task.deadline);
  row.className = `task-row${task.completed ? " is-complete" : ""}`;
  row.innerHTML = `
    <input class="task-checkbox" type="checkbox" aria-label="Mark ${escapeHtml(task.title)} complete" ${task.completed ? "checked" : ""}>
    <div class="task-main"><p class="task-name"></p></div>
    <span class="subject-tag"></span>
    <span class="due-date${dayOffset < 0 && !task.completed ? " overdue" : ""}">${dueLabel}</span>
    <span class="priority-tag ${task.priority}">${task.priority[0].toUpperCase()}${task.priority.slice(1)}</span>
    <button class="task-menu" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">···</button>`;
  row.querySelector(".task-name").textContent = task.title;
  row.querySelector(".subject-tag").textContent = task.subject;
  row.querySelector(".task-checkbox").addEventListener("change", (event) => {
    task.completed = event.target.checked;
    saveTasks();
    render();
  });
  row.querySelector(".task-menu").addEventListener("click", () => {
    tasks = tasks.filter((item) => item.id !== task.id);
    saveTasks();
    render();
    showToast("Task deleted.");
  });
  return row;
}

function renderBoard() {
  els.boardColumns.replaceChildren();
  const columns = [
    { priority: "high", title: "High priority" },
    { priority: "medium", title: "Medium priority" },
    { priority: "low", title: "Low priority" },
  ];
  columns.forEach(({ priority, title }) => {
    const column = document.createElement("section");
    column.className = "board-column";
    column.dataset.priority = priority;
    const matching = tasks.filter((task) => task.priority === priority && !task.completed);
    column.innerHTML = `<div class="board-column-heading"><span class="priority-tag ${priority}">${title}</span><span class="board-column-count">${matching.length}</span></div>`;
    if (!matching.length) {
      const empty = document.createElement("div");
      empty.className = "board-empty";
      empty.textContent = "Drop a task here";
      column.append(empty);
    }
    matching.forEach((task) => {
      const card = document.createElement("article");
      card.className = "board-task";
      card.draggable = true;
      card.dataset.taskId = task.id;
      const titleElement = document.createElement("strong");
      titleElement.textContent = task.title;
      const details = document.createElement("span");
      details.textContent = `${task.subject} · ${formattedDate(task.deadline)}`;
      card.append(titleElement, details);
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
      });
      column.append(card);
    });
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", (event) => {
      if (!column.contains(event.relatedTarget)) column.classList.remove("drag-over");
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const task = tasks.find((item) => item.id === event.dataTransfer.getData("text/plain"));
      if (task && task.priority !== priority) {
        task.priority = priority;
        saveTasks();
        render();
        showToast(`Priority changed to ${priority}.`);
      }
    });
    els.boardColumns.append(column);
  });
}

function render() {
  updateSummaries();
  updateSubjectControls();
  const isBoard = view === "board";
  els.board.hidden = !isBoard;
  document.querySelector(".task-panel").hidden = isBoard;
  const titles = { today: "Today's tasks", upcoming: "Upcoming deadlines", overdue: "Overdue tasks", all: "All tasks", board: "Priority board" };
  $("#breadcrumb-view").textContent = isBoard ? "Priority board" : subjectView || titles[view];
  $("#list-heading").textContent = subjectView ? `${subjectView} tasks` : titles[view];
  $("#visible-count").textContent = filteredTasks().length;
  const headingTitle = { today: "Good morning, let's focus", upcoming: "Look ahead with confidence", overdue: "Let's get back on track", all: "Your assignments, in one place", board: "Make your priorities clear" };
  $("#page-title").innerHTML = `${headingTitle[view]} <span class="wave">✦</span>`;
  $("#page-subtitle").textContent = view === "overdue"
    ? "A fresh start begins with one small step."
    : view === "upcoming" ? "Stay one step ahead of your deadlines."
      : view === "board" ? "Drag and drop assignments to set your focus."
        : "A little progress each day adds up to big results.";

  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const shown = isBoard ? [] : filteredTasks();
  els.list.replaceChildren(...shown.map(renderTask));
  els.empty.hidden = isBoard || shown.length > 0;
  $("#empty-title").textContent = view === "today" ? "A clear desk, a clear mind." : "Nothing on your plate.";
  $("#empty-copy").textContent = view === "today"
    ? "Nothing due today. Add a task to get your day started."
    : "No tasks match this view. Add a task or adjust your filters.";
  renderBoard();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function openTaskDialog() {
  els.form.reset();
  $("#task-deadline").value = localDateString();
  $("#form-error").textContent = "";
  $("#dialog-title").textContent = "Add a task";
  $("#save-task").innerHTML = 'Add task <span>→</span>';
  els.dialog.showModal();
  $("#task-title").focus();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
}

function changeTheme(dark) {
  document.body.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch (error) {
    console.error("Could not save theme preference.", error);
    showToast("Theme preference couldn't be saved.");
  }
  $("#theme-label").textContent = dark ? "Light mode" : "Dark mode";
  $("#theme-icon").textContent = dark ? "☼" : "☾";
  $(".toggle-track").setAttribute("aria-label", dark ? "Dark theme on" : "Dark theme off");
}

document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => {
  view = item.dataset.view;
  subjectView = "";
  els.subjectFilter.value = "";
  render();
}));
$("#top-add").addEventListener("click", openTaskDialog);
$("#panel-add").addEventListener("click", openTaskDialog);
$("#empty-add").addEventListener("click", openTaskDialog);
$("#dialog-close").addEventListener("click", () => els.dialog.close());
$("#cancel-task").addEventListener("click", () => els.dialog.close());
$("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(els.form);
  const title = String(formData.get("title") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const deadline = String(formData.get("deadline") || "");
  const priority = String(formData.get("priority") || "");
  if (!title || !subject || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !PRIORITIES.includes(priority)) {
    $("#form-error").textContent = "Enter a title, subject, valid due date, and priority.";
    return;
  }
  tasks.push({ id: crypto.randomUUID(), title, subject, deadline, priority, completed: false, createdAt: new Date().toISOString() });
  saveTasks();
  els.dialog.close();
  render();
  showToast("Task added. You've got this!");
});

els.search.addEventListener("input", render);
els.subjectFilter.addEventListener("change", () => {
  subjectView = "";
  render();
});
els.priorityFilter.addEventListener("change", render);
$("#add-subject").addEventListener("click", () => {
  view = "all";
  render();
  openTaskDialog();
  $("#task-subject").focus();
});
$("#theme-toggle").addEventListener("click", () => changeTheme(!document.body.classList.contains("dark")));
$("#help-button").addEventListener("click", () => $("#shortcuts-dialog").showModal());
$("#shortcuts-close").addEventListener("click", () => $("#shortcuts-dialog").close());

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (els.dialog.open) els.dialog.close();
    if ($("#shortcuts-dialog").open) $("#shortcuts-dialog").close();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))) return;
  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    openTaskDialog();
  }
  if (event.key === "/") {
    event.preventDefault();
    els.search.focus();
  }
});

$("#current-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
try {
  changeTheme(localStorage.getItem(THEME_KEY) === "dark");
} catch (error) {
  console.error("Could not load theme preference.", error);
  changeTheme(false);
}
render();
