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
    charsList: null
};

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

// Выбор баз данных (можно включить обе, одну или ни одной)
const ENABLE_VM = true;
const ENABLE_INFLUXDB = true;

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
    HC.C_KiloWattHour
];

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
    HS.C_KiloWattHourMeter
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

function writeToVM(measurement, tags, fields) {
    var body = makeBody(measurement, tags, fields);
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

function writeToInfluxDB(measurement, tags, fields) {
    var body = makeBody(measurement, tags, fields);
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

// ============================================================================
// SECTION 5: DATA EXTRACTION
// ============================================================================

function getDataForMetrics(chr) {
    var service = chr.getService();
    var serviceName = service.getName();
    var serviceType = service.getType();
    var accessory = service.getAccessory();
    var accessoryName = accessory.getName();
    var roomName = accessory.getRoom().getName();
    var value = chr.getValue();

    return {
        tags: "room=" + roomName + ",accessory=" + accessoryName + ",type=" + serviceType + ",service=" + serviceName,
        value: "value=" + value
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
    writeToVM(MEASUREMENT, data.tags, data.value);
}

function sendCharToInfluxDB(chr) {
    var data = getDataForMetrics(chr);
    writeToInfluxDB(MEASUREMENT, data.tags, data.value);
}

function sendAllMetrics(options) {
    var list = getCharsList();

    for (var i = 0; i < list.length; i++) {
        var chr = list[i];
        if (ENABLE_VM) sendCharToVM(chr);
        if (ENABLE_INFLUXDB) sendCharToInfluxDB(chr);
    }

    if (options && options.ShowDebugLog) {
        log.info("Metrics: Sent " + list.length + " metrics to databases");
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

        initCronJobs(options);
        refreshCharsList(options);
    }

    if (!value) return;

    var accessory = source.getAccessory();
    var service = source.getService();
    var roomName = accessory.getRoom().getName();
    var accessoryName = accessory.getName();
    var serviceName = service.getName();
    var serviceType = service.getType();

    var tags = "room=" + roomName + ",accessory=" + accessoryName + ",type=" + serviceType + ",service=" + serviceName;
    var fields = "value=" + value;

    if (ENABLE_VM) writeToVM(MEASUREMENT, tags, fields);
    if (ENABLE_INFLUXDB) writeToInfluxDB(MEASUREMENT, tags, fields);

    if (options.ShowDebugLog) {
        log.info("Metrics: " + serviceName + " in " + roomName + " = " + value);
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
}

function runTests() {
    if (!global.hasUnitTests) return;

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
        assertNotNull(data.value, "getDataForMetrics: should return value");
        assertTrue(data.tags.indexOf("room=Kitchen") >= 0, "getDataForMetrics: tags should contain room");
        assertTrue(data.tags.indexOf("accessory=Test Sensor") >= 0, "getDataForMetrics: tags should contain accessory");
        assertEquals(data.value, "value=23.5", "getDataForMetrics: value should be formatted correctly");

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
