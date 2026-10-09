import definition from './program.json' with { type: 'json' };

export const WEIGHT_LABELS = {
  barbell: 'кг, общий вес',
  machine: 'кг тренажёра',
  dumbbell: 'кг на одну гантель',
  'per-hand': 'кг на одну руку',
  pullup: '+кг к весу тела'
};

validateProgram(definition);

export const PROGRAM = definition.routines;
export const PROGRAM_SCHEDULE = definition.schedule;
export const PROGRAM_GUIDANCE = definition.guidance;
export const NECK_CIRCUIT = definition.neckCircuit || { exerciseIds: [] };
export const NECK_CIRCUIT_IDS = NECK_CIRCUIT.exerciseIds;

export const EXERCISE_BANK = PROGRAM.flatMap((routine) => routine.exercises)
  .filter((exercise, index, exercises) => exercises.findIndex((item) => item.name === exercise.name) === index);

export function getRoutine(routineId) {
  return PROGRAM.find((routine) => routine.id === routineId) || PROGRAM[0];
}

export function getWorkoutRoutine(workout) {
  return workout.plan || getRoutine(workout.routineId);
}

export function getWorkoutNeckCircuit(workout) {
  return workout.plan?.neckCircuit || NECK_CIRCUIT;
}

export function getExercise(workout, exerciseId) {
  const exercises = workout.plan
    ? [...workout.plan.exercises, ...(workout.addedExercises || [])]
    : [...getRoutine(workout.routineId).exercises, ...EXERCISE_BANK];
  return exercises.find((exercise) => exercise.id === exerciseId)
    || definition.archivedExercises.find((exercise) => exercise.id === exerciseId);
}

export function getActiveWorkoutExercises(workout) {
  return Object.keys(workout.sets)
    .map((id) => getExercise(workout, id))
    .filter(Boolean);
}

// Resolve labels and rest for this composition without changing the saved plan.
// A replacement's `replaces` id identifies the slot it occupies in a pair.
export function getWorkoutExerciseSettings(workout, exerciseId) {
  const exercise = getExercise(workout, exerciseId);
  if (!exercise) return exercise;
  const active = getActiveWorkoutExercises(workout);
  const slot = (item) => item.replaces
    ? getRoutine(workout.routineId).exercises.find((source) => source.id === item.replaces)
      || EXERCISE_BANK.find((source) => source.id === item.replaces)
      || definition.archivedExercises.find((source) => source.id === item.replaces)
    : item;
  const source = slot(exercise);
  if (!exercise.superset && !source?.superset) return exercise;

  const slots = new Map();
  for (const item of active) {
    const original = slot(item);
    // Re-adding an original exercise must not steal its replacement's pair slot.
    if (original && !slots.has(original.id)) slots.set(original.id, { exercise: item, source: original });
  }
  const pair = slots.get(source?.id)?.exercise.id === exerciseId ? findSupersetPair(workout, source) : null;
  const partnerSlot = pair && slots.get(pair.partner.id);
  const partner = partnerSlot && partnerSlot.source.superset === pair.partner.superset ? partnerSlot.exercise : null;
  const resolved = { ...exercise };
  // Remove only the pairing instruction, keeping weight/distance/technique notes.
  const note = exercise.note?.replace(/^Суперсет\s+с\s+«[^»]+»:[^.]*\.\s*/u, '') || '';

  if (partner) {
    const second = source.superset.endsWith('2') ? source : partnerSlot.source;
    resolved.superset = source.superset;
    resolved.restSeconds = source.superset.endsWith('1') ? 15 : second.restSeconds;
    resolved.note = `Суперсет с\u00a0«${partner.name}»: подходы по очереди, отдых после пары.${note ? ` ${note}` : ''}`;
  } else {
    delete resolved.superset;
    const nativePair = findSupersetPair(workout, exercise);
    resolved.restSeconds = nativePair?.second.restSeconds ?? Math.max(90, exercise.restSeconds);
    if (note) resolved.note = note;
    else delete resolved.note;
  }
  resolved.rest = `${resolved.restSeconds} с`;
  return resolved;
}

