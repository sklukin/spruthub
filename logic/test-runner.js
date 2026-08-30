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

// unitTests.js захватывает логгер при загрузке (global.log ещё не объявлен),
// поэтому assert'ы пишут в console.error — это единственный признак провала теста
let currentScenario = null;
const failedScenarios = [];
const _consoleError = console.error;

console.error = function(msg) {
    process.exitCode = 1;
    if (currentScenario) {
        if (failedScenarios.indexOf(currentScenario) === -1) failedScenarios.push(currentScenario);
        // GitHub Actions привяжет ошибку к файлу и покажет её в diff'е PR
        if (process.env.GITHUB_ACTIONS) {
            console.log("::error file=logic/" + currentScenario + "::" + String(msg).replace(/\n/g, "%0A"));
        }
    }
    _consoleError.apply(console, arguments);
};

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
    GarageDoorOpener: { toString: () => "GarageDoorOpener" },
    Outlet: { toString: () => "Outlet" }
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

// assert-функции из unitTests.js не бросают исключений, а только логируют через
// log.error — для CI это единственный признак провала теста
global.log = {
    info: (msg) => console.log("[INFO]", msg),
    warn: (msg) => console.log("[WARN]", msg),
    error: (msg) => { console.log("[ERROR]", msg); process.exitCode = 1; }
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

// Сценарии подхватываются автоматически — новый файл с function runTests()
// попадёт в прогон сам, править этот список не нужно
const scenarios = fs.readdirSync(__dirname)
    .filter(function(f) { return f.endsWith('.js') && f !== path.basename(__filename); })
    .sort();

scenarios.forEach(function(file) {
    const scenarioCode = fs.readFileSync(path.join(__dirname, file), 'utf8');

    if (!/function\s+runTests\s*\(/.test(scenarioCode)) {
        console.log("[SKIP] " + file + " — нет function runTests()");
        return;
    }

    // Сброс состояния между сценариями
    global.httpRequests = [];
    currentScenario = file;

    console.log("=".repeat(60));
    console.log(file + " - Unit Tests");
    console.log("=".repeat(60));
    console.log("");

    try {
        // Сценарии не вызывают runTests() сами — тесты запускает только раннер
        eval(scenarioCode + "\nrunTests();");
    } catch (e) {
        console.error("[FATAL]", e.message);
        console.error(e.stack);
        process.exitCode = 1;
    }

    currentScenario = null;
    console.log("");
});

console.log("=".repeat(60));

if (process.exitCode) {
    console.log("РЕЗУЛЬТАТ: ЕСТЬ ОШИБКИ");
    failedScenarios.forEach(function(f) { console.log("  ✗ " + f); });
} else {
    console.log("РЕЗУЛЬТАТ: ВСЕ ТЕСТЫ ПРОЙДЕНЫ");
}

console.log("=".repeat(60));
