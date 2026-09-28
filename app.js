import { GENERAL_GUIDANCE, PROGRAM, WEIGHT_LABELS, getRoutine } from './program.js';
import {
  countStatuses,
  ensureDraft,
  findPreviousSet,
  finishWorkout,
  loadStore,
  saveStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from './state.js';
import {
  formatTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  settleTimer,
  startTimer
} from './timer.js';
import { formatLocalDateTime, formatSetResult, workoutToMarkdown, workoutsToMarkdown } from './export.js';

const elements = {
  storageWarning: document.querySelector('#storage-warning'),
  offlineBanner: document.querySelector('#offline-banner'),
  toast: document.querySelector('#toast'),
  installButton: document.querySelector('#install-button'),
  daySelector: document.querySelector('#day-selector'),
  workoutWeekday: document.querySelector('#workout-weekday'),
  workoutHeading: document.querySelector('#workout-heading'),
  workoutDate: document.querySelector('#workout-date'),
  workoutProgress: document.querySelector('#workout-progress'),
  timingGuidance: document.querySelector('#timing-guidance'),
  exerciseList: document.querySelector('#exercise-list'),
  finishWorkout: document.querySelector('#finish-workout'),
  newWorkout: document.querySelector('#new-workout'),
  timerDisplay: document.querySelector('#timer-heading'),
  timerStatus: document.querySelector('#timer-status'),
  timerPresets: document.querySelector('#timer-presets'),
  timerToggle: document.querySelector('#timer-toggle'),
  timerReset: document.querySelector('#timer-reset'),
  historyEmpty: document.querySelector('#history-empty'),
  historyList: document.querySelector('#history-list'),
  exportAll: document.querySelector('#export-all'),
  programList: document.querySelector('#program-list')
};

const storage = getStorage();
const loaded = loadStore(storage);
let store = loaded.store;
let installPrompt = null;
let toastTimer = null;

if (loaded.error) showStorageError(loaded.error);

renderStaticGuidance();
renderProgram();
renderWorkout();
renderHistory();
syncTimer(false);
updateNetworkStatus();
bindEvents();
registerServiceWorker();

setInterval(() => syncTimer(document.visibilityState === 'visible'), 250);

function bindEvents() {
  elements.daySelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-routine-id]');
    if (!button) return;
    store.selectedRoutineId = button.dataset.routineId;
    ensureDraft(store, store.selectedRoutineId);
    persist();
    renderWorkout();
  });

  elements.exerciseList.addEventListener('input', (event) => {
    const input = event.target.closest('[data-exercise-id][data-set-index][data-field]');
    if (!input) return;

    const draft = ensureDraft(store, store.selectedRoutineId);
    const result = draft.sets[input.dataset.exerciseId][Number(input.dataset.setIndex)];
    result[input.dataset.field] = input.value;
    result.prefilled = false;
    result.edited = true;
    draft.updatedAt = Date.now();
    persist();
  });

  elements.exerciseList.addEventListener('click', (event) => {
    const button = event.target.closest('.status-button');
    if (!button) return;

    const draft = ensureDraft(store, store.selectedRoutineId);
    const timestamp = Date.now();
    store.timer = transitionSetStatus(
      draft,
      store.timer,
      button.dataset.exerciseId,
      Number(button.dataset.setIndex),
      button.dataset.status,
      timestamp
    );
    draft.updatedAt = timestamp;
    persist();
    renderWorkout();
    renderTimer();
  });

  elements.finishWorkout.addEventListener('click', finishCurrentWorkout);
  elements.newWorkout.addEventListener('click', clearCurrentDraft);

  elements.timerPresets.addEventListener('click', (event) => {
    const button = event.target.closest('[data-seconds]');
    if (!button) return;
    store.timer = startTimer(store.timer, Number(button.dataset.seconds));
    persist();
    renderTimer();
  });

  elements.timerToggle.addEventListener('click', () => {
    if (store.timer.mode === 'running') store.timer = pauseTimer(store.timer);
    else if (store.timer.mode === 'paused') store.timer = resumeTimer(store.timer);
    else store.timer = startTimer(store.timer, store.timer.durationMs / 1000);
    persist();
    renderTimer();
  });

  elements.timerReset.addEventListener('click', () => {
    store.timer = resetTimer(store.timer);
    persist();
    renderTimer();
  });

  document.querySelector('.bottom-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    showView(button.dataset.view);
  });

  elements.historyList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-export-id]');
    if (!button) return;
    const workout = store.history.find((item) => item.id === button.dataset.exportId);
    if (workout) downloadMarkdown(workoutToMarkdown(workout), `${workout.date}-${workout.routineId}.md`);
  });

  elements.exportAll.addEventListener('click', () => {
    if (!store.history.length) return;
    downloadMarkdown(workoutsToMarkdown(store.history), `gym-history-${todayKey()}.md`);
  });

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  document.addEventListener('visibilitychange', () => syncTimer(false));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    elements.installButton.hidden = true;
    showToast('Приложение установлено');
  });
}

