const STORAGE_KEY = "fokusflow_state_v1";
const WEEKLY_KEY = "fokusflow_weekly_v1";

const i18n = window.FokusI18n;
const t = i18n ? i18n.t : (key) => key;
const applyTranslations = i18n ? i18n.applyTranslations : () => {};
const getLang = i18n ? i18n.getLang : () => "id";
const setLang = i18n ? i18n.setLang : () => {};
const locale = i18n ? i18n.locale : () => "id-ID";

const DEFAULT_STATE = {
  settings: {
    focusMinutes: 25,
    shortMinutes: 5,
    longMinutes: 15,
    autoSwitch: true,
    sound: true,
    showCompleted: false,
  },
  tasks: [],
  activeTaskId: null,
  timer: {
    mode: "focus",
    remaining: 25 * 60,
    running: false,
    endTime: null,
    focusCount: 0,
    cycleCount: 0,
    pendingMode: null,
  },
};

let state = loadState();
if (state.timer.running && state.timer.endTime) {
  const remaining = Math.round((state.timer.endTime - Date.now()) / 1000);
  if (remaining <= 0) {
    state.timer.running = false;
    state.timer.remaining = modeDuration(state.timer.mode);
    state.timer.endTime = null;
  } else {
    state.timer.remaining = remaining;
  }
} else {
  state.timer.running = false;
  state.timer.endTime = null;
}
let timerInterval = null;
let editingTaskId = null;
let isDraggingTask = false;

const elements = {
  navPills: document.querySelectorAll(".nav-pill"),
  sessionLabel: document.getElementById("session-label"),
  timerDisplay: document.getElementById("timer-display"),
  timerRing: document.querySelector(".timer-ring"),
  startPause: document.getElementById("start-pause"),
  resetTimer: document.getElementById("reset-timer"),
  todayCount: document.getElementById("today-count"),
  activeTaskLabel: document.getElementById("active-task-label"),
  liveClock: document.getElementById("live-clock"),
  finishEstimate: document.getElementById("finish-estimate"),
  nextSession: document.getElementById("next-session-label"),
  nextButton: document.getElementById("next-session"),
  toggleSound: document.getElementById("toggle-sound"),
  resetAll: document.getElementById("reset-all"),
  taskForm: document.getElementById("task-form"),
  taskName: document.getElementById("task-name"),
  taskEstimate: document.getElementById("task-estimate"),
  taskBreak: document.getElementById("task-break"),
  cancelTask: document.getElementById("cancel-task"),
  taskList: document.getElementById("task-list"),
  addTaskCard: document.getElementById("add-task-card"),
  taskSummary: document.getElementById("task-summary"),
  completedList: document.getElementById("completed-list"),
  completedToggle: document.getElementById("completed-toggle"),
  completedButton: document.getElementById("completed-button"),
  completedLabel: document.getElementById("completed-label"),
  todayDate: document.getElementById("today-date"),
  taskOptions: document.getElementById("task-options"),
  taskOptionsMenu: document.getElementById("task-options-menu"),
  clearCompleted: document.getElementById("clear-completed"),
  headerOptions: document.getElementById("header-options"),
  headerOptionsMenu: document.getElementById("header-options-menu"),
  focusMinutes: document.getElementById("focus-minutes"),
  shortMinutes: document.getElementById("short-minutes"),
  longMinutes: document.getElementById("long-minutes"),
  autoSwitch: document.getElementById("auto-switch"),
  langSelect: document.getElementById("lang-select"),
};

if (elements.langSelect && i18n) {
  elements.langSelect.value = getLang();
  elements.langSelect.addEventListener("change", (event) => {
    setLang(event.target.value);
    applyTranslations();
    render();
  });
  applyTranslations();
}

elements.taskForm.addEventListener(
  "wheel",
  (event) => {
    if (elements.taskForm.classList.contains("hidden")) return;
    event.preventDefault();
  },
  { passive: false }
);

