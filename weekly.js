const WEEKLY_KEY = "fokusflow_weekly_v1";
const WEEKLY_PREFS_KEY = "fokusflow_weekly_prefs_v1";
const STATE_KEY = "fokusflow_state_v1";
const WEEKLY_COPY_KEY = "fokusflow_weekly_copy_v1";

const i18n = window.FokusI18n;
const t = i18n ? i18n.t : (key) => key;
const applyTranslations = i18n ? i18n.applyTranslations : () => {};
const getLang = i18n ? i18n.getLang : () => "id";
const setLang = i18n ? i18n.setLang : () => {};
const locale = i18n ? i18n.locale : () => "id-ID";

const elements = {
  weekGrid: document.getElementById("week-grid"),
  weekRange: document.getElementById("week-range"),
  prevWeek: document.getElementById("prev-week"),
  nextWeek: document.getElementById("next-week"),
  thisWeek: document.getElementById("this-week"),
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

elements.weekGrid.addEventListener(
  "wheel",
  (event) => {
    if (!event.target.closest(".day-inline-edit")) return;
    event.preventDefault();
  },
  { passive: false }
);

let weekOffset = 0;
let editingId = null;
let editingNewDateKey = null;
let copyBuffer = loadCopyBuffer();

function loadCopyBuffer() {
  const saved = localStorage.getItem(WEEKLY_COPY_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveCopyBuffer(buffer) {
  localStorage.setItem(WEEKLY_COPY_KEY, JSON.stringify(buffer));
}

function loadPrefs() {
  const saved = localStorage.getItem(WEEKLY_PREFS_KEY);
  if (!saved) return { lastBreakByDay: {} };
  try {
    const parsed = JSON.parse(saved);
    return { lastBreakByDay: parsed.lastBreakByDay || {} };
  } catch (error) {
    return { lastBreakByDay: {} };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(WEEKLY_PREFS_KEY, JSON.stringify(prefs));
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const dayIndex = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(date.getDate() + offset);
  return next;
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

function formatDateShort(date) {
  return date.toLocaleDateString(locale(), {
    day: "2-digit",
    month: "short",
  });
}

function getDayLabel(date) {
  return date.toLocaleDateString(locale(), { weekday: "long" });
}

function getFullDate(date) {
  return date.toLocaleDateString(locale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getSettings() {
  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) {
    return { focusMinutes: 25, shortMinutes: 5, longMinutes: 15 };
  }
  try {
    const parsed = JSON.parse(saved);
    return {
      focusMinutes: parsed.settings?.focusMinutes || 25,
      shortMinutes: parsed.settings?.shortMinutes || 5,
      longMinutes: parsed.settings?.longMinutes || 15,
    };
  } catch (error) {
    return { focusMinutes: 25, shortMinutes: 5, longMinutes: 15 };
  }
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

function getBreakLabel(mode) {
  if (mode === "short") return t("break.short");
  if (mode === "long") return t("break.long");
  return t("break.auto");
}

function estimateDaySeconds(tasks, settings) {
  const focusSeconds = settings.focusMinutes * 60;
  const shortSeconds = settings.shortMinutes * 60;
  const longSeconds = settings.longMinutes * 60;
  let cycleCount = 0;
  let remaining = tasks.reduce((sum, task) => sum + (task.estimate || 0), 0);
  if (remaining === 0) return 0;
  let totalSeconds = 0;
  tasks.forEach((task) => {
    let taskRemaining = task.estimate || 0;
    while (taskRemaining > 0) {
      totalSeconds += focusSeconds;
      taskRemaining -= 1;
      remaining -= 1;
      cycleCount += 1;
      if (remaining > 0) {
        if (task.breakMode === "short") {
          totalSeconds += shortSeconds;
        } else if (task.breakMode === "long") {
          totalSeconds += longSeconds;
        } else {
          totalSeconds += cycleCount % 4 === 0 ? longSeconds : shortSeconds;
        }
      }
    }
  });
  return totalSeconds;
}

function render() {
  document.title = t("title.weekly");
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const start = startOfWeek(addDays(today, weekOffset * 7));
  const week = [];
  for (let i = 0; i < 7; i += 1) {
    week.push(addDays(start, i));
  }

  const rangeLabel = `${formatDateShort(week[0])} - ${formatDateShort(
    week[6]
  )}`;
  elements.weekRange.textContent = rangeLabel;

  const store = loadWeekly();
  const prefs = loadPrefs();
  elements.weekGrid.innerHTML = "";

  week.forEach((date) => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    if (dateStart < todayStart) return;
    const dateKey = getDateKey(date);
    const dayTasks = store.days[dateKey] || [];

    const card = document.createElement("div");
    card.className = "day-card";
    card.dataset.date = dateKey;

    const header = document.createElement("div");
    header.className = "card-header day-header";
    const estimateSeconds = estimateDaySeconds(dayTasks, getSettings());
    const estimateLabel = estimateSeconds
      ? t("task.estimate", { label: formatDuration(estimateSeconds) })
      : t("task.estimate", { label: "-" });
    header.innerHTML = `
      <div>
        <p class="eyebrow">${t("task.list")}</p>
        <h2 class="day-title">${getDayLabel(date)}</h2>
        <div class="day-date">${getFullDate(date)}</div>
      </div>
      <div class="day-actions">
        <div class="task-header-row">
          <p class="task-estimate">${estimateLabel}</p>
        </div>
        <div class="day-copy-panel">
          <button class="ghost-btn day-copy-btn" type="button">${t(
            "weekly.copy"
          )}</button>
          <button class="secondary-btn day-paste-btn" type="button">${t(
            "weekly.paste"
          )}</button>
        </div>
      </div>
    `;

    const list = document.createElement("ul");
    list.className = "day-list";

    dayTasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "day-item";
      if (editingId === task.id) {
        item.innerHTML = `
          <div class="day-inline-edit">
            <input type="text" class="inline-input inline-name" value="${task.name}" />
            <input type="number" class="inline-input inline-number inline-rep" min="1" max="12" value="${task.estimate}" />
            <select class="inline-select inline-break">
              <option value="auto">${t("break.auto")}</option>
              <option value="short">${t("break.short")}</option>
              <option value="long">${t("break.long")}</option>
            </select>
            <div class="inline-actions">
            <button class="secondary-btn save-btn" type="button" data-action="save">${t("task.save")}</button>
              <button class="secondary-btn danger-btn" type="button" data-action="cancel">${t("task.cancel")}</button>
            </div>
          </div>
        `;
      } else {
        item.innerHTML = `
          <div class="day-inline">
            <strong>${task.name}</strong>
            <span>${t("task.focusCount", { count: task.estimate })} - ${t(
              "break.label",
              { label: getBreakLabel(task.breakMode) }
            )}</span>
          </div>
          <button type="button" data-id="${task.id}">${t("task.delete")}</button>
        `;
      }
      if (editingId !== task.id) {
        item.querySelector("button").addEventListener("click", () => {
          store.days[dateKey] = dayTasks.filter((t) => t.id !== task.id);
          saveWeekly(store);
          render();
        });
      } else {
        const nameInput = item.querySelector(".inline-input");
        const estimateInput = item.querySelector(".inline-number");
        const breakSelect = item.querySelector(".inline-select");
        breakSelect.value = task.breakMode || "auto";
        item.querySelector("[data-action='save']").addEventListener("click", () => {
          const name = nameInput.value.trim();
          if (!name) return;
          task.name = name;
          task.estimate = Number.parseInt(estimateInput.value, 10) || 1;
          task.breakMode = breakSelect.value || "auto";
          prefs.lastBreakByDay[dateKey] = task.breakMode;
          savePrefs(prefs);
          saveWeekly(store);
          editingId = null;
          editingNewDateKey = null;
          render();
        });
        item.querySelector("[data-action='cancel']").addEventListener("click", () => {
          if (!task.name) {
            store.days[dateKey] = dayTasks.filter((t) => t.id !== task.id);
            saveWeekly(store);
          }
          editingId = null;
          editingNewDateKey = null;
          render();
        });
      }
      item.addEventListener("dblclick", () => {
        editingNewDateKey = null;
        editingId = task.id;
        render();
      });
      list.appendChild(item);
    });

    if (editingNewDateKey === dateKey && !editingId) {
      const item = document.createElement("li");
      item.className = "day-item";
      item.innerHTML = `
          <div class="day-inline-edit">
          <input type="text" class="inline-input inline-name" placeholder="Nama tugas" />
          <input type="number" class="inline-input inline-number inline-rep" min="1" max="12" value="1" />
          <select class="inline-select inline-break">
            <option value="auto">${t("break.auto")}</option>
            <option value="short">${t("break.short")}</option>
            <option value="long">${t("break.long")}</option>
          </select>
          <div class="inline-actions">
            <button class="secondary-btn save-btn" type="button" data-action="save-new">${t("task.save")}</button>
            <button class="secondary-btn danger-btn" type="button" data-action="cancel-new">${t("task.cancel")}</button>
          </div>
        </div>
      `;
      const nameInput = item.querySelector(".inline-input");
      const estimateInput = item.querySelector(".inline-number");
      const breakSelect = item.querySelector(".inline-select");
      breakSelect.value = prefs.lastBreakByDay[dateKey] || "auto";
      item.querySelector("[data-action='save-new']").addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) return;
        const estimate = Number.parseInt(estimateInput.value, 10) || 1;
        const breakMode = breakSelect.value || "auto";
        const tasks = store.days[dateKey] || [];
        tasks.push({
          id: crypto.randomUUID(),
          name,
          estimate,
          done: 0,
          breakMode,
        });
        prefs.lastBreakByDay[dateKey] = breakMode;
        savePrefs(prefs);
        store.days[dateKey] = tasks;
        saveWeekly(store);
        editingNewDateKey = null;
        editingId = null;
        render();
      });
      item.querySelector("[data-action='cancel-new']").addEventListener("click", () => {
        editingNewDateKey = null;
        editingId = null;
        render();
      });
      list.appendChild(item);
    }

    const copyBtn = header.querySelector(".day-copy-btn");
    const pasteBtn = header.querySelector(".day-paste-btn");
    copyBtn.disabled = dayTasks.length === 0;
    pasteBtn.disabled = copyBuffer.length === 0;
    copyBtn.addEventListener("click", () => {
      copyBuffer = dayTasks.map((task) => ({
        name: task.name,
        estimate: task.estimate,
        breakMode: task.breakMode || "auto",
      }));
      saveCopyBuffer(copyBuffer);
      render();
    });
    pasteBtn.addEventListener("click", () => {
      if (copyBuffer.length === 0) return;
      const copied = copyBuffer.map((task) => ({
        id: crypto.randomUUID(),
        name: task.name,
        estimate: task.estimate,
        done: 0,
        breakMode: task.breakMode || "auto",
      }));
      store.days[dateKey] = dayTasks.concat(copied);
      saveWeekly(store);
      render();
    });

    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.className = "day-add-card";
    addCard.textContent = t("task.add");
    addCard.addEventListener("click", () => {
      editingId = null;
      editingNewDateKey = dateKey;
      render();
    });

    card.appendChild(header);
    card.appendChild(list);
    card.appendChild(addCard);
    elements.weekGrid.appendChild(card);
  });
}

elements.prevWeek.addEventListener("click", () => {
  weekOffset -= 1;
  render();
});

elements.nextWeek.addEventListener("click", () => {
  weekOffset += 1;
  render();
});

elements.thisWeek.addEventListener("click", () => {
  weekOffset = 0;
  render();
});

render();
