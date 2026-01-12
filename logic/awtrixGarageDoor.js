/**
 * AWTRIX Garage Door Indicator
 *
 * Отображение статуса гаражных ворот на часах AWTRIX3.
 * Открытые ворота = мигающая красная точка (indicator).
 * Закрытые ворота = индикатор выключен.
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const CLOCKS = [
    { name: "Кухня", ip: "192.168.1.65" },
    { name: "Спальня", ip: "192.168.1.66" }
];

// Состояния ворот (HomeKit стандарт)
const DOOR_STATE = {
    OPEN: 0,
    CLOSED: 1,
    OPENING: 2,
    CLOSING: 3,
    STOPPED: 4
};

// Настройки индикатора
const INDICATOR_COLOR = [255, 0, 0];  // Красный
const INDICATOR_FADE = 1000;           // Период мигания (мс)

// ============================================================================
// INFO BLOCK
// ============================================================================

info = {
    name: "AWTRIX Garage Door Indicator",
    description: "Индикатор открытых ворот на часах AWTRIX",
    version: "1.0",
    author: "@sklukin",
    onStart: true,
    sourceServices: [HS.GarageDoorOpener],
    sourceCharacteristics: [HC.CurrentDoorState],

    options: {
        indicatorNumber: {
            type: "Integer",
            value: 1,
            formType: "list",
            values: [
                { value: 1, key: "IND1", name: { ru: "Индикатор 1", en: "Indicator 1" } },
                { value: 2, key: "IND2", name: { ru: "Индикатор 2", en: "Indicator 2" } },
                { value: 3, key: "IND3", name: { ru: "Индикатор 3", en: "Indicator 3" } }
            ],
            name: { ru: "Номер индикатора", en: "Indicator number" },
            desc: { ru: "Позиция индикатора на часах (1-3)", en: "Indicator position on clock (1-3)" }
        },
        debug: {
            type: "Boolean",
            value: false,
            name: { ru: "Отладка", en: "Debug" },
            desc: { ru: "Включить логирование для отладки", en: "Enable debug logging" }
        }
    }
};

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

function trigger(source, value, variables, options, context) {
    // 1. Валидация списка часов
    if (CLOCKS.length === 0) {
        log.error("AWTRIX Garage: Список часов пуст!");
        return;
    }

    // 2. Валидация значения
    if (value === null || value === undefined) {
        if (options.debug) {
            log.info("AWTRIX Garage: Пропуск невалидного значения: " + value);
        }
        return;
    }

    // 3. Индикатор включён для всех состояний кроме CLOSED (1)
    var needIndicator = (value === DOOR_STATE.OPEN ||
                         value === DOOR_STATE.OPENING ||
                         value === DOOR_STATE.CLOSING ||
                         value === DOOR_STATE.STOPPED);

    // 4. Получаем данные для логирования
    var accessory = source.getService().getAccessory();
    var room = accessory.getRoom();
    var roomName = room ? room.getName() : accessory.getName();

    // 5. Формируем endpoint индикатора
    var indicatorPath = "api/indicator" + options.indicatorNumber;

    // 6. Payload: включить или выключить
    var payload = needIndicator
        ? { color: INDICATOR_COLOR, fade: INDICATOR_FADE }
        : {};

    // 7. Отправляем на все часы
    CLOCKS.forEach(function(clock) {
        var success = sendToAwtrix(clock.ip, indicatorPath, payload);

        if (options.debug) {
            var stateNames = ["открыты", "закрыты", "открываются", "закрываются", "остановлены"];
            var stateName = stateNames[value] || "неизвестно";
            if (success) {
                log.info("AWTRIX Garage [" + clock.name + "]: " + roomName + " " + stateName);
            } else {
                log.warn("AWTRIX Garage [" + clock.name + "]: Ошибка отправки");
            }
        }
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Отправка запроса на AWTRIX
 */
function sendToAwtrix(ip, path, payload) {
    try {
        var response = HttpClient.POST("http://" + ip)
            .header('Content-Type', 'application/json')
            .path(path)
            .body(JSON.stringify(payload))
            .send();

        return response.getStatus() === 200;
    } catch (e) {
        log.error("AWTRIX Garage HTTP error [" + ip + "]: " + e.message);
        return false;
    }
}

// ============================================================================
// UNIT TESTS
// ============================================================================

// Хранилище HTTP-запросов для проверки в тестах
var httpRequests = [];

