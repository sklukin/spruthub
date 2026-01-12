#!/usr/bin/env node
/**
 * Node.js Test Runner для сценариев SprutHub
 *
 * Запуск: node logic/test-runner.js
 *
 * Этот файл эмулирует окружение SprutHub для локального запуска тестов.
 * Assert-функции и createUnitTestFullAccessory загружаются из global/unitTests.js
 */

// ============================================================================
// ЗАГРУЗКА UNIT TESTS FRAMEWORK
// ============================================================================

const unitTests = require('../global/unitTests.js');

// Экспортируем все функции в global
global.hasUnitTests = true;
global.assert = unitTests.assert;
global.assertNull = unitTests.assertNull;
global.assertNotNull = unitTests.assertNotNull;
global.assertEquals = unitTests.assertEquals;
global.assertNotEquals = unitTests.assertNotEquals;
global.assertTrue = unitTests.assertTrue;
global.assertFalse = unitTests.assertFalse;
global.assertDefined = unitTests.assertDefined;
global.assertContains = unitTests.assertContains;
global.assertEmpty = unitTests.assertEmpty;
global.assertNotEmpty = unitTests.assertNotEmpty;
global.assertLength = unitTests.assertLength;
global.createUnitTestFullAccessory = unitTests.createUnitTestFullAccessory;

// ============================================================================
// MOCK: HomeKit Service Types (HS)
// ============================================================================

global.HS = {
    TemperatureSensor: { toString: () => "TemperatureSensor" },
    HumiditySensor: { toString: () => "HumiditySensor" },
    CarbonDioxideSensor: { toString: () => "CarbonDioxideSensor" },
    C_WattMeter: { toString: () => "C_WattMeter" },
    C_VoltMeter: { toString: () => "C_VoltMeter" },
    C_AmpereMeter: { toString: () => "C_AmpereMeter" },
    LightSensor: { toString: () => "LightSensor" },
    AirQualitySensor: { toString: () => "AirQualitySensor" },
    C_KiloWattHourMeter: { toString: () => "C_KiloWattHourMeter" },
    Switch: { toString: () => "Switch" },
    Lightbulb: { toString: () => "Lightbulb" },
    GarageDoorOpener: { toString: () => "GarageDoorOpener" }
};

// ============================================================================
// MOCK: HomeKit Characteristic Types (HC)
// ============================================================================

global.HC = {
    CurrentTemperature: { toString: () => "CurrentTemperature" },
    CurrentRelativeHumidity: { toString: () => "CurrentRelativeHumidity" },
    CarbonDioxideLevel: { toString: () => "CarbonDioxideLevel" },
    C_Watt: { toString: () => "C_Watt" },
    C_Volt: { toString: () => "C_Volt" },
    C_Ampere: { toString: () => "C_Ampere" },
    CurrentAmbientLightLevel: { toString: () => "CurrentAmbientLightLevel" },
    VOCDensity: { toString: () => "VOCDensity" },
    C_KiloWattHour: { toString: () => "C_KiloWattHour" },
    On: { toString: () => "On" },
    CurrentDoorState: { toString: () => "CurrentDoorState" }
};

// ============================================================================
// MOCK: log object
// ============================================================================

global.log = {
    info: (msg) => console.log("[INFO]", msg),
    warn: (msg) => console.log("[WARN]", msg),
    error: (msg) => console.log("[ERROR]", msg)
};

// ============================================================================
// MOCK: HttpClient
// ============================================================================

global.HttpClient = {
    POST: (url) => ({
        header: function() { return this; },
        path: function() { return this; },
        queryString: function() { return this; },
        body: function() { return this; },
        timeout: function() { return this; },
        send: function() { return { getStatus: () => 200 }; }
    }),
    GET: (url) => ({
        header: function() { return this; },
        path: function() { return this; },
        queryString: function() { return this; },
        timeout: function() { return this; },
        send: function() { return { getStatus: () => 200 }; }
    })
};

// ============================================================================
// MOCK: Cron object
// ============================================================================

global.Cron = {
    schedule: function(expression, handler) {
        return { expression: expression, handler: handler, cancelled: false };
    }
};

global.clear = function(task) {
    if (task) task.cancelled = true;
};

// ============================================================================
// MOCK: Hub object
// ============================================================================

global.Hub = {
    getAccessories: function() { return []; }
};

// ============================================================================
// LOAD AND RUN SCENARIOS
// ============================================================================

const fs = require('fs');
const path = require('path');

// Список сценариев с тестами
const scenarios = [
    { file: 'awtrixTemperature.js', name: 'AWTRIX Temperature Display' },
    { file: 'awtrixGarageDoor.js', name: 'AWTRIX Garage Door Indicator' },
    { file: 'statisticsSensors.js', name: 'Statistics Sensors Metrics' }
];

scenarios.forEach(function(scenario) {
    const scenarioPath = path.join(__dirname, scenario.file);

    // Пропускаем если файл не существует
    if (!fs.existsSync(scenarioPath)) {
        console.log("[SKIP] " + scenario.name + " - файл не найден");
        return;
    }

    // Сброс состояния между сценариями
    global.httpRequests = [];

    let scenarioCode = fs.readFileSync(scenarioPath, 'utf8');

    // Enable tests by replacing isDeveloping = false with true
    scenarioCode = scenarioCode.replace('var isDeveloping = false;', 'var isDeveloping = true;');

    console.log("=".repeat(60));
    console.log(scenario.name + " - Unit Tests");
    console.log("=".repeat(60));
    console.log("");

    try {
        // Execute scenario code
        eval(scenarioCode);
    } catch (e) {
        console.error("[FATAL]", e.message);
        console.error(e.stack);
        process.exitCode = 1;
    }

    console.log("");
});

console.log("=".repeat(60));

if (process.exitCode === 1) {
    console.log("РЕЗУЛЬТАТ: ЕСТЬ ОШИБКИ");
} else {
    console.log("РЕЗУЛЬТАТ: ВСЕ ТЕСТЫ ПРОЙДЕНЫ");
}

console.log("=".repeat(60));
