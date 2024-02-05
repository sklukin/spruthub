const server = 'http://192.168.1.68:8428';

function writeToVM(measurement, tags, fields) {
    const body = "${measurement},${tags.replace(' ', '-')} ${fields.replace(' ', '-')} ${Date.now()}";
    try {
        let h = HttpClient.POST(server)
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Accept', 'application/json')
            .path('api/v2/write')
            .body(body)
            .send();
        // log.info(h);
    } catch(e) {
        log.error(e.message);
    }
}

function getDataForMetrics(chr) {
    const service = chr.getService();
    const serviceName = service.getName();
    const serviceType = service.getType();

    const accessory = service.getAccessory()
    const accessoryName = accessory.getName();
    
    const roomName = accessory.getRoom().getName();
    let value = chr.getValue()

    return { 
        tags: "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}",
        value: "value=${value}",
    };
}

function sendToVM(aid, cid) {
    const chr = Hub.getCharacteristic(aid, cid);

    // If that virtual sensor about temperature and dont have humidity sensor
    if (chr === null) {
        log.info("Could not find characteristic for ${aid} ${cid}");
        return;
    }

    const data = global.getDataForMetrics(chr);

    global.writeToVM('sensors', data.tags, data.value);
}