const org = 'copper';
const server = 'http://192.168.1.68:8086';
const token = 'AK2rhKCvXG7sxbzivicYQQ2OFUimAaooxdM9tp-kV4_GBjmJXkP7_BdzAURpU8F-0zHWta4TVTo4AUesUk3Fqw=='; 
const bucket = 'sensors';

function writeToInfluxDB(measurement, tags, fields) {
    const body = "${measurement},${tags.replace(' ', '-')} ${fields.replace(' ', '-')} ${Date.now()}";
    // log.info(body);
    try {
        let h = HttpClient.POST(server)
            .header('Authorization', "Token ${token}")
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Accept', 'application/json')
            .path('api/v2/write')
            .queryString('org', org)
            .queryString('bucket', bucket)
            .queryString('precision', 'ms')
            .body(body)
            .send();
        // log.info(h);
    } catch(e) {
        log.error(e.message);
    }
}

function sendToInfluxDB(aid, cid) {
    const chr = Hub.getCharacteristic(aid, cid);

    // If that virtual sensor about temperature and dont have humidity sensor
    if (chr === null) {
        log.info("Could not find characteristic for ${aid} ${cid}");
        return;
    }
    
    const service = chr.getService();
    const serviceName = service.getName();
    const serviceType = service.getType();

    const accessory = service.getAccessory()
    const accessoryName = accessory.getName();
    
    const roomName = accessory.getRoom().getName();
    let value = chr.getValue()

    const tags = "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}";

    // log.info(tags); log.info("value ${value}");
    
    global.writeToInfluxDB('sensors', tags, "value=${value}")
}
