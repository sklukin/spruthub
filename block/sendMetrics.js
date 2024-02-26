const list = global.getCharsList();

list.forEach(function(chr){
    global.sendCharToVM(chr);
    global.sendCharToInfluxDB(chr);
});
