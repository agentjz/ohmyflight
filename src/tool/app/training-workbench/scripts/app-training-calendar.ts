import { TrainingToolScanner } from "./scanner";
import type { TrainingCalendarDayEvent, TrainingCalendarSession, TrainingToolAppRuntime } from "./models";
import { TrainingToolTrainingCalendar } from "./training-calendar";
import { TrainingToolUtils } from "./utils";

export function installTrainingAppTrainingCalendar(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const Scanner = TrainingToolScanner;
  const Calendar = TrainingToolTrainingCalendar;
  const state = runtime.state;
  const elements = runtime.elements;

  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

  function today(): Date {
    const now = new Date();
    return Utils.makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function currentMonthKey(): string {
    return Utils.toMonthKey(today());
  }

  function eventTone(projectName: string): string {
    if (projectName === "CRM") return "crm";
    if (projectName === "应急训练") return "emergency";
    if (projectName === "危险品") return "dangerous-goods";
    if (projectName.includes("航空安保") || projectName.includes("TSA")) return "security";
    if (projectName === "疲劳管理") return "fatigue";
    return "style";
  }

  function formatSessionDate(session: TrainingCalendarSession): string {
    const start = Utils.parseDate(session.startDate);
    const end = Utils.parseDate(session.endDate);
    if (!start || !end) return session.startDate;
    const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`;
    if (session.startDate === session.endDate) return startLabel;
    return `${startLabel}-${end.getMonth() + 1}月${end.getDate()}日`;
  }

  function renderReminders(): void {
    if (!state.trainingCalendarResult) {
      elements.trainingCalendarReminderList.innerHTML = '<div class="calendar-reminder-empty">导入总培训表后显示未来 7 天签到表提醒。</div>';
      return;
    }

    const reminders = state.trainingCalendarResult.reminders;
    if (!reminders.length) {
      elements.trainingCalendarReminderList.innerHTML = '<div class="calendar-reminder-empty">未来 7 天没有需要打印签到表的培训。</div>';
      return;
    }

    elements.trainingCalendarReminderList.innerHTML = reminders.map((reminder) => {
      const attendeeText = reminder.attendeeNames.length
        ? `<small>${Utils.escapeHtml(reminder.attendeeNames.join("、"))}</small>`
        : "";
      return `
        <div class="calendar-reminder-item">
          <time datetime="${Utils.escapeHtml(reminder.startDate)}">${Utils.escapeHtml(formatSessionDate(reminder))}</time>
          <div>
            <strong>${Utils.escapeHtml(reminder.projectName)}</strong>
            ${attendeeText}
          </div>
          <span>${Utils.escapeHtml(reminder.message)}</span>
        </div>
      `;
    }).join("");
  }

  function renderEvent(event: TrainingCalendarDayEvent): string {
    const range = event.startDate === event.endDate
      ? ""
      : `<small class="calendar-event-range">${Utils.escapeHtml(formatSessionDate(event))}</small>`;
    const attendees = event.attendeeNames.length
      ? `<small class="calendar-event-attendees">${Utils.escapeHtml(event.attendeeNames.join("、"))}</small>`
      : "";
    return `
      <article class="calendar-event calendar-event-${eventTone(event.projectName)}" title="${Utils.escapeHtml(formatSessionDate(event))} ${Utils.escapeHtml(event.projectName)}">
        <strong>${Utils.escapeHtml(event.projectName)}</strong>
        ${range}
        ${attendees}
      </article>
    `;
  }

  function renderMonth(): void {
    const monthKey = state.trainingCalendarMonthKey || currentMonthKey();
    const events = state.trainingCalendarResult ? state.trainingCalendarResult.dayEvents : [];
    const view = Calendar.buildMonthView(events, monthKey, today());
    elements.trainingCalendarMonthLabel.textContent = view.label;
    elements.trainingCalendarMonthInput.value = monthKey;

    const weekdayHead = WEEKDAYS.map((weekday) => (
      `<div class="calendar-weekday" aria-hidden="true">周${weekday}</div>`
    )).join("");
    const dayCells = view.days.map((day) => {
      const classes = ["calendar-day"];
      if (!day.inCurrentMonth) classes.push("is-outside");
      if (day.isToday) classes.push("is-today");
      const eventHtml = day.events.map(renderEvent).join("");
      return `
        <div class="${classes.join(" ")}" aria-label="${Utils.escapeHtml(day.date)}">
          <time datetime="${Utils.escapeHtml(day.date)}">${day.dayNumber}</time>
          <div class="calendar-day-events">${eventHtml}</div>
        </div>
      `;
    }).join("");
    elements.trainingCalendarGrid.innerHTML = weekdayHead + dayCells;
  }

  function render(): void {
    renderReminders();
    renderMonth();
  }

  function rebuild(): void {
    if (!state.workbook || !state.analysis) {
      clear();
      return;
    }
    state.trainingCalendarResult = Calendar.buildCalendar(
      state.workbook,
      state.analysis,
      Scanner,
      { today: today() }
    );
    state.trainingCalendarMonthKey = currentMonthKey();
    render();
  }

  function clear(): void {
    state.trainingCalendarResult = null;
    state.trainingCalendarMonthKey = currentMonthKey();
    render();
  }

  function selectMonth(): void {
    if (!Utils.monthRangeFromKey(elements.trainingCalendarMonthInput.value)) return;
    state.trainingCalendarMonthKey = elements.trainingCalendarMonthInput.value;
    renderMonth();
  }

  function goToday(): void {
    state.trainingCalendarMonthKey = currentMonthKey();
    renderMonth();
  }

  function initialize(): void {
    elements.trainingCalendarMonthInput.addEventListener("change", selectMonth);
    elements.trainingCalendarTodayButton.addEventListener("click", goToday);
    clear();
  }

  runtime.trainingCalendar = {
    initialize,
    rebuild,
    clear,
    render
  };
}
