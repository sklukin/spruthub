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

// Уровни температуры: пороги и цвета
// threshold — верхняя граница диапазона (temp < threshold)
// null означает "без ограничения" (самый горячий уровень)
const TEMPERATURE_LEVELS = {
    FREEZING: { threshold: -20, color: "#9400D3" },  // фиолетовый: < -20°C
    COLD:     { threshold: -12, color: "#0000FF" },  // синий: -20 до -12°C
    COOL:     { threshold: 0,   color: "#00FFFF" },  // голубой: -12 до 0°C
    WARM:     { threshold: 15,  color: "#00FF00" },  // зелёный: 0 до 15°C
    HOT:      { threshold: 25,  color: "#FFA500" },  // оранжевый: 15 до 25°C
    BOILING:  { threshold: null, color: "#FF0000" }  // красный: >= 25°C
};

// Невалидное значение 
const INVALID_TEMP = -100;

// Настройки яркости
const AUTO_BRIGHTNESS = false;
const MANUAL_BRIGHTNESS = 50;  // 0-255, используется если AUTO_BRIGHTNESS = false

// Время отображения приложения (секунды)
const APP_DISPLAY_TIME = 10;

// Время жизни приложения (секунды). Удаляется если нет обновлений.
const APP_LIFETIME = 86400;  // 24 часа

// Иконки по комнатам (название комнаты => ID иконки)
// Если иконка найдена — показывается только температура с иконкой
// Если не найдена — показывается температура с названием комнаты
const ROOM_ICONS = {
    "Улица": 4285,
    "Гараж": 2083,
};

