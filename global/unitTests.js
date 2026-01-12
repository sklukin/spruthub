// Функции assert для unit-тестирования сценариев в Sprut.Hub

// Универсальный логгер: log на хабе, console локально
var _log = (typeof log !== 'undefined') ? log : console;

/**
 * Функция для проверки наличия данного сценария
 */
function hasUnitTests() { return true }

/**
 * Проверяет, что выражение истинно
 * @param {any} expression Выражение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assert(expression, message) {
  if (!expression) {
    const msg = "Ожидалось истинное значение, получено ложное";
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение равно null
 * @param {any} value Значение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertNull(value, message) {
  if (value !== null) {
    const msg = `Ожидалось null, получено ${value}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение не равно null
 * @param {any} value Значение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertNotNull(value, message) {
  if (value === null) {
    const msg = "Ожидалось не-null значение, получено null";
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение равно ожидаемому
 * @param {any} actual Фактическое значение
 * @param {any} expected Ожидаемое значение
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    const msg = `Ожидалось ${expected}, получено ${actual}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение не равно указанному
 * @param {any} actual Фактическое значение
 * @param {any} notExpected Неожидаемое значение
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertNotEquals(actual, notExpected, message) {
  if (actual === notExpected) {
    const msg = `Ожидалось значение, отличное от ${notExpected}, получено ${actual}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение истинно (true)
 * @param {any} value Значение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertTrue(value, message) {
  if (value !== true) {
    const msg = `Ожидалось true, получено ${value}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение ложно (false)
 * @param {any} value Значение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertFalse(value, message) {
  if (value !== false) {
    const msg = `Ожидалось false, получено ${value}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что значение определено (не undefined)
 * @param {any} value Значение для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertDefined(value, message) {
  if (typeof value === "undefined") {
    const msg = "Ожидалось определённое значение, получено undefined";
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что массив содержит указанный элемент
 * @param {Array} array Массив для проверки
 * @param {any} element Элемент для поиска
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertContains(array, element, message) {
  if (!Array.isArray(array) || array.indexOf(element) === -1) {
    const msg = `Ожидалось, что массив содержит ${element}, получено ${JSON.stringify(array)}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что массив пустой
 * @param {Array} array Массив для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertEmpty(array, message) {
  if (!Array.isArray(array) || array.length > 0) {
    const msg = `Ожидался пустой массив, получено ${JSON.stringify(array)}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что массив не пустой
 * @param {Array} array Массив для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertNotEmpty(array, message) {
  if (!Array.isArray(array) || array.length === 0) {
    const msg = `Ожидался непустой массив, получено ${JSON.stringify(array)}`;
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

/**
 * Проверяет, что в массиве есть указанное количество элементов
 * @param {Array} array Массив для проверки
 * @param {string} [message] Опциональное сообщение об ошибке
 */
function assertLength(array, length, message) {
  if (array.length != length) {
    const msg = `Ожидалось ${length} элементов, получено ${array.length}`
    const errorMsg = message ? `${message}: ${msg}` : msg;
    _log.error(errorMsg);
  }
}

// #####################################################################################################

/**
 * Создание Характеристики для использования в Unit тестах
 */
createUnitTestCharacteristic = (function (type, id, name, charValue, service, accessory) {
  let isStatusVisibleValue = true
  let isNotifyValue = true

  return {
    getValue: getValue,
    setValue: setValue,
    toggle: toggle,
    getType: getType,
    getService: getService,
    setService: setService,
    getAccessory: getAccessory,
    setAccessory: setAccessory,
    getName: getName,
    isStatusVisible: isStatusVisible,
    setStatusVisible: setStatusVisible,
    isNotify: isNotify,
    setNotify: setNotify,
    getUUID: getUUID,
    getId: getId,
    format: format,
    getMinValue: getMinValue,
    getMaxValue: getMaxValue,
    getMinStep: getMinStep,
    toString: toString
  };

  function getAccessory() { return accessory; }
  function setAccessory(newAccessory) { accessory = newAccessory; }
  function getService() { return service; }
  function setService(newService) { service = newService }
  function getName() { return name; }
  function getType() { return type; }
  function getValue() { return charValue; }
  function setValue(value) { charValue = value; }
  function toggle() { if (typeof charValue === "boolean") charValue = !charValue }
  function isStatusVisible() { return isStatusVisibleValue }
  function setStatusVisible(statusVisible) { isStatusVisibleValue = statusVisible }
  function isNotify() { return isNotifyValue }
  function setNotify(notify) { isNotifyValue = notify }
  function format() { return `value: ${charValue}` }
  function getMinValue() { return 0 }
  function getMaxValue() { return 100 }
  function getMinStep() { return 1 }
  function getId() { return id }
  function getUUID() { let serId = service ? service.getUUID() : ""; return `${serId}.${id}` }
  function toString() { return `Service ${id} ${name}` }
});


