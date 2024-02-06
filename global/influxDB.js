const org = 'copper';
const server = 'http://192.168.1.68:8086';
const token = '..token..';
const bucket = 'sensors';

function writeToInfluxDB(measurement, tags, fields) {
    const body = global.makeBody(measurement, tags, fields);
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

    const data = global.getDataForMetrics(chr);

    global.writeToInfluxDB('sensors', data.tags, data.value);
}