// Trigger by cron

// 15 - Characteristic about temp
// 18 - Characteristic about humidity
// 32 - Characteristic about CO2

const chars = [15, 18, 32];
const list = global.getSensorsList();

chars.forEach(function(charId){
    list.forEach(function(aid) {
        global.sendToInfluxDB(aid, charId);
        global.sendToVM(aid, charId);
    });
});
