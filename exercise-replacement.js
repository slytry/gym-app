import { NECK_CIRCUIT_IDS, getAvailableExercises, getExercise } from './program.js?v=19';
import { getExerciseReplacementError, replaceWorkoutExercise } from './state.js?v=21';
import { formatTimer } from './timer.js?v=10';
import { escapeHtml } from './html.js?v=20';

export function bindExerciseReplacement(dialog, getStore, commitStore, onReplaced) {
  let replacing = null;
  const heading = dialog.querySelector('#exercise-replacement-heading');
  const choices = dialog.querySelector('#exercise-replacement-choices');
  const error = dialog.querySelector('#exercise-replacement-error');
  const empty = dialog.querySelector('#exercise-replacement-empty');

  dialog.querySelector('[data-cancel-replacement]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { replacing = null; });
  choices.addEventListener('click', (event) => {
    const button = event.target.closest('[data-replacement-id]');
    if (!button || !replacing) return;
    try {
      const store = getStore();
      if (store.selectedRoutineId !== replacing.routineId || store.drafts[replacing.routineId]?.id !== replacing.draftId) {
        throw new Error('Черновик изменился. Закройте окно и выберите упражнение заново.');
      }
      const next = structuredClone(store);
      replaceWorkoutExercise(next, replacing.routineId, replacing.exerciseId, button.dataset.replacementId);
      if (!commitStore(next)) throw new Error('Не удалось сохранить замену. Исходное упражнение оставлено без изменений.');
      const replacementId = button.dataset.replacementId;
      dialog.close();
      document.querySelector(`#exercise-list [data-replace-exercise="${replacementId}"]`).focus();
      onReplaced();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    }
  });

  return {
    open(exerciseId) {
      const store = getStore();
      const routineId = store.selectedRoutineId;
      const draft = store.drafts[routineId];
      const blocked = getExerciseReplacementError(draft, exerciseId);
      replacing = { routineId, exerciseId, draftId: draft?.id };
      heading.textContent = `Заменить: ${draft ? getExercise(draft, exerciseId)?.name || 'упражнение' : 'упражнение'}`;
      error.textContent = blocked || '';
      error.hidden = !blocked;
      const exercises = blocked ? [] : getAvailableExercises(draft)
        .filter((exercise) => !NECK_CIRCUIT_IDS.includes(exercise.id));
      empty.hidden = !!blocked || exercises.length > 0;
      choices.innerHTML = exercises.map((exercise) => `
        <button class="exercise-choice" type="button" data-replacement-id="${exercise.id}" aria-label="${escapeHtml(`Заменить на: ${exercise.name}`)}">
          <span>
            <strong>${escapeHtml(exercise.name)}</strong>
            <small>${exercise.sets} × ${escapeHtml(exercise.target)} · отдых ${formatTimer(exercise.restSeconds * 1000)}</small>
          </span>
        </button>
      `).join('');
      dialog.showModal();
    }
  };
}
