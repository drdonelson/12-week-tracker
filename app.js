const STORAGE_KEY = "execution-tracker-v1";

const dailyItems = [
  {
    id: "plan",
    title: "Plan the day",
    description: "Clarify your top 1–3 priorities before the day gets noisy.",
  },
  {
    id: "ceo-block",
    title: "CEO Block",
    description: "45–60 min of strategic work: systems, growth, leadership. NOT email or firefighting.",
  },
  {
    id: "workout",
    title: "Workout",
    description: "20 min minimum. Anything extra is a bonus.",
  },
  {
    id: "journal-fuel",
    title: "Journal & Fuel",
    description: "Eat aligned with your goals. Write at least 1 positive sentence.",
  },
  {
    id: "wellness",
    title: "Wellness / Breathing",
    description: "2 min minimum. Reset, breathe, close the day. Floor: 3 breaths.",
  },
];

const state = {
  selectedDate: todayKey(),
  entries: loadEntries(),
};

const elements = {
  dateInput: document.getElementById("date-input"),
  checklist: document.getElementById("checklist"),
  frictionNotes: document.getElementById("friction-notes"),
  winNotes: document.getElementById("win-notes"),
  dailyScore: document.getElementById("daily-score"),
  dailyStatus: document.getElementById("daily-status"),
  statusDot: document.getElementById("status-dot"),
  dailyCompleted: document.getElementById("daily-completed"),
  weekRange: document.getElementById("week-range"),
  weekAverage: document.getElementById("week-average"),
  weekBest: document.getElementById("week-best"),
  daysTracked: document.getElementById("days-tracked"),
  weekBars: document.getElementById("week-bars"),
  scoreboard: document.getElementById("scoreboard"),
  kpiStreak: document.getElementById("kpi-streak"),
  kpiPerfect: document.getElementById("kpi-perfect"),
  kpiRate: document.getElementById("kpi-rate"),
  exportBtn: document.getElementById("export-btn"),
  exportStatus: document.getElementById("export-status"),
  exportPreview: document.getElementById("export-preview"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
};

init();

function init() {
  renderChecklist();
  bindEvents();
  syncSelectedDay();
  render();
}

function bindEvents() {
  elements.dateInput.addEventListener("change", (event) => {
    state.selectedDate = event.target.value || todayKey();
    syncSelectedDay();
    render();
  });

  elements.frictionNotes.addEventListener("input", (event) => {
    updateEntry(state.selectedDate, { friction: event.target.value });
    renderKpisAndScoreboard();
  });

  elements.winNotes.addEventListener("input", (event) => {
    updateEntry(state.selectedDate, { win: event.target.value });
    renderKpisAndScoreboard();
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
      if (button.dataset.tabTarget === "kpis-panel") {
        renderExportPreview();
      }
    });
  });

  elements.exportBtn.addEventListener("click", () => {
    const text = buildExportText();
    navigator.clipboard.writeText(text).then(() => {
      elements.exportStatus.textContent = "Copied! Paste it wherever you need.";
      setTimeout(() => { elements.exportStatus.textContent = ""; }, 3000);
    }).catch(() => {
      elements.exportStatus.textContent = "Copy failed — use the preview below and copy manually.";
    });
  });
}

function renderChecklist() {
  elements.checklist.innerHTML = "";

  dailyItems.forEach((item) => {
    const label = document.createElement("label");
    label.className = "check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.itemId = item.id;
    checkbox.addEventListener("change", () => {
      const entry = getEntry(state.selectedDate);
      const nextItems = { ...entry.items, [item.id]: checkbox.checked };
      updateEntry(state.selectedDate, { items: nextItems });
      render();
    });

    const copy = document.createElement("div");
    copy.className = "check-copy";
    copy.innerHTML = `<strong>${item.title}</strong><span>${item.description}</span>`;

    label.append(checkbox, copy);
    elements.checklist.appendChild(label);
  });
}

