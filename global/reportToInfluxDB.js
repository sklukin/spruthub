function sendToInfluxDB(aid, cid) {
    const chr = Hub.getCharacteristic(aid, cid);

    // If that virtual sensor about temperature and dont have humidity sensor
    if (chr === null) {
        return;
    }
    
    const service = chr.getService();
    const serviceName = service.getName();
    const serviceType = service.getType();

    const accessory = service.getAccessory()
    const accessoryName = accessory.getName();
    
    const roomName = accessory.getRoom().getName();
    const value = chr.getValue()
    
    const tags = "room=${roomName},accessory=${accessoryName},type=${serviceType},service=${serviceName}";
    
    global.writeToInfluxDB('sensors', tags, "value=${value}")
}