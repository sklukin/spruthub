info = {
    name: "Статистика датчиков",
    description: "Отправка значений датчиков в InfluxDB",
    version: "0.1",
    author: "@sklukin",
    onStart: false,

    sourceServices: [HS.TemperatureSensor, HS.HumiditySensor],
    sourceCharacteristics: [HC.CurrentTemperature, HC.CurrentRelativeHumidity]
}

function trigger(source, value) {
    const accessory = source.getAccessory();
    const accessoryName = accessory.getName();
    
    const service = source.getService();
    const serviceName = service.getName();
    const serviceType = service.getType();

    const roomName = accessory.getRoom().getName();
    const tags = "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}";
    
    global.writeToInfluxDB('sensors', tags, "value=${value}")
}