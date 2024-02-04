const charTemp = 15; // Characteristic about temp

const list = [
    47, 
    81, 
    82, 
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
];

function getTempList() {
    return list;
}

function reportAboutTemps() {
    let res = '';

    list.forEach(function(item) {
        res = res + Hub.getCharacteristic(item[0], charTemp).format() + '\n';
    });

    return res;
}