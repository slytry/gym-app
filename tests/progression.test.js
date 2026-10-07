import test from 'node:test';
import assert from 'node:assert/strict';
import { progressionHint } from '../progression.js';
import { createWorkout, finishWorkout } from '../state.js';

function completed() {
  const workout = createWorkout('legs-a', 100, 'previous');
  workout.sets.squat.forEach((set) => Object.assign(set, { status: 'done', weight: '80', reps: '5', rir: '2' }));
  return finishWorkout(workout, 200);
}

test('подсказка предлагает повышение только после верхней границы всех рабочих подходов с запасом, не меняя вес', () => {
  const previous = completed();
  const draft = createWorkout('legs-a', 300, 'next', [previous]);
  const before = JSON.stringify({ previous, draft });
  assert.match(progressionHint([previous], draft, draft.plan.exercises[0]), /повышение веса/i);
  assert.equal(JSON.stringify({ previous, draft }), before);
});

test('пропуск, недобор, неизвестный RIR, отказ или разный вес не дают совета повысить нагрузку', () => {
  for (const change of [
    (set) => { set.status = 'skipped'; },
    (set) => { set.reps = '4'; },
    (set) => { set.reps = 'не записано'; },
    (set) => { delete set.rir; },
    (set) => { set.rir = '0'; },
    (set) => { set.weight = '75'; }
  ]) {
    const previous = completed();
    change(previous.sets.squat[1]);
    const draft = createWorkout('legs-a', 300, 'next');
    assert.doesNotMatch(progressionHint([previous], draft, draft.plan.exercises[0]), /рассмотри повышение веса/i);
  }
});

test('подсказка не использует другую программу, будущую тренировку, прежний диапазон и упражнения шеи', () => {
  const previous = completed();
  const draft = createWorkout('legs-a', 300, 'next');
  const exercise = draft.plan.exercises[0];
  previous.routineId = 'legs-b';
  assert.equal(progressionHint([previous], draft, exercise), '');
  previous.routineId = 'legs-a';
  previous.finishedAt = 400;
  assert.equal(progressionHint([previous], draft, exercise), '');
  previous.finishedAt = 200;
  exercise.target = '6–8 повторов';
  assert.match(progressionHint([previous], draft, exercise), /план изменился/i);
  const back = createWorkout('back-a', 300, 'neck');
  assert.equal(progressionHint([previous], back, back.plan.exercises.find((item) => item.id === 'neck-front')), '');
});

test('необязательные и дополнительные подходы не мешают подсказке после всех обязательных', () => {
  const previous = completed();
  previous.plan.exercises[0].optionalAfter = 2;
  previous.sets.squat[2].status = 'skipped';
  previous.sets.squat.push({ status: 'pending', weight: '', reps: '' });
  const draft = createWorkout('legs-a', 300, 'next');
  draft.plan.exercises[0].optionalAfter = 2;
  assert.match(progressionHint([previous], draft, draft.plan.exercises[0]), /Рассмотри повышение веса/);
});
