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

test('экспорт пятницы содержит новый план и результат дополнительного жима', () => {
  const workout = finishWorkout(createWorkout('back-b', 100, 'friday'), 200);
  workout.sets['dumbbell-bench'][0] = { status: 'done', weight: '20', reps: '10' };

  const markdown = workoutToMarkdown(workout);
  assert.match(markdown, /План: 3 × 6–10 повторов/);
  assert.match(markdown, /План: 2 × 6–10 повторов/);
  assert.match(markdown, /## Жим гантелей лёжа\nПлан: 2 × 8–12 повторов/);
  assert.match(markdown, /20 кг на одну гантель × 10 повт\./);
  assert.doesNotMatch(markdown, /Шраги|Удержание тяжёлых гантелей/);
});

test('экспорт старой пятницы сохраняет шраги и удержания без добавления нового жима', () => {
  const workout = finishWorkout(createWorkout('back-b', 100, 'old-friday'), 200);
  delete workout.sets['dumbbell-bench'];
  workout.sets.shrug = [{ status: 'done', weight: '24', reps: '10' }, { status: 'skipped' }];
  workout.sets['dumbbell-hold'] = [{ status: 'done', weight: '30', seconds: '25' }, { status: 'pending' }];

  const markdown = workoutToMarkdown(workout);
  assert.match(markdown, /## Шраги с гантелями\nПлан: 2 × 8–10 повторов/);
  assert.match(markdown, /24 кг на одну гантель × 10 повт\./);
  assert.match(markdown, /## Удержание тяжёлых гантелей стоя\nПлан: 2 × 20–30 секунд/);
  assert.match(markdown, /30 кг на одну гантель × 25 с/);
  assert.doesNotMatch(markdown, /Жим гантелей лёжа/);
});

test('экспорт старого подъёма с гантелью не смешивается с упражнением в Смите', () => {
  const workout = createWorkout('legs-a', 100, 'legacy');
  workout.sets['single-calf-raise'] = [
    { status: 'done', weight: '12', leftReps: '10', rightReps: '9' },
    { status: 'skipped' }
  ];

  const markdown = workoutToMarkdown(workout);
  assert.match(markdown, /Подъём на носки в тренажёре Смита/);
  assert.match(markdown, /Подъём на носок одной ноги с гантелью/);
  assert.match(markdown, /12 кг на одну гантель × левая 10 повт\. × правая 9 повт\./);
});

test('Markdown сохраняет RIR 0, заметку к тренировке и заметки незавершённых и пропущенных подходов', () => {
  const workout = createWorkout('legs-a', 100, 'notes');
  workout.note = 'Утром\nСпокойный темп';
  Object.assign(workout.sets.squat[0], { status: 'done', weight: '80', reps: '5', rir: '0', note: 'Последний повтор тяжёлый' });
  Object.assign(workout.sets.squat[1], { status: 'skipped', note: 'Нет времени' });
  workout.sets.squat[2].note = 'Не начинал';
  const markdown = workoutToMarkdown(workout);
  assert.match(markdown, /> Утром\n> Спокойный темп/);
  assert.match(markdown, /RIR 0 · заметка: Последний повтор тяжёлый/);
  assert.match(markdown, /пропущен · заметка: Нет времени/);
  assert.match(markdown, /не завершён · заметка: Не начинал/);
});
