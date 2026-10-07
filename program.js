export const PROGRAM = [
  {
    id: 'legs-a',
    day: 'Пн',
    weekday: 'Понедельник',
    name: 'Ноги А — присед',
    exercises: [
      {
        id: 'squat',
        name: 'Присед со штангой',
        sets: 3,
        target: '3–5 повторов',
        kind: 'reps',
        weight: 'barbell',
        rest: '2,5–3 мин',
        restSeconds: 180,
        image: 'https://static.strengthlevel.com/images/illustrations/squat-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/squat' }],
        tips: [
          'Устойчивая опора на всю стопу, колени движутся в направлении носков.',
          'Перед повтором напрячь корпус; опускаться до глубины, на которой сохраняется контроль спины и таза.',
          'Использовать страховочные упоры в стойке.'
        ]
      },
      {
        id: 'leg-curl',
        name: 'Сгибание ног в тренажёре',
        sets: 3,
        target: '6–10 повторов',
        kind: 'reps',
        weight: 'machine',
        rest: '90–120 с',
        restSeconds: 120,
        image: 'https://static.strengthlevel.com/images/illustrations/lying-leg-curl-1000x1000.jpg',
        links: [
          { label: 'Вариант лёжа', url: 'https://strengthlevel.com/strength-standards/lying-leg-curl' },
          { label: 'Вариант сидя', url: 'https://strengthlevel.com/strength-standards/seated-leg-curl' }
        ],
        note: 'На иллюстрации вариант лёжа; тип тренажёра в программе не зафиксирован.',
        tips: [
          'Ось вращения тренажёра совместить с осью колена, валик разместить на нижней части голени.',
          'Сгибать ноги без отрыва таза и рывка, подконтрольно возвращать вес.'
        ]
      },
      {
        id: 'smith-calf-raise',
        name: 'Подъём на носки в тренажёре Смита',
        sets: 2,
        target: '8–12 повторов',
        kind: 'reps',
        weight: 'barbell',
        rest: '45–60 с',
        restSeconds: 60,
        note: 'Обе стопы на устойчивой платформе, гриф на плечах; выставить страховочные упоры.',
        tips: [
          'Подниматься на обеих ногах без рывка и подворачивания стоп, плавно опускать пятки.',
          'Начать с пустого грифа и сохранять контроль корпуса на всём протяжении подхода.'
        ]
      },
      {
        id: 'reverse-wrist-curl',
        name: 'Разгибание кистей с лёгкими гантелями',
        sets: 2,
        target: '12–15 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '45–60 с',
        restSeconds: 60,
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-reverse-wrist-curl-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-reverse-wrist-curl' }],
        tips: [
          'Предплечья на опоре, кисти за краем, ладони вниз.',
          'Двигаются только кисти; использовать лёгкий вес и комфортную амплитуду без рывков.'
        ]
      }
    ]
  },
  {
    id: 'back-a',
    day: 'Вт',
    weekday: 'Вторник',
    name: 'Спина А — подтягивания',
    exercises: [
      {
        id: 'weighted-pullup',
        name: 'Подтягивания с отягощением',
        sets: 3,
        target: '3–5 повторов',
        kind: 'reps',
        weight: 'pullup',
        rest: '2,5–3 мин',
        restSeconds: 180,
        image: 'https://static.strengthlevel.com/images/illustrations/pull-ups-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/pull-ups' }],
        note: 'Вес — только дополнительное отягощение, не масса тела.',
        tips: [
          'Надёжно закрепить отягощение; не раскачиваться и не подбрасывать себя ногами.',
          'Не вытягивать подбородок и не запрокидывать голову; опускаться плавно.'
        ]
      },
      {
        id: 'dumbbell-bench',
        name: 'Жим гантелей лёжа',
        sets: 2,
        target: '6–8 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '60–90 с при чередовании',
        restSeconds: 90,
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-bench-press-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-bench-press' }],
        note: 'Небольшой объём для мышечного баланса; можно чередовать с тягой.',
        tips: [
          'Стопы устойчиво на полу, таз и верх спины на скамье.',
          'Кисти над локтями; опускать до комфортной глубины, не сталкивать гантели.'
        ]
      },
      {
        id: 'chest-row-a',
        name: 'Тяга с упором грудью',
        sets: 2,
        target: '6–8 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '60–90 с при чередовании',
        restSeconds: 90,
        image: 'https://static.strengthlevel.com/images/illustrations/chest-supported-dumbbell-row-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/chest-supported-dumbbell-row' }],
        note: 'Можно чередовать с жимом гантелей лёжа.',
        tips: [
          'Скамья примерно 30–45°, грудь на спинке, стопы на полу.',
          'Тянуть локти назад к нижним рёбрам, не отрывать грудь; опускать плавно.'
        ]
      },
      {
        id: 'neck-front',
        name: 'Шея — лоб',
        sets: 2,
        optionalAfter: 1,
        target: '10–15 секунд',
        kind: 'seconds',
        weight: null,
        rest: 'короткий переход',
        restSeconds: 30,
        note: 'Первый круг обязателен, второй — по самочувствию. Лёгкое усилие, без задержки дыхания.',
        tips: ['Ладонь создаёт сопротивление со стороны лба; голова остаётся неподвижной.']
      },
      {
        id: 'neck-back',
        name: 'Шея — затылок',
        sets: 2,
        optionalAfter: 1,
        target: '10–15 секунд',
        kind: 'seconds',
        weight: null,
        rest: 'короткий переход',
        restSeconds: 30,
        note: 'Первый круг обязателен, второй — по самочувствию. Лёгкое усилие, без задержки дыхания.',
        tips: ['Ладонь создаёт сопротивление со стороны затылка; голова остаётся неподвижной.']
      },
      {
        id: 'neck-left',
        name: 'Шея — левый висок',
        sets: 2,
        optionalAfter: 1,
        target: '10–15 секунд',
        kind: 'seconds',
        weight: null,
        rest: 'короткий переход',
        restSeconds: 30,
        note: 'Первый круг обязателен, второй — по самочувствию. Лёгкое усилие, без задержки дыхания.',
        tips: ['Ладонь у левого виска; давить без движения головы, сохраняя нейтральное положение.']
      },
      {
        id: 'neck-right',
        name: 'Шея — правый висок',
        sets: 2,
        optionalAfter: 1,
        target: '10–15 секунд',
        kind: 'seconds',
        weight: null,
        rest: 'короткий переход',
        restSeconds: 30,
        note: 'Первый круг обязателен, второй — по самочувствию. Лёгкое усилие, без задержки дыхания.',
        tips: ['Ладонь у правого виска; давить без движения головы, сохраняя нейтральное положение.']
      }
    ]
  },
  {
    id: 'legs-b',
    day: 'Чт',
    weekday: 'Четверг',
    name: 'Ноги Б — становая тяга',
    exercises: [
      {
        id: 'deadlift',
        name: 'Становая тяга в привычной технике',
        sets: 3,
        target: '3 повтора',
        kind: 'reps',
        weight: 'barbell',
        rest: '2,5–3 мин',
        restSeconds: 180,
        image: 'https://static.strengthlevel.com/images/illustrations/deadlift-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/deadlift' }],
        note: 'Оставлять примерно 2 повтора в запасе, без отказа и затяжных повторений.',
        tips: [
          'Гриф близко к ногам; напрячь корпус и выбрать слабину до подъёма.',
          'Поднимать без рывка; завершать выпрямлением, а не отклонением назад.'
        ]
      },
      {
        id: 'leg-press',
        name: 'Жим ногами',
        sets: 3,
        target: '6–8 повторов',
        kind: 'reps',
        weight: 'machine',
        rest: '90–120 с',
        restSeconds: 120,
        image: 'https://static.strengthlevel.com/images/illustrations/sled-leg-press-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/sled-leg-press' }],
        note: 'Конструкция тренажёра может отличаться от показанной платформы-салазок.',
        tips: [
          'Таз и спина на опоре, стопы полностью на платформе, колени по направлению носков.',
          'Не допускать отрыва таза и не выпрямлять колени резким ударом.'
        ]
      },
      {
        id: 'wrist-curl',
        name: 'Сгибание кистей с лёгкими гантелями',
        sets: 2,
        target: '12–15 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '45–60 с',
        restSeconds: 60,
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-wrist-curl-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-wrist-curl' }],
        tips: [
          'Предплечья на опоре, кисти за краем, ладони вверх.',
          'Двигать кистями плавно, не выпускать гантели на кончики пальцев.'
        ]
      }
    ]
  },
  {
    id: 'back-b',
    day: 'Пт',
    weekday: 'Пятница',
    name: 'Спина Б — горизонтальная тяга',
    exercises: [
      {
        id: 'chest-row-b',
        name: 'Тяга с упором грудью',
        sets: 3,
        target: '6–10 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '2–3 мин',
        restSeconds: 180,
        image: 'https://static.strengthlevel.com/images/illustrations/chest-supported-dumbbell-row-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/chest-supported-dumbbell-row' }],
        note: 'Основное упражнение пятницы. Упор грудью снижает дополнительную нагрузку на поясницу после становой. Оставлять примерно 2 чистых повтора в запасе.',
        tips: [
          'Скамья примерно 30–45°, грудь на спинке, стопы на полу.',
          'Тянуть локти назад к нижним рёбрам, не отрывать грудь; голову не запрокидывать.'
        ]
      },
      {
        id: 'seated-press',
        name: 'Жим гантелей сидя',
        sets: 2,
        target: '6–10 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '1,5–2,5 мин',
        restSeconds: 120,
        image: 'https://static.strengthlevel.com/images/illustrations/seated-dumbbell-shoulder-press-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/seated-dumbbell-shoulder-press' }],
        note: 'Основной вертикальный жим недели. Оставлять примерно 2 чистых повтора в запасе; не выполнять через боль в запястье или спине.',
        tips: [
          'Спинка примерно 80–90°, стопы на полу, таз и спина на опоре.',
          'Кисти над локтями; не усиливать прогиб поясницы.'
        ]
      },
      {
        id: 'dumbbell-bench',
        name: 'Жим гантелей лёжа',
        sets: 2,
        target: '8–12 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '1,5–2,5 мин',
        restSeconds: 120,
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-bench-press-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-bench-press' }],
        note: 'Дополнительная нагрузка на грудь после вторника. Оставлять примерно 2 чистых повтора в запасе. Сравнивать результаты с предыдущими пятницами, а не со вторником.',
        tips: [
          'Стопы устойчиво на полу, таз и верх спины на скамье.',
          'Кисти над локтями; опускать до комфортной глубины, не сталкивать гантели.'
        ]
      }
    ]
  }
];

