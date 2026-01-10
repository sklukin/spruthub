# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Naming

**Правильно:** SprutHub (без умлаута)
**Неправильно:** SprütHub, Sprüt Hub

## Important Notes

- **Нет `console`** — в SprutHub нет объекта `console`. Используй `log.info()`, `log.warn()`, `log.error()` для логирования.
- **ES5 только** — Nashorn не поддерживает многие ES6+ методы массивов: `find()`, `every()`, `some()`, `includes()`, `findIndex()`. Используй циклы или полифиллы.

## База знаний для сценариев

**ОБЯЗАТЕЛЬНО** при создании или изменении сценариев используй документацию из `docs/ScenarioTemplate/`:

| Файл | Описание |
|------|----------|
| `README.md` | Принципы разработки, структура сценариев, best practices |
| `LogicScenarioTemplate.js` | Шаблон логического сценария с примерами всех типов опций |
| `spruthub.js` | TypeScript интерфейсы всех API (Hub, Accessory, Service, Characteristic, HttpClient, Cron, etc.) |
| `sh_types.json` | Полный справочник всех типов сервисов (HS) и характеристик (HC) |

**Workflow:**
1. Перед созданием нового сценария — прочитай `LogicScenarioTemplate.js`
2. При работе с API — сверяйся с `spruthub.js`
3. При выборе типов сервисов/характеристик — используй `sh_types.json`

## Тестирование

**ОБЯЗАТЕЛЬНО** после каждого изменения сценария:
1. Запусти тесты: `node logic/test-runner.js`
2. Убедись что все тесты проходят
3. Если тесты падают — исправь код или тесты

**Если непонятно что править (код или тесты) — спроси у пользователя.**

## Project Overview

SprutHub automation scripts for collecting IoT sensor metrics from HomeKit accessories and sending them to time-series databases (VictoriaMetrics, InfluxDB) for monitoring via Grafana.

## Architecture

### Directory Structure

- **global/** - Shared utility functions available via `global.` namespace
  - Database integrations (VictoriaMetrics, InfluxDB)
  - Sensor data collection helpers
  - External API integrations (AWTRIX clock)

- **logic/** - Complex business logic with `info` metadata blocks
  - Triggered by sensor changes or on startup (`onStart: true`)
  - Contains `trigger(source, value, variables, options)` function

- **block/** - Simple cron-triggered scripts
  - No `info` block required
  - Scheduled via SprutHub cron configuration

- **docker/** - Docker Compose files for databases
  - InfluxDB, VictoriaMetrics, Grafana

### Script Metadata Format

Logic scripts use an `info` object for configuration:

```javascript
info = {
    name: "Script Name",
    description: "Description",
    version: "1.0",
    author: "@author",
    onStart: true,  // Run on startup
    sourceServices: [HS.TemperatureSensor, ...],
    sourceCharacteristics: [HC.CurrentTemperature, ...],
    variables: { /* persistent state */ },
    options: {
        MyOption: {
            name: { en: "English", ru: "Русский" },
            type: "Boolean",  // Boolean, Integer, Double, String, Enum, ServiceSelect
            value: false,     // default value
        },
    },
}
```

### Core Functions

```javascript
// Main callback - executed when monitored characteristics change
function trigger(source, value, variables, options, context) {
    // source: Characteristic that triggered
    // value: new value
    // variables: persistent scenario state
    // options: user-configured options
}

// Synchronous value transformer (use sparingly - blocks hub)
function compute(source, value, variables, options, context) {
    return value; // must return value matching characteristic type
}
```

## SprutHub Platform API

JavaScript runtime uses Nashorn engine (ES5 + limited ES6: arrow functions, template literals, const/let, Map/Set, for...of). No destructuring, classes, modules, or promises.

### Hub

```javascript
Hub.getAccessories()                           // → Accessory[]
Hub.getAccessory(id)                           // → Accessory
Hub.getRooms()                                 // → Room[]
Hub.getCharacteristic(aid, cid)                // → Characteristic
Hub.getCharacteristicValue(aid, cid)           // → any
Hub.setCharacteristicValue(aid, cid, value)
Hub.toggleCharacteristicValue(aid, cid)
Hub.subscribe(handler, ...args)                // → Task
Hub.subscribeWithCondition(cond, value, [hs], [hc], handler, ...args) // → Task
```

### Accessory

```javascript
accessory.getName() / setName(name)
accessory.getRoom()                            // → Room
accessory.getServices() / getServices(visible) / getServices(visible, hs)
accessory.getService(id) / getService(hs)      // → Service
accessory.getCharacteristic(id)                // → Characteristic
accessory.getUUID() / getModel() / getManufacturer() / getSerial() / getFirmware()
accessory.getSnapshot(width?, height?)         // → number[] (cameras)
```

### Service

```javascript
service.getAccessory()                         // → Accessory
service.getType()                              // → HS
service.getName() / setName(name)
service.getUUID()
service.isVisible() / setVisible(visible)
service.getCharacteristics()                   // → Characteristic[]
service.getCharacteristic(id) / getCharacteristic(hc)
```

### Characteristic

```javascript
characteristic.getValue() / setValue(value) / toggle()
characteristic.getType()                       // → HC
characteristic.getName() / getUUID() / format()
characteristic.getService() / getAccessory()
characteristic.getMinValue() / getMaxValue() / getMinStep()
characteristic.isNotify() / setNotify(notify)
characteristic.isStatusVisible() / setStatusVisible(visible)
```

### Room

```javascript
room.getName() / setName(name)
room.getAccessories()                          // → Accessory[]
```

### HttpClient

```javascript
HttpClient.GET(url) / POST(url) / PUT(url) / DELETE(url) / PATCH(url)
    .header(name, value)
    .queryString(name, value)
    .path(segment)
    .body(text) / body(bytes[])
    .field(name, value)                        // form fields
    .timeout(connect, read)
    .noCheckCertificate(true)
    .send()                                    // → HttpResponse