if (elements.completedButton) {
  elements.completedButton.addEventListener("click", () => {
    state.settings.showCompleted = !state.settings.showCompleted;
    saveState();
    render();
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(DEFAULT_STATE);
  try {
    const parsed = JSON.parse(saved);
    const nextState = {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
      timer: { ...DEFAULT_STATE.timer, ...parsed.timer },
    };
    if (Number.isNaN(Number(nextState.timer.cycleCount))) {
      nextState.timer.cycleCount = nextState.timer.focusCount || 0;
    }
    nextState.tasks = normalizeTasks(nextState.tasks || []);
    const weekly = loadWeekly();
    const todayKey = getDateKey(new Date());
    if (weekly.days[todayKey]) {
      nextState.tasks = normalizeTasks(weekly.days[todayKey]);
    } else if (nextState.tasks.length > 0) {
      weekly.days[todayKey] = nextState.tasks;
      saveWeekly(weekly);
    }
    if (
      nextState.tasks.length > 0 &&
      !nextState.tasks.some((task) => task.id === nextState.activeTaskId)
    ) {
      nextState.activeTaskId = nextState.tasks[0].id;
    }
    return nextState;
  } catch (error) {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const weekly = loadWeekly();
  const todayKey = getDateKey(new Date());
  weekly.days[todayKey] = state.tasks;
  saveWeekly(weekly);
}

function loadWeekly() {
  const saved = localStorage.getItem(WEEKLY_KEY);
  if (!saved) return { days: {} };
  try {
    const parsed = JSON.parse(saved);
    return { days: parsed.days || {} };
  } catch (error) {
    return { days: {} };
  }
}

function saveWeekly(data) {
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(data));
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTasks(tasks) {
  return tasks.map((task) => ({
    ...task,
    done: Number.isFinite(task.done) ? task.done : 0,
    estimate: Number.isFinite(task.estimate) ? task.estimate : 1,
    breakMode: task.breakMode || "auto",
    completedAt: task.completedAt || null,
  }));
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getModeLabel(mode) {
  if (mode === "focus") return t("mode.focus");
  if (mode === "short") return t("mode.short");
  return t("mode.long");
}

function modeDuration(mode) {
  const { focusMinutes, shortMinutes, longMinutes } = state.settings;
  if (mode === "focus") return focusMinutes * 60;
  if (mode === "short") return shortMinutes * 60;
  return longMinutes * 60;
}

function updateTimerRing() {
  const ringMode = state.timer.pendingMode || state.timer.mode;
  const total = modeDuration(ringMode);
  const remaining =
    state.timer.pendingMode ? modeDuration(ringMode) : state.timer.remaining;
  const progress = 1 - remaining / total;
  const degrees = Math.max(0, Math.min(1, progress)) * 360;
  elements.timerRing.style.setProperty("--progress", `${degrees}deg`);
}

function updateNav() {
  elements.navPills.forEach((pill) => {
    const activeMode = state.timer.pendingMode || state.timer.mode;
    pill.classList.toggle("is-active", pill.dataset.mode === activeMode);
    pill.classList.toggle(
      "is-pending",
      state.timer.running &&
        state.timer.pendingMode &&
        pill.dataset.mode === state.timer.mode
    );
  });
}

function updateHeader() {
  elements.sessionLabel.textContent = getModeLabel(state.timer.mode);
  elements.todayCount.textContent = t("labels.focusDone", {
    count: state.timer.focusCount,
  });
  const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
  elements.activeTaskLabel.textContent = activeTask
    ? t("labels.activeTask", { task: activeTask.name })
    : t("labels.noTask");
}

function resolveNextMode(completedFocus) {
  if (state.timer.mode !== "focus") return "focus";
  const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
  const override = activeTask ? activeTask.breakMode : "auto";
  if (override !== "auto") return override;
  const nextCount = completedFocus
    ? state.timer.cycleCount
    : state.timer.cycleCount + 1;
  return nextCount % 4 === 0 ? "long" : "short";
}

function updateNextSession() {
  const nextMode = resolveNextMode(false);
  elements.nextSession.textContent = t("labels.next", {
    mode: getModeLabel(nextMode),
  });
}

function updateTimerDisplay() {
  const displaySeconds = state.timer.pendingMode
    ? modeDuration(state.timer.pendingMode)
    : state.timer.remaining;
  elements.timerDisplay.textContent = formatTime(displaySeconds);
  document.title = `${formatTime(state.timer.remaining)} - ${getModeLabel(
    state.timer.mode
  )}`;
  updateTimerRing();
}

function updateLiveClock() {
  const now = new Date();
  const time = now.toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  elements.liveClock.textContent = `${time} WIB`;
}

function updateTodayDate() {
  const now = new Date();
  elements.todayDate.textContent = now.toLocaleDateString(locale(), {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function updateFinishEstimate() {
  const estimateSeconds = computeEstimateSeconds();
  if (!estimateSeconds) {
    elements.finishEstimate.textContent = t("task.estimate", { label: "-" });
    return;
  }

  const finishTime = new Date(Date.now() + estimateSeconds * 1000);
  const label = finishTime.toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const durationLabel = formatDuration(estimateSeconds);
  elements.finishEstimate.textContent = t("task.estimate", {
    label: `${label} (${durationLabel})`,
  });
}

function computeEstimateSeconds() {
  const tasks = state.tasks.map((task) => ({
    id: task.id,
    remaining: Math.max(0, task.estimate - task.done),
    breakMode: task.breakMode || "auto",
  }));
  const totalRemaining = tasks.reduce((sum, task) => sum + task.remaining, 0);
  if (totalRemaining === 0) return 0;

  let totalSeconds = state.timer.remaining;
  let virtualCycle = state.timer.cycleCount;
  let remaining = totalRemaining;

  const activeTask =
    tasks.find((task) => task.id === state.activeTaskId) ||
    tasks.find((task) => task.remaining > 0);

  if (state.timer.mode === "focus") {
    if (activeTask && activeTask.remaining > 0) {
      activeTask.remaining -= 1;
      remaining -= 1;
      virtualCycle += 1;
      if (remaining > 0) {
        totalSeconds += breakDuration(activeTask.breakMode, virtualCycle);
      }
    } else {
      return 0;
    }
  }

  while (remaining > 0) {
    const nextTask = tasks.find((task) => task.remaining > 0);
    if (!nextTask) break;
    totalSeconds += modeDuration("focus");
    nextTask.remaining -= 1;
    remaining -= 1;
    virtualCycle += 1;
    if (remaining > 0) {
      totalSeconds += breakDuration(nextTask.breakMode, virtualCycle);
    }
  }

  return totalSeconds;
}

function breakDuration(breakMode, cycleCount) {
  if (breakMode === "short") return modeDuration("short");
  if (breakMode === "long") return modeDuration("long");
  return cycleCount % 4 === 0
    ? modeDuration("long")
    : modeDuration("short");
}

function formatDuration(totalSeconds) {
  const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourUnit = t("time.hourShort");
  const minuteUnit = t("time.minuteShort");
  if (hours === 0) return `${minutes}${minuteUnit}`;
  if (minutes === 0) return `${hours}${hourUnit}`;
  return `${hours}${hourUnit} ${minutes}${minuteUnit}`;
}

function updateSettingsInputs() {
  elements.focusMinutes.value = state.settings.focusMinutes;
  elements.shortMinutes.value = state.settings.shortMinutes;
  elements.longMinutes.value = state.settings.longMinutes;
  elements.autoSwitch.checked = state.settings.autoSwitch;
  elements.toggleSound.textContent = state.settings.sound
    ? t("sound.on")
    : t("sound.off");
}

function updateTaskFormLabels() {
  if (!elements.taskBreak) return;
  const options = elements.taskBreak.options;
  if (options.length >= 3) {
    options[0].textContent = t("break.auto");
    options[1].textContent = t("break.short");
    options[2].textContent = t("break.long");
  }
}

function updateTaskList() {
  elements.taskList.innerHTML = "";
  const editingTask = state.tasks.find((task) => task.id === editingTaskId);
  const commitInlineEdit = (forceExit = false) => {
    if (!editingTask) return;
    const name = (editingTask._draftName || "").trim();
    if (name) {
      const estimate =
        Number.parseInt(editingTask._draftEstimate, 10) ||
        editingTask.estimate;
      editingTask.name = name;
      editingTask.estimate = Math.max(1, estimate);
      editingTask.done = Math.min(editingTask.done, editingTask.estimate);
      editingTask.breakMode = editingTask._draftBreak || editingTask.breakMode;
    }
    delete editingTask._draftName;
    delete editingTask._draftEstimate;
    delete editingTask._draftBreak;
    editingTaskId = null;
    saveState();
    if (forceExit) render();
  };
  const visibleTasks = state.tasks.filter(
    (task) => task.done < task.estimate
  );
  if (visibleTasks.length === 0) {
    elements.taskSummary.textContent = "";
  } else {
    visibleTasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "task-item";
      item.dataset.taskId = task.id;
      if (task.id === state.activeTaskId) item.classList.add("is-active");
      item.addEventListener("click", () => {
        if (editingTaskId === task.id) return;
        if (editingTaskId && editingTaskId !== task.id) {
          commitInlineEdit(true);
        }
        state.activeTaskId = task.id;
        saveState();
        render();
      });
      item.addEventListener("dblclick", () => {
        editingTaskId = task.id;
        render();
      });

      const content = document.createElement("div");
      content.className = "task-main";
      if (task.id === state.activeTaskId) {
        const handle = document.createElement("div");
        handle.className = "drag-rail";
        handle.draggable = true;
        handle.dataset.taskId = task.id;
        const dots = document.createElement("span");
        dots.className = "drag-dots";
        handle.appendChild(dots);
        content.appendChild(handle);
      }
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "task-check";
      check.checked = task.done >= task.estimate;
      check.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
      check.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      check.addEventListener("change", () => {
        if (check.checked) {
          task.done = task.estimate;
          task.completedAt = new Date().toISOString();
        } else {
          task.done = Math.max(0, task.estimate - 1);
          task.completedAt = null;
        }
        saveState();
        render();
      });

      const info = document.createElement("div");
      if (editingTaskId === task.id) {
        info.className = "task-inline";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "inline-input";
        nameInput.value = task.name;
        nameInput.maxLength = 48;
        nameInput.addEventListener("input", () => {
          task._draftName = nameInput.value;
        });
        nameInput.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        const estimateInput = document.createElement("input");
        estimateInput.type = "number";
        estimateInput.className = "inline-input inline-number";
        estimateInput.min = "1";
        estimateInput.max = "12";
        estimateInput.value = task.estimate;
        estimateInput.addEventListener("input", () => {
          task._draftEstimate = estimateInput.value;
        });
        estimateInput.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        const breakSelect = document.createElement("select");
        breakSelect.className = "inline-select";
        breakSelect.innerHTML = `
          <option value="auto">${t("break.auto")}</option>
          <option value="short">${t("break.short")}</option>
          <option value="long">${t("break.long")}</option>
        `;
        breakSelect.value = task.breakMode || "auto";
        breakSelect.addEventListener("change", () => {
          task._draftBreak = breakSelect.value;
        });
        breakSelect.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        const actionsRow = document.createElement("div");
        actionsRow.className = "inline-actions";
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "secondary-btn";
        saveBtn.textContent = t("task.save");
        saveBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          task._draftName = nameInput.value;
          task._draftEstimate = estimateInput.value;
          task._draftBreak = breakSelect.value;
          commitInlineEdit();
          render();
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "secondary-btn danger-btn";
        cancelBtn.textContent = t("task.cancel");
        cancelBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          delete task._draftName;
          delete task._draftEstimate;
          delete task._draftBreak;
          editingTaskId = null;
          render();
        });

        const submitOnEnter = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveBtn.click();
          }
        };
        nameInput.addEventListener("keydown", submitOnEnter);
        estimateInput.addEventListener("keydown", submitOnEnter);


        actionsRow.appendChild(saveBtn);
        actionsRow.appendChild(cancelBtn);

        info.appendChild(nameInput);
        info.appendChild(estimateInput);
        info.appendChild(breakSelect);
        info.appendChild(actionsRow);
      } else {
        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = task.name;
        const meta = document.createElement("div");
        meta.className = "task-meta";
        meta.textContent = t("task.progress", {
          done: task.done,
          total: task.estimate,
          break: getBreakLabel(task.breakMode),
        });
        info.appendChild(title);
        info.appendChild(meta);

        const breakContainer = document.createElement("div");
        breakContainer.className = "break-row";
        if (task.id === state.activeTaskId) {
          const breakToggle = document.createElement("div");
          breakToggle.className = "break-toggle";
          const autoBtn = document.createElement("button");
          autoBtn.type = "button";
          autoBtn.className = "break-btn";
          if (task.breakMode === "auto") autoBtn.classList.add("is-active");
          autoBtn.textContent = t("break.autoShort");
          autoBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            handleMenuAction(task.id, "break-auto");
          });

          const shortBtn = document.createElement("button");
          shortBtn.type = "button";
          shortBtn.className = "break-btn";
          if (task.breakMode === "short") shortBtn.classList.add("is-active");
          shortBtn.textContent = t("break.short");
          shortBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            handleMenuAction(task.id, "break-short");
          });

          const longBtn = document.createElement("button");
          longBtn.type = "button";
          longBtn.className = "break-btn";
          if (task.breakMode === "long") longBtn.classList.add("is-active");
          longBtn.textContent = t("break.long");
          longBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            handleMenuAction(task.id, "break-long");
          });

          breakToggle.appendChild(autoBtn);
          breakToggle.appendChild(shortBtn);
          breakToggle.appendChild(longBtn);
          breakContainer.appendChild(breakToggle);
        } else {
          const spacer = document.createElement("div");
          spacer.className = "break-spacer";
          breakContainer.appendChild(spacer);
        }
        info.appendChild(breakContainer);
      }

      content.appendChild(check);
      content.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-btn";
      deleteButton.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
        '<path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zm-8 0h2v9H6V9z" fill="currentColor"/>' +
        "</svg>";
      deleteButton.setAttribute("aria-label", t("task.delete"));
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        handleMenuAction(task.id, "delete");
      });

      actions.appendChild(deleteButton);

      item.appendChild(content);
      item.appendChild(actions);
      elements.taskList.appendChild(item);
    });

    const total = state.tasks.length;
    const remaining = state.tasks.reduce(
      (sum, task) => sum + Math.max(0, task.estimate - task.done),
      0
    );
    const doneCount = state.tasks.filter(
      (task) => task.done >= task.estimate
    ).length;
    elements.taskSummary.textContent = t("task.summary", {
      total,
      remaining,
      done: doneCount,
    });
  }

  const completedTasks = state.tasks.filter(
    (task) => task.done >= task.estimate
  );
  elements.completedList.innerHTML = "";
  if (elements.completedLabel) {
    elements.completedLabel.textContent = `${t("task.completed")} (${
      completedTasks.length
    })`;
  }
  if (completedTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "completed-item";
    empty.textContent = t("task.completedEmpty");
    elements.completedList.appendChild(empty);
  } else {
    completedTasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "completed-item";
      const row = document.createElement("div");
      row.className = "completed-row";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "completed-check";
      check.checked = true;
      check.addEventListener("change", () => {
        task.done = Math.max(0, task.estimate - 1);
        task.completedAt = null;
        saveState();
        render();
      });

      const title = document.createElement("div");
      title.className = "completed-title";
      title.textContent = task.name;

      const meta = document.createElement("div");
      meta.className = "completed-meta";
      meta.textContent = t("task.progress", {
        done: task.done,
        total: task.estimate,
        break: getBreakLabel(task.breakMode),
      });

      const whenLabel = document.createElement("div");
      whenLabel.className = "completed-when";
      if (task.completedAt) {
        const date = new Date(task.completedAt);
        const dateLabel = date.toLocaleDateString(locale(), {
          weekday: "short",
          day: "2-digit",
          month: "short",
          timeZone: "Asia/Jakarta",
        });
        const timeLabel = date.toLocaleTimeString(locale(), {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });
        whenLabel.textContent = t("task.doneAt", {
          date: dateLabel,
          time: timeLabel,
        });
      } else {
        whenLabel.textContent = t("task.doneEmpty");
      }

      row.appendChild(check);
      row.appendChild(title);
      item.appendChild(row);
      item.appendChild(meta);
      item.appendChild(whenLabel);
      elements.completedList.appendChild(item);
    });
  }

  if (elements.completedToggle && elements.completedButton) {
    const isOpen = !!state.settings.showCompleted;
    elements.completedToggle.classList.toggle("is-open", isOpen);
    elements.completedButton.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );
    elements.completedList.classList.toggle("is-hidden", !isOpen);
  }

}