function renderWorkout() {
  const routine = getRoutine(store.selectedRoutineId);
  const draft = ensureDraft(store, routine.id);
  const statuses = countStatuses(draft);

  elements.daySelector.innerHTML = PROGRAM.map((item) => `
    <button type="button" data-routine-id="${item.id}" aria-pressed="${item.id === routine.id}">
      ${item.day}
    </button>
  `).join('');

  elements.workoutWeekday.textContent = routine.weekday;
  elements.workoutHeading.textContent = routine.name;
  elements.workoutDate.textContent = `Черновик от ${formatDate(draft.startedAt)}`;
  elements.workoutProgress.textContent = `${statuses.done}/${statuses.total} готово`;
  elements.exerciseList.innerHTML = routine.exercises.map((exercise) => renderExercise(exercise, draft)).join('');
  bindOptionalImageErrors(elements.exerciseList);
}

function renderExercise(exercise, draft) {
  const weightText = exercise.weight ? ` · ${WEIGHT_LABELS[exercise.weight]}` : '';
  const setRows = draft.sets[exercise.id].map((result, index) => {
    const previous = findPreviousSet(store.history, draft.routineId, exercise.id, index);
    return renderSetRow(exercise, result, previous, index);
  }).join('');

  return `
    <article class="exercise-card">
      <header class="exercise-header">
        <div>
          <h3>${escapeHtml(exercise.name)}</h3>
          <p class="exercise-meta">${exercise.sets} × ${escapeHtml(exercise.target)}${escapeHtml(weightText)}</p>
        </div>
        <span class="rest-badge">${escapeHtml(exercise.rest)} · авто ${formatTimer(exercise.restSeconds * 1000)}</span>
      </header>
      <div class="sets">${setRows}</div>
      ${renderTechnique(exercise)}
    </article>
  `;
}

function renderSetRow(exercise, result, previous, index) {
  const inputs = inputDefinitions(exercise).map((input) => `
    <div class="input-wrap">
      <label for="${exercise.id}-${index}-${input.field}">${input.label}</label>
      <input
        id="${exercise.id}-${index}-${input.field}"
        type="number"
        inputmode="${input.step === '1' ? 'numeric' : 'decimal'}"
        min="0"
        step="${input.step}"
        value="${escapeHtml(result[input.field] ?? '')}"
        placeholder="${escapeHtml(previousValue(previous, input.field))}"
        data-exercise-id="${exercise.id}"
        data-set-index="${index}"
        data-field="${input.field}"
        aria-label="${escapeHtml(`${exercise.name}, подход ${index + 1}, ${input.label}`)}"
      >
    </div>
  `).join('');

  const optional = exercise.optionalAfter && index >= exercise.optionalAfter;
  const hint = renderSetHint(exercise, result, previous);

  return `
    <div class="set-row">
      <div class="set-number ${optional ? 'optional-label' : ''}" title="${optional ? 'По самочувствию' : `Подход ${index + 1}`}">${index + 1}</div>
      <div class="set-content">
        <div class="set-inputs" style="--input-count: ${inputDefinitions(exercise).length}">${inputs}</div>
        <div class="set-controls">
          <button class="status-button" type="button" data-status="done" data-exercise-id="${exercise.id}" data-set-index="${index}" aria-pressed="${result.status === 'done'}">Готово</button>
          <button class="status-button" type="button" data-status="skipped" data-exercise-id="${exercise.id}" data-set-index="${index}" aria-pressed="${result.status === 'skipped'}">Пропуск</button>
        </div>
        ${optional ? '<p class="previous-hint">Второй круг — по самочувствию.</p>' : ''}
        ${hint}
      </div>
    </div>
  `;
}

