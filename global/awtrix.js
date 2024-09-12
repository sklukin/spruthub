// https://blueforcer.github.io/awtrix3/#/api

clockHost = 'http://192.168.1.63';

function NotificationOn() {
  const body = { "color": [255, 0, 0], "fade": 1000 };
  try {
    let h = HttpClient.POST(clockHost)
      .header('Content-Type', 'application/json')
      .path('api/indicator1')
      .body(JSON.stringify(body))
      .send();
    // log.info(h);
  } catch (e) {
    log.error(e.message);
  }
}

function NotificationOff() {
  const body = {};
  try {
    let h = HttpClient.POST(clockHost)
      .header('Content-Type', 'application/json')
      .path('api/indicator1')
      .body(JSON.stringify(body))
      .send();
    log.info(h);
  } catch (e) {
    log.error(e.message);
  }
}
