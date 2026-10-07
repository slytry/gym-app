import { getWorkoutExercises, getWorkoutRoutine } from './program.js?v=19';
import { beginWorkoutEdit, saveWorkoutEdit, getExerciseHistory } from './history.js?v=21';
import { localDateKey } from './state.js?v=21';
import { formatLocalDateTime, formatSetResult } from './export.js?v=20';
import { escapeHtml } from './html.js?v=20';

export function renderExerciseHistory(history, routineId, exercise) {
  const entries = getExerciseHistory(history, routineId, exercise.id);
  const content = entries.length ? entries.map(({ workout, sets, exercise: savedExercise }) => `
    <li>
      <strong>${escapeHtml(formatLocalDateTime(workout.finishedAt))}</strong>
      <ul>${sets.map((set, index) => `<li>${index + 1}: ${escapeHtml(formatSetResult(set, savedExercise))}</li>`).join('')}</ul>
      ${workout.note ? `<p class="entry-note">${escapeHtml(workout.note)}</p>` : ''}
    </li>
  `).join('') : '<li>Выполненных подходов пока нет.</li>';
  return `
    <details class="exercise-history">
      <summary>История: ${escapeHtml(exercise.name)}</summary>
      <div class="technique-body">
        <p>Последние 10 занятий этой программы. Пропуски не считаются выполненными подходами.</p>
        <ol>${content}</ol>
      </div>
    </details>
  `;
}

export function bindHistoryEditor(dialog, getStore, commitStore, renderSetRow) {
  let editing = null;
  const form = dialog.querySelector('form');
  const content = dialog.querySelector('#history-editor-content');
  const error = dialog.querySelector('#history-editor-error');

  dialog.querySelector('[data-cancel-edit]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { editing = null; });
  content.addEventListener('input', (event) => {
    const input = event.target.closest('[data-exercise-id][data-set-index][data-field]');
    if (!input || !editing) return;
    const set = editing.sets[input.dataset.exerciseId][Number(input.dataset.setIndex)];
    set[input.dataset.field] = input.value;
    set.prefilled = false;
    set.edited = true;
  });
  content.addEventListener('click', (event) => {
    const button = event.target.closest('.status-button');
    if (!button || !editing) return;
    const set = editing.sets[button.dataset.exerciseId][Number(button.dataset.setIndex)];
    set.status = set.status === button.dataset.status ? 'pending' : button.dataset.status;
    button.closest('.set-controls').querySelectorAll('.status-button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.status === set.status));
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editing || !form.reportValidity()) return;
    const startedAt = form.elements.startedAt.value;
    const finishedAt = form.elements.finishedAt.value;
    if (startedAt !== localInputTime(editing.startedAt)) {
      editing.startedAt = new Date(startedAt).getTime();
      editing.date = localDateKey(editing.startedAt);
    }
    if (finishedAt !== localInputTime(editing.finishedAt)) editing.finishedAt = new Date(finishedAt).getTime();
    editing.note = form.elements.note.value;
    try {
      const next = saveWorkoutEdit(getStore(), editing);
      if (!commitStore(next)) throw new Error('Не удалось сохранить. Изменения остаются в редакторе.');
      dialog.close();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    }
  });

  return {
    open(id) {
      editing = beginWorkoutEdit(getStore().history, id);
      error.hidden = true;
      dialog.querySelector('#history-editor-heading').textContent = `Редактировать: ${getWorkoutRoutine(editing).name}`;
      content.innerHTML = `
        <div class="edit-dates">
          <div class="input-wrap"><label for="edit-start">Начало</label><input id="edit-start" name="startedAt" type="datetime-local" step="1" required value="${localInputTime(editing.startedAt)}"></div>
          <div class="input-wrap"><label for="edit-end">Завершение</label><input id="edit-end" name="finishedAt" type="datetime-local" step="1" required value="${localInputTime(editing.finishedAt)}"></div>
        </div>
        <label class="note-field" for="edit-note">Заметка к тренировке<textarea id="edit-note" name="note" maxlength="2000" rows="3">${escapeHtml(editing.note || '')}</textarea></label>
        ${getWorkoutExercises(editing).map((exercise) => `
          <section class="history-exercise">
            <h3>${escapeHtml(exercise.name)}</h3>
            <div class="sets">${editing.sets[exercise.id].map((set, index) => renderSetRow(exercise, set, null, index, false, [], true)).join('')}</div>
          </section>
        `).join('')}
      `;
      dialog.showModal();
    }
  };
}

function localInputTime(timestamp) {
  const date = new Date(timestamp);
  return `${localDateKey(timestamp)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}