function inputDefinitions(exercise) {
  const inputs = [];
  if (exercise.weight) inputs.push({ field: 'weight', label: exercise.weight === 'pullup' ? '+ кг' : 'вес, кг', step: '0.5' });
  if (exercise.kind === 'reps') inputs.push({ field: 'reps', label: 'повторы', step: '1' });
  if (exercise.kind === 'sides') {
    inputs.push({ field: 'leftReps', label: 'левая', step: '1' });
    inputs.push({ field: 'rightReps', label: 'правая', step: '1' });
  }
  if (exercise.kind === 'seconds') inputs.push({ field: 'seconds', label: 'секунды', step: '1' });
  return inputs;
}

function previousValue(previous, field) {
  const value = previous?.status === 'done' ? previous[field] : '';
  return value === undefined || value === '' ? '' : `было ${value}`;
}

function renderSetHint(exercise, result, previous) {
  if (result.prefilled && result.status === 'pending') {
    const source = previous?.status === 'done'
      ? ` из прошлого выполненного подхода: ${escapeHtml(trimFinalPeriod(formatSetResult(previous, exercise)))}`
      : ' по нижней границе плана';
    return `<p class="previous-hint">Предзаполнено${source}. Текущий подход ещё не выполнен.</p>`;
  }
  if (previous?.status === 'done') {
    return `<p class="previous-hint">Прошлый выполненный подход: ${escapeHtml(trimFinalPeriod(formatSetResult(previous, exercise)))}.</p>`;
  }
  return '';
}

