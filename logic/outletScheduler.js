/**
 * Outlet Scheduler
 *
 * Управление розетками по расписанию.
 * Каждая розетка включается по cron и автоматически выключается через заданное время.
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

// Маппинг Enum значений на cron-выражения
// SprutHub использует 6-полевой cron: секунда минута час день месяц день_недели
var SCHEDULE_CRON = [
    "0 0,15,30,45 * * * *",  // 0: каждые 15 минут
    "0 0,30 * * * *",        // 1: каждые 30 минут
    "0 0 * * * *",           // 2: каждый час
    "0 0 */2 * * *",         // 3: каждые 2 часа
    "0 0 */6 * * *",         // 4: каждые 6 часов
    "0 0 0 * * *"            // 5: раз в сутки (полночь)
];

// Максимальная длительность для каждого расписания (в минутах)
// Длительность не должна превышать период между включениями
var SCHEDULE_MAX_DURATION = [
    15,    // 0: каждые 15 минут → макс 15 мин
    30,    // 1: каждые 30 минут → макс 30 мин
    60,    // 2: каждый час → макс 60 мин
    120,   // 3: каждые 2 часа → макс 120 мин
    360,   // 4: каждые 6 часов → макс 360 мин
    1440   // 5: раз в сутки → макс 1440 мин (24 часа)
];

// ============================================================================
// INFO BLOCK
// ============================================================================

info = {
    name: "Outlet Scheduler",
    description: "Управление розетками по расписанию",
    version: "1.0",
    author: "@sklukin",
    onStart: true,

    sourceServices: [HS.Outlet],
    sourceCharacteristics: [HC.On],

    variables: {
        cronTask: null  // хранение cron-задачи для этой розетки
    },

    options: {
        Schedule: {
            type: "Integer",
            value: 2,  // по умолчанию: каждый час
            formType: "list",
            values: [
                { value: 0, key: "EVERY_15_MIN", name: { ru: "Каждые 15 минут", en: "Every 15 minutes" } },
                { value: 1, key: "EVERY_30_MIN", name: { ru: "Каждые 30 минут", en: "Every 30 minutes" } },
                { value: 2, key: "EVERY_HOUR", name: { ru: "Каждый час", en: "Every hour" } },
                { value: 3, key: "EVERY_2_HOURS", name: { ru: "Каждые 2 часа", en: "Every 2 hours" } },
                { value: 4, key: "EVERY_6_HOURS", name: { ru: "Каждые 6 часов", en: "Every 6 hours" } },
                { value: 5, key: "ONCE_A_DAY", name: { ru: "Раз в сутки (полночь)", en: "Once a day (midnight)" } }
            ],
            name: { ru: "Расписание", en: "Schedule" },
            desc: { ru: "Как часто включать розетку", en: "How often to turn on the outlet" }
        },
        Duration: {
            type: "Integer",
            value: 15,
            minValue: 1,
            maxValue: 1440,
            step: 1,
            name: { ru: "Длительность (минуты)", en: "Duration (minutes)" },
            desc: { ru: "На сколько минут включать розетку", en: "How many minutes to keep the outlet on" }
        }
    }
};

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

function trigger(source, value, variables, options, context) {
    // Если cron-задача уже создана — ничего не делаем
    if (variables.cronTask) {
        return;
    }

    var accessory = source.getAccessory();
    var accessoryName = accessory.getName();
    var scheduleIndex = options.Schedule;
    var cronExpr = SCHEDULE_CRON[scheduleIndex];
    var maxDuration = SCHEDULE_MAX_DURATION[scheduleIndex];

    // Проверка: длительность не должна превышать период расписания
    var duration = options.Duration;
    if (duration > maxDuration) {
        log.warn("[Outlet Scheduler] " + accessoryName + ": длительность " + duration + " мин превышает период расписания, ограничено до " + maxDuration + " мин");
        duration = maxDuration;
    }

    var durationMs = duration * 60 * 1000;

    var outletService = accessory.getService(HS.Outlet);
    var onChar = outletService.getCharacteristic(HC.On);

    variables.cronTask = Cron.schedule(cronExpr, function() {
        log.info("[Outlet Scheduler] Включаю: " + accessoryName);
        onChar.setValue(true);

        setTimeout(function() {
            log.info("[Outlet Scheduler] Выключаю: " + accessoryName);
            onChar.setValue(false);
        }, durationMs);
    });

    log.info("[Outlet Scheduler] Расписание создано для: " + accessoryName + " (cron: " + cronExpr + ", длительность: " + duration + " мин)");
}

// ============================================================================
// UNIT TESTS
// ============================================================================

function runTests() {
    if (!global.hasUnitTests) {
        return;
    }

    // Импорт assert функций
    var assertEquals = global.assertEquals;
    var assertTrue = global.assertTrue;

    log.info("Outlet Scheduler Tests: Запуск тестов...");

    // Test: SCHEDULE_CRON count
    log.info("Outlet Scheduler Tests: Тест SCHEDULE_CRON count");
    assertEquals(6, SCHEDULE_CRON.length, "SCHEDULE_CRON должен иметь 6 элементов");
    log.info("Outlet Scheduler Tests: SCHEDULE_CRON count - OK");

    // Test: Cron format (6 fields)
    log.info("Outlet Scheduler Tests: Тест формата cron");
    for (var i = 0; i < SCHEDULE_CRON.length; i++) {
        var parts = SCHEDULE_CRON[i].split(" ");
        assertEquals(6, parts.length, "Cron index " + i + " должен иметь 6 полей");
    }
    log.info("Outlet Scheduler Tests: формат cron - OK");

    // Test: values matches SCHEDULE_CRON
    log.info("Outlet Scheduler Tests: Тест соответствия values и SCHEDULE_CRON");
    assertEquals(SCHEDULE_CRON.length, info.options.Schedule.values.length,
        "Количество values должно совпадать с SCHEDULE_CRON");
    log.info("Outlet Scheduler Tests: соответствие values - OK");

    // Test: SCHEDULE_MAX_DURATION matches SCHEDULE_CRON
    log.info("Outlet Scheduler Tests: Тест SCHEDULE_MAX_DURATION");
    assertEquals(SCHEDULE_CRON.length, SCHEDULE_MAX_DURATION.length,
        "Количество SCHEDULE_MAX_DURATION должно совпадать с SCHEDULE_CRON");
    for (var j = 0; j < SCHEDULE_MAX_DURATION.length; j++) {
        assertTrue(SCHEDULE_MAX_DURATION[j] > 0, "MAX_DURATION[" + j + "] должен быть положительным");
    }
    log.info("Outlet Scheduler Tests: SCHEDULE_MAX_DURATION - OK");

    // Test: Default Schedule value
    log.info("Outlet Scheduler Tests: Тест значения по умолчанию Schedule");
    var defaultSchedule = info.options.Schedule.value;
    assertTrue(defaultSchedule >= 0 && defaultSchedule < SCHEDULE_CRON.length,
        "Значение Schedule по умолчанию должно быть валидным индексом");
    log.info("Outlet Scheduler Tests: значение Schedule - OK");

    // Test: Default Duration
    log.info("Outlet Scheduler Tests: Тест значения по умолчанию Duration");
    assertTrue(info.options.Duration.value > 0, "Duration должен быть положительным");
    log.info("Outlet Scheduler Tests: значение Duration - OK");

    log.info("Outlet Scheduler Tests: ВСЕ ТЕСТЫ ПРОЙДЕНЫ!");
}

// Запуск тестов
runTests();