function getBreakLabel(mode) {
  if (mode === "short") return t("break.short");
  if (mode === "long") return t("break.long");
  return t("break.auto");
}

function handleMenuAction(taskId, action) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (action === "edit") {
    editingTaskId = task.id;
    elements.taskName.value = task.name;
    elements.taskEstimate.value = task.estimate;
    elements.taskBreak.value = task.breakMode || "auto";
    elements.taskForm.classList.remove("hidden");
    elements.taskName.focus();
  } else if (action === "delete") {
    state.tasks = state.tasks.filter((t) => t.id !== task.id);
    if (state.activeTaskId === task.id) state.activeTaskId = null;
  } else if (action === "break-short") {
    task.breakMode = "short";
  } else if (action === "break-long") {
    task.breakMode = "long";
  } else if (action === "break-auto") {
    task.breakMode = "auto";
  }
  saveState();
  render();
}

function render() {
  updateNav();
  updateHeader();
  updateTimerDisplay();
  updateLiveClock();
  updateTodayDate();
  updateNextSession();
  updateSettingsInputs();
  updateTaskFormLabels();
  updateTaskList();
  updateFinishEstimate();
  const hasStarted =
    state.timer.running ||
    state.timer.remaining !== modeDuration(state.timer.mode);
  elements.resetTimer.classList.toggle("hidden", !hasStarted);
  elements.resetTimer.textContent = t("controls.reset");
  elements.nextButton.textContent = t("controls.next");
  elements.resetAll.textContent = t("controls.resetDay");
  elements.startPause.textContent = state.timer.running
    ? t("controls.pause")
    : t("controls.start");
  const isSaving = !elements.taskForm.classList.contains("hidden");
  elements.addTaskCard.textContent = isSaving ? t("task.save") : t("task.add");
}