// Мок HttpClient для тестов
var MockHttpClient = {
    POST: function(url) {
        var request = {
            url: url,
            headers: {},
            pathSegment: "",
            bodyContent: null
        };

        return {
            header: function(name, value) {
                request.headers[name] = value;
                return this;
            },
            path: function(segment) {
                request.pathSegment = segment;
                return this;
            },
            body: function(content) {
                request.bodyContent = content;
                return this;
            },
            send: function() {
                httpRequests.push(request);
                return {
                    getStatus: function() { return 200; }
                };
            }
        };
    }
};

/**
 * Создание тестового GarageDoorOpener
 */
function createTestGarageDoor(roomName, doorState) {
    return global.createUnitTestFullAccessory({
        id: Math.floor(Math.random() * 1000),
        name: "Ворота " + roomName,
        room: roomName,
        services: [{
            type: HS.GarageDoorOpener,
            name: "Garage Door",
            characteristics: [{
                type: HC.CurrentDoorState,
                value: doorState
            }]
        }]
    });
}

/**
 * Получение опций по умолчанию для тестов
 */
function getDefaultOptions() {
    return {
        indicatorNumber: 1,
        debug: false
    };
}

/**
 * Сброс состояния тестов
 */
function resetTestState() {
    httpRequests = [];
}

/**
 * ES5-совместимый Array.find()
 */
function arrayFind(arr, predicate) {
    for (var i = 0; i < arr.length; i++) {
        if (predicate(arr[i], i, arr)) {
            return arr[i];
        }
    }
    return null;
}

/**
 * ES5-совместимый Array.every()
 */
function arrayEvery(arr, predicate) {
    for (var i = 0; i < arr.length; i++) {
        if (!predicate(arr[i], i, arr)) {
            return false;
        }
    }
    return true;
}

/**
 * Запуск всех тестов
 */
