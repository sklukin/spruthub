/**
 * AWTRIX Temperature Display
 *
 * Отправка температуры с датчиков на часы AWTRIX3.
 * Все температурные датчики отправляются на все часы из списка CLOCKS.
 * Цвет текста меняется в зависимости от температуры.
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const CLOCKS = [
    { name: "Кухня", ip: "192.168.1.65" },
    { name: "Спальня", ip: "192.168.1.66" }
];

// Цвета по температуре
const COLORS = {
    VERY_COLD: "#9400D3",  // фиолетовый
    COLD: "#0000FF",       // синий
    COMFORT: "#00FF00",    // зелёный
    HOT: "#FF0000"         // красный
};

// Невалидное значение 
const INVALID_TEMP = -100;

// Настройки яркости
const AUTO_BRIGHTNESS = false;
const MANUAL_BRIGHTNESS = 50;  // 0-255, используется если AUTO_BRIGHTNESS = false

// Время отображения приложения (секунды)
const APP_DISPLAY_TIME = 10;

// Задержка после перезагрузки перед отправкой данных (мс)
const REBOOT_DELAY = 30000;

// Встроенные приложения AWTRIX (true = включено, false = выключено)
const BUILTIN_APPS = {
    TIM: true,   // Время
    DAT: false,   // Дата
    TEMP: false,  // Температура
    HUM: false,   // Влажность
    BAT: false    // Батарея
};

// ============================================================================
// INFO BLOCK
// ============================================================================

info = {
    name: "AWTRIX Temperature Display",
    description: "Отправка температуры с датчиков на часы AWTRIX",
    version: "1.0",
    author: "@sklukin",
    onStart: true,
    sourceServices: [HS.TemperatureSensor],
    sourceCharacteristics: [HC.CurrentTemperature],

    options: {
        veryColdThreshold: {
            type: "Double",
            value: 0,
            minValue: -50,
            maxValue: 50,
            step: 1,
            name: { ru: "Очень холодно (°C)", en: "Very cold (°C)" },
            desc: { ru: "Ниже этого порога — фиолетовый цвет", en: "Below this — purple color" }
        },
        coldThreshold: {
            type: "Double",
            value: 18,
            minValue: -20,
            maxValue: 50,
            step: 1,
            name: { ru: "Холодно (°C)", en: "Cold (°C)" },
            desc: { ru: "Ниже этого порога — синий цвет", en: "Below this — blue color" }
        },
        hotThreshold: {
            type: "Double",
            value: 24,
            minValue: 0,
            maxValue: 50,
            step: 1,
            name: { ru: "Жарко (°C)", en: "Hot (°C)" },
            desc: { ru: "Выше этого порога — красный цвет", en: "Above this — red color" }
        },
        debug: {
            type: "Boolean",
            value: false,
            name: { ru: "Отладка", en: "Debug" },
            desc: { ru: "Включить логирование для отладки", en: "Enable debug logging" }
        }
    },

    variables: {
        createdApps: {}  // { "service_uuid": "app_name" }
    }
};

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ (выполняется при загрузке/сохранении сценария)
// ============================================================================

var scenarioStartTime = Date.now();

// Применяем настройки ко всем часам
CLOCKS.forEach(function(clock) {
    applyClockSettings(clock.ip);
    log.info("AWTRIX [" + clock.name + "]: Настройки применены, часы перезагружаются");
});

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

function trigger(source, value, variables, options, context) {
    // 1. Валидация списка часов
    if (CLOCKS.length === 0) {
        log.error("AWTRIX: Список часов пуст! Добавьте часы в константу CLOCKS.");
        return;
    }

    // 2. Проверка: часы ещё перезагружаются после применения настроек?
    var now = Date.now();
    var elapsed = now - scenarioStartTime;
    if (elapsed < REBOOT_DELAY) {
        if (options.debug) {
            var remaining = Math.round((REBOOT_DELAY - elapsed) / 1000);
            log.info("AWTRIX: Часы перезагружаются, осталось " + remaining + " сек");
        }
        return;
    }

    // 3. Валидация температуры
    if (value === null || value === undefined || value === INVALID_TEMP) {
        if (options.debug) {
            log.info("AWTRIX: Пропуск невалидной температуры: " + value);
        }
        return;
    }

    // 4. Получение данных датчика
    var service = source.getService();
    var accessory = service.getAccessory();
    var room = accessory.getRoom();
    var roomName = room.getName();
    var serviceUUID = service.getUUID();

    // 5. Формирование имени приложения (транслит для URL)
    var appName = "temp_" + transliterate(roomName).replace(/[^a-z0-9_]/g, '');

    // 6. Определение цвета по температуре
    var color = getColorByTemp(value, options);

    // 7. Формат текста
    var tempText = Math.round(value) + "° " + roomName;

    // 8. Payload для custom app
    var payload = {
        text: tempText,
        icon: 2056,
        color: color,
        lifetime: 3600
    };

    // 9. Отправка на все часы
    CLOCKS.forEach(function(clock) {
        var success = sendToAwtrix(clock.ip, "api/custom", payload, { name: appName });

        if (options.debug) {
            if (success) {
                log.info("AWTRIX [" + clock.name + "]: " + tempText + " -> " + color);
            } else {
                log.warn("AWTRIX [" + clock.name + "]: Ошибка отправки");
            }
        }
    });

    // 10. Сохранение информации о созданном приложении
    variables.createdApps[serviceUUID] = appName;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Определение цвета по температуре
 */
