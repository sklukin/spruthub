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
    list.unshift(47, 81, 82);

    list.forEach(function(item) {
        res = res + Hub.getCharacteristic(item, charTemp).format() + '\n';
    });

    return res;
}