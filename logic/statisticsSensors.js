// ============================================================================
// SECTION 0: INITIALIZATION STATE
// ============================================================================

// Уникальная версия скрипта - меняется при каждой перезагрузке сценария
var SCRIPT_VERSION = Date.now();

// Последняя версия, при которой была инициализация
var _lastInitVersion = 0;

// Cron-задачи (общие для всех триггеров)
var _cronVariables = {
    metricsTask: null,
    refreshTask: null,
    healthCheckTask: null,
    charsList: null,
    batch: [],          // массив строк Line Protocol для батчинга
    batchTask: null     // задача setInterval для flush
};

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

// Выбор баз данных (можно включить обе, одну или ни одной)
const ENABLE_VM = true;
const ENABLE_INFLUXDB = true;

// Батчинг метрик в trigger()
const ENABLE_BATCH_MODE = true;  // false = текущее поведение, true = батчинг
const BATCH_INTERVAL_MS = 10000;  // 10 секунд (только при ENABLE_BATCH_MODE = true)
const BATCH_SHOW_LOG = false; // Логировать отправку батчей

// VictoriaMetrics configuration
const VM_SERVER = 'http://192.168.1.68:8428';

// InfluxDB configuration
const INFLUX_SERVER = 'http://192.168.1.68:8086';
const INFLUX_ORG = 'copper';
const INFLUX_TOKEN = '..token..';
const INFLUX_BUCKET = 'sensors';

// Measurement name
const MEASUREMENT = 'sensors';

// Комнаты, которые исключаются из сбора метрик
const EXCLUDED_ROOMS = [
    "Дом"
];

// Настройки периодической отправки метрик
const ENABLE_PERIODIC_SEND = true;
const CRON_SCHEDULE = "0 0 * * * *";           // Раз в час
const REFRESH_INTERVAL = "0 * * * * *";         // Раз в минуту

// Настройки проверки доступности баз данных
const ENABLE_HEALTH_CHECK = true;
const HEALTH_CHECK_SCHEDULE = "0 0,30 * * * *"; // Раз в 30 минут


// Единый список сервисов для мониторинга
const MONITORED_SERVICES = [
    HS.TemperatureSensor,
    HS.HumiditySensor,
    HS.CarbonDioxideSensor,
    HS.C_WattMeter,
    HS.C_VoltMeter,
    HS.C_AmpereMeter,
    HS.LightSensor,
    HS.AirQualitySensor,
    HS.C_KiloWattHourMeter,
];

// Единый список характеристик для мониторинга
const MONITORED_CHARACTERISTICS = [
    HC.CurrentTemperature,
    HC.CurrentRelativeHumidity,
    HC.CarbonDioxideLevel,
    HC.C_Watt,
    HC.C_Volt,
    HC.C_Ampere,
    HC.CurrentAmbientLightLevel,
    HC.VOCDensity,
    HC.C_KiloWattHour,
    HC.PM2_5Density
];


// ============================================================================
// SECTION 2: INFO BLOCK
// ============================================================================

info = {
    name: "Статистика датчиков",
    description: "Сбор метрик датчиков и отправка в InfluxDB и VictoriaMetrics",
    version: "1.0",
    author: "@sklukin",
    onStart: true,

    sourceServices: MONITORED_SERVICES,
    sourceCharacteristics: MONITORED_CHARACTERISTICS,

    variables: {
        active: true
    },

    options: {
        ShowDebugLog: {
            name: {
                en: "Show debug log",
                ru: "Показать логи отправки метрик"
            },
            type: "Boolean",
            value: false
        }
    }
}

// ============================================================================
// SECTION 3: LINE PROTOCOL FORMATTING
// ============================================================================

function makeBody(measurement, tags, fields) {
    var fields_replaced = fields.replace(/\s/g, '-');
    var tags_replaced = tags.replace(/\s/g, '-');
    return measurement + "," + tags_replaced + " " + fields_replaced + " " + Date.now();
}

// ============================================================================
// SECTION 4: DATABASE WRITERS
// ============================================================================

function sendToVM(body) {
    try {
        HttpClient.POST(VM_SERVER)
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Accept', 'application/json')
            .path('api/v2/write')
            .body(body)
            .send();
    } catch(e) {
        log.error("VM write error: " + e.message);
    }
}

