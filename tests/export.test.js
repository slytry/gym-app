import test from 'node:test';
import assert from 'node:assert/strict';

import { workoutToMarkdown, workoutsToMarkdown } from '../export.js';
import { createWorkout, finishWorkout } from '../state.js';

test('экспортирует результаты, пропуски, незавершённые подходы и единицы веса', () => {
  const workout = finishWorkout(createWorkout('back-a', 1_700_000_000_000, 'export'), 1_700_000_600_000);
  workout.sets['weighted-pullup'][0] = { status: 'done', weight: '20', reps: '5' };
  workout.sets['weighted-pullup'][1].status = 'skipped';
  workout.sets['dumbbell-bench'][0] = { status: 'done', weight: '24', reps: '8' };
  workout.sets['neck-front'][0] = { status: 'done', weight: '', seconds: '12' };

  const markdown = workoutToMarkdown(workout);
  assert.match(markdown, /20 \+кг к весу тела × 5 повт\./);
  assert.match(markdown, /24 кг на одну гантель × 8 повт\./);
  assert.match(markdown, /12 с/);
  assert.match(markdown, /пропущен/);
  assert.match(markdown, /не завершён/);
  assert.match(markdown, /для гантелей вес указан на одну гантель/);
});

test('общий экспорт сортирует тренировки по времени', () => {
  const later = finishWorkout(createWorkout('back-b', 300, 'later'), 400);
  const earlier = finishWorkout(createWorkout('legs-a', 100, 'earlier'), 200);
  const markdown = workoutsToMarkdown([later, earlier]);

  assert.ok(markdown.indexOf('Ноги А') < markdown.indexOf('Спина Б'));
  assert.match(markdown, /^# История тренировок/);
});