function render() {
  const entry = getEntry(state.selectedDate);
  const score = calculateScore(entry);
  const completed = countCompleted(entry);

  elements.dateInput.value = state.selectedDate;
  elements.frictionNotes.value = entry.friction || "";
  elements.winNotes.value = entry.win || "";
  elements.dailyScore.textContent = `${score}%`;
  elements.dailyCompleted.textContent = `${completed} / ${dailyItems.length}`;
  updateStatus(score);

  [...elements.checklist.querySelectorAll("input[type='checkbox']")].forEach((input) => {
    input.checked = Boolean(entry.items[input.dataset.itemId]);
  });

  renderWeek();
  renderKpisAndScoreboard();
}

function renderWeek() {
  const weekDates = getWeekDates(state.selectedDate);
  const weekEntries = weekDates.map((date) => ({
    date,
    entry: getEntry(date),
  }));
  const scores = weekEntries.map(({ entry }) => calculateScore(entry));
  const trackedDays = weekEntries.filter(({ entry }) => hasAnyActivity(entry)).length;
  const average = trackedDays
    ? Math.round(
        weekEntries.reduce((sum, current) => sum + calculateScore(current.entry), 0) / trackedDays
      )
    : 0;
  const best = weekEntries.reduce(
    (currentBest, day) => {
      const score = calculateScore(day.entry);
      if (score > currentBest.score) {
        return { score, label: formatShortDate(day.date) };
      }
      return currentBest;
    },
    { score: -1, label: "-" }
  );

  const [firstDay, lastDay] = weekDates;
  elements.weekRange.textContent = `${formatMonthDay(firstDay)} - ${formatMonthDay(lastDay)}`;
  elements.weekAverage.textContent = `${average}%`;
  elements.weekBest.textContent = best.score >= 0 ? `${best.label} (${best.score}%)` : "-";
  elements.daysTracked.textContent = String(trackedDays);

  elements.weekBars.innerHTML = "";
  weekEntries.forEach(({ date, entry }) => {
    const score = calculateScore(entry);
    const column = document.createElement("div");
    column.className = "bar-card";
    column.innerHTML = `
      <span class="bar-day">${formatWeekday(date)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="height: ${Math.max(score, 6)}%"></div>
      </div>
      <span class="bar-score">${score}%</span>
    `;
    elements.weekBars.appendChild(column);
  });
}

function renderKpisAndScoreboard() {
  const allTracked = Object.entries(state.entries)
    .map(([date, entry]) => ({ date, entry }))
    .filter(({ entry }) => hasAnyActivity(entry))
    .sort((a, b) => b.date.localeCompare(a.date));

  const recent = allTracked.slice(0, 7);
  elements.scoreboard.innerHTML = "";

  if (!recent.length) {
    const empty = document.createElement("div");
    empty.className = "score-row";
    empty.innerHTML = `
      <div>
        <strong>No tracked days yet</strong>
        <span>Check a few boxes to start building your scoreboard.</span>
      </div>
      <span class="score-pill">0%</span>
      <span>0/${dailyItems.length}</span>
    `;
    elements.scoreboard.appendChild(empty);
  } else {
    recent.forEach(({ date, entry }) => {
      const score = calculateScore(entry);
      const row = document.createElement("div");
      row.className = "score-row";
      row.innerHTML = `
        <div>
          <strong>${formatFullDate(date)}</strong>
          <span>${getScoreboardSubtitle(entry)}</span>
        </div>
        <span class="score-pill">${score}%</span>
        <span>${countCompleted(entry)}/${dailyItems.length}</span>
      `;
      elements.scoreboard.appendChild(row);
    });
  }

  const streak = calculateStreak(allTracked);
  const perfect = allTracked.filter(({ entry }) => calculateScore(entry) === 100).length;
  const completionRate = allTracked.length
    ? Math.round(
        allTracked.reduce((sum, current) => sum + calculateScore(current.entry), 0) / allTracked.length
      )
    : 0;

  elements.kpiStreak.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
  elements.kpiPerfect.textContent = String(perfect);
  elements.kpiRate.textContent = `${completionRate}%`;
}

function syncSelectedDay() {
  if (!state.entries[state.selectedDate]) {
    state.entries[state.selectedDate] = createEmptyEntry();
    saveEntries();
  }
}