response.getStatus() / getStatusText()
response.getBody() / getBinary()
response.getHeaders() / getCookies()
response.back()                                // → HttpRequest (for retry)
```

### Timers & Cron

```javascript
setTimeout(handler, ms, ...args)               // → Task
setInterval(handler, ms, ...args)              // → Task
clearTimeout(task) / clearInterval(task) / clear(task)

Cron.schedule("0 * * * *", handler, ...args)   // → Task
Cron.sunrise(schedule, offsetMinutes, handler, ...args)
Cron.sunset(schedule, offsetMinutes, handler, ...args)
```

### Notifications

```javascript
Notify.text("Message %s", arg)
    .image(bytes[])
    .silent(true)
    .to(clientIndex, ...clients)
    .send()
```

### SSH

```javascript
SSH.host(host).port(22).username(user).password(pass).connect() // → SSHSession
session.execute(command, timeout?)
session.request(command, timeout?)             // → String
```

### Mail

```javascript
Mail.host(host).port(587).username(user).password(pass)
    .from(email).to(email)
    .subject(subj).body(text)
    .send()
```

### Utilities

```javascript
log.info(format, ...args) / log.warn() / log.error() / log.message()
Utils.uuid()                                   // → String
UtilsNet.ping(host)                            // → boolean
UtilsNet.wakeOnLan(mac)
UtilsNet.getMacAddress(host)
global.functionName()                          // functions from global/ scripts
GlobalVariables / LocalVariables               // persistent storage
```

### Common Service Types (HS)

`HS.Switch`, `HS.Lightbulb`, `HS.Outlet`, `HS.Thermostat`, `HS.TemperatureSensor`, `HS.HumiditySensor`, `HS.CarbonDioxideSensor`, `HS.MotionSensor`, `HS.ContactSensor`, `HS.LightSensor`, `HS.AirQualitySensor`, `HS.Fan`, `HS.WindowCovering`, `HS.LockMechanism`, `HS.SecuritySystem`, `HS.C_WattMeter`, `HS.C_VoltMeter`, `HS.C_AmpereMeter`, `HS.C_KiloWattHourMeter`

### Common Characteristic Types (HC)

`HC.On`, `HC.Brightness`, `HC.Hue`, `HC.Saturation`, `HC.CurrentTemperature`, `HC.TargetTemperature`, `HC.CurrentRelativeHumidity`, `HC.CarbonDioxideLevel`, `HC.VOCDensity`, `HC.CurrentAmbientLightLevel`, `HC.MotionDetected`, `HC.ContactSensorState`, `HC.C_Watt`, `HC.C_Volt`, `HC.C_Ampere`, `HC.C_KiloWattHour`

### Data Flow

```
HomeKit Accessories → logic/statisticsSensors.js (trigger)
                    ↘
                      global/victoriMetrics.js → VictoriaMetrics (192.168.1.68:8428)
                      global/influxDB.js       → InfluxDB (192.168.1.68:8086)
                    ↗
Cron → block/sendMetrics.js
```

## Running Databases

```bash
cd docker && docker compose up -d
```

## Metrics Collection

Two collection methods are used for completeness:

1. **Trigger-based** (`logic/statisticsSensors.js`) - Captures every sensor change
2. **Cron-based** (`block/sendMetrics.js`) - Periodic snapshots for hourly/daily aggregations

InfluxDB is used for short-term precision (~1 month), VictoriaMetrics for long-term retention (5 years).

## API Documentation

Full API reference: https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/ScenarioTemplate