// Задержка после перезагрузки перед отправкой данных (мс)
const REBOOT_DELAY = 5000;

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
    version: "1.1",
    author: "@sklukin",
    onStart: true,
    sourceServices: [HS.TemperatureSensor],
    sourceCharacteristics: [HC.CurrentTemperature],

    options: {
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
    var color = getColorByTemp(value);

    // 7. Проверяем есть ли иконка для комнаты
    var roomIcon = ROOM_ICONS[roomName];
    var hasIcon = roomIcon !== undefined;

    // 8. Формат текста: с иконкой — только температура, без — с названием
    var tempText;
    if (hasIcon) {
        tempText = Math.round(value) + "°";
    } else {
        var shortName = shortenName(roomName, 4);
        tempText = Math.round(value) + "° " + shortName;
    }

    // 9. Payload для custom app
    var payload = {
        text: tempText,
        color: color,
        noScroll: true,
        lifetime: APP_LIFETIME
    };

    // Добавляем иконку если есть для комнаты
    if (hasIcon) {
        payload.icon = roomIcon;
        payload.pushIcon = 2;
    }

    // 10. Отправка на все часы
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

    // 11. Сохранение информации о созданном приложении
    variables.createdApps[serviceUUID] = appName;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Определение цвета по температуре
 */
function getColorByTemp(temp) {
    var levelOrder = ['FREEZING', 'COLD', 'COOL', 'WARM', 'HOT', 'BOILING'];
    for (var i = 0; i < levelOrder.length; i++) {
        var level = TEMPERATURE_LEVELS[levelOrder[i]];
        if (level.threshold === null || temp < level.threshold) {
            return level.color;
        }
    }
    return TEMPERATURE_LEVELS.BOILING.color;
}

/**
 * Сокращение текста до N символов
 */
function shortenName(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength);
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
        log.warn("AWTRIX Tests: Сценарий UnitTests не установлен. Скачать: https://github.com/sklukin/spruthub/blob/main/global/unitTests.js");
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

        // Тесты используют пороги из TEMPERATURE_LEVELS

        // FREEZING (< -20°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.FREEZING.threshold - 10),
            TEMPERATURE_LEVELS.FREEZING.color,
            "getColorByTemp: ниже FREEZING.threshold должен быть фиолетовым"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.FREEZING.threshold - 0.1),
            TEMPERATURE_LEVELS.FREEZING.color,
            "getColorByTemp: чуть ниже FREEZING.threshold должен быть фиолетовым"
        );

        // COLD (-20 до -12°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.FREEZING.threshold),
            TEMPERATURE_LEVELS.COLD.color,
            "getColorByTemp: на границе FREEZING должен быть синим"
        );
        assertEquals(
            getColorByTemp((TEMPERATURE_LEVELS.FREEZING.threshold + TEMPERATURE_LEVELS.COLD.threshold) / 2),
            TEMPERATURE_LEVELS.COLD.color,
            "getColorByTemp: между FREEZING и COLD должен быть синим"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.COLD.threshold - 0.1),
            TEMPERATURE_LEVELS.COLD.color,
            "getColorByTemp: чуть ниже COLD.threshold должен быть синим"
        );

        // COOL (-12 до 0°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.COLD.threshold),
            TEMPERATURE_LEVELS.COOL.color,
            "getColorByTemp: на границе COLD должен быть голубым"
        );
        assertEquals(
            getColorByTemp((TEMPERATURE_LEVELS.COLD.threshold + TEMPERATURE_LEVELS.COOL.threshold) / 2),
            TEMPERATURE_LEVELS.COOL.color,
            "getColorByTemp: между COLD и COOL должен быть голубым"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.COOL.threshold - 0.1),
            TEMPERATURE_LEVELS.COOL.color,
            "getColorByTemp: чуть ниже COOL.threshold должен быть голубым"
        );

        // WARM (0 до 15°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.COOL.threshold),
            TEMPERATURE_LEVELS.WARM.color,
            "getColorByTemp: на границе COOL должен быть зелёным"
        );
        assertEquals(
            getColorByTemp((TEMPERATURE_LEVELS.COOL.threshold + TEMPERATURE_LEVELS.WARM.threshold) / 2),
            TEMPERATURE_LEVELS.WARM.color,
            "getColorByTemp: между COOL и WARM должен быть зелёным"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.WARM.threshold - 0.1),
            TEMPERATURE_LEVELS.WARM.color,
            "getColorByTemp: чуть ниже WARM.threshold должен быть зелёным"
        );

        // HOT (15 до 25°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.WARM.threshold),
            TEMPERATURE_LEVELS.HOT.color,
            "getColorByTemp: на границе WARM должен быть оранжевым"
        );
        assertEquals(
            getColorByTemp((TEMPERATURE_LEVELS.WARM.threshold + TEMPERATURE_LEVELS.HOT.threshold) / 2),
            TEMPERATURE_LEVELS.HOT.color,
            "getColorByTemp: между WARM и HOT должен быть оранжевым"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.HOT.threshold - 0.1),
            TEMPERATURE_LEVELS.HOT.color,
            "getColorByTemp: чуть ниже HOT.threshold должен быть оранжевым"
        );

        // BOILING (>= 25°C)
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.HOT.threshold),
            TEMPERATURE_LEVELS.BOILING.color,
            "getColorByTemp: на границе HOT должен быть красным"
        );
        assertEquals(
            getColorByTemp(TEMPERATURE_LEVELS.HOT.threshold + 10),
            TEMPERATURE_LEVELS.BOILING.color,
            "getColorByTemp: выше HOT.threshold должен быть красным"
        );
        assertEquals(
            getColorByTemp(50),
            TEMPERATURE_LEVELS.BOILING.color,
            "getColorByTemp: 50°C должен быть красным (BOILING)"
        );

        log.info("AWTRIX Tests: getColorByTemp() - OK");

        // ==================== TEST: shortenName ====================

        log.info("AWTRIX Tests: Тест shortenName()");

        assertEquals(
            shortenName("Спальня", 4),
            "Спал",
            "shortenName: 'Спальня' -> 'Спал'"
        );
        assertEquals(
            shortenName("Кухня", 4),
            "Кухн",
            "shortenName: 'Кухня' -> 'Кухн'"
        );
        assertEquals(
            shortenName("Зал", 4),
            "Зал",
            "shortenName: 'Зал' -> 'Зал' (короче 4)"
        );

        log.info("AWTRIX Tests: shortenName() - OK");

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
        // Устанавливаем время старта так, чтобы прошло меньше REBOOT_DELAY
        scenarioStartTime = Date.now() - Math.floor(REBOOT_DELAY / 2);
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

        // Используем температуру в диапазоне WARM (0 до 15°C)
        var warmTemp = (TEMPERATURE_LEVELS.COOL.threshold + TEMPERATURE_LEVELS.WARM.threshold) / 2;
        var expectedColor = getColorByTemp(warmTemp);

        trigger(source, warmTemp, variables, getDefaultOptions(), "TEST");

        var customRequest = arrayFind(httpRequests, function(req) {
            return req.pathSegment.indexOf("api/custom") === 0;
        });

        assertNotNull(customRequest, "payload: Должен быть запрос на /api/custom");

        var payload = JSON.parse(customRequest.bodyContent);
        assertEquals(payload.text, Math.round(warmTemp) + "° Спал", "payload: Текст должен содержать температуру и комнату");
        assertEquals(payload.color, expectedColor, "payload: Цвет должен соответствовать температуре");
        assertEquals(payload.lifetime, APP_LIFETIME, "payload: Lifetime должен быть APP_LIFETIME");

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

// ============================================================================
// ПРИМЕНЕНИЕ НАСТРОЕК К ЧАСАМ (после тестов)
// ============================================================================

CLOCKS.forEach(function(clock) {
    applyClockSettings(clock.ip);
    log.info("AWTRIX [" + clock.name + "]: Настройки применены, часы перезагружаются");
});