function tick() {
  if (!state.timer.running) return;
  const now = Date.now();
  const remaining = Math.max(0, Math.round((state.timer.endTime - now) / 1000));
  state.timer.remaining = remaining;
  updateTimerDisplay();
  updateFinishEstimate();
  if (remaining <= 0) {
    completeSession();
  }
}

function syncTasksFromDom() {
  const ids = Array.from(elements.taskList.querySelectorAll(".task-item")).map(
    (item) => item.dataset.taskId
  );
  const nextTasks = ids
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter(Boolean);
  if (nextTasks.length === state.tasks.length) {
    state.tasks = nextTasks;
    saveState();
    render();
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".task-item:not(.dragging)"),
  ];
  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;
  draggableElements.forEach((child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = child;
    }
  });
  return closest;
}



function startTimer() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.endTime = Date.now() + state.timer.remaining * 1000;
  timerInterval = setInterval(tick, 250);
  saveState();
  render();
}

function pauseTimer() {
  if (!state.timer.running) return;
  state.timer.running = false;
  state.timer.remaining = Math.max(
    0,
    Math.round((state.timer.endTime - Date.now()) / 1000)
  );
  state.timer.endTime = null;
  state.timer.pendingMode = null;
  clearInterval(timerInterval);
  timerInterval = null;
  saveState();
  render();
}