function runTests() {
    if (!global.hasUnitTests) {
        log.warn("AWTRIX Garage Tests: Сценарий UnitTests не установлен. Скачать: https://github.com/sklukin/spruthub/blob/main/global/unitTests.js");
        return;
    }

    // Импорт assert функций
    var assertEquals = global.assertEquals;
    var assertTrue = global.assertTrue;
    var assertNotNull = global.assertNotNull;
    var assertLength = global.assertLength;

    // Сохраняем оригинальный HttpClient
    var OriginalHttpClient = HttpClient;

    try {
        HttpClient = MockHttpClient;

        log.info("AWTRIX Garage Tests: Запуск тестов...");

        // ==================== TEST: trigger с OPEN (0) ====================

        log.info("AWTRIX Garage Tests: Тест trigger() с OPEN (0)");

        resetTestState();
        var sensor = createTestGarageDoor("Гараж", DOOR_STATE.OPEN);
        var source = sensor.getService(HS.GarageDoorOpener).getCharacteristic(HC.CurrentDoorState);
        var variables = {};

        trigger(source, DOOR_STATE.OPEN, variables, getDefaultOptions(), "TEST");

        assertEquals(
            httpRequests.length,
            CLOCKS.length,
            "trigger OPEN: Должно быть " + CLOCKS.length + " HTTP запросов"
        );

        var payload = JSON.parse(httpRequests[0].bodyContent);
        assertNotNull(payload.color, "trigger OPEN: payload должен содержать color");
        assertNotNull(payload.fade, "trigger OPEN: payload должен содержать fade");
        assertEquals(payload.color[0], 255, "trigger OPEN: color[0] должен быть 255");
        assertEquals(payload.color[1], 0, "trigger OPEN: color[1] должен быть 0");
        assertEquals(payload.color[2], 0, "trigger OPEN: color[2] должен быть 0");
        assertEquals(payload.fade, INDICATOR_FADE, "trigger OPEN: fade должен быть " + INDICATOR_FADE);

        log.info("AWTRIX Garage Tests: trigger() с OPEN - OK");

        // ==================== TEST: trigger с CLOSED (1) ====================

        log.info("AWTRIX Garage Tests: Тест trigger() с CLOSED (1)");

        resetTestState();

        trigger(source, DOOR_STATE.CLOSED, variables, getDefaultOptions(), "TEST");

        assertEquals(
            httpRequests.length,
            CLOCKS.length,
            "trigger CLOSED: Должно быть " + CLOCKS.length + " HTTP запросов"
        );

        payload = JSON.parse(httpRequests[0].bodyContent);
        var payloadKeys = Object.keys(payload);
        assertEquals(payloadKeys.length, 0, "trigger CLOSED: payload должен быть пустым");

        log.info("AWTRIX Garage Tests: trigger() с CLOSED - OK");

        // ==================== TEST: trigger с OPENING (2) ====================

        log.info("AWTRIX Garage Tests: Тест trigger() с OPENING (2)");

        resetTestState();

        trigger(source, DOOR_STATE.OPENING, variables, getDefaultOptions(), "TEST");

        payload = JSON.parse(httpRequests[0].bodyContent);
        assertNotNull(payload.color, "trigger OPENING: payload должен содержать color");

        log.info("AWTRIX Garage Tests: trigger() с OPENING - OK");

        // ==================== TEST: trigger с CLOSING (3) ====================

        log.info("AWTRIX Garage Tests: Тест trigger() с CLOSING (3)");

        resetTestState();

        trigger(source, DOOR_STATE.CLOSING, variables, getDefaultOptions(), "TEST");

        payload = JSON.parse(httpRequests[0].bodyContent);
        assertNotNull(payload.color, "trigger CLOSING: payload должен содержать color");

        log.info("AWTRIX Garage Tests: trigger() с CLOSING - OK");

        // ==================== TEST: trigger с STOPPED (4) ====================

        log.info("AWTRIX Garage Tests: Тест trigger() с STOPPED (4)");

        resetTestState();

        trigger(source, DOOR_STATE.STOPPED, variables, getDefaultOptions(), "TEST");

        payload = JSON.parse(httpRequests[0].bodyContent);
        assertNotNull(payload.color, "trigger STOPPED: payload должен содержать color");

        log.info("AWTRIX Garage Tests: trigger() с STOPPED - OK");

        // ==================== TEST: правильный endpoint индикатора ====================

        log.info("AWTRIX Garage Tests: Тест endpoint индикатора");

        resetTestState();
        var options1 = { indicatorNumber: 1, debug: false };
        trigger(source, DOOR_STATE.OPEN, variables, options1, "TEST");
        assertEquals(httpRequests[0].pathSegment, "api/indicator1", "endpoint должен быть api/indicator1");

        resetTestState();
        var options2 = { indicatorNumber: 2, debug: false };
        trigger(source, DOOR_STATE.OPEN, variables, options2, "TEST");
        assertEquals(httpRequests[0].pathSegment, "api/indicator2", "endpoint должен быть api/indicator2");

        resetTestState();
        var options3 = { indicatorNumber: 3, debug: false };
        trigger(source, DOOR_STATE.OPEN, variables, options3, "TEST");
        assertEquals(httpRequests[0].pathSegment, "api/indicator3", "endpoint должен быть api/indicator3");

        log.info("AWTRIX Garage Tests: endpoint индикатора - OK");

        // ==================== TEST: отправка на все часы ====================

        log.info("AWTRIX Garage Tests: Тест отправки на все часы");

        resetTestState();

        trigger(source, DOOR_STATE.OPEN, variables, getDefaultOptions(), "TEST");

        // Проверяем что запросы отправлены на все IP из CLOCKS
        var allClocksReceived = arrayEvery(CLOCKS, function(clock) {
            return arrayFind(httpRequests, function(req) {
                return req.url === "http://" + clock.ip;
            }) !== null;
        });

        assertTrue(allClocksReceived, "Запросы должны быть отправлены на все часы");

        log.info("AWTRIX Garage Tests: отправка на все часы - OK");

        // ==================== TEST: невалидные значения ====================

        log.info("AWTRIX Garage Tests: Тест невалидных значений");

        resetTestState();

        trigger(source, null, variables, getDefaultOptions(), "TEST");
        assertLength(httpRequests, 0, "trigger null: не должно быть запросов");

        trigger(source, undefined, variables, getDefaultOptions(), "TEST");
        assertLength(httpRequests, 0, "trigger undefined: не должно быть запросов");

        log.info("AWTRIX Garage Tests: невалидные значения - OK");

        // ==================== FINISH ====================

        log.info("AWTRIX Garage Tests: ВСЕ ТЕСТЫ ПРОЙДЕНЫ!");

    } finally {
        HttpClient = OriginalHttpClient;
        resetTestState();
    }
}

// Запуск тестов
runTests();

// ============================================================================
// СБРОС ИНДИКАТОРОВ ПРИ ЗАГРУЗКЕ/СОХРАНЕНИИ СЦЕНАРИЯ
// ============================================================================

/**
 * Сброс всех индикаторов на всех часах
 */
function resetAllIndicators() {
    CLOCKS.forEach(function(clock) {
        for (var i = 1; i <= 3; i++) {
            sendToAwtrix(clock.ip, "api/indicator" + i, {});
        }
        log.info("AWTRIX Garage [" + clock.name + "]: Индикаторы сброшены");
    });
}

// Сброс при загрузке сценария
resetAllIndicators();