function findSupersetPair(workout, exercise) {
  if (!exercise?.superset) return null;
  const opposite = `${exercise.superset[0]}${exercise.superset.endsWith('1') ? '2' : '1'}`;
  // Group labels repeat across days; match the original exercise id within a plan.
  for (const plan of [getWorkoutRoutine(workout).exercises, ...PROGRAM.map((routine) => routine.exercises)]) {
    const exercises = plan.filter((item) => !item.replaces);
    if (!exercises.some((item) => item.id === exercise.id && item.superset === exercise.superset)) continue;
    const partner = exercises.find((item) => item.superset === opposite);
    if (partner) return { partner, second: exercise.superset.endsWith('2') ? exercise : partner };
  }
  return null;
}

export function getAvailableExercises(workout) {
  const names = new Set(getActiveWorkoutExercises(workout).map((exercise) => exercise.name));
  return EXERCISE_BANK
    .filter((exercise) => !workout.sets[exercise.id] && !names.has(exercise.name)
      && (!NECK_CIRCUIT_IDS.includes(exercise.id) || exercise.id === NECK_CIRCUIT_IDS[0]))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function getWorkoutExercises(workout) {
  const active = getActiveWorkoutExercises(workout);
  const ids = new Set(active.map((exercise) => exercise.id));
  return [
    ...active,
    ...definition.archivedExercises.filter((exercise) => workout.sets[exercise.id] && !ids.has(exercise.id))
  ];
}

export function validateProgram(data) {
  check(Array.isArray(data?.routines) && data.routines.length > 0, 'routines', 'нужна хотя бы одна тренировка');
  check(Array.isArray(data.guidance) && data.guidance.every(isText), 'guidance', 'нужен список рекомендаций');
  check(Array.isArray(data.archivedExercises), 'archivedExercises', 'нужен список архивных упражнений');

  const routineIds = new Set();
  const exercisesById = new Map();
  for (const [index, routine] of data.routines.entries()) {
    const path = `routines[${index}]`;
    check(routine && typeof routine === 'object', path, 'нужен объект тренировки');
    check(isId(routine.id) && !routineIds.has(routine.id), path, 'id тренировки должен быть уникальным');
    routineIds.add(routine.id);
    check([routine.day, routine.weekday, routine.name].every(isText), path, 'нужны day, weekday и name');
    check(Array.isArray(routine.exercises) && routine.exercises.length > 0, path, 'нужен список упражнений');
    const ids = new Set();
    for (const [exerciseIndex, exercise] of routine.exercises.entries()) {
      const exercisePath = `${path}.exercises[${exerciseIndex}]`;
      validateExercise(exercise, exercisePath, true);
      check(!ids.has(exercise.id), exercisePath, 'упражнение повторяется в одной тренировке');
      ids.add(exercise.id);
      const previous = exercisesById.get(exercise.id);
      check(!previous || ['name', 'kind', 'weight'].every((field) => previous[field] === exercise[field]),
        exercisePath, 'одноимённый id должен обозначать одно упражнение');
      exercisesById.set(exercise.id, exercise);
    }
  }

  const archiveIds = new Set();
  for (const [index, exercise] of data.archivedExercises.entries()) {
    const path = `archivedExercises[${index}]`;
    validateExercise(exercise, path, false);
    check(!archiveIds.has(exercise.id) && !exercisesById.has(exercise.id), path, 'архивный id должен быть уникальным');
    archiveIds.add(exercise.id);
  }

  check(Array.isArray(data.schedule) && data.schedule.length > 0, 'schedule', 'нужно расписание');
  const scheduled = new Set();
  const days = new Set();
  for (const [index, entry] of data.schedule.entries()) {
    const path = `schedule[${index}]`;
    check(entry && typeof entry === 'object', path, 'нужен объект расписания');
    let day;
    if (entry.routineId !== undefined) {
      check(routineIds.has(entry.routineId) && !scheduled.has(entry.routineId), path, 'неизвестная или повторная тренировка');
      check(entry.day === undefined && entry.activity === undefined, path, 'день берётся из тренировки');
      scheduled.add(entry.routineId);
      day = data.routines.find((routine) => routine.id === entry.routineId).day;
    } else {
      check(isText(entry.day) && isText(entry.activity), path, 'нужны day и activity');
      day = entry.day;
    }
    check(!days.has(day), path, 'день повторяется в расписании');
    days.add(day);
  }
  check(scheduled.size === routineIds.size, 'schedule', 'каждая тренировка должна быть в расписании');

  const circuit = data.neckCircuit;
  if (circuit === null) return;
  check(isText(circuit?.name) && isText(circuit.extraRoundNote) && isText(circuit.technique),
    'neckCircuit', 'нужны name, extraRoundNote и technique');
  check(Array.isArray(circuit.exerciseIds) && circuit.exerciseIds.length > 1
    && new Set(circuit.exerciseIds).size === circuit.exerciseIds.length,
    'neckCircuit.exerciseIds', 'нужны уникальные направления');
  check(circuit.exerciseIds.every((id) => exercisesById.get(id)?.kind === 'seconds'),
    'neckCircuit.exerciseIds', 'направления должны ссылаться на упражнения с секундными подходами');
  for (const routine of data.routines) {
    const directions = circuit.exerciseIds.map((id) => routine.exercises.find((exercise) => exercise.id === id));
    if (!directions.some(Boolean)) continue;
    check(directions.every((exercise) => exercise && exercise.sets === directions[0]?.sets
      && exercise.target === directions[0]?.target),
      `routines.${routine.id}`, 'круг должен включать все направления с одинаковым количеством подходов и временем');
  }
}

function validateExercise(exercise, path, active) {
  check(isId(exercise?.id) && isText(exercise.name), path, 'нужны id и name');
  check(Number.isInteger(exercise.sets) && exercise.sets > 0, path, 'sets должен быть положительным целым числом');
  check(isText(exercise.target) && (/\d/.test(exercise.target)
    || exercise.kind === 'seconds' && exercise.target.startsWith('до отказа')),
    path, 'target должен содержать количество повторов, секунд или удержание до отказа');
  check(['reps', 'seconds', 'sides'].includes(exercise.kind), path, 'неизвестный kind');
  check(exercise.weight === null || Object.hasOwn(WEIGHT_LABELS, exercise.weight), path, 'неизвестная единица веса');
  if (active) {
    check(isText(exercise.rest) && Number.isFinite(exercise.restSeconds) && exercise.restSeconds >= 0,
      path, 'нужны rest и неотрицательный restSeconds');
  }
  if (exercise.optionalAfter !== undefined) {
    check(Number.isInteger(exercise.optionalAfter) && exercise.optionalAfter >= 0
      && exercise.optionalAfter < exercise.sets, path, 'неверный optionalAfter');
  }
  if (exercise.warmup !== undefined) {
    check(typeof exercise.warmup === 'boolean' && (!exercise.warmup || exercise.weight === 'barbell'),
      path, 'warmup должен быть булевым флагом упражнения со штангой');
  }
  if (exercise.superset !== undefined) {
    check(typeof exercise.superset === 'string' && /^[A-Z][12]$/.test(exercise.superset), path, 'неверная метка суперсета');
  }
  if (exercise.note !== undefined) check(isText(exercise.note), path, 'note должен быть текстом');
  if (exercise.tips !== undefined) check(Array.isArray(exercise.tips) && exercise.tips.every(isText), path, 'tips должен быть списком текстов');
  if (exercise.image !== undefined) check(isSafeUrl(exercise.image), path, 'неверный адрес изображения');
  if (exercise.links !== undefined) {
    check(Array.isArray(exercise.links) && exercise.links.every((link) => isText(link?.label) && isSafeUrl(link.url)),
      path, 'links должен содержать подписи и безопасные адреса');
  }
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value) && !Object.hasOwn(Object.prototype, value);
}

function isSafeUrl(value) {
  if (!isText(value) || !value.startsWith('https://') && !value.startsWith('./')) return false;
  try {
    return new URL(value, 'https://app.invalid/').protocol === 'https:';
  } catch {
    return false;
  }
}

function check(condition, path, message) {
  if (!condition) throw new Error(`program.json: ${path}: ${message}`);
}