export const EXERCISE_BANK = PROGRAM.flatMap((routine) => routine.exercises)
  .filter((exercise, index, exercises) => exercises.findIndex((item) => item.name === exercise.name) === index);

export const WEIGHT_LABELS = {
  barbell: 'кг, общий вес',
  machine: 'кг тренажёра',
  dumbbell: 'кг на одну гантель',
  pullup: '+кг к весу тела'
};

const LEGACY_EXERCISES = [
  {
    id: 'single-calf-raise',
    name: 'Подъём на носок одной ноги с гантелью',
    sets: 2,
    target: '8–12 на каждую ногу',
    kind: 'sides',
    weight: 'dumbbell'
  },
  {
    id: 'shrug',
    name: 'Шраги с гантелями',
    sets: 2,
    target: '8–10 повторов',
    kind: 'reps',
    weight: 'dumbbell'
  },
  {
    id: 'dumbbell-hold',
    name: 'Удержание тяжёлых гантелей стоя',
    sets: 2,
    target: '20–30 секунд',
    kind: 'seconds',
    weight: 'dumbbell'
  }
];

export const NECK_CIRCUIT_IDS = ['neck-front', 'neck-back', 'neck-left', 'neck-right'];

export function getRoutine(routineId) {
  return PROGRAM.find((routine) => routine.id === routineId) || PROGRAM[0];
}

export function getExercise(routineId, exerciseId) {
  return getRoutine(routineId).exercises.find((exercise) => exercise.id === exerciseId)
    || EXERCISE_BANK.find((exercise) => exercise.id === exerciseId);
}

export function getActiveWorkoutExercises(workout) {
  return Object.keys(workout.sets)
    .map((id) => getExercise(workout.routineId, id))
    .filter(Boolean);
}

export function getAvailableExercises(workout) {
  const names = new Set(getActiveWorkoutExercises(workout).map((exercise) => exercise.name));
  return EXERCISE_BANK
    .filter((exercise) => !names.has(exercise.name)
      && (!NECK_CIRCUIT_IDS.includes(exercise.id) || exercise.id === NECK_CIRCUIT_IDS[0]))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function getWorkoutExercises(workout) {
  return [
    ...getActiveWorkoutExercises(workout),
    ...LEGACY_EXERCISES.filter((exercise) => workout.sets[exercise.id])
  ];
}
