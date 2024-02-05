info = {
    name: "Статистика датчиков",
    description: "Отправка значений датчиков в InfluxDB",
    version: "0.1",
    author: "@sklukin",
    onStart: true,

    sourceServices: [HS.TemperatureSensor, HS.HumiditySensor],
    sourceCharacteristics: [HC.CurrentTemperature, HC.CurrentRelativeHumidity],

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
    },
}

function isAllowedSensor(type, options) {
    if (type == HS.TemperatureSensor && options.SkipTemperature) {
        return false;
    }

    if (type == HS.HumiditySensor && options.SkipHumidity) {
        return false;
    }

    return true;
}

function trigger(source, value, variables, options) {
    const accessory = source.getAccessory();
    const service = source.getService();

    if (!isAllowedSensor(service.getType(), options)) {
        log.info("Skip get statisitics for this sensor " + source);
        return;
    }

    const accessoryName = accessory.getName();
    const serviceName   = service.getName();
    const serviceType   = service.getType();

    const roomName = accessory.getRoom().getName();
    const tags = "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}";
    
    // global.writeToInfluxDB('sensors', tags, "value=${value}");
    global.writeToVM('sensors', tags, "value=${value}");
}