/**
 * Создание Сервиса для использования в Unit тестах
 */
createUnitTestService = (function (type, id, name, characteristics, accessory) {
  let isVisibleValue = true
  let chars = characteristics == undefined ? [] : characteristics

  return {
    getType: getType,
    getAccessory: getAccessory,
    setAccessory: setAccessory,
    getName: getName,
    setName: setName,
    isVisible: isVisible,
    setVisible: setVisible,
    getId: getId,
    getUUID: getUUID,
    getCharacteristic: getCharacteristic,
    getCharacteristics: getCharacteristics,
    toString: toString
  };

  function getAccessory() { return accessory; }
  function setAccessory(newAccessory) { accessory = newAccessory; chars.forEach(function (c) { c.setAccessory(newAccessory) }) }
  function getName() { return name; }
  function setName(newName) { name = newName }
  function getType() { return type; }
  function isVisible() { return isVisibleValue }
  function setVisible(visible) { isVisibleValue = visible }
  function getCharacteristic(value) { if (typeof value === "number") return getCharacteristicById(value); return getCharacteristicByType(value) }
  function getCharacteristicById(charId) { let filtered = chars.filter(function (c) { return c.getId() == charId }); return filtered.length > 0 ? filtered[0] : null }
  function getCharacteristicByType(hc) { let filtered = chars.filter(function (c) { return c.getType() == hc }); return filtered.length > 0 ? filtered[0] : null }
  function getCharacteristics() { return chars }
  function getId() { return id }
  function getUUID() { let accId = accessory != undefined ? accessory.getUUID() : ""; return `${accId}.${id}` }
  function toString() { return `Service ${id} ${name}` }
});

/**
 * Создание Аксессуара для использования в Unit тестах
 */
createUnitTestAccessory = (function (id, name, room, services, model, modelId, manufacturer, manufacturerId, serial, firmware) {
  let ser = services == undefined ? [] : services

  return {
    getName: getName,
    setName: setName,
    getRoom: getRoom,
    setRoom: setRoom,
    getId: getId,
    getUUID: getUUID,
    getCharacteristic: getCharacteristic,
    getService: getService,
    getServices: getServices,
    toString: toString,
    getModel: getModel,
    getModelId: getModelId,
    getManufacturer: getManufacturer,
    getManufacturerId: getManufacturerId,
    getSerial: getSerial,
    getFirmware: getFirmware,
    getSnapshot: getSnapshot,
    toString: toString
  };

  function getName() { return name; }
  function setName(newName) { name = newName }
  function getRoom() { return room; }
  function setRoom(newRoom) { room = newRoom }
  function getService(value, value2) { let criteria = (typeof value2 == "undefined") ? value : value2; let visible = (typeof value2 == "undefined") ? undefined : value; if (typeof value === "number") return getServiceById(criteria, visible); return getServiceByType(criteria, visible); }
  function getServiceById(serId, visible) { let filtered = ser.filter(function (s) { return s.getId() == serId }); filtered = (typeof visible == "undefined") ? filtered : filtered.filter(function (s) { return s.isVisible() == visible }); return filtered.length > 0 ? filtered[0] : null }
  function getServiceByType(hs, visible) { let filtered = ser.filter(function (s) { return s.getType() == hs }); filtered = (typeof visible == "undefined") ? filtered : filtered.filter(function (s) { return s.isVisible() == visible }); return filtered.length > 0 ? filtered[0] : null }
  function getServices(visible) { return (typeof visible == "undefined") ? ser : ser.filter(function (s) { return s.isVisible() == visible }) }
  function getCharacteristic(charId) { let filtered = ser.filter(function (s) { return s.getCharacteristic(charId) != null }); return filtered.length > 0 ? filtered[0] : null }
  function getId() { return id }
  function getUUID() { return `${id}` }
  function getModel() { return model; }
  function getModelId() { return modelId; }
  function getManufacturer() { return manufacturer; }
  function getManufacturerId() { return manufacturerId; }
  function getSerial() { return serial; }
  function getFirmware() { return firmware; }
  function getName() { return name; }
  function getSnapshot() { return null }
  function toString() { return `Accessory ${id} ${name}` }
});

