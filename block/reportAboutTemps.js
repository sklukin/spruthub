// Trigger by cron

var now = new Date();
var hour = now.getHours(); // получаем текущий час

let res = ''
res = res + "Текущий час: " + hour + "\n";
res = res + global.reportAboutTemps();
global.sendToTelegram(res);