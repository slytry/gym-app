import {
  NECK_CIRCUIT,
  NECK_CIRCUIT_IDS,
  PROGRAM,
  PROGRAM_GUIDANCE,
  PROGRAM_SCHEDULE,
  WEIGHT_LABELS,
  getActiveWorkoutExercises,
  getAvailableExercises,
  getExercise,
  getWorkoutExercises,
  getWorkoutNeckCircuit,
  getWorkoutRoutine,
  getWorkoutExerciseSettings
} from './program.js?v=22';
import {
  addWorkoutExercise,
  addWorkoutSet,
  STORAGE_KEY,
  countStatuses,
  ensureDraft,
  findPreviousSet,
  finishWorkout,
  loadStore,
  recordSpecialWorkout,
  saveStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from './state.js?v=22';
import {
  addTimerSeconds,
  formatTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  settleTimer,
  startTimer
} from './timer.js?v=10';
import { formatLocalDateTime, formatSetResult, workoutToMarkdown, workoutsToMarkdown } from './export.js?v=22';
import { BACKUP_MAX_BYTES, createBackup, parseBackup, restoreBackup } from './backup.js?v=22';
import { deleteWorkout } from './history.js?v=22';
import { bindHistoryEditor, renderExerciseHistory } from './history-view.js?v=22';
import { bindExerciseReplacement } from './exercise-replacement.js?v=22';
import { progressionHint } from './progression.js?v=22';
import { escapeHtml } from './html.js?v=20';
import { calculateWarmupSets } from './warmup.js?v=22';

const elements = {
  storageWarning: document.querySelector('#storage-warning'),
  offlineBanner: document.querySelector('#offline-banner'),
  toast: document.querySelector('#toast'),
  installButton: document.querySelector('#install-button'),
  menuToggle: document.querySelector('#menu-toggle'),
  areaMenu: document.querySelector('#area-menu'),
  areaLabel: document.querySelector('#area-label'),
  bottomNav: document.querySelector('.bottom-nav'),
  daySelector: document.querySelector('#day-selector'),
  workoutWeekday: document.querySelector('#workout-weekday'),
  workoutHeading: document.querySelector('#workout-heading'),
  workoutDate: document.querySelector('#workout-date'),
  workoutProgress: document.querySelector('#workout-progress'),
  exerciseList: document.querySelector('#exercise-list'),
  exerciseBankToggle: document.querySelector('#exercise-bank-toggle'),
  exerciseBank: document.querySelector('#exercise-bank'),
  exerciseBankList: document.querySelector('#exercise-bank-list'),
  exerciseBankEmpty: document.querySelector('#exercise-bank-empty'),
  finishWorkout: document.querySelector('#finish-workout'),
  newWorkout: document.querySelector('#new-workout'),
  timerDisplay: document.querySelector('#timer-heading'),
  timerStatus: document.querySelector('#timer-status'),
  timerPresets: document.querySelector('#timer-presets'),
  timerToggle: document.querySelector('#timer-toggle'),
  timerExtend: document.querySelector('#timer-extend'),
  timerReset: document.querySelector('#timer-reset'),
  historyEmpty: document.querySelector('#history-empty'),
  historyList: document.querySelector('#history-list'),
  exportAll: document.querySelector('#export-all'),
  exportBackup: document.querySelector('#export-backup'),
  restoreBackup: document.querySelector('#restore-backup'),
  backupFile: document.querySelector('#backup-file'),
  workoutNote: document.querySelector('#workout-note'),
  programIntro: document.querySelector('#program-intro'),
  programList: document.querySelector('#program-list')
};

const storage = getStorage();
const loaded = loadStore(storage);
let store = loaded.store;
let installPrompt = null;
let toastTimer = null;
let activeNeckRound = 0;
let storageReadError = loaded.error;
// Session-only UI state: warm-ups never enter the saved workout or timer.
const warmupChecks = new Map();
const warmupWeights = new Map();
const historyEditor = bindHistoryEditor(document.querySelector('#history-editor'), () => store, commitStore, renderSetRow);
const exerciseReplacement = bindExerciseReplacement(document.querySelector('#exercise-replacement'), () => store, commitStore,
  () => showToast('Упражнение заменено только на это занятие'));

if (loaded.error) showStorageError(loaded.error);

renderProgram();
renderWorkout();
if (!loaded.error) persist();
renderHistory();
renderSpecialHistory('hands');
renderSpecialHistory('foot-ankle');
syncTimer(false);
updateNetworkStatus();
bindEvents();
registerServiceWorker();

setInterval(() => syncTimer(document.visibilityState === 'visible'), 250);

function bindEvents() {
  elements.menuToggle.addEventListener('click', () => {
    setAreaMenuOpen(elements.areaMenu.hidden);
  });

  elements.areaMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-area]');
    if (!button) return;
    showView(button.dataset.view || 'workout');
    elements.menuToggle.focus();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#area-menu, #menu-toggle')) setAreaMenuOpen(false);
  });

  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('#area-menu, #menu-toggle')) setAreaMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!elements.areaMenu.hidden) {
      setAreaMenuOpen(false);
      elements.menuToggle.focus();
    } else if (!elements.exerciseBank.hidden) {
      setExerciseBankOpen(false);
      elements.exerciseBankToggle.focus();
    }
  });

  document.querySelectorAll('[data-record-special]').forEach((button) => button.addEventListener('click', () => {
    const routineId = button.dataset.recordSpecial;
    recordSpecialWorkout(store, routineId);
    const saved = persist();
    renderSpecialHistory(routineId);
    showToast(saved ? 'Занятие записано' : 'Только в памяти: данные не сохранены');
  }));

  elements.daySelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-routine-id]');
    if (!button) return;
    store.selectedRoutineId = button.dataset.routineId;
    activeNeckRound = 0;
    setExerciseBankOpen(false);
    ensureDraft(store, store.selectedRoutineId);
    persist();
    renderWorkout();
  });

  elements.exerciseBankToggle.addEventListener('click', () => {
    setExerciseBankOpen(elements.exerciseBank.hidden);
  });

  elements.exerciseBankList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-exercise]');
    if (!button) return;
    const exerciseId = button.dataset.addExercise;
    addWorkoutExercise(store, store.selectedRoutineId, exerciseId);
    if (NECK_CIRCUIT_IDS.includes(exerciseId)) activeNeckRound = 0;
    const saved = persist();
    renderWorkout();
    setExerciseBankOpen(false);
    elements.exerciseList.querySelector(`[data-add-set="${exerciseId}"]`).focus();
    showToast(saved ? 'Упражнение добавлено' : 'Упражнение добавлено только в памяти: данные не сохранены');
  });

  elements.exerciseList.addEventListener('input', (event) => {
    const input = event.target.closest('[data-exercise-id][data-set-index][data-field]');
    if (!input) return;
    if (!input.checkValidity()) { showToast('Проверь значение: отрицательные результаты и RIR вне 0–10 недопустимы'); return; }

    const draft = ensureDraft(store, store.selectedRoutineId);
    const result = draft.sets[input.dataset.exerciseId][Number(input.dataset.setIndex)];
    result[input.dataset.field] = input.value;
    result.prefilled = false;
    result.edited = true;
    draft.updatedAt = Date.now();
    persist();
    if (input.dataset.field === 'weight') {
      const exercise = getExercise(draft, input.dataset.exerciseId);
      if (exercise.warmup) {
        warmupWeights.set(`${draft.id}:${exercise.id}`, input.value);
        const block = elements.exerciseList.querySelector(`[data-warmup-exercise="${exercise.id}"]`);
        block.innerHTML = renderWarmupContent(exercise, draft);
      }
    }
  });

  elements.exerciseList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-warmup-set]');
    if (!checkbox) return;
    const draft = ensureDraft(store, store.selectedRoutineId);
    const exerciseId = checkbox.closest('[data-warmup-exercise]').dataset.warmupExercise;
    const checked = warmupChecks.get(`${draft.id}:${exerciseId}`).checked;
    if (checkbox.checked) checked.add(Number(checkbox.dataset.warmupSet));
    else checked.delete(Number(checkbox.dataset.warmupSet));
  });

  elements.workoutNote.addEventListener('input', () => {
    const draft = ensureDraft(store, store.selectedRoutineId);
    draft.note = elements.workoutNote.value;
    draft.updatedAt = Date.now();
    persist();
  });

  elements.exerciseList.addEventListener('click', (event) => {
    const replaceButton = event.target.closest('[data-replace-exercise]');
    if (replaceButton) {
      setExerciseBankOpen(false);
      exerciseReplacement.open(replaceButton.dataset.replaceExercise);
      return;
    }
    const tab = event.target.closest('[data-neck-round]');
    if (tab) {
      selectNeckRound(Number(tab.dataset.neckRound));
      return;
    }
    const addButton = event.target.closest('[data-add-set]');
    if (addButton) {
      const exerciseId = addButton.dataset.addSet;
      const draft = addWorkoutSet(store, store.selectedRoutineId, exerciseId);
      if (getWorkoutNeckCircuit(draft).exerciseIds.includes(exerciseId)) activeNeckRound = draft.sets[exerciseId].length - 1;
      const saved = persist();
      renderWorkout();
      elements.exerciseList.querySelector(`[data-add-set="${exerciseId}"]`).focus();
      if (!saved) showToast('Подход добавлен только в памяти: данные не сохранены');
      return;
    }
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

  elements.exerciseList.addEventListener('keydown', (event) => {
    if (!event.target.matches('[data-neck-round]')) return;
    const roundCount = elements.exerciseList.querySelectorAll('[data-neck-round]').length;
    const next = {
      ArrowLeft: (activeNeckRound + roundCount - 1) % roundCount,
      ArrowRight: (activeNeckRound + 1) % roundCount,
      Home: 0,
      End: roundCount - 1
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectNeckRound(next);
    elements.exerciseList.querySelector(`[data-neck-round="${next}"]`).focus();
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

  elements.timerExtend.addEventListener('click', () => {
    store.timer = addTimerSeconds(store.timer, 30);
    persist();
    renderTimer();
  });

  document.querySelector('.bottom-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    showView(button.dataset.view);
  });

  elements.historyList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-export-id], [data-edit-id], [data-delete-id]');
    if (!button) return;
    if (button.dataset.editId) { historyEditor.open(button.dataset.editId); return; }
    if (button.dataset.deleteId) {
      if (window.confirm('Удалить тренировку? Будущее предзаполнение будет учитывать оставшуюся историю. Текущие черновики не изменятся.')) {
        if (commitStore(deleteWorkout(store, button.dataset.deleteId))) showToast('Тренировка удалена');
      }
      return;
    }
    const workout = store.history.find((item) => item.id === button.dataset.exportId);
    if (workout) downloadMarkdown(workoutToMarkdown(workout), `${workout.date}-${workout.routineId}.md`);
  });

  elements.exportAll.addEventListener('click', () => {
    if (!store.history.length) return;
    downloadMarkdown(workoutsToMarkdown(store.history), `gym-history-${todayKey()}.md`);
  });

  elements.exportBackup.addEventListener('click', () => {
    setAreaMenuOpen(false);
    try {
      if (storageReadError) throw new Error('Исходные данные не прочитаны. Не заменяй их бэкапом пустого журнала.');
      downloadFile(createBackup(store), `gym-backup-${todayKey()}.json`, 'application/json');
    } catch (error) { showStorageError(`Не удалось создать бэкап: ${error.message}`); }
  });
  elements.restoreBackup.addEventListener('click', () => {
    setAreaMenuOpen(false);
    elements.backupFile.click();
  });
  elements.backupFile.addEventListener('change', async () => {
    const file = elements.backupFile.files[0];
    elements.backupFile.value = '';
    if (!file) return;
    try {
      if (file.size > BACKUP_MAX_BYTES) throw new Error('Бэкап больше 10 МБ');
      const raw = await file.text();
      const restored = parseBackup(raw);
      const message = `Заменить все данные бэкапом? Тренировок: ${restored.history.length}, черновиков: ${Object.keys(restored.drafts).length}, специализированных занятий: ${restored.specialHistory.length}. Перед заменой текущая копия будет скачана отдельно.`;
      if (!window.confirm(message)) return;
      const current = storageReadError ? storage.getItem(STORAGE_KEY) : createBackup(store);
      downloadFile(current || '', `gym-before-restore-${todayKey()}.json`, 'application/json');
      const result = restoreBackup(storage, raw);
      if (!result.ok) throw new Error(result.error);
      store = result.store;
      resetWarmupState();
      storageReadError = null;
      elements.storageWarning.hidden = true;
      activeNeckRound = 0;
      renderWorkout();
      renderHistory();
      renderSpecialHistory('hands');
      renderSpecialHistory('foot-ankle');
      syncTimer(false);
      showToast('Бэкап восстановлен');
    } catch (error) { showStorageError(error.message); }
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

function setAreaMenuOpen(open) {
  elements.areaMenu.hidden = !open;
  elements.menuToggle.setAttribute('aria-expanded', String(open));
}

function setExerciseBankOpen(open) {
  elements.exerciseBank.hidden = !open;
  elements.exerciseBankToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    const timerHeight = elements.timerDisplay.closest('.timer-card').getBoundingClientRect().height;
    const top = window.scrollY + elements.exerciseBankToggle.getBoundingClientRect().top;
    window.scrollTo({ top: top - timerHeight - 12, behavior: 'instant' });
  }
}

function renderWorkout() {
  const draft = ensureDraft(store, store.selectedRoutineId);
  const routine = getWorkoutRoutine(draft);
  const circuitIds = getWorkoutNeckCircuit(draft).exerciseIds;
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
  elements.workoutNote.value = draft.note || '';
  elements.exerciseList.innerHTML = getActiveWorkoutExercises(draft).map((exercise) => {
    if (exercise.id === circuitIds[0]) return renderNeckCircuit(draft);
    if (circuitIds.includes(exercise.id)) return '';
    return renderExercise(exercise, draft);
  }).join('');
  bindOptionalImageErrors(elements.exerciseList);
  renderExerciseBank(draft);
}

function renderExerciseBank(draft) {
  const exercises = getAvailableExercises(draft);
  elements.exerciseBankEmpty.hidden = exercises.length > 0;
  elements.exerciseBankList.innerHTML = exercises.map((exercise) => {
    const neck = exercise.id === NECK_CIRCUIT_IDS[0];
    const name = neck ? `${NECK_CIRCUIT.name} — круг из ${NECK_CIRCUIT_IDS.length} направлений` : exercise.name;
    return `
      <button class="exercise-choice" type="button" data-add-exercise="${exercise.id}" aria-label="${escapeHtml(`Добавить: ${name}`)}">
        <span>
          <strong>${escapeHtml(name)}</strong>
          <small>${exercise.sets} ${neck ? 'круга по' : '×'} ${escapeHtml(exercise.target)}</small>
        </span>
        <span class="add-icon" aria-hidden="true">+</span>
      </button>
    `;
  }).join('');
}

function renderExercise(exercise, draft) {
  exercise = getWorkoutExerciseSettings(draft, exercise.id);
  const weightText = exercise.weight ? ` · ${WEIGHT_LABELS[exercise.weight]}` : '';
  const setRows = draft.sets[exercise.id].map((result, index) => {
    const previous = findPreviousSet(store.history, draft.routineId, exercise.id, index);
    return renderSetRow(exercise, result, previous, index);
  }).join('');
  const hint = progressionHint(store.history, draft, exercise);

  return `
    <article class="exercise-card">
      <header class="exercise-header">
        <div>
          <h3>${escapeHtml(exercise.name)}</h3>
          <p class="exercise-meta">${draft.sets[exercise.id].length} × ${escapeHtml(exercise.target)}${escapeHtml(weightText)}</p>
          ${exercise.superset ? `<p class="superset-label">Суперсет ${escapeHtml(exercise.superset)} · подходы по очереди</p>` : ''}
          ${exercise.replaces ? '<p class="replacement-label">Замена на это занятие</p>' : ''}
          <button class="button button-quiet button-replace" type="button" data-replace-exercise="${exercise.id}" aria-label="${escapeHtml(`Заменить: ${exercise.name}`)}">Заменить</button>
        </div>
        <span class="rest-badge">Отдых ${formatTimer(exercise.restSeconds * 1000)}</span>
      </header>
      ${exercise.warmup ? `<section class="warmup" data-warmup-exercise="${exercise.id}" aria-label="${escapeHtml(`Разминка: ${exercise.name}`)}">${renderWarmupContent(exercise, draft)}</section>` : ''}
      <div class="sets">
        ${setRows}
        <button class="button button-add-set button-icon" type="button" data-add-set="${exercise.id}" aria-label="${escapeHtml(`Добавить подход: ${exercise.name}`)}"><span class="add-icon" aria-hidden="true">+</span> Добавить подход</button>
      </div>
      ${hint ? `<p class="progression-hint">${escapeHtml(hint)}</p>` : ''}
      ${renderExerciseHistory(store.history, draft.routineId, exercise)}
      ${renderTechnique(exercise)}
    </article>
  `;
}

function renderWarmupContent(exercise, draft) {
  const key = `${draft.id}:${exercise.id}`;
  const entered = warmupWeights.get(key);
  const recorded = draft.sets[exercise.id].find((set) => set.weight !== '' && set.weight !== undefined)?.weight;
  const previous = findPreviousSet(store.history, draft.routineId, exercise.id, 0)?.weight;
  const weight = entered !== undefined && entered !== '' ? entered : recorded ?? previous ?? '';
  const sets = calculateWarmupSets(weight);
  const signature = JSON.stringify(sets);
  if (warmupChecks.get(key)?.signature !== signature) {
    warmupChecks.set(key, { signature, checked: new Set() });
  }
  const { checked } = warmupChecks.get(key);
  const content = sets.length
    ? `<div class="warmup-sets">${sets.map((set, index) => `
        <label class="warmup-set">
          <input type="checkbox" data-warmup-set="${index}" ${checked.has(index) ? 'checked' : ''}>
          <span>${set.weightKg.toLocaleString('ru-RU')} кг × ${set.reps}</span>
        </label>
      `).join('')}</div>`
    : `<p class="warmup-hint">${Number(weight) > 0 && Number(weight) <= 20
      ? 'Рабочий вес не больше грифа — разминочных подходов нет'
      : 'Укажи рабочий вес для расчёта'}</p>`;
  return `<h4>Разминка</h4>${content}<p class="warmup-hint">Отдых между разминочными 30–60 с</p>`;
}

function resetWarmupState() {
  warmupChecks.clear();
  warmupWeights.clear();
}

function renderNeckCircuit(draft) {
  const circuit = getWorkoutNeckCircuit(draft);
  const directions = circuit.exerciseIds.map((id) => getExercise(draft, id));
  const roundCount = draft.sets[directions[0].id].length;
  return `
    <article class="exercise-card neck-circuit">
      <header class="exercise-header">
        <div>
          <h3>${escapeHtml(circuit.name)} — круг из ${directions.length} направлений</h3>
          <p class="exercise-meta">${escapeHtml(directions[0].target)} на направление</p>
        </div>
        <span class="rest-badge">Отдых ${formatTimer(directions.at(-1).restSeconds * 1000)}</span>
      </header>
      <div class="circuit-tabs" role="tablist" aria-label="Круги тренировки шеи">
        ${Array.from({ length: roundCount }, (_, index) => `
          <button id="neck-tab-${index}" type="button" role="tab" data-neck-round="${index}" aria-controls="neck-round-${index}" aria-selected="${index === activeNeckRound}" tabindex="${index === activeNeckRound ? 0 : -1}">
            Круг ${index + 1} · ${directions.filter((direction) => draft.sets[direction.id][index].status === 'done').length}/${directions.length}
          </button>
        `).join('')}
      </div>
      ${Array.from({ length: roundCount }, (_, index) => `
        <div id="neck-round-${index}" class="circuit-round" role="tabpanel" aria-labelledby="neck-tab-${index}" ${index === activeNeckRound ? '' : 'hidden'}>
          ${index >= (directions[0].optionalAfter ?? roundCount) ? `<p class="circuit-note">${escapeHtml(circuit.extraRoundNote)}</p>` : ''}
          <div class="sets">${directions.map((direction) => renderSetRow(
            direction,
            draft.sets[direction.id][index],
            findPreviousSet(store.history, draft.routineId, direction.id, index),
            index,
            true,
            circuit.exerciseIds
          )).join('')}</div>
        </div>
      `).join('')}
      <div class="sets">
        <button class="button button-add-set button-icon" type="button" data-add-set="${circuit.exerciseIds[0]}"><span class="add-icon" aria-hidden="true">+</span> Добавить круг</button>
      </div>
      ${directions.map((direction) => renderExerciseHistory(store.history, draft.routineId, direction)).join('')}
      <details class="technique">
        <summary>Техника</summary>
        <div class="technique-body">
          <p>${escapeHtml(circuit.technique)}</p>
        </div>
      </details>
    </article>
  `;
}

function selectNeckRound(index) {
  activeNeckRound = index;
  elements.exerciseList.querySelectorAll('[data-neck-round]').forEach((tab) => {
    const selected = Number(tab.dataset.neckRound) === index;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  });
  elements.exerciseList.querySelectorAll('.circuit-round').forEach((panel, panelIndex) => {
    panel.hidden = panelIndex !== index;
  });
}

function renderSetRow(exercise, result, previous, index, inCircuit = false, circuitIds = [], editing = false) {
  const prefix = `${editing ? 'edit-' : ''}${exercise.id}-${index}`;
  const inputs = inputDefinitions(exercise).map((input) => `
    <div class="input-wrap">
      <label for="${prefix}-${input.field}">${input.label}</label>
      <input
        id="${prefix}-${input.field}"
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

  const optional = exercise.optionalAfter !== undefined && index >= exercise.optionalAfter;
  const hint = renderSetHint(exercise, result, previous);

  return `
    <div class="set-row">
      <div class="set-number ${optional ? 'optional-label' : ''}" title="${inCircuit ? escapeHtml(exercise.name) : optional ? 'По самочувствию' : `Подход ${index + 1}`}">${inCircuit ? circuitIds.indexOf(exercise.id) + 1 : index + 1}</div>
      <div class="set-content">
        ${inCircuit ? `<h4 class="circuit-direction">${escapeHtml(exercise.name)}</h4>` : ''}
        <div class="set-inputs" style="--input-count: ${inputDefinitions(exercise).length}">${inputs}</div>
        <div class="set-controls">
          <button class="status-button" type="button" data-status="done" data-exercise-id="${exercise.id}" data-set-index="${index}" aria-pressed="${result.status === 'done'}">Готово</button>
          <button class="status-button" type="button" data-status="skipped" data-exercise-id="${exercise.id}" data-set-index="${index}" aria-pressed="${result.status === 'skipped'}">Пропуск</button>
        </div>
        ${optional && !inCircuit ? '<p class="previous-hint">По самочувствию.</p>' : ''}
        ${editing ? '' : hint}
        <details class="set-effort" ${result.rir !== undefined && result.rir !== '' || result.note ? 'open' : ''}>
          <summary>${exercise.kind === 'seconds' ? 'Заметка' : 'RIR и заметка'}</summary>
          ${exercise.kind === 'seconds' ? '' : `
            <div class="input-wrap">
              <label for="${prefix}-rir">RIR: запас повторов, 0–10</label>
              <input id="${prefix}-rir" type="number" min="0" max="10" step="1" inputmode="numeric" value="${escapeHtml(result.rir ?? '')}" data-exercise-id="${exercise.id}" data-set-index="${index}" data-field="rir" aria-label="${escapeHtml(`${exercise.name}, подход ${index + 1}, запас повторов`)}">
            </div>
            <p class="fine-print">0 — больше повторов не осталось; 2 — мог бы сделать ещё два. Поле необязательное и не копируется из прошлого занятия.</p>
          `}
          <label class="note-field" for="${prefix}-note">Заметка к подходу<textarea id="${prefix}-note" rows="2" maxlength="2000" data-exercise-id="${exercise.id}" data-set-index="${index}" data-field="note">${escapeHtml(result.note || '')}</textarea></label>
        </details>
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
    ? `<img class="technique-image" src="${escapeHtml(exercise.image)}" alt="${escapeHtml(exercise.name)}" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  const note = exercise.note ? `<p>${escapeHtml(exercise.note)}</p>` : '';
  const links = exercise.links?.length
    ? `<p>${exercise.links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.label)}</a>`).join(' · ')}</p>`
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
  resetWarmupState();
  activeNeckRound = 0;
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
  resetWarmupState();
  activeNeckRound = 0;
  const saved = persist();
  renderWorkout();
  showToast(saved ? 'Создан новый черновик' : 'Новый черновик не сохранён на устройстве');
}

function renderHistory() {
  const workouts = [...store.history].sort((a, b) => b.finishedAt - a.finishedAt);
  elements.historyEmpty.hidden = workouts.length > 0;
  elements.exportAll.disabled = workouts.length === 0;
  elements.historyList.innerHTML = workouts.map((workout) => {
    const routine = getWorkoutRoutine(workout);
    const statuses = countStatuses(workout);
    const exercises = getWorkoutExercises(workout).map((exercise) => {
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
          ${workout.note ? `<p class="entry-note">${escapeHtml(workout.note)}</p>` : ''}
          ${exercises}
          <div class="history-actions">
            <button class="button button-quiet" type="button" data-edit-id="${escapeHtml(workout.id)}">Редактировать</button>
            <button class="button button-danger" type="button" data-delete-id="${escapeHtml(workout.id)}">Удалить</button>
            <button class="button button-quiet" type="button" data-export-id="${escapeHtml(workout.id)}">Скачать Markdown</button>
          </div>
        </div>
      </details>
    `;
  }).join('');
}

function renderSpecialHistory(routineId) {
  const entries = store.specialHistory.filter((entry) => entry.routineId === routineId);
  document.querySelector(`#${routineId}-empty`).hidden = entries.length > 0;
  document.querySelector(`#${routineId}-history`).innerHTML = entries
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((entry) => `<li>${escapeHtml(formatLocalDateTime(entry.finishedAt))}</li>`)
    .join('');
}

function renderProgram() {
  const schedule = PROGRAM_SCHEDULE.map((entry) => {
    if (!entry.routineId) return `${entry.day} — ${entry.activity}`;
    const routine = PROGRAM.find((item) => item.id === entry.routineId);
    return `${routine.day} — ${routine.name}`;
  }).join(' · ');
  elements.programIntro.innerHTML = [schedule, ...PROGRAM_GUIDANCE]
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  elements.programList.innerHTML = PROGRAM.map((routine) => `
    <details class="program-day">
      <summary>${escapeHtml(`${routine.weekday} · ${routine.name}`)}</summary>
      <div class="program-exercises">
        ${routine.exercises.map((exercise) => `
          <article class="program-exercise">
            <h3>${escapeHtml(exercise.name)}</h3>
            <p class="exercise-meta">${exercise.sets} × ${escapeHtml(exercise.target)} · ${programRestLabel(exercise)}${exercise.weight ? ` · ${escapeHtml(WEIGHT_LABELS[exercise.weight])}` : ''}</p>
            ${renderTechnique(exercise)}
          </article>
        `).join('')}
      </div>
    </details>
  `).join('');
  bindOptionalImageErrors(elements.programList);
}

function programRestLabel(exercise) {
  if (exercise.id === NECK_CIRCUIT_IDS.at(-1)) return `отдых ${formatTimer(exercise.restSeconds * 1000)} после круга`;
  if (NECK_CIRCUIT_IDS.includes(exercise.id)) return 'без паузы до следующего направления';
  return `отдых ${escapeHtml(exercise.rest)} · авто ${formatTimer(exercise.restSeconds * 1000)}`;
}

function showView(viewName) {
  const special = viewName === 'hands' || viewName === 'foot-ankle';
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== `view-${viewName}`;
  });
  elements.bottomNav.hidden = special;
  elements.areaLabel.textContent = special ? 'Восстановление' : 'Силовые тренировки';
  elements.areaMenu.querySelectorAll('[data-area]').forEach((button) => {
    if (button.dataset.view === viewName) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  setAreaMenuOpen(false);
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
  if (storageReadError) { showStorageError(`${storageReadError}. Исходные данные не перезаписаны. Восстановите JSON-бэкап через меню.`); return false; }
  const result = saveStore(storage, store);
  if (result.ok) elements.storageWarning.hidden = true;
  else showStorageError(result.error);
  return result.ok;
}

function commitStore(next) {
  if (storageReadError) { showStorageError(storageReadError); return false; }
  const result = saveStore(storage, next);
  if (!result.ok) { showStorageError(result.error); return false; }
  store = next;
  resetWarmupState();
  elements.storageWarning.hidden = true;
  renderHistory();
  renderWorkout();
  return true;
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
  downloadFile(content, filename, 'text/markdown;charset=utf-8');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
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
