// Trigger by cron

const charTemp = 15; // Characteristic about temp
const charHum = 18; //  Characteristic about humidity

let list = global.getSensorsList();

list.forEach(function(aid) {
    global.sendToInfluxDB(aid, charTemp);
    global.sendToVM(aid, charTemp);
});

list.forEach(function(aid) {
    global.sendToInfluxDB(aid, charHum);
    global.sendToVM(aid, charHum);
});