function sendToInfluxDB(body) {
    try {
        HttpClient.POST(INFLUX_SERVER)
            .header('Authorization', "Token " + INFLUX_TOKEN)
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Accept', 'application/json')
            .path('api/v2/write')
            .queryString('org', INFLUX_ORG)
            .queryString('bucket', INFLUX_BUCKET)
            .queryString('precision', 'ms')
            .body(body)
            .send();
    } catch(e) {
        log.error("InfluxDB write error: " + e.message);
    }
}

function writeToVM(measurement, tags, fields) {
    sendToVM(makeBody(measurement, tags, fields));
}

function writeToInfluxDB(measurement, tags, fields) {
    sendToInfluxDB(makeBody(measurement, tags, fields));
}

// ============================================================================
// SECTION 5: DATA EXTRACTION
// ============================================================================

function getDataForMetrics(chr, valueOverride) {
    var service = chr.getService();
    var chrType = chr.getType();
    var serviceName = service.getName();
    var serviceType = service.getType();
    var accessory = service.getAccessory();
    var accessoryName = accessory.getName();
    var roomName = accessory.getRoom().getName();
    var value = (valueOverride !== undefined) ? valueOverride : chr.getValue();

    return {
        tags: "room=" + roomName + ",accessory=" + accessoryName + ",type=" + serviceType + ",service=" + serviceName + ",chrType=" + chrType,
        fields: "value=" + value
    };
}

