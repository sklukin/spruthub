const server = 'http://192.168.1.21:8086';
const org = 'copper';
const bucket = 'sensors';
const token = '...your-token...'; 

function writeToInfluxDB(measurement, tags, fields) {
    try {
        let h = HttpClient.POST(server)
            .header('Authorization', "Token ${token}")
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Accept', 'application/json')
            .path('api/v2/write')
            .queryString('org', org)
            .queryString('bucket', bucket)
            .queryString('precision', 'ms')
            .body("${measurement},${tags.replace(' ', '\\ ')} ${fields.replace(' ', '\\ ')} ${Date.now()}")
            .send();
    } catch(e) {
        log.error(e.message);
    }
}