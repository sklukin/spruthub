info = {
    name: "StarLine",
    description: "Авторизация и получение slnet кода. Обязательно активируйте параметр логического сценария Последовательное выполенение. Идентификатор приложения appId и пароль secret можно получить в личном кабинете в разделе Разработчикам на my.starline.ru.",
    version: "0.1",
    author: "@Sergey_Bukreev",
    onStart: false,

    sourceServices: [HS.Switch],
    sourceCharacteristics: [HC.On],

    options: {
        Login: {
            name: {
                en: "Login",
                ru: "Логин"
            },
            type: "String",
            value: "asdf"
        },
        Pass: {
            name: {
                en: "Password",
                ru: "Пароль"
            },
            type: "String",
            value: "111111"
        },
        AppID: {
            name: {
                en: "App ID",
                ru: "App ID"
            },
            type: "String",
            value: "11111"
        },
        Secret: {
            name: {
                en: "Secret",
                ru: "Secret"
            },
            type: "String",
            value: "qp11111111119Pkfh"
        },
        SMS: {
            name: {
                en: "SMS",
                ru: "SMS только при необходимости"
            },
            type: "String",
            value: ""
        }
    }
}

function trigger(source, value, variables, options, contex) {
    //log.message("!!!Обязательно активируйте параметр логического сценария Последовательное выполнение")
    const appId = options.AppID
    const secret = options.Secret
    const login = options.Login
    const pass = options.Pass

    //определение номера Аксессуара, где был активирован сценарий
    let uuidStr = source.getUUID()
    let uuidObj = {}
    uuidObj = uuidStr.split(".")
    let findHC = uuidObj[0]

    //Блок дополнительных функций
    //функция возвращает MD5
    var MD5 = function(d) {
        var r = M(V(Y(X(d), 8 * d.length)));
        return r.toLowerCase()
    };

    function M(d) {
        for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++) _ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _);
        return f
    }

    function X(d) {
        for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++) _[m] = 0;
        for (m = 0; m < 8 * d.length; m += 8) _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32;
        return _
    }

    function V(d) {
        for (var _ = "", m = 0; m < 32 * d.length; m += 8) _ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255);
        return _
    }

    function Y(d, _) {
        d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _;
        for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) {
            var h = m,
                t = f,
                g = r,
                e = i;
            f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e)
        }
        return Array(m, f, r, i)
    }

    function md5_cmn(d, _, m, f, r, i) {
        return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m)
    }

    function md5_ff(d, _, m, f, r, i, n) {
        return md5_cmn(_ & m | ~_ & f, d, _, r, i, n)
    }

    function md5_gg(d, _, m, f, r, i, n) {
        return md5_cmn(_ & f | m & ~f, d, _, r, i, n)
    }

    function md5_hh(d, _, m, f, r, i, n) {
        return md5_cmn(_ ^ m ^ f, d, _, r, i, n)
    }

    function md5_ii(d, _, m, f, r, i, n) {
        return md5_cmn(m ^ (_ | ~f), d, _, r, i, n)
    }

    function safe_add(d, _) {
        var m = (65535 & d) + (65535 & _);
        return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m
    }

    function bit_rol(d, _) {
        return d << _ | d >>> 32 - _
    }
    //функция возвращает SHA1
    function sha1(str) {
        var hash
        try {
            var crypto = require('crypto')
            var sha1sum = crypto.createHash('sha1')
            sha1sum.update(str)
            hash = sha1sum.digest('hex')
        } catch (e) {
            hash = undefined
        }
        if (hash !== undefined) {
            return hash
        }
        var _rotLeft = function(n, s) {
            var t4 = (n << s) | (n >>> (32 - s))
            return t4
        }
        var _cvtHex = function(val) {
            var str = ''
            var i
            var v
            for (i = 7; i >= 0; i--) {
                v = (val >>> (i * 4)) & 0x0f
                str += v.toString(16)
            }
            return str
        }
        var blockstart
        var i, j
        var W = new Array(80)
        var H0 = 0x67452301
        var H1 = 0xEFCDAB89
        var H2 = 0x98BADCFE
        var H3 = 0x10325476
        var H4 = 0xC3D2E1F0
        var A, B, C, D, E
        var temp
        // utf8_encode
        str = unescape(encodeURIComponent(str))
        var strLen = str.length
        var wordArray = []
        for (i = 0; i < strLen - 3; i += 4) {
            j = str.charCodeAt(i) << 24 |
                str.charCodeAt(i + 1) << 16 |
                str.charCodeAt(i + 2) << 8 |
                str.charCodeAt(i + 3)
            wordArray.push(j)
        }
        switch (strLen % 4) {
            case 0:
                i = 0x080000000
                break
            case 1:
                i = str.charCodeAt(strLen - 1) << 24 | 0x0800000
                break
            case 2:
                i = str.charCodeAt(strLen - 2) << 24 | str.charCodeAt(strLen - 1) << 16 | 0x08000
                break
            case 3:
                i = str.charCodeAt(strLen - 3) << 24 |
                    str.charCodeAt(strLen - 2) << 16 |
                    str.charCodeAt(strLen - 1) <<
                    8 | 0x80
                break
        }
        wordArray.push(i)
        while ((wordArray.length % 16) !== 14) {
            wordArray.push(0)
        }
        wordArray.push(strLen >>> 29)
        wordArray.push((strLen << 3) & 0x0ffffffff)
        for (blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
            for (i = 0; i < 16; i++) {
                W[i] = wordArray[blockstart + i]
            }
            for (i = 16; i <= 79; i++) {
                W[i] = _rotLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1)
            }
            A = H0
            B = H1
            C = H2
            D = H3
            E = H4
            for (i = 0; i <= 19; i++) {
                temp = (_rotLeft(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff
                E = D
                D = C
                C = _rotLeft(B, 30)
                B = A
                A = temp
            }
            for (i = 20; i <= 39; i++) {
                temp = (_rotLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff
                E = D
                D = C
                C = _rotLeft(B, 30)
                B = A
                A = temp
            }
            for (i = 40; i <= 59; i++) {
                temp = (_rotLeft(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff
                E = D
                D = C
                C = _rotLeft(B, 30)
                B = A
                A = temp
            }
            for (i = 60; i <= 79; i++) {
                temp = (_rotLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff
                E = D
                D = C
                C = _rotLeft(B, 30)
                B = A
                A = temp
            }
            H0 = (H0 + A) & 0x0ffffffff
            H1 = (H1 + B) & 0x0ffffffff
            H2 = (H2 + C) & 0x0ffffffff
            H3 = (H3 + D) & 0x0ffffffff
            H4 = (H4 + E) & 0x0ffffffff
        }
        temp = _cvtHex(H0) + _cvtHex(H1) + _cvtHex(H2) + _cvtHex(H3) + _cvtHex(H4)
        return temp.toLowerCase()
    }

    if (value && source.getService().getName() == "Авторизация") {
        if (options.SMS == "") {
            //получаем MD5 от secret
            var secretMD5 = MD5(secret)

            // 1 этап
            //Получение кода приложения для дальнейшего получения токена. 
            //Срок годности кода приложения – 1 час. 
            //В результате выполнения в консоль будет выведен код приложения

            try {

                var getCode = {}
                var code

                getCode = JSON.parse(HttpClient.GET("https://id.starline.ru/apiV3/application/getCode?")
                    .queryString("appId", appId)
                    .queryString("secret", secretMD5)
                    .send()
                    .getBody()
                )

                if (getCode.state === 1) {
                    //выводим в консоль код приложения, если ответ корректный
                    code = getCode.desc.code
                    log.message("1 этап ОК. Код приложения " + code)

                    // 2 этап
                    //Получение токена приложения для дальнейшей авторизации.
                    //Время жизни токена приложения – 4 часа.
                    //В результате выполнения в консоль будет выведен токен приложения.

                    try {

                        var getToken = {}


                        //MD5 от результата конкатенации (соединения) пароля приложения и кода, 
                        //полученного через /application/getCode на первом этапе
                        var secretToken = secret + "" + code
                        var secretTokenMD5 = MD5(secretToken)

                        getToken = JSON.parse(HttpClient.GET("https://id.starline.ru/apiV3/application/getToken?")

                            .queryString("appId", appId)
                            .queryString("secret", secretTokenMD5)
                            .send()
                            .getBody()
                        )

                        if (getToken.state === 1) {
                            //выводим в консоль токен приложения, если ответ корректный
                            GlobalVariables.token = getToken.desc.token
                            log.message("2 этап ОК. Токен приложения " + GlobalVariables.token)

                        } else {
                            //выводим в консоль ошибку
                            log.message("ОШИБКА на 2 этапе " + JSON.stringify(getToken))
                        }

                    } catch (e) {
                        log.error(e.message)
                    }

                } else {
                    //выводим в консоль ошибку
                    log.message("ОШИБКА на 1 этапе " + JSON.stringify(getCode))
                }

            } catch (e) {
                log.error(e.message)
            }
        } else {
            log.message("ГРАФА СМС В НАСТРОЙКАХ ЛОГИКИ ВЫКЛЮЧАТЕЛЯ ЗАПОЛНЕНА И СЦЕНАРИЙ НАЧИНАЕТСЯ С 3 ЭТАПА")
        }

        // 3 этап
        //Аутентификация пользователя по логину и паролю. 

        //Неверные данные аутентификации или слишком частое выполнение запроса аутентификации с одного IP-адреса 
        //может привести к запросу капчи. Для того чтобы сервер SLID корректно обрабатывал клиентский IP,
        //необходимо проксировать его в параметре user_ip. 

        //В противном случае все запросы аутентификации будут фиксироваться для IP-адреса сервера приложения,
        //что приведет к частому требованию капчи. 

        //В случае, если включена двухфакторная аутентификация, то в ответе придет сообщение "Need confirmation".
        //Вам потребуется вписать код из смс из вашего телефона в поле smsCode, после чего повторить данный запрос.

        //В результате в консоль будет выведен StarLineID token. 

        try {

            //login Логин пользователя или любой из подтвержденных email-ов
            //pass SHA1 от пароля пользователя
            //user_ip IP-адрес клиента
            //smsCode Код из смс, используется только в случае включенной двухфакторной аутентификации
            //captchaSid Заполняется в случае, если в ответ на аутентификацию была получена ошибка 'Captcha needed' из одноименного параметра ответа
            //captchaCode Заполняется в случае, если в ответ на аутентификацию была получена ошибка 'Captcha needed'. Должен содержать значение кода с картинки

            var userLogin = {}
            GlobalVariables.slIDToken = ""
            GlobalVariables.slID = ""

            //SHA1 от пароля pass
            var passSHA1 = sha1(pass)

            var data = {}
            //возожно понадобится смс при двухфакторной авторизации
            //при заполненной графе SMS в опциях сценария, сценарий сразу запустится с 3 этапе,
            //поэтому необходимо сначала запустить сценарий без СМС, потом после получения кода,
            //внести в опцию полученный код и заново запустить сценарий.
            if (options.SMS == "") {
                data = {
                    login: login,
                    pass: passSHA1
                    //smsCode: options.SMS
                    //captchaSid
                    //captchaCode
                }
            } else {
                data = {
                    login: login,
                    pass: passSHA1,
                    smsCode: options.SMS
                    //captchaSid
                    //captchaCode
                }
            }

            //ниже блок кода по формированию формы из логина и пароля в тело запроса
            var boundary = String(Math.random()).slice(2);
            var boundaryMiddle = '--' + boundary + '\r\n';
            var boundaryLast = '--' + boundary + '--\r\n'

            var body = ['\r\n'];
            for (var key in data) {
                body.push('Content-Disposition: form-data; name="' + key + '"\r\n\r\n' + data[key] + '\r\n');
            }

            body = body.join(boundaryMiddle) + boundaryLast;

            //сам http запрос
            userLogin = JSON.parse(HttpClient.POST("https://id.starline.ru/apiV3/user/login")
                .header("Content-Type", 'multipart/form-data; boundary=' + boundary)
                .header("token", GlobalVariables.token)
                .body(body)
                .send()
                .getBody()
            )

            if (userLogin.state === 1) {
                //выводим в консоль StarLine ID Token, если ответ корректный
                GlobalVariables.slIDToken = userLogin.desc.user_token
                GlobalVariables.slID = userLogin.desc.id

                log.message("3 этап ОК. StarLine ID Token " + GlobalVariables.slIDToken)
                log.message("3 этап ОК. ID " + GlobalVariables.slID)

                // 4 этап
                //Полученный в результате успешного выполнения команды cookie необходимо использовать 
                //в методах WebAPI для прохождения авторизации. 
                //Для того чтобы сервер понимал, что аутентификацию следует выполнять digest методом,
                //клиент должен передать в запросе заголовок 'DigestAuth:true'.
                //username – slid-token, password – идентификатор пользователя на StarLineID сервере (slid user_id). 
                try {


                        try {

                            var url = "https://developer.starline.ru/json/v2/auth.slid"
                            var body = ""
                            body = "{\"slid_token\":\"" + GlobalVariables.slIDToken + "\"}"
                            //log.message("5 этап. Body " + body)

                            var authResp = HttpClient.POST(url)
                                .body(body)
                                .send()

                            authHeaders = authResp.getHeaders()

                            var isCookie = authHeaders.get("Set-Cookie") + ""
                            isCookie = isCookie.replace(/[[\]]/g, "")
                            log.message("isCooke: ", isCookie)

                            //блок по формированию из строки заголовка объекта с массивом данных
                            var slCookie = {}

                            slCookie = isCookie.split("; ")

                            var slObj = {}

                            slCookie.forEach(function(entry) {
                                entry = entry.split("=");
                                slObj[entry[0]] = entry[1].replace(/;/g, "");
                            });
                            GlobalVariables.slNet = slObj.slnet
                            log.message("4 этап OK. Получили slNet cookie аутентификации " + GlobalVariables.slNet)

                            var authResponse = {}
                            var authResponse = JSON.parse(authResp.getBody());

                            if (getCode.state === 1) {
                                //выводим в консоль user id, если ответ корректный
                                log.message("5 этап OK. Запрос информации по устройству " + JSON.stringify(authResponse))
                                GlobalVariables.userID = authResponse.user_id
                                log.message("5 этап OK. Получили User ID  " + GlobalVariables.userID)


                                //6 этап
                                //запрос информации по устройствам и определению device_id

                                try {

                                    var url = "https://developer.starline.ru/json/v3/user/" + GlobalVariables.userID + "/data"
                                    log.message("6 этап. URL запроса " + url)
                                    var dataResponse = {}
                                    var dataResponse = JSON.parse(HttpClient.GET(url)
                                        .header("cookie", "slnet=" + GlobalVariables.slNet)
                                        .send()
                                        .getBody()
                                    )

                                    if (getCode.state === 1) {
                                        //выводим в консоль информацию по устройствам, если ответ корректный
                                        log.message("6 этап OK. Запрос информации по всем устройствам " + JSON.stringify(dataResponse))
                                        //тут перебираем подряд все устройства
                                        log.message("6 этап ОК. Вы имеете доступ к следующему кол-ву устройств: " + dataResponse.user_data.devices.length)
                                        for (var i = 0; i < dataResponse.user_data.devices.length; i++) {
                                            log.message("№ " + (i + 1) + " имя " + dataResponse.user_data.devices[i].alias + " Device ID " + dataResponse.user_data.devices[i].device_id)

                                        }

                                        log.message("slnet " + GlobalVariables.slNet)

                                        if (options.SMS != "") {
                                            log.message("Не забудьте очистить графу СМС в опциях сценария выключателя")
                                        }

                                        Hub.getAccessory(findHC).getServices().forEach(function(_s) {
                                            _s.getCharacteristics().forEach(function(_c) {
                                                if (_c.getType() == "C_String") {
                                                    if (_s.getName() == "Token") {
                                                        _c.setValue(GlobalVariables.slNet)
                                                    }
                                                    if (_s.getName() == "Device") {
                                                        _c.setValue(dataResponse.user_data.devices[0].device_id + "")
                                                    }
                                                    if (_s.getName() == "User") {
                                                        _c.setValue(GlobalVariables.userID)
                                                    }
                                                }
                                            })
                                        })


                                    } else {
                                        //выводим в консоль ошибку
                                        log.message("ОШИБКА на 6 этапе " + JSON.stringify(getCode))
                                    }

                                } catch (e) {
                                    log.error(e.message)
                                }

                            } else {
                                //выводим в консоль ошибку
                                log.message("ОШИБКА на 5 этапе " + JSON.stringify(authResponse))
                            }

                        } catch (e) {
                            log.error(e.message)
                        }

                } catch (e) {
                    log.error(e.message)
                }

            } else {
                //выводим в консоль ошибку
                log.message("ОШИБКА на 3 этапе " + JSON.stringify(userLogin))
            }

        } catch (e) {
            log.error(e.message)
        }
        if (options.SMS != "") {
            log.message("Внимание, заполнена графа СМС! Сотрите, если это не трубется")
        }
        source.setValue(false)
    }

    //исполнительный блок на выключатель с именем Статус
    if (value && source.getService().getName() == "Статус") {

        //СТАТУС
        //запрос информации по устройствам

        try {

            Hub.getAccessory(findHC).getServices().forEach(function(_s) {
                _s.getCharacteristics().forEach(function(_c) {
                    if (_c.getType() == "C_String") {
                        if (_s.getName() == "Token") {
                            GlobalVariables.slNet = _c.getValue()
                        }
                        if (_s.getName() == "Device") {
                            GlobalVariables.deviceID = _c.getValue()
                        }
                    }
                })
            })

            var url = "https://developer.starline.ru/json/v3/device/" + GlobalVariables.deviceID + "/data"
            var dataResponse = {}
            var dataResponse = JSON.parse(HttpClient.GET(url)
                .header("cookie", "slnet=" + GlobalVariables.slNet)
                .send()
                .getBody()
            )
            //раскомментируй, если нужен полный ответ по статусу устройства
            //log.message(JSON.stringify(dataResponse))

            if (dataResponse.code === 200) {


                Hub.getAccessory(findHC).getServices().forEach(function(_s) {
                    _s.getCharacteristics().forEach(function(_c) {
                        if (_c.getType() == "C_String") {
                            if (_s.getName() == "Пробег") {
                                _c.setValue(dataResponse.data.obd.mileage)
                            }
                            if (_s.getName() == "Топливо") {
                                _c.setValue(dataResponse.data.obd.fuel_percent)
                            }
                            if (_s.getName() == "Широта") {
                                _c.setValue(dataResponse.data.position.y)
                            }
                            if (_s.getName() == "Долгота") {
                                _c.setValue(dataResponse.data.position.x)
                            }
                        }
                        if (_c.getType() == "On") {
                            if (_s.getName() == "Автозапуск") {
                                _c.setValue(dataResponse.data.state.r_start)
                            }
                            if (_s.getName() == "Охрана") {
                                _c.setValue(dataResponse.data.state.arm)
                            }
                        }
                        if (_c.getType() == "C_NoiseDetected") {
                            if (_s.getName() == "Двигатель") {
                                _c.setValue(dataResponse.data.state.ign)
                            }
                        }
                        if (_c.getType() == "MotionDetected") {
                            if (_s.getName() == "Движение") {
                                _c.setValue(dataResponse.data.position.is_move)
                            }
                        }

                    })
                })
            } else {
                //выводим в консоль ошибку
                log.message("ОШИБКА при запросе сатуса " + JSON.stringify(dataResponse))
            }
        } catch (e) {
            log.error(e.message)
        }

        source.setValue(false)
    }
    //исполнительный блок на выключатель с именем Автозапуск
    if (source.getService().getName() == "Автозапуск") {
        try {

            Hub.getAccessory(findHC).getServices().forEach(function(_s) {
                _s.getCharacteristics().forEach(function(_c) {
                    if (_c.getType() == "C_String") {
                        if (_s.getName() == "Token") {
                            GlobalVariables.slNet = _c.getValue()
                        }
                        if (_s.getName() == "Device") {
                            GlobalVariables.deviceID = _c.getValue()
                        }
                    }
                })
            })

            var urlStat = "https://developer.starline.ru/json/v3/device/" + GlobalVariables.deviceID + "/data"
            var dataStat = {}
            var dataStat = JSON.parse(HttpClient.GET(urlStat)
                .header("cookie", "slnet=" + GlobalVariables.slNet)
                .send()
                .getBody()
            )

            var url = "https://developer.starline.ru/json/v2/device/" + GlobalVariables.deviceID + "/async"
            var command = {}
            if (value) {
                command = {
                    "type": "ign_start",
                    "value": 1
                }
            } else {
                command = {
                    "type": "ign_stop",
                    "value": 1
                }
            }

            if (value && dataStat.code === 200 && dataStat.data.state.ign == false || value == false && dataStat.code === 200 && dataStat.data.state.r_start == true) {
                body = JSON.stringify(command)

                var dataResponse = {}
                var dataResponse = JSON.parse(HttpClient.POST(url)
                    .header("cookie", "slnet=" + GlobalVariables.slNet)
                    .body(body)
                    .send()
                    .getBody()
                )

                if (dataResponse.code != 200) {
                    log.message("ОШИБКА при отправке команды " + dataResponse)
                }
            }
        } catch (e) {
            log.error(e.message)
        }
    }

    //исполнительный блок на выключатель с именем Охрана
    if (source.getService().getName() == "Охрана") {



        try {

            Hub.getAccessory(findHC).getServices().forEach(function(_s) {
                _s.getCharacteristics().forEach(function(_c) {
                    if (_c.getType() == "C_String") {
                        if (_s.getName() == "Token") {
                            GlobalVariables.slNet = _c.getValue()
                        }
                        if (_s.getName() == "Device") {
                            GlobalVariables.deviceID = _c.getValue()
                        }
                    }
                })
            })

            var urlStat = "https://developer.starline.ru/json/v3/device/" + GlobalVariables.deviceID + "/data"
            var dataStat = {}
            var dataStat = JSON.parse(HttpClient.GET(urlStat)
                .header("cookie", "slnet=" + GlobalVariables.slNet)
                .send()
                .getBody()
            )

            var url = "https://developer.starline.ru/json/v2/device/" + GlobalVariables.deviceID + "/async"
            var command = {}
            if (value) {
                command = {
                    "type": "arm",
                    "value": 1
                }
            } else {
                command = {
                    "type": "arm",
                    "value": 0
                }
            }

            if (value && dataStat.code === 200 && dataStat.data.state.arm == false || value == false && dataStat.code === 200 && dataStat.data.state.arm == true) {
                body = JSON.stringify(command)

                var dataResponse = {}
                var dataResponse = JSON.parse(HttpClient.POST(url)
                    .header("cookie", "slnet=" + GlobalVariables.slNet)
                    .body(body)
                    .send()
                    .getBody()
                )

                if (dataResponse.code != 200) {
                    log.message("ОШИБКА при отправке команды " + dataResponse)
                }
            }
        } catch (e) {
            log.error(e.message)
        }
    }
}