// ES5-совместимая проверка типа характеристики
function isMonitoredCharacteristic(chrType) {
    for (var i = 0; i < MONITORED_CHARACTERISTICS.length; i++) {
        if (MONITORED_CHARACTERISTICS[i] === chrType) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// SECTION 6: CHARACTERISTIC COLLECTION
// ============================================================================

// ES5-совместимая проверка исключённой комнаты
function isExcludedRoom(roomName) {
    for (var i = 0; i < EXCLUDED_ROOMS.length; i++) {
        if (EXCLUDED_ROOMS[i] === roomName) {
            return true;
        }
    }
    return false;
}

function buildCharsList() {
    var list = [];
    var accessories = Hub.getAccessories();

    for (var i = 0; i < accessories.length; i++) {
        var accessory = accessories[i];

        // Пропускаем исключённые комнаты
        if (isExcludedRoom(accessory.getRoom().getName())) continue;

        var services = accessory.getServices();
        for (var j = 0; j < services.length; j++) {
            var service = services[j];
            var chars = service.getCharacteristics();

            for (var k = 0; k < chars.length; k++) {
                var ch = chars[k];
                if (isMonitoredCharacteristic(ch.getType())) {
                    list.push(ch);
                }
            }
        }
    }

    return list;
}

function getCharsList() {
    if (!_cronVariables.charsList || _cronVariables.charsList.length === 0) {
        _cronVariables.charsList = buildCharsList();
    }
    return _cronVariables.charsList;
}

function refreshCharsList(options) {
    _cronVariables.charsList = buildCharsList();

    if (options && options.ShowDebugLog) {
        log.info("Metrics: Device list refreshed, " + _cronVariables.charsList.length + " characteristics");
    }
}

// ============================================================================
// SECTION 7: SEND FUNCTIONS
// ============================================================================

function sendCharToVM(chr) {
    var data = getDataForMetrics(chr);
    writeToVM(MEASUREMENT, data.tags, data.fields);
}

function sendCharToInfluxDB(chr) {
    var data = getDataForMetrics(chr);
    writeToInfluxDB(MEASUREMENT, data.tags, data.fields);
}

function sendAllMetrics(options) {
    var list = getCharsList();
    var lines = [];

    for (var i = 0; i < list.length; i++) {
        var chr = list[i];
        var data = getDataForMetrics(chr);
        lines.push(makeBody(MEASUREMENT, data.tags, data.fields));
    }

    if (lines.length > 0) {
        if (ENABLE_VM) writeBatchToVM(lines);
        if (ENABLE_INFLUXDB) writeBatchToInfluxDB(lines);
    }

    if (options && options.ShowDebugLog) {
        log.info("Metrics: Sent " + list.length + " metrics to databases");
    }
}

// ============================================================================
// SECTION 7.1: BATCH FUNCTIONS
// ============================================================================

function writeBatchToVM(lines) {
    sendToVM(lines.join("\n"));
}

function writeBatchToInfluxDB(lines) {
    sendToInfluxDB(lines.join("\n"));
}

function addToBatch(measurement, tags, fields) {
    var line = makeBody(measurement, tags, fields);
    _cronVariables.batch.push(line);
}

function flushBatch() {
    var count = _cronVariables.batch.length;
    if (count === 0) return;

    if (ENABLE_VM) writeBatchToVM(_cronVariables.batch);
    if (ENABLE_INFLUXDB) writeBatchToInfluxDB(_cronVariables.batch);

    _cronVariables.batch = [];

    if (BATCH_SHOW_LOG) {
        log.info("Metrics: Flushed batch - " + count + " metrics");
    }
}

// ============================================================================
// SECTION 8: CRON INITIALIZATION
// ============================================================================

// Валидация cron-выражений (должно быть 6 полей)
function validateCron(expr, defaultExpr) {
    if (!expr) return defaultExpr;
    var fields = expr.trim().split(/\s+/);
    if (fields.length < 6) {
        log.warn("Metrics: Invalid cron '" + expr + "', using default '" + defaultExpr + "'");
        return defaultExpr;
    }
    return expr;
}

function initCronJobs(options) {
    // Отменяем существующие задачи
    if (_cronVariables.metricsTask) {
        clear(_cronVariables.metricsTask);
        _cronVariables.metricsTask = null;
    }
    if (_cronVariables.refreshTask) {
        clear(_cronVariables.refreshTask);
        _cronVariables.refreshTask = null;
    }
    if (_cronVariables.healthCheckTask) {
        clear(_cronVariables.healthCheckTask);
        _cronVariables.healthCheckTask = null;
    }

    // Проверяем, выбрана ли хотя бы одна база данных
    if (!ENABLE_VM && !ENABLE_INFLUXDB) {
        log.warn("Metrics: No database enabled (ENABLE_VM=false, ENABLE_INFLUXDB=false). Metrics will not be sent.");
    }

    // Планируем отправку метрик
    if (ENABLE_PERIODIC_SEND) {
        var metricsSchedule = validateCron(CRON_SCHEDULE, "0 0 * * * *");
        _cronVariables.metricsTask = Cron.schedule(metricsSchedule, function() {
            sendAllMetrics(options);
        });
        log.info("Metrics: Scheduled metrics sending with cron: " + metricsSchedule);

        var refreshSchedule = validateCron(REFRESH_INTERVAL, "0 * * * * *");
        _cronVariables.refreshTask = Cron.schedule(refreshSchedule, function() {
            refreshCharsList(options);
        });
        log.info("Metrics: Scheduled device refresh with cron: " + refreshSchedule);
    } else {
        log.info("Metrics: Periodic sending disabled");
    }

    // Планируем проверку доступности баз данных
    if (ENABLE_HEALTH_CHECK) {
        var healthSchedule = validateCron(HEALTH_CHECK_SCHEDULE, "0 0,30 * * * *");
        _cronVariables.healthCheckTask = Cron.schedule(healthSchedule, function() {
            runHealthCheckWithNotification();
        });
        log.info("Metrics: Scheduled health check with cron: " + healthSchedule);
    } else {
        log.info("Metrics: Health check disabled");
    }

    // Инициализация батчинга
    if (_cronVariables.batchTask) {
        clear(_cronVariables.batchTask);
        _cronVariables.batchTask = null;
    }

    if (ENABLE_BATCH_MODE) {
        _cronVariables.batchTask = setInterval(function() {
            flushBatch();
        }, BATCH_INTERVAL_MS);
        log.info("Metrics: Batch mode enabled, flush every " + BATCH_INTERVAL_MS + "ms");
    }
}

// ============================================================================
// SECTION 9: MAIN TRIGGER
// ============================================================================

function trigger(source, value, variables, options) {
    // Инициализация при первом вызове или после перезагрузки сценария
    if (_lastInitVersion !== SCRIPT_VERSION) {
        // Сразу ставим версию, чтобы избежать повторной инициализации
        _lastInitVersion = SCRIPT_VERSION;

        // Очищаем старые cron-задачи при перезагрузке
        if (_cronVariables.metricsTask) {
            try { clear(_cronVariables.metricsTask); } catch(e) {}
        }
        if (_cronVariables.refreshTask) {
            try { clear(_cronVariables.refreshTask); } catch(e) {}
        }
        if (_cronVariables.healthCheckTask) {
            try { clear(_cronVariables.healthCheckTask); } catch(e) {}
        }
        if (_cronVariables.batchTask) {
            try { clear(_cronVariables.batchTask); } catch(e) {}
        }
        // Очищаем буфер батчей при перезагрузке
        _cronVariables.batch = [];

        initCronJobs(options);
        refreshCharsList(options);
    }

    if (!value) return;

    var data = getDataForMetrics(source, value);

    if (ENABLE_BATCH_MODE) {
        // Батчинг: накапливаем и отправляем раз в BATCH_INTERVAL_MS
        addToBatch(MEASUREMENT, data.tags, data.fields);
    } else {
        // Текущее поведение: отправляем сразу
        if (ENABLE_VM) writeToVM(MEASUREMENT, data.tags, data.fields);
        if (ENABLE_INFLUXDB) writeToInfluxDB(MEASUREMENT, data.tags, data.fields);
    }

    if (options.ShowDebugLog) {
        log.info("Metrics: " + source.getService().getName() + " in " + source.getAccessory().getRoom().getName() + " = " + value);
    }
}

// ============================================================================
// SECTION 10: CONNECTIVITY TESTS
// ============================================================================

function checkVMConnectivity() {
    try {
        var response = HttpClient.GET(VM_SERVER)
            .path('health')
            .timeout(5000, 5000)
            .send();
        var status = response.getStatus();
        if (status === 200) {
            log.info("Metrics: VictoriaMetrics is available (" + VM_SERVER + ")");
            return true;
        } else {
            log.warn("Metrics: VictoriaMetrics returned status " + status);
            return false;
        }
    } catch(e) {
        log.error("Metrics: VictoriaMetrics is not available: " + e.message);
        return false;
    }
}

function checkInfluxDBConnectivity() {
    try {
        var response = HttpClient.GET(INFLUX_SERVER)
            .path('health')
            .timeout(5000, 5000)
            .send();
        var status = response.getStatus();
        if (status === 200) {
            log.info("Metrics: InfluxDB is available (" + INFLUX_SERVER + ")");
            return true;
        } else {
            log.warn("Metrics: InfluxDB returned status " + status);
            return false;
        }
    } catch(e) {
        log.error("Metrics: InfluxDB is not available: " + e.message);
        return false;
    }
}

function checkConnectivity() {
    var vmOk = ENABLE_VM ? checkVMConnectivity() : true;
    var influxOk = ENABLE_INFLUXDB ? checkInfluxDBConnectivity() : true;
    return { vm: vmOk, influx: influxOk };
}

// ============================================================================
// SECTION 10.1: HEALTH CHECK WITH NOTIFICATION
// ============================================================================

function runHealthCheckWithNotification() {
    var result = checkConnectivity();
    var errors = [];

    if (ENABLE_VM && !result.vm) {
        errors.push("VictoriaMetrics (" + VM_SERVER + ")");
    }
    if (ENABLE_INFLUXDB && !result.influx) {
        errors.push("InfluxDB (" + INFLUX_SERVER + ")");
    }

    if (errors.length > 0) {
        var message = "SprutHub Metrics Alert\n\n" +
            "Недоступны базы данных:\n" +
            errors.join("\n") + "\n\n" +
            "Время: " + new Date().toLocaleString();

        try {
            global.sendToTelegram(message);
            log.info("Metrics: Telegram notification sent");
        } catch(e) {
            log.error("Metrics: Telegram send failed: " + e.message);
        }
    }

    return result;
}

// ============================================================================
// SECTION 11: UNIT TESTS
// ============================================================================

var httpRequests = [];

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
                return this;
            },
            body: function(content) {
                request.bodyContent = content;
                return this;
            },
            send: function() {
                httpRequests.push(request);
                return { getStatus: function() { return 200; } };
            }
        };
    }
};

