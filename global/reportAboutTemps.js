const charTemp = 15; // Characteristic about temp

const list = [
    4,
    9,
    10, 
    26, 
    28, 
    27, 
    29, 
    45, 
    55, 
    67, 
    74, 
    75, 
    76, 
    77,
    78, 
];

function getSensorsList() {
    return list;
}

function reportAboutTemps() {
    let res = '';

    // Because the list above is also used to send to the database and this will 
    // interfere with the calculation of the average value at the database level. 
    // But in the telegram report I’m interested in these sensors
    const list2 = [47, 81, 82];
    list.forEach(function(item) { list2.push(item); });

    list2.forEach(function(item) {
        const char = Hub.getCharacteristic(item, charTemp);
        if (char != null) {
            res = res + char.format() + '\n';    
        }
        else {
            log.info("Could not find sensor " + item);
        }
    });

    return res;
}