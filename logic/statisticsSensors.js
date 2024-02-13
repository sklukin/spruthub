info = {
    name: "Статистика датчиков",
    description: "Сбор метрик датчиков и оптравка в InfluxDB VictoriMetrics",
    version: "0.5",
    author: "@sklukin",
    onStart: true,

    sourceServices: [HS.TemperatureSensor, HS.HumiditySensor, HS.CarbonDioxideSensor],
    sourceCharacteristics: [HC.CurrentTemperature, HC.CurrentRelativeHumidity, HC.CarbonDioxideLevel],

    variables: {
        active: true,
    },

    options: {
        SkipTemperature: {
            name: {
                en: "Skip temperature",
                ru: "Не учитывать температуру"
            },
            type: "Boolean",
            value: false,
        },
        SkipHumidity: {
            name: {
                en: "Skip humidity",
                ru: "Не учитывать влажность"
            },
            type: "Boolean",
            value: false,
        },
        SkipCO2: {
            name: {
                en: "Skip CO2",
                ru: "Не учитывать CO2",
            },
            type: "Boolean",
            value: false,
        },
        ShowDebugLog: {
            name: {
                en: "Show debug log",
                ru: "Показать логи отправки метрик",
            },
            type: "Boolean",
            value: false,
        },
    },
}

function isAllowedSensor(type, options) {
    if (type == HS.TemperatureSensor && options.SkipTemperature) {
        return false;
    }

    if (type == HS.HumiditySensor && options.SkipHumidity) {
        return false;
    }

    if (type == HS.CarbonDioxideSensor && options.SkipHumidity) {
        return false;
    }

    return true;
}

function trigger(source, value, variables, options) {
    if (!value) return;

    const accessory = source.getAccessory();
    const service   = source.getService();
    const roomName  = accessory.getRoom().getName();

    const accessoryName = accessory.getName();
    const serviceName   = service.getName();
    const serviceType   = service.getType();

    const log_info = "metrics for this sensor " + serviceName + " in room " + roomName + " value " + value;

    if (options.ShowDebugLog) {
        log.info("Trigger collect " + log_info);
    }

    if (!isAllowedSensor(service.getType(), options)) {
        if (options.ShowDebugLog) {
            log.info("Skip collect " + log_info);
        }
        return;
    }

    const tags = "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}";
    
    global.writeToVM('sensors', tags, "value=${value}");
    global.writeToInfluxDB('sensors', tags, "value=${value}");

    if (options.ShowDebugLog) {
        log.info("Сollect " + log_info);
    }
}