function getColorByTemp(temp, options) {
    if (temp < options.veryColdThreshold) {
        return COLORS.VERY_COLD;  // фиолетовый
    }
    if (temp < options.coldThreshold) {
        return COLORS.COLD;       // синий
    }
    if (temp <= options.hotThreshold) {
        return COLORS.COMFORT;    // зелёный
    }
    return COLORS.HOT;            // красный
}

/**
 * Транслитерация кириллицы в латиницу
 */
function transliterate(text) {
    var map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        ' ': '_', '-': '_'
    };

    return text.toLowerCase().split('').map(function(char) {
        return map[char] !== undefined ? map[char] : char;
    }).join('');
}

/**
 * Отправка запроса на AWTRIX
 * @param {string} ip - IP адрес часов
 * @param {string} path - путь API (например "api/custom")
 * @param {Object} payload - данные для отправки
 * @param {Object} [queryParams] - query параметры (например {name: "app_name"})
 */
function sendToAwtrix(ip, path, payload, queryParams) {
    try {
        var request = HttpClient.POST("http://" + ip)
            .header('Content-Type', 'application/json')
            .path(path);

        // Добавляем query параметры если есть
        if (queryParams) {
            for (var key in queryParams) {
                if (queryParams.hasOwnProperty(key)) {
                    request = request.queryString(key, queryParams[key]);
                }
            }
        }

        var response = request
            .body(JSON.stringify(payload))
            .send();

        return response.getStatus() === 200;
    } catch (e) {
        log.error("AWTRIX HTTP error [" + ip + "]: " + e.message);
        return false;
    }
}

/**
 * Применение настроек на часы
 * - Встроенные приложения (TIM, DAT, TEMP, HUM, BAT)
 * - Яркость
 * - Время отображения приложений
 * - Перезагрузка для применения
 */
function applyClockSettings(ip) {
    var settings = {
        // Встроенные приложения (из констант)
        "TIM": BUILTIN_APPS.TIM,
        "DAT": BUILTIN_APPS.DAT,
        "TEMP": BUILTIN_APPS.TEMP,
        "HUM": BUILTIN_APPS.HUM,
        "BAT": BUILTIN_APPS.BAT,
        // Время отображения приложения (секунды)
        "ATIME": APP_DISPLAY_TIME
    };

    // Настройки яркости (из констант)
    if (AUTO_BRIGHTNESS) {
        settings.ABRI = true;
    } else {
        settings.ABRI = false;
        settings.BRI = MANUAL_BRIGHTNESS;
    }

    sendToAwtrix(ip, "api/settings", settings);

    // Перезагрузка часов для применения настроек
    sendToAwtrix(ip, "api/reboot", {});
}

// ============================================================================
// UNIT TESTS
// ============================================================================

var isDeveloping = true;  // Установить true для запуска тестов
var inTestMode = false;

