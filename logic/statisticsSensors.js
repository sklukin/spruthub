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
    batchTask: null,    // задача setInterval для flush
    lastHealthStatus: { vm: true, influx: true }  // для дедупликации уведомлений
};

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

// Выбор баз данных (можно включить обе, одну или ни одной)
const ENABLE_VM = true;
const ENABLE_INFLUXDB = true;

// Батчинг метрик в trigger()
const ENABLE_BATCH_MODE = true;  // false = текущее поведение, true = батчинг
const BATCH_INTERVAL_MS = 30000;  // 30 секунд (только при ENABLE_BATCH_MODE = true)
const BATCH_SHOW_LOG = true; // Логировать отправку батчей

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
        active: true,
        showDebugLog: false
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

function escapeTagValue(val) {
    var str = String(val);
    return str.replace(/\s/g, '-').replace(/,/g, '\\,').replace(/=/g, '\\=');
}

function buildMetricLine(chr, valueOverride) {
    var service = chr.getService();
    var accessory = service.getAccessory();
    var value = (valueOverride !== undefined) ? valueOverride : chr.getValue();

    var tags = "room=" + escapeTagValue(accessory.getRoom().getName()) +
        ",accessory=" + escapeTagValue(accessory.getName()) +
        ",type=" + escapeTagValue(service.getType()) +
        ",service=" + escapeTagValue(service.getName()) +
        ",chrType=" + escapeTagValue(chr.getType());

    return MEASUREMENT + "," + tags + " value=" + value + " " + Date.now();
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
            .timeout(5000, 5000)
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
            .timeout(5000, 5000)
            .send();
    } catch(e) {
        log.error("InfluxDB write error: " + e.message);
    }
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

