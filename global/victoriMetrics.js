const server = 'http://192.168.1.68:8428';

function makeBody(measurement, tags, fields) {
    const fields_replaced = fields.replace(/\s/g, '-')
    const tags_replaced = tags.replace(/\s/g, '-')
    return "${measurement},${tags_replaced} ${fields_replaced} ${Date.now()}";
}

function writeToVM(measurement, tags, fields) {
    const body = global.makeBody(measurement, tags, fields);
    // log.info("send body " + body)
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
    let value = chr.getValue();

    return { 
        tags:  "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}",
        value: "value=${value}",
    };
}

function sendCharToVM(chr) {
    const data = global.getDataForMetrics(chr);
    global.writeToVM('sensors', data.tags, data.value);
}