// Хранилище HTTP-запросов для проверки в тестах
var httpRequests = [];

// Мок HttpClient для тестов
var MockHttpClient = {
    POST: function(url) {
        var request = {
            url: url,
            headers: {},
            pathSegment: "",
            queryParams: {},
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
            queryString: function(name, value) {
                request.queryParams[name] = value;
                // Добавляем query params к pathSegment для совместимости с тестами
                if (request.pathSegment.indexOf("?") === -1) {
                    request.pathSegment = request.pathSegment + "?" + name + "=" + value;
                } else {
                    request.pathSegment = request.pathSegment + "&" + name + "=" + value;
                }
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
 * Создание тестового датчика температуры
 */
function createTestTemperatureSensor(roomName, temperature) {
    return global.createUnitTestFullAccessory({
        id: Math.floor(Math.random() * 1000),
        name: "Датчик " + roomName,
        room: roomName,
        services: [{
            type: HS.TemperatureSensor,
            name: "Temperature Sensor",
            characteristics: [{
                type: HC.CurrentTemperature,
                value: temperature
            }]
        }]
    });
}

/**
 * Получение опций по умолчанию для тестов
 */
function getDefaultOptions() {
    return {
        veryColdThreshold: 0,
        coldThreshold: 18,
        hotThreshold: 24,
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
    if (!isDeveloping) {
        return;
    }

    if (!global.hasUnitTests) {
        log.warn("AWTRIX Tests: Сценарий UnitTests не установлен");
        return;
    }

    // Импорт assert функций
    var assertEquals = global.assertEquals;
    var assertTrue = global.assertTrue;
    var assertFalse = global.assertFalse;
    var assertNotNull = global.assertNotNull;
    var assertLength = global.assertLength;

    // Сохраняем оригинальный HttpClient
    var OriginalHttpClient = HttpClient;

    try {
        inTestMode = true;
        HttpClient = MockHttpClient;

        log.info("AWTRIX Tests: Запуск тестов...");

        // ==================== TEST: getColorByTemp ====================

        log.info("AWTRIX Tests: Тест getColorByTemp()");

        var options = getDefaultOptions();

        // Очень холодно (< 0)
        assertEquals(
            getColorByTemp(-10, options),
            COLORS.VERY_COLD,
            "getColorByTemp: -10° должен быть фиолетовым"
        );
        assertEquals(
            getColorByTemp(-1, options),
            COLORS.VERY_COLD,
            "getColorByTemp: -1° должен быть фиолетовым"
        );

        // Холодно (0 <= temp < 18)
        assertEquals(
            getColorByTemp(0, options),
            COLORS.COLD,
            "getColorByTemp: 0° должен быть синим"
        );
        assertEquals(
            getColorByTemp(10, options),
            COLORS.COLD,
            "getColorByTemp: 10° должен быть синим"
        );
        assertEquals(
            getColorByTemp(17.9, options),
            COLORS.COLD,
            "getColorByTemp: 17.9° должен быть синим"
        );

        // Комфортно (18 <= temp <= 24)
        assertEquals(
            getColorByTemp(18, options),
            COLORS.COMFORT,
            "getColorByTemp: 18° должен быть зелёным"
        );
        assertEquals(
            getColorByTemp(22, options),
            COLORS.COMFORT,
            "getColorByTemp: 22° должен быть зелёным"
        );
        assertEquals(
            getColorByTemp(24, options),
            COLORS.COMFORT,
            "getColorByTemp: 24° должен быть зелёным"
        );

        // Жарко (> 24)
        assertEquals(
            getColorByTemp(24.1, options),
            COLORS.HOT,
            "getColorByTemp: 24.1° должен быть красным"
        );
        assertEquals(
            getColorByTemp(30, options),
            COLORS.HOT,
            "getColorByTemp: 30° должен быть красным"
        );

        // Кастомные пороги
        var customOptions = {
            veryColdThreshold: -10,
            coldThreshold: 15,
            hotThreshold: 28
        };
        assertEquals(
            getColorByTemp(-5, customOptions),
            COLORS.COLD,
            "getColorByTemp: -5° с порогом -10 должен быть синим"
        );
        assertEquals(
            getColorByTemp(26, customOptions),
            COLORS.COMFORT,
            "getColorByTemp: 26° с порогом 28 должен быть зелёным"
        );

        log.info("AWTRIX Tests: getColorByTemp() - OK");

        // ==================== TEST: transliterate ====================

        log.info("AWTRIX Tests: Тест transliterate()");

        assertEquals(
            transliterate("Спальня"),
            "spalnya",
            "transliterate: 'Спальня' -> 'spalnya'"
        );
        assertEquals(
            transliterate("Кухня"),
            "kuhnya",
            "transliterate: 'Кухня' -> 'kuhnya'"
        );
        assertEquals(
            transliterate("Гостиная"),
            "gostinaya",
            "transliterate: 'Гостиная' -> 'gostinaya'"
        );
        assertEquals(
            transliterate("Детская комната"),
            "detskaya_komnata",
            "transliterate: 'Детская комната' -> 'detskaya_komnata'"
        );
        assertEquals(
            transliterate("Ванная-туалет"),
            "vannaya_tualet",
            "transliterate: 'Ванная-туалет' -> 'vannaya_tualet'"
        );
        assertEquals(
            transliterate("Room 1"),
            "room_1",
            "transliterate: 'Room 1' -> 'room_1'"
        );
        assertEquals(
            transliterate("Ёлка"),
            "yolka",
            "transliterate: 'Ёлка' -> 'yolka'"
        );

        log.info("AWTRIX Tests: transliterate() - OK");

        // ==================== TEST: trigger with valid temperature ====================

        log.info("AWTRIX Tests: Тест trigger() с валидной температурой");

        resetTestState();
        // Устанавливаем время старта в прошлое, чтобы trigger не пропускал отправку
        scenarioStartTime = Date.now() - REBOOT_DELAY - 1000;

        var sensor = createTestTemperatureSensor("Спальня", 22.5);
        var source = sensor.getService(HS.TemperatureSensor).getCharacteristic(HC.CurrentTemperature);
        var variables = { createdApps: {} };

        trigger(source, 22.5, variables, getDefaultOptions(), "TEST");

        // Проверяем что были отправлены запросы на все часы (N часов = N запросов)
        assertEquals(
            httpRequests.length,
            CLOCKS.length,
            "trigger: Должно быть " + CLOCKS.length + " HTTP запросов"
        );

        // Проверяем что приложение сохранено
        assertNotNull(
            variables.createdApps[source.getService().getUUID()],
            "trigger: Приложение должно быть сохранено в variables"
        );

        // Проверяем имя приложения
        assertEquals(
            variables.createdApps[source.getService().getUUID()],
            "temp_spalnya",
            "trigger: Имя приложения должно быть 'temp_spalnya'"
        );

        log.info("AWTRIX Tests: trigger() с валидной температурой - OK");

        // ==================== TEST: trigger with invalid temperature ====================

        log.info("AWTRIX Tests: Тест trigger() с невалидной температурой");

        resetTestState();
        scenarioStartTime = Date.now() - REBOOT_DELAY - 1000;
        variables = { createdApps: {} };

        // null
        trigger(source, null, variables, getDefaultOptions(), "TEST");
        assertLength(httpRequests, 0, "trigger: null температура не должна отправлять запросы");

        // undefined
        trigger(source, undefined, variables, getDefaultOptions(), "TEST");
        assertLength(httpRequests, 0, "trigger: undefined температура не должна отправлять запросы");

        // -100 (Aqara offline)
        trigger(source, -100, variables, getDefaultOptions(), "TEST");
        assertLength(httpRequests, 0, "trigger: -100 (Aqara offline) не должна отправлять запросы");

        log.info("AWTRIX Tests: trigger() с невалидной температурой - OK");

        // ==================== TEST: trigger во время перезагрузки часов ====================

        log.info("AWTRIX Tests: Тест trigger() во время перезагрузки");

        resetTestState();
        // Устанавливаем время старта в "недавнее прошлое" - часы ещё перезагружаются
        scenarioStartTime = Date.now() - 5000;  // 5 секунд назад (< REBOOT_DELAY)
        variables = { createdApps: {} };

        trigger(source, 23, variables, getDefaultOptions(), "TEST");

        // Во время перезагрузки запросы не должны отправляться
        assertLength(httpRequests, 0, "trigger: Во время перезагрузки запросы не должны отправляться");

        log.info("AWTRIX Tests: trigger() во время перезагрузки - OK");

        // ==================== TEST: payload содержит правильные данные ====================

        log.info("AWTRIX Tests: Тест payload данных");

        resetTestState();
        scenarioStartTime = Date.now() - REBOOT_DELAY - 1000;
        variables = { createdApps: {} };

        trigger(source, 22.7, variables, getDefaultOptions(), "TEST");

        var customRequest = arrayFind(httpRequests, function(req) {
            return req.pathSegment.indexOf("api/custom") === 0;
        });

        assertNotNull(customRequest, "payload: Должен быть запрос на /api/custom");

        var payload = JSON.parse(customRequest.bodyContent);
        assertEquals(payload.text, "23° Спальня", "payload: Текст должен быть '23° Спальня' (округлено)");
        assertEquals(payload.icon, 2056, "payload: Иконка должна быть 2056");
        assertEquals(payload.color, COLORS.COMFORT, "payload: Цвет должен быть зелёным (комфорт)");
        assertEquals(payload.lifetime, 3600, "payload: Lifetime должен быть 3600");

        log.info("AWTRIX Tests: payload данных - OK");

        // ==================== TEST: настройки часов ====================

        log.info("AWTRIX Tests: Тест настроек часов");

        resetTestState();

        // Вызываем applyClockSettings напрямую
        applyClockSettings(CLOCKS[0].ip);

        var settingsRequest = arrayFind(httpRequests, function(req) {
            return req.pathSegment === "api/settings";
        });

        assertNotNull(settingsRequest, "settings: Должен быть запрос на /api/settings");
        var settingsPayload = JSON.parse(settingsRequest.bodyContent);

        // Проверяем встроенные приложения (из констант)
        assertEquals(settingsPayload.TIM, BUILTIN_APPS.TIM, "settings: TIM должен быть " + BUILTIN_APPS.TIM);
        assertEquals(settingsPayload.DAT, BUILTIN_APPS.DAT, "settings: DAT должен быть " + BUILTIN_APPS.DAT);
        assertEquals(settingsPayload.TEMP, BUILTIN_APPS.TEMP, "settings: TEMP должен быть " + BUILTIN_APPS.TEMP);
        assertEquals(settingsPayload.HUM, BUILTIN_APPS.HUM, "settings: HUM должен быть " + BUILTIN_APPS.HUM);
        assertEquals(settingsPayload.BAT, BUILTIN_APPS.BAT, "settings: BAT должен быть " + BUILTIN_APPS.BAT);

        // Проверяем время отображения приложения
        assertEquals(settingsPayload.ATIME, APP_DISPLAY_TIME, "settings: ATIME должен быть " + APP_DISPLAY_TIME);

        // Проверяем яркость (зависит от константы AUTO_BRIGHTNESS)
        if (AUTO_BRIGHTNESS) {
            assertTrue(settingsPayload.ABRI, "settings: ABRI должен быть true (AUTO_BRIGHTNESS=true)");
        } else {
            assertFalse(settingsPayload.ABRI, "settings: ABRI должен быть false (AUTO_BRIGHTNESS=false)");
            assertEquals(settingsPayload.BRI, MANUAL_BRIGHTNESS, "settings: BRI должен быть " + MANUAL_BRIGHTNESS);
        }

        // Проверяем что был вызван reboot
        var rebootRequest = arrayFind(httpRequests, function(req) {
            return req.pathSegment === "api/reboot";
        });
        assertNotNull(rebootRequest, "settings: Должен быть запрос на /api/reboot");

        log.info("AWTRIX Tests: настройки часов - OK");

        // ==================== FINISH ====================

        log.info("AWTRIX Tests: ВСЕ ТЕСТЫ ПРОЙДЕНЫ!");

    } finally {
        inTestMode = false;
        HttpClient = OriginalHttpClient;
        resetTestState();
    }
}

// Запуск тестов
runTests();