/**
 * Создание Комнаты для использования в Unit тестах
 */
createUnitTestRoom = (function (name, accessories) {
  let accs = accessories == undefined ? [] : accessories
  return {
    getAccessories: getAccessories,
    setAccessories: setAccessories,
    getName: getName,
    setName: setName,
  };

  function getAccessories() { return accs; }
  function setAccessories(newAccessories) { accs = newAccessories }
  function getName() { return name; }
  function setName(newName) { name = newName }
});


/**
 * Создание Аксессуара с комнатой, сервисами и характеристиками по описанной модели для использования в Unit тестах
 */
function createUnitTestFullAccessory(toCreate) {
  let sId = 13
  let room = createUnitTestRoom(toCreate.room)
  let services = toCreate.services.map(function (s) {
    let serviceId = sId
    let characteristicId = sId + 1
    let characteristics = s.characteristics.map(function (c) {
      let char = createUnitTestCharacteristic(c.type, c.id ? c.id : characteristicId, (c.name != undefined) ? c.name : c.type.toString(), c.value)
      characteristicId = characteristicId + 1
      return char
    })

    let service = createUnitTestService(s.type, s.id ? s.id : serviceId, (s.name != undefined) ? s.name : s.type.toString(), characteristics)
    characteristics.forEach(function (c) { c.setService(service) })
    sId = characteristicId
    return service
  })
  let accessory = createUnitTestAccessory(toCreate.id, toCreate.name, room, services, toCreate.model, toCreate.modelId, toCreate.manufacturer, toCreate.manufacturerId, toCreate.serial, toCreate.firmware)
  services.forEach(function (s) { s.setAccessory(accessory); s.getCharacteristics().forEach(function (c) { c.setAccessory(accessory) }) })
  room.setAccessories([accessory])
  return accessory
}

/**
 * Пример создания объекта для функции createUnitTestFullAccessory
 * Использование: 
 * let accessory = createUnitTestFullAccessory(lampAcc)
 */
/*
let lampAcc = {
  id: 1,
  name: "Лампочка",
  room: "Тест",
  model: "", // Не обзательно
  modelId: "", // Не обзательно
  manufacturer: "", // Не обзательно
  manufacturerId: "", // Не обзательно
  serial: "", // Не обзательно
  firmware: "", // Не обзательно
  services: [
    {
      id: 100, // Id не обязателен указывать для сервисов и характеристик (подставляется автоматически сгенерированное значение)
      type: HS.Lightbulb,
      name: "Лампочка", // Имя не обязательно указывать для сервисов и характеристик (в имя подставляется тип сервиса)
      characteristics: [
        {
          id: 101,
          type: HC.On,
          value: true
        },
        {
          id: 102,
          type: HC.Brightness,
          name: "Яркость",
          value: 100
        },
        {
          id: 103,
          type: HC.ColorTemperature,
          name: "Температура",
          value: 400
        }
      ]
    }
  ]
}
*/


// ============================================================================
// ЭКСПОРТ ДЛЯ NODE.JS (локальный запуск тестов через test-runner.js)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hasUnitTests: hasUnitTests,
    assert: assert,
    assertNull: assertNull,
    assertNotNull: assertNotNull,
    assertEquals: assertEquals,
    assertNotEquals: assertNotEquals,
    assertTrue: assertTrue,
    assertFalse: assertFalse,
    assertDefined: assertDefined,
    assertContains: assertContains,
    assertEmpty: assertEmpty,
    assertNotEmpty: assertNotEmpty,
    assertLength: assertLength,
    createUnitTestCharacteristic: createUnitTestCharacteristic,
    createUnitTestService: createUnitTestService,
    createUnitTestAccessory: createUnitTestAccessory,
    createUnitTestRoom: createUnitTestRoom,
    createUnitTestFullAccessory: createUnitTestFullAccessory
  };
}