function resetTimer() {
  state.timer.running = false;
  state.timer.endTime = null;
  state.timer.pendingMode = null;
  state.timer.remaining = modeDuration(state.timer.mode);
  clearInterval(timerInterval);
  timerInterval = null;
  saveState();
  render();
}

function skipSession() {
  state.timer.running = false;
  state.timer.endTime = null;
  clearInterval(timerInterval);
  timerInterval = null;
  state.timer.pendingMode = null;
  if (state.timer.mode === "focus") {
    state.timer.cycleCount += 1;
  }
  const nextMode = resolveNextMode(true);
  state.timer.mode = nextMode;
  state.timer.remaining = modeDuration(nextMode);
  saveState();
  render();
}

function switchMode(mode) {
  state.timer.mode = mode;
  state.timer.running = false;
  state.timer.endTime = null;
  state.timer.pendingMode = null;
  state.timer.remaining = modeDuration(mode);
  clearInterval(timerInterval);
  timerInterval = null;
  saveState();
  render();
}

function completeSession() {
  pauseTimer();
  if (state.timer.mode === "focus") {
    state.timer.focusCount += 1;
    state.timer.cycleCount += 1;
    const activeTask = state.tasks.find(
      (task) => task.id === state.activeTaskId
    );
    if (activeTask && activeTask.done < activeTask.estimate) {
      activeTask.done += 1;
      if (activeTask.done >= activeTask.estimate) {
        activeTask.completedAt = new Date().toISOString();
        state.activeTaskId =
          state.tasks.find((task) => task.done < task.estimate)?.id || null;
      }
    }
  }
  playBell();
  const nextMode = resolveNextMode(true);
  state.timer.mode = nextMode;
  state.timer.remaining = modeDuration(nextMode);
  state.timer.running = false;
  state.timer.endTime = null;
  saveState();
  render();
  if (state.settings.autoSwitch) startTimer();
}

  const bellAudio = new Audio("assets/school-bell.mp3");
  bellAudio.preload = "auto";

  function playBell() {
    if (!state.settings.sound) return;
    bellAudio.currentTime = 0;
    bellAudio.play().catch(() => {});
  }