function getEntry(dateKey) {
  if (!state.entries[dateKey]) {
    state.entries[dateKey] = createEmptyEntry();
  }
  return state.entries[dateKey];
}

function updateEntry(dateKey, patch) {
  const current = getEntry(dateKey);
  state.entries[dateKey] = {
    ...current,
    ...patch,
    items: {
      ...current.items,
      ...(patch.items || {}),
    },
  };
  saveEntries();
}

function createEmptyEntry() {
  return {
    friction: "",
    win: "",
    items: dailyItems.reduce((accumulator, item) => {
      accumulator[item.id] = false;
      return accumulator;
    }, {}),
  };
}

function calculateScore(entry) {
  return Math.round((countCompleted(entry) / dailyItems.length) * 100);
}

function countCompleted(entry) {
  return dailyItems.filter((item) => entry.items[item.id]).length;
}

function hasAnyActivity(entry) {
  return (
    countCompleted(entry) > 0 ||
    Boolean((entry.friction || "").trim()) ||
    Boolean((entry.win || "").trim())
  );
}

function calculateStreak(trackedEntries) {
  if (!trackedEntries.length) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = toKey(cursor);
    const entry = state.entries[key];
    if (entry && countCompleted(entry) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

function getWeekDates(dateKey) {
  const current = parseDateKey(dateKey);
  const start = new Date(current);
  start.setDate(current.getDate() - current.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toKey(date);
  });
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function todayKey() {
  return toKey(new Date());
}

function toKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatWeekday(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, { weekday: "short" });
}

function formatMonthDay(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function truncate(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function updateStatus(score) {
  const status = getStatus(score);
  elements.dailyStatus.textContent = status.label;
  elements.statusDot.className = `status-dot ${status.className}`;
}

function getStatus(score) {
  if (score >= 85) {
    return { label: "WIN", className: "status-green" };
  }
  if (score >= 70) {
    return { label: "Warning", className: "status-yellow" };
  }
  return { label: "Adjust", className: "status-red" };
}

function getScoreboardSubtitle(entry) {
  if (entry.win) {
    return `Win: ${truncate(entry.win, 40)}`;
  }
  if (entry.friction) {
    return `Friction: ${truncate(entry.friction, 36)}`;
  }
  return "Daily check-in saved";
}

function setActiveTab(targetId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tabTarget === targetId);
  });

  elements.tabPanels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function buildExportText() {
  const allTracked = Object.entries(state.entries)
    .filter(([, entry]) => hasAnyActivity(entry))
    .sort(([a], [b]) => a.localeCompare(b));

  if (!allTracked.length) {
    return "No tracked data yet.";
  }

  const lines = ["=== 12 Week Tracker Export ===", `Generated: ${new Date().toLocaleString()}`, ""];

  allTracked.forEach(([date, entry]) => {
    const score = calculateScore(entry);
    const status = getStatus(score);
    lines.push(`Date: ${formatFullDate(date)}  |  Score: ${score}%  |  ${status.label}`);
    dailyItems.forEach((item) => {
      lines.push(`  [${entry.items[item.id] ? "x" : " "}] ${item.title}`);
    });
    if (entry.win) lines.push(`  Win: ${entry.win}`);
    if (entry.friction) lines.push(`  Friction: ${entry.friction}`);
    lines.push("");
  });

  const totalDays = allTracked.length;
  const avgScore = Math.round(allTracked.reduce((sum, [, e]) => sum + calculateScore(e), 0) / totalDays);
  const winDays = allTracked.filter(([, e]) => calculateScore(e) >= 85).length;
  const zeroDays = allTracked.filter(([, e]) => calculateScore(e) === 0).length;

  lines.push("=== Summary ===");
  lines.push(`Total tracked days: ${totalDays}`);
  lines.push(`Average score: ${avgScore}%`);
  lines.push(`WIN days (85%+): ${winDays} of ${totalDays}`);
  lines.push(`Zero days: ${zeroDays}`);

  return lines.join("\n");
}

function renderExportPreview() {
  elements.exportPreview.textContent = buildExportText();
}
