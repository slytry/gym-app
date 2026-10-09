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
  assert.match(progressionHint([previous], draft, draft.plan.exercises.find((item) => item.id === 'squat')), /повышение веса/i);
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
    assert.doesNotMatch(progressionHint([previous], draft, draft.plan.exercises.find((item) => item.id === 'squat')), /рассмотри повышение веса/i);
  }
});

test('подсказка не использует другую программу, будущую тренировку, прежний диапазон и упражнения шеи', () => {
  const previous = completed();
  const draft = createWorkout('legs-a', 300, 'next');
  const exercise = draft.plan.exercises.find((item) => item.id === 'squat');
  previous.routineId = 'legs-b';
  assert.equal(progressionHint([previous], draft, exercise), '');
  previous.routineId = 'legs-a';
  previous.finishedAt = 400;
  assert.equal(progressionHint([previous], draft, exercise), '');
  previous.finishedAt = 200;
  exercise.target = '6–8 повторов';
  assert.match(progressionHint([previous], draft, exercise), /план изменился/i);
  assert.equal(progressionHint([previous], draft, draft.plan.exercises.find((item) => item.id === 'knee-to-wall')), '');
});

test('фиксированные 4×5 и 4×3 требуют все четыре подхода и показывают шаг основных движений', () => {
  for (const [routineId, id, reps, increment] of [
    ['legs-a', 'squat', '5', '2,5–5'], ['back-a', 'bench-press', '5', '2,5'], ['legs-b', 'deadlift', '3', '2,5–5']
  ]) {
    const previous = createWorkout(routineId, 100, `previous-${id}`);
    previous.sets[id].forEach((set) => Object.assign(set, { status: 'done', weight: '80', reps, rir: '2' }));
    const completed = finishWorkout(previous, 200);
    const draft = createWorkout(routineId, 300, `next-${id}`);
    const exercise = draft.plan.exercises.find((item) => item.id === id);
    const hint = progressionHint([completed], draft, exercise);
    assert.ok(hint.includes(`повышение веса на ${increment} кг`));
    assert.match(hint, /целевого числа повторов/);
    completed.sets[id][3].reps = String(Number(reps) - 1);
    assert.doesNotMatch(progressionHint([completed], draft, exercise), /Рассмотри повышение/);
  }
});

test('диапазон 6–10 использует верхнюю границу, а изменение прежних 3×3 не даёт совет повысить вес', () => {
  const previous = createWorkout('back-a', 100, 'pullup');
  previous.sets['weighted-pullup'].forEach((set) => Object.assign(set, { status: 'done', weight: '0', reps: '10', rir: '2' }));
  const completed = finishWorkout(previous, 200);
  const draft = createWorkout('back-a', 300, 'next');
  const exercise = draft.plan.exercises.find((item) => item.id === 'weighted-pullup');
  assert.match(progressionHint([completed], draft, exercise), /Рассмотри повышение/);
  completed.sets['weighted-pullup'][2].reps = '9';
  assert.doesNotMatch(progressionHint([completed], draft, exercise), /Рассмотри повышение/);

  const deadlift = createWorkout('legs-b', 100, 'old');
  deadlift.plan.exercises[0].sets = 3;
  deadlift.sets.deadlift.pop();
  const next = createWorkout('legs-b', 300, 'next-deadlift');
  assert.match(progressionHint([finishWorkout(deadlift, 200)], next, next.plan.exercises[0]), /План изменился/);
});

test('необязательные и дополнительные подходы не мешают подсказке после всех обязательных', () => {
  const previous = completed();
  previous.plan.exercises.find((item) => item.id === 'squat').optionalAfter = 2;
  previous.sets.squat[2].status = 'skipped';
  previous.sets.squat.push({ status: 'pending', weight: '', reps: '' });
  const draft = createWorkout('legs-a', 300, 'next');
  draft.plan.exercises.find((item) => item.id === 'squat').optionalAfter = 2;
  assert.match(progressionHint([previous], draft, draft.plan.exercises.find((item) => item.id === 'squat')), /Рассмотри повышение веса/);
});