elements.startPause.addEventListener("click", () => {
  if (state.timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
});

elements.resetTimer.addEventListener("click", resetTimer);
elements.nextButton.addEventListener("click", skipSession);

elements.navPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    if (state.timer.running) {
      const nextMode = pill.dataset.mode;
      state.timer.pendingMode =
        state.timer.pendingMode === nextMode ? null : nextMode;
      if (nextMode === state.timer.mode) {
        state.timer.pendingMode = null;
      }
      saveState();
      render();
      return;
    }
    switchMode(pill.dataset.mode);
  });
});

elements.toggleSound.addEventListener("click", () => {
  state.settings.sound = !state.settings.sound;
  saveState();
  render();
});

elements.resetAll.addEventListener("click", () => {
  state = structuredClone(DEFAULT_STATE);
  saveState();
  resetTimer();
});

elements.cancelTask.addEventListener("click", () => {
  editingTaskId = null;
  elements.taskForm.classList.add("hidden");
  elements.addTaskCard.textContent = t("task.add");
  elements.addTaskCard.classList.remove("is-save");
});

elements.addTaskCard.addEventListener("click", () => {
  if (!elements.taskForm.classList.contains("hidden")) {
    elements.taskForm.requestSubmit();
    return;
  }
  editingTaskId = null;
  elements.taskForm.classList.remove("hidden");
  elements.addTaskCard.textContent = t("task.save");
  elements.addTaskCard.classList.add("is-save");
  elements.taskName.value = "";
  elements.taskEstimate.value = 1;
  elements.taskBreak.value = "auto";
  elements.taskName.focus();
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.taskName.value.trim();
  const estimate = Number.parseInt(elements.taskEstimate.value, 10) || 1;
  const breakMode = elements.taskBreak.value || "auto";
  if (!name) return;
  if (editingTaskId) {
    const task = state.tasks.find((t) => t.id === editingTaskId);
    if (task) {
      task.name = name;
      task.estimate = Math.max(1, estimate);
      task.done = Math.min(task.done, task.estimate);
      task.breakMode = breakMode;
    }
  } else {
    const newTask = {
      id: crypto.randomUUID(),
      name,
      estimate: Math.max(1, estimate),
      done: 0,
      breakMode,
    };
    state.tasks.push(newTask);
    state.activeTaskId = newTask.id;
  }
  editingTaskId = null;
  elements.taskForm.classList.add("hidden");
  elements.addTaskCard.textContent = t("task.add");
  elements.addTaskCard.classList.remove("is-save");
  saveState();
  render();
});