function renderTechnique(exercise) {
  const image = exercise.image
    ? `<img class="technique-image" src="${exercise.image}" alt="${escapeHtml(exercise.name)}" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  const note = exercise.note ? `<p>${escapeHtml(exercise.note)}</p>` : '';
  const links = exercise.links?.length
    ? `<p>${exercise.links.map((link) => `<a href="${link.url}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.label)}</a>`).join(' · ')}</p>`
    : '';
  const tips = exercise.tips?.length
    ? `<ul>${exercise.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
    : '';

  return `
    <details class="technique">
      <summary>Техника и иллюстрация</summary>
      <div class="technique-body">
        ${image}${note}${links}${tips}
      </div>
    </details>
  `;
}

function finishCurrentWorkout() {
  const draft = ensureDraft(store, store.selectedRoutineId);
  const statuses = countStatuses(draft);
  if (statuses.pending && !window.confirm(`Осталось незавершённых подходов: ${statuses.pending}. Сохранить тренировку с ними?`)) return;

  const completed = finishWorkout(draft);
  store.history.push(completed);
  startNewDraft(store, store.selectedRoutineId);
  const saved = persist();
  renderWorkout();
  renderHistory();
  showToast(saved ? 'Тренировка сохранена в историю' : 'Только в памяти: экспортируйте историю');
}

function clearCurrentDraft() {
  const draft = ensureDraft(store, store.selectedRoutineId);
  const message = workoutHasProgress(draft)
    ? 'Черновик содержит записи. Удалить их и начать заново?'
    : 'Создать новый черновик с текущей датой?';
  if (!window.confirm(message)) return;

  startNewDraft(store, store.selectedRoutineId);
  const saved = persist();
  renderWorkout();
  showToast(saved ? 'Создан новый черновик' : 'Новый черновик не сохранён на устройстве');
}

function renderHistory() {
  const workouts = [...store.history].sort((a, b) => b.finishedAt - a.finishedAt);
  elements.historyEmpty.hidden = workouts.length > 0;
  elements.exportAll.disabled = workouts.length === 0;
  elements.historyList.innerHTML = workouts.map((workout) => {
    const routine = getRoutine(workout.routineId);
    const statuses = countStatuses(workout);
    const exercises = routine.exercises.map((exercise) => {
      const sets = (workout.sets[exercise.id] || []).map((set, index) => (
        `<li>${index + 1}: ${escapeHtml(formatSetResult(set, exercise))}</li>`
      )).join('');
      return `<div class="history-exercise"><h3>${escapeHtml(exercise.name)}</h3><ul>${sets}</ul></div>`;
    }).join('');

    return `
      <details class="history-card">
        <summary>
          <span>${escapeHtml(routine.name)}<br><small class="muted">${escapeHtml(formatLocalDateTime(workout.finishedAt))}</small></span>
          <span>${statuses.done}/${statuses.total}</span>
        </summary>
        <div class="history-body">
          ${exercises}
          <button class="button button-quiet" type="button" data-export-id="${escapeHtml(workout.id)}">Скачать Markdown</button>
        </div>
      </details>
    `;
  }).join('');
}

function renderProgram() {
  elements.programList.innerHTML = PROGRAM.map((routine) => `
    <details class="program-day">
      <summary>${escapeHtml(`${routine.weekday} · ${routine.name}`)}</summary>
      <div class="program-exercises">
        ${routine.exercises.map((exercise) => `
          <article class="program-exercise">
            <h3>${escapeHtml(exercise.name)}</h3>
            <p class="exercise-meta">${exercise.sets} × ${escapeHtml(exercise.target)} · отдых ${escapeHtml(exercise.rest)} · авто ${formatTimer(exercise.restSeconds * 1000)}${exercise.weight ? ` · ${escapeHtml(WEIGHT_LABELS[exercise.weight])}` : ''}</p>
            ${renderTechnique(exercise)}
          </article>
        `).join('')}
      </div>
    </details>
  `).join('');
  bindOptionalImageErrors(elements.programList);
}

function renderStaticGuidance() {
  elements.timingGuidance.innerHTML = `
    <ul>${GENERAL_GUIDANCE.timing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <ul>${GENERAL_GUIDANCE.rules.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  `;
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== `view-${viewName}`;
  });
  document.querySelectorAll('.bottom-nav [data-view]').forEach((button) => {
    if (button.dataset.view === viewName) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (viewName === 'history') renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncTimer(allowVibrate) {
  const settled = settleTimer(store.timer);
  store.timer = settled.timer;
  if (settled.finishedNow) {
    persist();
    if (allowVibrate && navigator.vibrate) navigator.vibrate([180, 80, 180]);
  }
  renderTimer();
}

function renderTimer() {
  elements.timerDisplay.textContent = formatTimer(store.timer.remainingMs);
  elements.timerStatus.textContent = {
    idle: 'Готов',
    running: 'Идёт',
    paused: 'Пауза',
    finished: 'Отдых окончен'
  }[store.timer.mode] || 'Готов';
  elements.timerToggle.textContent = {
    idle: 'Старт',
    running: 'Пауза',
    paused: 'Продолжить',
    finished: 'Повторить'
  }[store.timer.mode] || 'Старт';

  elements.timerPresets.querySelectorAll('[data-seconds]').forEach((button) => {
    button.setAttribute('aria-pressed', Number(button.dataset.seconds) * 1000 === store.timer.durationMs);
  });
}

function persist() {
  const result = saveStore(storage, store);
  if (result.ok) elements.storageWarning.hidden = true;
  else showStorageError(result.error);
  return result.ok;
}

function showStorageError(message) {
  elements.storageWarning.textContent = message;
  elements.storageWarning.hidden = false;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function updateNetworkStatus() {
  elements.offlineBanner.hidden = navigator.onLine;
}

function bindOptionalImageErrors(container) {
  container.querySelectorAll('.technique-image').forEach((image) => {
    image.addEventListener('error', () => image.remove(), { once: true });
  });
}

function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return {
      getItem() { throw error; },
      setItem() { throw error; }
    };
  }
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(timestamp));
}

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function trimFinalPeriod(value) {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (error) {
    console.warn('Service worker не зарегистрирован', error);
  }
}
