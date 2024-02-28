const list = [];
Hub.getAccessories().forEach(function(a) { 
    if (a.getRoom().getName() == "Дом") return;

    var services = a.getServices()
    services.forEach(function(s) { 
        const chars = s.getCharacteristics();
        chars.forEach(function(ch) {
            if (
                ch.getType() == HC.CurrentTemperature 
                ||
                ch.getType() == HC.CurrentRelativeHumidity
                ||
                ch.getType() == HC.CarbonDioxideLevel
            ) {
                list.push(ch);
            }
        });
    })
})


function getCharsList() {
    return list;
}

function reportSensors() {
    res = '';
    list.forEach(function(chr) {
        if (
            chr.getType() == HC.CurrentTemperature
            ||
            chr.getType() == HC.CarbonDioxideLevel
        ) {
            res = res + chr.format() + '\n';    
        }
    });

    return res;
}