function resetTestState() {
    httpRequests = [];
    _cronVariables.batch = [];
}

function runTests() {
    if (!global.hasUnitTests) {
        log.warn("Metrics Tests: Сценарий UnitTests не установлен. Скачать: https://github.com/sklukin/spruthub/blob/main/global/unitTests.js");
        return;
    }

    var assertEquals = global.assertEquals;
    var assertTrue = global.assertTrue;
    var assertFalse = global.assertFalse;
    var assertNotNull = global.assertNotNull;

    var OriginalHttpClient = HttpClient;

    try {
        HttpClient = MockHttpClient;

        log.info("Metrics Tests: Starting...");

        // ==================== TEST: makeBody ====================
        log.info("Metrics Tests: Test makeBody()");

        var body = makeBody("sensors", "room=Kitchen,type=Temp", "value=22.5");

        assertTrue(body.indexOf("sensors,") === 0, "makeBody: should start with measurement");
        assertTrue(body.indexOf("room=Kitchen") > 0, "makeBody: should contain tags");
        assertTrue(body.indexOf("value=22.5") > 0, "makeBody: should contain fields");

        // Check space replacement
        var bodyWithSpaces = makeBody("sensors", "room=Living Room", "value=20");
        assertTrue(bodyWithSpaces.indexOf("Living-Room") > 0, "makeBody: should replace spaces with dashes");

        log.info("Metrics Tests: makeBody() - OK");

        // ==================== TEST: isMonitoredCharacteristic ====================
        log.info("Metrics Tests: Test isMonitoredCharacteristic()");

        assertTrue(isMonitoredCharacteristic(HC.CurrentTemperature), "isMonitoredCharacteristic: temperature should be monitored");
        assertTrue(isMonitoredCharacteristic(HC.CurrentRelativeHumidity), "isMonitoredCharacteristic: humidity should be monitored");
        assertTrue(isMonitoredCharacteristic(HC.CarbonDioxideLevel), "isMonitoredCharacteristic: CO2 should be monitored");
        assertFalse(isMonitoredCharacteristic(HC.On), "isMonitoredCharacteristic: On should not be monitored");

        log.info("Metrics Tests: isMonitoredCharacteristic() - OK");

        // ==================== TEST: getDataForMetrics ====================
        log.info("Metrics Tests: Test getDataForMetrics()");

        var testAccessory = global.createUnitTestFullAccessory({
            id: 1,
            name: "Test Sensor",
            room: "Kitchen",
            services: [{
                type: HS.TemperatureSensor,
                name: "Temperature",
                characteristics: [{
                    type: HC.CurrentTemperature,
                    value: 23.5
                }]
            }]
        });

        var chr = testAccessory.getService(HS.TemperatureSensor).getCharacteristic(HC.CurrentTemperature);
        var data = getDataForMetrics(chr);

        assertNotNull(data.tags, "getDataForMetrics: should return tags");
        assertNotNull(data.fields, "getDataForMetrics: should return fields");
        assertTrue(data.tags.indexOf("room=Kitchen") >= 0, "getDataForMetrics: tags should contain room");
        assertTrue(data.tags.indexOf("accessory=Test Sensor") >= 0, "getDataForMetrics: tags should contain accessory");
        assertEquals(data.fields, "value=23.5", "getDataForMetrics: fields should be formatted correctly");

        log.info("Metrics Tests: getDataForMetrics() - OK");

        // ==================== TEST: HTTP requests format ====================
        log.info("Metrics Tests: Test HTTP request formatting");

        resetTestState();

        writeToVM("sensors", "room=Test", "value=1");

        assertEquals(httpRequests.length, 1, "writeToVM: should make one HTTP request");
        assertEquals(httpRequests[0].url, VM_SERVER, "writeToVM: should use VM server");
        assertEquals(httpRequests[0].pathSegment, "api/v2/write", "writeToVM: should use correct path");
        assertTrue(httpRequests[0].bodyContent.indexOf("sensors,room=Test") >= 0, "writeToVM: body should be line protocol");

        resetTestState();

        writeToInfluxDB("sensors", "room=Test", "value=2");

        assertEquals(httpRequests.length, 1, "writeToInfluxDB: should make one HTTP request");
        assertEquals(httpRequests[0].url, INFLUX_SERVER, "writeToInfluxDB: should use InfluxDB server");
        assertEquals(httpRequests[0].queryParams.org, INFLUX_ORG, "writeToInfluxDB: should set org param");
        assertEquals(httpRequests[0].queryParams.bucket, INFLUX_BUCKET, "writeToInfluxDB: should set bucket param");
        assertEquals(httpRequests[0].headers['Authorization'], "Token " + INFLUX_TOKEN, "writeToInfluxDB: should set auth header");

        log.info("Metrics Tests: HTTP request formatting - OK");

        // ==================== TEST: sendCharToVM / sendCharToInfluxDB ====================
        log.info("Metrics Tests: Test sendCharToVM/sendCharToInfluxDB");

        resetTestState();

        sendCharToVM(chr);
        assertEquals(httpRequests.length, 1, "sendCharToVM: should make one HTTP request");

        resetTestState();

        sendCharToInfluxDB(chr);
        assertEquals(httpRequests.length, 1, "sendCharToInfluxDB: should make one HTTP request");

        log.info("Metrics Tests: sendCharToVM/sendCharToInfluxDB - OK");

        // ==================== TEST: addToBatch ====================
        log.info("Metrics Tests: Test addToBatch()");

        resetTestState();

        addToBatch("sensors", "room=Test", "value=1");
        addToBatch("sensors", "room=Test2", "value=2");

        assertEquals(_cronVariables.batch.length, 2, "addToBatch: should add to batch");
        assertTrue(_cronVariables.batch[0].indexOf("sensors,room=Test") >= 0, "addToBatch: batch should contain line protocol");
        assertTrue(_cronVariables.batch[1].indexOf("room=Test2") >= 0, "addToBatch: batch should contain second entry");

        log.info("Metrics Tests: addToBatch() - OK");

        // ==================== TEST: flushBatch ====================
        log.info("Metrics Tests: Test flushBatch()");

        // Batch already has 2 items from previous test
        flushBatch();

        assertEquals(httpRequests.length, 2, "flushBatch: should make two HTTP requests (VM + InfluxDB)");
        assertEquals(_cronVariables.batch.length, 0, "flushBatch: should clear batch");

        // Verify batch body contains multiple lines
        var vmRequest = httpRequests[0];
        var influxRequest = httpRequests[1];
        assertTrue(vmRequest.bodyContent.indexOf("\n") > 0, "flushBatch: VM request should contain multiple lines");
        assertTrue(influxRequest.bodyContent.indexOf("\n") > 0, "flushBatch: InfluxDB request should contain multiple lines");

        log.info("Metrics Tests: flushBatch() - OK");

        // ==================== TEST: flushBatch with empty buffer ====================
        log.info("Metrics Tests: Test flushBatch() with empty buffer");

        resetTestState();

        flushBatch();

        assertEquals(httpRequests.length, 0, "flushBatch: should not make requests with empty buffers");

        log.info("Metrics Tests: flushBatch() with empty buffer - OK");

        // ==================== TEST: writeBatchToVM / writeBatchToInfluxDB ====================
        log.info("Metrics Tests: Test writeBatchToVM/writeBatchToInfluxDB");

        resetTestState();

        var testLines = ["sensors,room=A value=1 123", "sensors,room=B value=2 456"];

        writeBatchToVM(testLines);
        assertEquals(httpRequests.length, 1, "writeBatchToVM: should make one HTTP request");
        assertEquals(httpRequests[0].bodyContent, "sensors,room=A value=1 123\nsensors,room=B value=2 456", "writeBatchToVM: body should be lines joined with newline");

        resetTestState();

        writeBatchToInfluxDB(testLines);
        assertEquals(httpRequests.length, 1, "writeBatchToInfluxDB: should make one HTTP request");
        assertEquals(httpRequests[0].bodyContent, "sensors,room=A value=1 123\nsensors,room=B value=2 456", "writeBatchToInfluxDB: body should be lines joined with newline");

        log.info("Metrics Tests: writeBatchToVM/writeBatchToInfluxDB - OK");

        // ==================== FINISH ====================
        log.info("Metrics Tests: ALL TESTS PASSED!");

    } finally {
        HttpClient = OriginalHttpClient;
        resetTestState();
    }
}

runTests();

// Проверка доступности баз данных при сохранении сценария
checkConnectivity();
