import { WEIGHT_LABELS, getRoutine } from './program.js';

export function workoutToMarkdown(workout) {
  const routine = getRoutine(workout.routineId);
  const lines = [
    `# ${routine.name} — ${workout.date}`,
    '',
    `- Начало: ${formatLocalDateTime(workout.startedAt)}`,
    `- Завершение: ${workout.finishedAt ? formatLocalDateTime(workout.finishedAt) : 'не завершена'}`,
    '- Единицы: для гантелей вес указан на одну гантель; для подтягиваний — только дополнительный вес.',
    ''
  ];

  for (const exercise of routine.exercises) {
    lines.push(`## ${exercise.name}`);
    lines.push(`План: ${exercise.sets} × ${exercise.target}${exercise.optionalAfter ? ' (второй круг по самочувствию)' : ''}.`);
    if (exercise.weight) lines.push(`Вес: ${WEIGHT_LABELS[exercise.weight]}.`);
    lines.push('');

    const results = workout.sets[exercise.id] || [];
    for (let index = 0; index < exercise.sets; index += 1) {
      lines.push(`- Подход ${index + 1}: ${formatSetResult(results[index], exercise)}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function workoutsToMarkdown(workouts) {
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  const header = '# История тренировок\n\n';
  return header + sorted.map(workoutToMarkdown).join('\n---\n\n');
}

export function formatSetResult(set, exercise) {
  if (!set || set.status === 'pending') return 'не завершён';
  if (set.status === 'skipped') return 'пропущен';

  const values = [];
  if (exercise.weight && set.weight !== '') values.push(`${set.weight} ${WEIGHT_LABELS[exercise.weight]}`);
  if (exercise.kind === 'reps' && set.reps !== '') values.push(`${set.reps} повт.`);
  if (exercise.kind === 'sides') {
    if (set.leftReps !== '') values.push(`левая ${set.leftReps} повт.`);
    if (set.rightReps !== '') values.push(`правая ${set.rightReps} повт.`);
  }
  if (exercise.kind === 'seconds' && set.seconds !== '') values.push(`${set.seconds} с`);

  return values.length ? values.join(' × ') : 'выполнен, результат не записан';
}

export function formatLocalDateTime(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}
