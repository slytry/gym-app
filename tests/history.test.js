import test from 'node:test';
import assert from 'node:assert/strict';
import { beginWorkoutEdit, saveWorkoutEdit, deleteWorkout, getExerciseHistory } from '../history.js';
import { createInitialStore, createWorkout, finishWorkout, findPreviousSet, startNewDraft, workoutHasProgress } from '../state.js';

function session(id, start, end, weight = '80') {
  const workout = createWorkout('legs-a', start, id);
  workout.sets.squat[0] = { status: 'done', weight, reps: '5' };
  return finishWorkout(workout, end);
}

test('отмена правок сохраняет оригинал, сохранение меняет предзаполнение, но не текущий черновик и снимок плана', () => {
  const store = createInitialStore();
  store.history.push(session('old', 100, 200));
  const draft = startNewDraft(store, 'legs-a', 300);
  const editing = beginWorkoutEdit(store.history, 'old');
  editing.sets.squat[0].weight = '82.5';
  editing.sets.squat[0].rir = '2';
  editing.note = 'Исправлено';
  assert.equal(store.history[0].sets.squat[0].weight, '80');
  const saved = saveWorkoutEdit(store, editing, 400);
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].id, 'old');
  assert.deepEqual(saved.history[0].plan, store.history[0].plan);
  assert.equal(findPreviousSet(saved.history, 'legs-a', 'squat', 0).weight, '82.5');
  assert.equal(startNewDraft(saved, 'legs-a', 500).sets.squat[0].weight, '82.5');
  assert.equal(draft.sets.squat[0].weight, '80');
  assert.equal(store.history[0].note, undefined);
});

test('удаление тренировки меняет будущую историю, не затрагивая черновики и специализированные занятия', () => {
  const store = createInitialStore();
  store.history.push(session('old', 100, 200), session('new', 300, 400, '90'));
  const saved = deleteWorkout(store, 'new');
  assert.equal(findPreviousSet(saved.history, 'legs-a', 'squat', 0).weight, '80');
  assert.equal(store.history.length, 2);
  assert.strictEqual(saved.drafts, store.drafts);
  assert.strictEqual(saved.specialHistory, store.specialHistory);
  assert.throws(() => deleteWorkout(store, 'missing'), /не найдена/i);
});

test('история упражнения разделяет программы, пропускает незавершённые занятия и сортирует последние записи', () => {
  const older = session('old', 100, 200);
  const newer = session('new', 300, 400, '90');
  const skipped = session('skipped', 500, 600);
  skipped.sets.squat[0].status = 'skipped';
  const other = session('other', 700, 800);
  other.routineId = 'legs-b';
  assert.deepEqual(getExerciseHistory([older, skipped, other, newer], 'legs-a', 'squat').map((item) => item.workout.id), ['new', 'old']);
  assert.equal(getExerciseHistory([older, newer], 'legs-a', 'squat', 1)[0].sets[0].weight, '90');
});

test('редактор отклоняет невозможную дату и неверный RIR, не заменяет план из редактируемого объекта', () => {
  const store = createInitialStore();
  store.history.push(session('old', 100, 200));
  const editing = beginWorkoutEdit(store.history, 'old');
  editing.plan.name = 'Подмена';
  assert.equal(saveWorkoutEdit(store, editing).history[0].plan.name, store.history[0].plan.name);
  editing.date = '2026-02-31';
  assert.throws(() => saveWorkoutEdit(store, editing), /дат/i);
  editing.date = store.history[0].date;
  editing.sets.squat[0].rir = 'abc';
  assert.throws(() => saveWorkoutEdit(store, editing), /RIR/);
});

test('заметка считается изменением черновика, RIR и заметки не копируются в новое занятие', () => {
  const workout = createWorkout('legs-a', 100, 'old');
  workout.note = 'Самочувствие';
  assert.equal(workoutHasProgress(workout), true);
  Object.assign(workout.sets.squat[0], { status: 'done', weight: '80', reps: '5', rir: '2', note: 'Техника' });
  const next = createWorkout('legs-a', 300, 'next', [finishWorkout(workout, 200)]);
  assert.equal(next.sets.squat[0].weight, '80');
  assert.equal(next.sets.squat[0].rir, undefined);
  assert.equal(next.sets.squat[0].note, undefined);
  assert.equal(next.note, undefined);
});