function sendAllMetrics(options) {
    var list = getCharsList();
    var lines = [];

    for (var i = 0; i < list.length; i++) {
        lines.push(buildMetricLine(list[i]));
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

function addToBatch(line) {
    _cronVariables.batch.push(line);
}

function flushBatch() {
    var lines = _cronVariables.batch;
    if (lines.length === 0) return;
    _cronVariables.batch = [];

    if (ENABLE_VM) writeBatchToVM(lines);
    if (ENABLE_INFLUXDB) writeBatchToInfluxDB(lines);

    if (BATCH_SHOW_LOG) {
        log.info("Metrics: Flushed batch - " + lines.length + " metrics");
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

var _taskKeys = ['metricsTask', 'refreshTask', 'healthCheckTask', 'batchTask'];

function clearAllTasks() {
    for (var i = 0; i < _taskKeys.length; i++) {
        var key = _taskKeys[i];
        if (_cronVariables[key]) {
            try { clear(_cronVariables[key]); } catch(e) {}
            _cronVariables[key] = null;
        }
    }
}

function initCronJobs(options) {
    // Отменяем существующие задачи
    clearAllTasks();

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

        _cronVariables.batch = [];
        initCronJobs(options);
        refreshCharsList(options);
    }

    if (value === null || value === undefined) return;

    var line = buildMetricLine(source, value);

    if (ENABLE_BATCH_MODE) {
        addToBatch(line);
    } else {
        if (ENABLE_VM) sendToVM(line);
        if (ENABLE_INFLUXDB) sendToInfluxDB(line);
    }

    variables.showDebugLog = options.ShowDebugLog;
    if (variables.showDebugLog) {
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
    var prev = _cronVariables.lastHealthStatus;
    var errors = [];
    var recovered = [];

    if (ENABLE_VM) {
        if (!result.vm && prev.vm) errors.push("VictoriaMetrics (" + VM_SERVER + ")");
        if (result.vm && !prev.vm) recovered.push("VictoriaMetrics (" + VM_SERVER + ")");
    }
    if (ENABLE_INFLUXDB) {
        if (!result.influx && prev.influx) errors.push("InfluxDB (" + INFLUX_SERVER + ")");
        if (result.influx && !prev.influx) recovered.push("InfluxDB (" + INFLUX_SERVER + ")");
    }

    _cronVariables.lastHealthStatus = { vm: result.vm, influx: result.influx };

    var message = null;

    if (errors.length > 0 && recovered.length > 0) {
        message = "SprutHub Metrics Alert\n\n" +
            "Недоступны базы данных:\n" + errors.join("\n") + "\n\n" +
            "Восстановлены базы данных:\n" + recovered.join("\n") + "\n\n" +
            "Время: " + new Date().toLocaleString();
    } else if (errors.length > 0) {
        message = "SprutHub Metrics Alert\n\n" +
            "Недоступны базы данных:\n" + errors.join("\n") + "\n\n" +
            "Время: " + new Date().toLocaleString();
    } else if (recovered.length > 0) {
        message = "SprutHub Metrics Recovery\n\n" +
            "Восстановлены базы данных:\n" + recovered.join("\n") + "\n\n" +
            "Время: " + new Date().toLocaleString();
    }

    if (message) {
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

var mockGetStatus = 200;

function createMockRequest(method, url) {
    var request = {
        method: method,
        url: url,
        headers: {},
        pathSegment: "",
        queryParams: {},
        bodyContent: null,
        timeoutConnect: null,
        timeoutRead: null
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
        timeout: function(connect, read) {
            request.timeoutConnect = connect;
            request.timeoutRead = read;
            return this;
        },
        send: function() {
            httpRequests.push(request);
            var status = mockGetStatus;
            return { getStatus: function() { return status; } };
        }
    };
}

var MockHttpClient = {
    POST: function(url) {
        return createMockRequest("POST", url);
    },
    GET: function(url) {
        return createMockRequest("GET", url);
    }
};

function resetTestState() {
    httpRequests = [];
    mockGetStatus = 200;
    _cronVariables.batch = [];
    _cronVariables.lastHealthStatus = { vm: true, influx: true };
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

        // ==================== TEST: buildMetricLine ====================
        log.info("Metrics Tests: Test buildMetricLine()");

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
        var line = buildMetricLine(chr);

        assertTrue(line.indexOf(MEASUREMENT + ",") === 0, "buildMetricLine: should start with measurement");
        assertTrue(line.indexOf("room=Kitchen") > 0, "buildMetricLine: should contain room tag");
        assertTrue(line.indexOf("accessory=Test-Sensor") > 0, "buildMetricLine: should escape spaces in accessory name");
        assertTrue(line.indexOf("value=23.5") > 0, "buildMetricLine: should contain value field");

        var lineOverride = buildMetricLine(chr, 99);
        assertTrue(lineOverride.indexOf("value=99") > 0, "buildMetricLine: valueOverride should take precedence");

        log.info("Metrics Tests: buildMetricLine() - OK");

        // ==================== TEST: isMonitoredCharacteristic ====================
        log.info("Metrics Tests: Test isMonitoredCharacteristic()");

        assertTrue(isMonitoredCharacteristic(HC.CurrentTemperature), "isMonitoredCharacteristic: temperature should be monitored");
        assertTrue(isMonitoredCharacteristic(HC.CurrentRelativeHumidity), "isMonitoredCharacteristic: humidity should be monitored");
        assertTrue(isMonitoredCharacteristic(HC.CarbonDioxideLevel), "isMonitoredCharacteristic: CO2 should be monitored");
        assertFalse(isMonitoredCharacteristic(HC.On), "isMonitoredCharacteristic: On should not be monitored");

        log.info("Metrics Tests: isMonitoredCharacteristic() - OK");

        // ==================== TEST: HTTP requests format ====================
        log.info("Metrics Tests: Test HTTP request formatting");

        resetTestState();

        sendToVM("sensors,room=Test value=1 123");

        assertEquals(httpRequests.length, 1, "sendToVM: should make one HTTP request");
        assertEquals(httpRequests[0].url, VM_SERVER, "sendToVM: should use VM server");
        assertEquals(httpRequests[0].pathSegment, "api/v2/write", "sendToVM: should use correct path");
        assertTrue(httpRequests[0].bodyContent.indexOf("sensors,room=Test") >= 0, "sendToVM: body should be line protocol");

        resetTestState();

        sendToInfluxDB("sensors,room=Test value=2 123");

        assertEquals(httpRequests.length, 1, "sendToInfluxDB: should make one HTTP request");
        assertEquals(httpRequests[0].url, INFLUX_SERVER, "sendToInfluxDB: should use InfluxDB server");
        assertEquals(httpRequests[0].queryParams.org, INFLUX_ORG, "sendToInfluxDB: should set org param");
        assertEquals(httpRequests[0].queryParams.bucket, INFLUX_BUCKET, "sendToInfluxDB: should set bucket param");
        assertEquals(httpRequests[0].headers['Authorization'], "Token " + INFLUX_TOKEN, "sendToInfluxDB: should set auth header");

        log.info("Metrics Tests: HTTP request formatting - OK");

        // ==================== TEST: addToBatch ====================
        log.info("Metrics Tests: Test addToBatch()");

        resetTestState();

        addToBatch("sensors,room=Test value=1 123");
        addToBatch("sensors,room=Test2 value=2 456");

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

        // ==================== TEST: isExcludedRoom ====================
        log.info("Metrics Tests: Test isExcludedRoom()");

        assertTrue(isExcludedRoom("Дом"), "isExcludedRoom: 'Дом' should be excluded");
        assertFalse(isExcludedRoom("Kitchen"), "isExcludedRoom: 'Kitchen' should not be excluded");
        assertFalse(isExcludedRoom(""), "isExcludedRoom: empty string should not be excluded");

        log.info("Metrics Tests: isExcludedRoom() - OK");

        // ==================== TEST: validateCron ====================
        log.info("Metrics Tests: Test validateCron()");

        assertEquals(validateCron("0 0 * * * *", "default"), "0 0 * * * *", "validateCron: valid 6-field cron should be returned as-is");
        assertEquals(validateCron("0 * * * *", "0 0 * * * *"), "0 0 * * * *", "validateCron: 5-field cron should return default");
        assertEquals(validateCron("", "0 0 * * * *"), "0 0 * * * *", "validateCron: empty string should return default");
        assertEquals(validateCron(null, "0 0 * * * *"), "0 0 * * * *", "validateCron: null should return default");

        log.info("Metrics Tests: validateCron() - OK");

        // ==================== TEST: escapeTagValue ====================
        log.info("Metrics Tests: Test escapeTagValue()");

        assertEquals(escapeTagValue("Kitchen"), "Kitchen", "escapeTagValue: plain string should be unchanged");
        assertEquals(escapeTagValue("Living Room"), "Living-Room", "escapeTagValue: spaces should become dashes");
        assertEquals(escapeTagValue("a,b"), "a\\,b", "escapeTagValue: commas should be escaped");
        assertEquals(escapeTagValue("a=b"), "a\\=b", "escapeTagValue: equals should be escaped");
        assertEquals(escapeTagValue("Room 1, Floor=2"), "Room-1\\,-Floor\\=2", "escapeTagValue: mixed special chars");

        log.info("Metrics Tests: escapeTagValue() - OK");

        // ==================== TEST: trigger with value=0 ====================
        log.info("Metrics Tests: Test trigger() with value=0");

        resetTestState();

        var triggerAccessory = global.createUnitTestFullAccessory({
            id: 2,
            name: "Power Meter",
            room: "Kitchen",
            services: [{
                type: HS.C_WattMeter,
                name: "Watt",
                characteristics: [{
                    type: HC.C_Watt,
                    value: 0
                }]
            }]
        });

        var triggerChr = triggerAccessory.getService(HS.C_WattMeter).getCharacteristic(HC.C_Watt);

        // Симулируем trigger с value=0 (не должен быть пропущен)
        var triggerValue = 0;
        if (triggerValue === null || triggerValue === undefined) {
            assertTrue(false, "trigger: value=0 should NOT be skipped");
        }
        addToBatch(buildMetricLine(triggerChr, triggerValue));

        assertEquals(_cronVariables.batch.length, 1, "trigger: value=0 should add to batch");
        assertTrue(_cronVariables.batch[0].indexOf("value=0") >= 0, "trigger: batch should contain value=0");

        log.info("Metrics Tests: trigger() with value=0 - OK");

        // ==================== TEST: checkConnectivity ====================
        log.info("Metrics Tests: Test checkConnectivity()");

        resetTestState();

        var connectResult = checkConnectivity();
        assertTrue(connectResult.vm, "checkConnectivity: VM should be OK with status 200");
        assertTrue(connectResult.influx, "checkConnectivity: InfluxDB should be OK with status 200");
        assertTrue(httpRequests.length >= 2, "checkConnectivity: should make GET requests");
        assertEquals(httpRequests[0].method, "GET", "checkConnectivity: should use GET method");
        assertEquals(httpRequests[0].pathSegment, "health", "checkConnectivity: should check /health");

        resetTestState();
        mockGetStatus = 500;

        var failResult = checkConnectivity();
        assertFalse(failResult.vm, "checkConnectivity: VM should fail with status 500");
        assertFalse(failResult.influx, "checkConnectivity: InfluxDB should fail with status 500");

        log.info("Metrics Tests: checkConnectivity() - OK");

        // ==================== TEST: health check deduplication ====================
        log.info("Metrics Tests: Test health check deduplication");

        resetTestState();
        var telegramMessages = [];
        var origSendToTelegram = global.sendToTelegram;
        global.sendToTelegram = function(msg) { telegramMessages.push(msg); };

        try {
            // Состояние: всё OK (lastHealthStatus = {vm:true, influx:true}), результат OK
            mockGetStatus = 200;
            _cronVariables.lastHealthStatus = { vm: true, influx: true };
            runHealthCheckWithNotification();
            assertEquals(telegramMessages.length, 0, "healthCheck: no notification when status unchanged (OK→OK)");

            // Состояние: было OK, стало FAIL
            telegramMessages = [];
            mockGetStatus = 500;
            _cronVariables.lastHealthStatus = { vm: true, influx: true };
            runHealthCheckWithNotification();
            assertEquals(telegramMessages.length, 1, "healthCheck: should notify on OK→FAIL");
            assertTrue(telegramMessages[0].indexOf("Недоступны") >= 0, "healthCheck: should contain failure message");

            // Состояние: было FAIL, осталось FAIL — без уведомления
            telegramMessages = [];
            mockGetStatus = 500;
            runHealthCheckWithNotification();
            assertEquals(telegramMessages.length, 0, "healthCheck: no notification when status unchanged (FAIL→FAIL)");

            // Состояние: было FAIL, стало OK — recovery
            telegramMessages = [];
            mockGetStatus = 200;
            runHealthCheckWithNotification();
            assertEquals(telegramMessages.length, 1, "healthCheck: should notify on FAIL→OK (recovery)");
            assertTrue(telegramMessages[0].indexOf("Восстановлены") >= 0, "healthCheck: should contain recovery message");
        } finally {
            global.sendToTelegram = origSendToTelegram;
        }

        log.info("Metrics Tests: health check deduplication - OK");

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
