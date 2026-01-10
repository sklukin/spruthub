# AWTRIX Temperature Display - Тестирование

## Запуск тестов

### Способ 1: Локально через Node.js (рекомендуется для разработки)

```bash
cd /Users/sklukin/Develop/sklukin/spruthub
node logic/test-runner.js
```

**Что происходит:**
- Эмулируется окружение SprutHub (HS, HC, HttpClient, Hub, log)
- Загружается фреймворк UnitTests (assert функции, createUnitTestFullAccessory)
- Запускаются все тесты из `awtrixTemperature.js`

**Пример вывода:**
```
============================================================
AWTRIX Temperature Display - Unit Tests
============================================================

AWTRIX Tests: Запуск тестов...
AWTRIX Tests: Тест getColorByTemp()
AWTRIX Tests: getColorByTemp() - OK
AWTRIX Tests: Тест transliterate()
AWTRIX Tests: transliterate() - OK
...
AWTRIX Tests: ВСЕ ТЕСТЫ ПРОЙДЕНЫ!

============================================================
РЕЗУЛЬТАТ: ВСЕ ТЕСТЫ ПРОЙДЕНЫ
============================================================
```

### Способ 2: В SprutHub (полная интеграция)

1. **Установи UnitTests** из [Sprut.Hub_Tools](https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/UnitTest):
   - Скопируй `UnitTest/source/UnitTests.js` в глобальные сценарии хаба
   - Или установи через менеджер сценариев

2. **Сохрани сценарий** в SprutHub

3. **Проверь логи** — должно появиться:
   ```
   [INFO] AWTRIX Tests: Запуск тестов...
   ...
   [INFO] AWTRIX Tests: ВСЕ ТЕСТЫ ПРОЙДЕНЫ!
   [INFO] AWTRIX [Кухня]: Настройки применены, часы перезагружаются
   ```

> **Важно:** Тесты запускаются автоматически при каждом сохранении сценария. После тестов применяются настройки к часам.

## Покрытие тестов

| Функция | Тест | Описание |
|---------|------|----------|
| `getColorByTemp()` | Цветовые диапазоны | Проверка всех порогов относительно констант |
| `transliterate()` | Кириллица | "Спальня" → "spalnya" |
| `transliterate()` | Пробелы/дефисы | "Детская комната" → "detskaya_komnata" |
| `transliterate()` | Буква Ё | "Ёлка" → "yolka" |
| `transliterate()` | Латиница | "Room 1" → "room_1" |
| `trigger()` | Валидная температура | Отправка на все часы, сохранение приложения |
| `trigger()` | null/undefined | Пропуск невалидных значений |
| `trigger()` | -100 (Aqara offline) | Пропуск маркера оффлайн |
| `trigger()` | Во время перезагрузки | Пропуск отправки пока часы перезагружаются |
| `payload` | Структура JSON | text, icon, color, lifetime (APP_LIFETIME) |
| `settings` | Встроенные приложения | TIM, DAT, TEMP, HUM, BAT |
| `settings` | Яркость | ABRI, BRI (из констант) |

## Структура тестов

```
logic/
├── awtrixTemperature.js    # Сценарий + встроенные тесты
└── test-runner.js          # Node.js runner для локального запуска
```

## Добавление новых тестов

Тесты находятся в конце файла `awtrixTemperature.js` в функции `runTests()`.

**Шаблон теста:**
```javascript
// ==================== TEST: Описание теста ====================

log.info("AWTRIX Tests: Тест описание");

resetTestState();  // Сброс HTTP запросов

// Подготовка данных
var sensor = createTestTemperatureSensor("Комната", 22.5);
var source = sensor.getService(HS.TemperatureSensor)
    .getCharacteristic(HC.CurrentTemperature);
var variables = { createdApps: {} };

// Важно: установить scenarioStartTime в прошлое
scenarioStartTime = Date.now() - REBOOT_DELAY - 1000;

// Вызов тестируемой функции
trigger(source, 22.5, variables, getDefaultOptions(), "TEST");

// Проверки
assertEquals(actual, expected, "Описание проверки");
assertTrue(condition, "Описание проверки");

log.info("AWTRIX Tests: Тест описание - OK");
```

## Mock объекты

### MockHttpClient

Перехватывает HTTP запросы и сохраняет их в `httpRequests`:

```javascript
httpRequests = [
    {
        url: "http://192.168.1.65",
        headers: { "Content-Type": "application/json" },
        pathSegment: "api/custom?name=temp_spalnya",
        bodyContent: '{"text":"23° Спальня","icon":2056,...}'
    },
    // ...
];
```

### createTestTemperatureSensor(roomName, temperature)

Создаёт мок датчика температуры:

```javascript
var sensor = createTestTemperatureSensor("Спальня", 22.5);
var source = sensor.getService(HS.TemperatureSensor)
    .getCharacteristic(HC.CurrentTemperature);
```

### getDefaultOptions()

Возвращает опции по умолчанию:

```javascript
{
    debug: false
}
```

> **Примечание:** Пороги температуры и яркость задаются через константы, а не через опции.

## Устранение неполадок

**Ошибка: "Сценарий UnitTests не установлен"**
- Установи глобальный сценарий UnitTests из Sprut.Hub_Tools
- Или используй Node.js runner (`node logic/test-runner.js`)

**[FAIL] в выводе**
- Тест не прошёл, смотри описание ошибки
- Исправь код и перезапусти тесты

**Cannot set properties of undefined**
- Убедись что `variables` содержит поле `createdApps`:
  ```javascript
  var variables = { createdApps: {} };
  ```
- Убедись что `scenarioStartTime` установлен в прошлое для тестов:
  ```javascript
  scenarioStartTime = Date.now() - REBOOT_DELAY - 1000;
  ```
