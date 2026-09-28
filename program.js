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
        id: 'single-calf-raise',
        name: 'Подъём на носок одной ноги с гантелью',
        sets: 2,
        target: '8–12 на каждую ногу',
        kind: 'sides',
        weight: 'dumbbell',
        rest: '45–60 с',
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-calf-raise-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-calf-raise' }],
        note: 'Выполнять на одной ноге на полу, свободной рукой держаться за устойчивую опору. Иллюстрация показывает общий вариант.',
        tips: [
          'Подниматься без раскачивания и подворачивания стопы; плавно опускать пятку.',
          'Начать без веса, если гантель мешает сохранять амплитуду и равновесие.'
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
        target: '4–6 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '2,5–3 мин',
        image: 'https://static.strengthlevel.com/images/illustrations/chest-supported-dumbbell-row-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/chest-supported-dumbbell-row' }],
        note: 'Упор грудью снижает дополнительную нагрузку на поясницу после становой.',
        tips: [
          'Скамья примерно 30–45°, грудь на спинке, стопы на полу.',
          'Тянуть локти назад к нижним рёбрам, не отрывать грудь; голову не запрокидывать.'
        ]
      },
      {
        id: 'seated-press',
        name: 'Жим гантелей сидя',
        sets: 2,
        target: '6–8 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '90–120 с',
        image: 'https://static.strengthlevel.com/images/illustrations/seated-dumbbell-shoulder-press-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/seated-dumbbell-shoulder-press' }],
        tips: [
          'Спинка примерно 80–90°, стопы на полу, таз и спина на опоре.',
          'Кисти над локтями; не усиливать прогиб поясницы.'
        ]
      },
      {
        id: 'shrug',
        name: 'Шраги с гантелями',
        sets: 2,
        target: '8–10 повторов',
        kind: 'reps',
        weight: 'dumbbell',
        rest: '45–60 с',
        image: 'https://static.strengthlevel.com/images/illustrations/dumbbell-shrug-1000x1000.jpg',
        links: [{ label: 'Страница упражнения', url: 'https://strengthlevel.com/strength-standards/dumbbell-shrug' }],
        tips: [
          'Стоять устойчиво, держать гантели вдоль тела, голову нейтрально.',
          'Поднимать плечи вверх без круговых вращений и помощи ногами.'
        ]
      },
      {
        id: 'dumbbell-hold',
        name: 'Удержание тяжёлых гантелей стоя',
        sets: 2,
        target: '20–30 секунд',
        kind: 'seconds',
        weight: 'dumbbell',
        rest: '45–60 с',
        note: 'Заканчивать до раскрытия пальцев, а не после падения гантели. Прогулка фермера не заменяет статическое удержание.',
        tips: [
          'Стоять устойчиво, гантели вдоль тела, кисти нейтрально.',
          'Не пожимать плечами и не задерживать дыхание; корпус неподвижен.'
        ]
      }
    ]
  }
];

export const WEIGHT_LABELS = {
  barbell: 'кг, общий вес',
  machine: 'кг тренажёра',
  dumbbell: 'кг на одну гантель',
  pullup: '+кг к весу тела'
};

export const GENERAL_GUIDANCE = {
  timing: [
    '0–8 мин: короткая общая разминка и 3–4 подводящих подхода первого упражнения без утомления.',
    '8–23 мин: главное силовое упражнение.',
    '23–33 мин: второе упражнение или пара упражнений.',
    '33–38 мин: дополнительные мышцы.',
    '38–40 мин: переходы и запись весов.'
  ],
  rules: [
    'Рабочие подходы указаны без разминочных.',
    'Тяжёлые подходы выполнять без отказа. Если 40 минут закончились, убрать последний дополнительный подход, а не сокращать отдых перед тяжёлым.',
    'При боли в шее, головокружении, онемении или простреле прекратить упражнение и обратиться за медицинской оценкой.'
  ]
};

export function getRoutine(routineId) {
  return PROGRAM.find((routine) => routine.id === routineId) || PROGRAM[0];
}

export function getExercise(routineId, exerciseId) {
  return getRoutine(routineId).exercises.find((exercise) => exercise.id === exerciseId);
}
