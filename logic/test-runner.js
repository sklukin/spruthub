#!/usr/bin/env node
/**
 * Node.js Test Runner для awtrixTemperature.js
 *
 * Запуск: node logic/test-runner.js
 *
 * Этот файл эмулирует окружение SprütHub для локального запуска тестов.
 */

// ============================================================================
// MOCK: HomeKit Service Types (HS)
// ============================================================================

global.HS = {
    TemperatureSensor: { toString: () => "TemperatureSensor" },
    HumiditySensor: { toString: () => "HumiditySensor" },
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
// MOCK: HttpClient (будет переопределён в тестах)
// ============================================================================

global.HttpClient = {
    POST: (url) => ({
        header: function() { return this; },
        path: function() { return this; },
        queryString: function() { return this; },
        body: function() { return this; },
        send: function() { return { getStatus: () => 200 }; }
    })
};

// ============================================================================
// MOCK: Hub object
// ============================================================================

global.Hub = {
    getAccessories: function() { return []; }
};

// ============================================================================
// MOCK: UnitTests Framework (из Sprut.Hub_Tools)
// ============================================================================

global.hasUnitTests = true;

global.assert = function(expression, message) {
    if (!expression) {
        const msg = "Ожидалось истинное значение, получено ложное";
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertEquals = function(actual, expected, message) {
    if (actual !== expected) {
        const msg = `Ожидалось '${expected}', получено '${actual}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertNotEquals = function(actual, notExpected, message) {
    if (actual === notExpected) {
        const msg = `Не ожидалось '${notExpected}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertTrue = function(value, message) {
    if (value !== true) {
        const msg = `Ожидалось true, получено '${value}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertFalse = function(value, message) {
    if (value !== false) {
        const msg = `Ожидалось false, получено '${value}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertNull = function(value, message) {
    if (value !== null) {
        const msg = `Ожидалось null, получено '${value}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertNotNull = function(value, message) {
    if (value === null || value === undefined) {
        const msg = `Ожидалось не null/undefined`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertDefined = function(value, message) {
    if (value === undefined) {
        const msg = `Ожидалось определённое значение`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertLength = function(array, length, message) {
    if (!array || array.length !== length) {
        const actualLength = array ? array.length : 0;
        const msg = `Ожидалась длина ${length}, получено ${actualLength}`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertContains = function(array, element, message) {
    if (!array || array.indexOf(element) === -1) {
        const msg = `Массив не содержит элемент '${element}'`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertEmpty = function(array, message) {
    if (!array || array.length !== 0) {
        const msg = `Ожидался пустой массив`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

global.assertNotEmpty = function(array, message) {
    if (!array || array.length === 0) {
        const msg = `Ожидался непустой массив`;
        const errorMsg = message ? `${message}: ${msg}` : msg;
        console.error("[FAIL]", errorMsg);
        process.exitCode = 1;
    }
};

// ============================================================================
// MOCK: createUnitTestFullAccessory (упрощённая версия)
// ============================================================================

global.createUnitTestFullAccessory = function(config) {
    let sId = 13;

    // Create Room
    const room = {
        _name: config.room,
        _accessories: [],
        getName: function() { return this._name; },
        setName: function(n) { this._name = n; },
        getAccessories: function() { return this._accessories; },
        setAccessories: function(a) { this._accessories = a; }
    };

    // Create Services
    const services = config.services.map(function(s) {
        const serviceId = s.id || sId++;

        // Create Characteristics
        const characteristics = s.characteristics.map(function(c) {
            const charId = c.id || sId++;
            let charValue = c.value;
            let charService = null;
            let charAccessory = null;

            return {
                _id: charId,
                _type: c.type,
                _name: c.name || c.type.toString(),
                getValue: function() { return charValue; },
                setValue: function(v) { charValue = v; },
                toggle: function() { if (typeof charValue === "boolean") charValue = !charValue; },
                getType: function() { return this._type; },
                getName: function() { return this._name; },
                getId: function() { return this._id; },
                getUUID: function() { return config.id + "." + this._id; },
                getService: function() { return charService; },
                setService: function(s) { charService = s; },
                getAccessory: function() { return charAccessory; },
                setAccessory: function(a) { charAccessory = a; },
                getMinValue: function() { return 0; },
                getMaxValue: function() { return 100; },
                getMinStep: function() { return 1; },
                format: function() { return "float"; },
                isNotify: function() { return true; },
                setNotify: function() {},
                isStatusVisible: function() { return true; },
                setStatusVisible: function() {},
                toString: function() { return `C[${this.getUUID()}]`; }
            };
        });

        let serviceAccessory = null;

        const service = {
            _id: serviceId,
            _type: s.type,
            _name: s.name || s.type.toString(),
            _visible: true,
            _characteristics: characteristics,
            getType: function() { return this._type; },
            getName: function() { return this._name; },
            setName: function(n) { this._name = n; },
            getId: function() { return this._id; },
            getUUID: function() { return config.id + "." + this._id; },
            isVisible: function() { return this._visible; },
            setVisible: function(v) { this._visible = v; },
            getAccessory: function() { return serviceAccessory; },
            setAccessory: function(a) { serviceAccessory = a; },
            getCharacteristics: function() { return this._characteristics; },
            getCharacteristic: function(typeOrId) {
                if (typeof typeOrId === "number") {
                    return this._characteristics.find(c => c._id === typeOrId);
                }
                return this._characteristics.find(c => c._type === typeOrId);
            },
            toString: function() { return `S[${this.getUUID()}]`; }
        };

        // Link characteristics to service
        characteristics.forEach(c => c.setService(service));

        return service;
    });

    // Create Accessory
    const accessory = {
        _id: config.id,
        _name: config.name,
        _room: room,
        _services: services,
        _model: config.model || "",
        _modelId: config.modelId || "",
        _manufacturer: config.manufacturer || "",
        _manufacturerId: config.manufacturerId || "",
        _serial: config.serial || "",
        _firmware: config.firmware || "",
        getId: function() { return this._id; },
        getUUID: function() { return String(this._id); },
        getName: function() { return this._name; },
        setName: function(n) { this._name = n; },
        getRoom: function() { return this._room; },
        setRoom: function(r) { this._room = r; },
        getServices: function(visible, type) {
            let result = this._services;
            if (visible !== undefined) {
                result = result.filter(s => s.isVisible() === visible);
            }
            if (type !== undefined) {
                result = result.filter(s => s.getType() === type);
            }
            return result;
        },
        getService: function(typeOrId) {
            if (typeof typeOrId === "number") {
                return this._services.find(s => s._id === typeOrId);
            }
            return this._services.find(s => s._type === typeOrId);
        },
        getCharacteristic: function(id) {
            for (const s of this._services) {
                const c = s.getCharacteristic(id);
                if (c) return c;
            }
            return null;
        },
        getModel: function() { return this._model; },
        getModelId: function() { return this._modelId; },
        getManufacturer: function() { return this._manufacturer; },
        getManufacturerId: function() { return this._manufacturerId; },
        getSerial: function() { return this._serial; },
        getFirmware: function() { return this._firmware; },
        getSnapshot: function() { return []; },
        toString: function() { return `A[${this.getUUID()}]`; }
    };

    // Link services to accessory
    services.forEach(s => {
        s.setAccessory(accessory);
        s.getCharacteristics().forEach(c => c.setAccessory(accessory));
    });

    // Link accessory to room
    room.setAccessories([accessory]);

    return accessory;
};

// ============================================================================
// LOAD AND RUN SCENARIOS
// ============================================================================

const fs = require('fs');
const path = require('path');

// Список сценариев с тестами
const scenarios = [
    { file: 'awtrixTemperature.js', name: 'AWTRIX Temperature Display' },
    { file: 'awtrixGarageDoor.js', name: 'AWTRIX Garage Door Indicator' }
];

let totalErrors = 0;

scenarios.forEach(function(scenario) {
    const scenarioPath = path.join(__dirname, scenario.file);

    // Пропускаем если файл не существует
    if (!fs.existsSync(scenarioPath)) {
        console.log("[SKIP] " + scenario.name + " - файл не найден");
        return;
    }

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
