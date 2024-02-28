// Trigger by cron

var now = new Date();
var hour = now.getHours(); // получаем текущий час

global.sendToTelegram(["Текущий час: " + hour, global.reportSensors()]);