elements.taskOptions.addEventListener("click", (event) => {
  event.stopPropagation();
  elements.taskOptionsMenu.classList.toggle("is-open");
});

document.addEventListener("click", () => {
  elements.taskOptionsMenu.classList.remove("is-open");
  elements.headerOptionsMenu.classList.remove("is-open");
});

elements.clearCompleted.addEventListener("click", (event) => {
  event.stopPropagation();
  state.tasks = state.tasks.filter((task) => task.done < task.estimate);
  if (!state.tasks.some((task) => task.id === state.activeTaskId)) {
    state.activeTaskId = state.tasks[0]?.id || null;
  }
  saveState();
  render();
  elements.taskOptionsMenu.classList.remove("is-open");
});

elements.headerOptions.addEventListener("click", (event) => {
  event.stopPropagation();
  elements.headerOptionsMenu.classList.toggle("is-open");
});

elements.taskList.addEventListener("dragstart", (event) => {
  const handle = event.target.closest(".drag-rail");
  if (!handle) return;
  const item = handle.closest(".task-item");
  if (!item) return;
  isDraggingTask = true;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

elements.taskList.addEventListener("dragend", (event) => {
  const item = event.target.closest(".task-item");
  if (item) item.classList.remove("dragging");
  if (isDraggingTask) {
    isDraggingTask = false;
    syncTasksFromDom();
  }
});

elements.taskList.addEventListener("dragover", (event) => {
  if (!isDraggingTask) return;
  event.preventDefault();
  const afterElement = getDragAfterElement(elements.taskList, event.clientY);
  const dragging = elements.taskList.querySelector(".dragging");
  if (!dragging) return;
  if (afterElement == null) {
    elements.taskList.appendChild(dragging);
  } else {
    elements.taskList.insertBefore(dragging, afterElement);
  }
});

elements.focusMinutes.addEventListener("change", () => {
  state.settings.focusMinutes = clampNumber(elements.focusMinutes.value, 10, 90);
  if (state.timer.mode === "focus") resetTimer();
  saveState();
  render();
});

elements.shortMinutes.addEventListener("change", () => {
  state.settings.shortMinutes = clampNumber(elements.shortMinutes.value, 3, 30);
  if (state.timer.mode === "short") resetTimer();
  saveState();
  render();
});

elements.longMinutes.addEventListener("change", () => {
  state.settings.longMinutes = clampNumber(elements.longMinutes.value, 10, 60);
  if (state.timer.mode === "long") resetTimer();
  saveState();
  render();
});

elements.autoSwitch.addEventListener("change", () => {
  state.settings.autoSwitch = elements.autoSwitch.checked;
  saveState();
  render();
});

function clampNumber(value, min, max) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}

render();
setInterval(updateLiveClock, 1000);
if (state.timer.running && state.timer.endTime) {
  timerInterval = setInterval(tick, 250);
}






