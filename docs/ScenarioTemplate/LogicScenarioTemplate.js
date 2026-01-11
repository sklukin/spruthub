/**
 * Шаблон логического сценария для Sprut.Hub
 *
 * Автор: Kirill Ashikhmin (@KirillAshikhmin)
 * Источник: https://github.com/KirillAshikhmin/Sprut.Hub_Tools
 *
 * ВАЖНЫЕ ЗАМЕЧАНИЯ:
 * 1. Нет console — используй log.info(), log.warn(), log.error()
 * 2. ES5 только — нет find(), every(), some(), includes(), используй циклы
 * 3. Cron формат — 6 полей: "секунда минута час день месяц день_недели"
 * 4. Telegram — используй global.sendToTelegram(message)
 * 5. variables уникален для каждого датчика — для общей инициализации используй SCRIPT_VERSION
 */

// ============================================================================
// КОНСТАНТЫ СЦЕНАРИЯ (настройки сценария в целом, НЕ опции)
// ============================================================================
var SERVER_URL = 'http://192.168.1.1:8080';
var CRON_SCHEDULE = "0 0 * * * *";  // 6 полей! Каждый час
var ENABLE_FEATURE = true;

// ============================================================================
// ОДНОКРАТНАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================================================
// Паттерн для выполнения кода один раз при загрузке сценария (cron-задачи и т.п.)
var SCRIPT_VERSION = Date.now();
var _lastInitVersion = 0;
var _cronTask = null;

// ============================================================================
// ДИНАМИЧЕСКИЕ СПИСКИ ДЛЯ ОПЦИЙ
// ============================================================================
// переменная с сервисами, которая будет использоваться в опции ServiceSelect. Нужна только если есть динамические опции у сценария.
// В данном случае это список сервисов для выбора, но можно сделать для чего угодно, главное что бы в массиве был объект с обязателями полями value и name:
// { value: "ID", name: { ru: "Название", en: "Name" } }
// ВНИМАНИЕ! Этот список должен быть объявлен над блоком info. А так же его значение обновляется только на старте хаба, а также при сохранении сценария.
let servicesList  = getServicesByServiceAndCharacteristicType([HS.Switch, HS.Lightbulb], [HC.On]);
 
 /*
   * info - Обязательное поле, описывающее сценарий.
   * Считывается хабом в момент загрузки или сохранения сценария.
   * В коде обращаться к этому объекту запрещено, считать данные с него тоже не получится.
   * Необходимо использовать только значения, которые приходят в функции compute или trigger.
   */
info = { 
  name: "Шаблон логического сценария", // Название сценария
  description: "Описание сценария", // Описание функционала сценария
  version: "1.0", // Номер версии сценария
  author: "@BOOMikru", // Автор сценария
  onStart: true, // Если true, тогда функция trigger будет вызвана при включении хаба, а так же при сохранении сценария для выбранных характеристик
  sourceServices: [HS.Swith, HS.Lightbulb], // Список устройств, на изменение характеристик которых будет реагировать сценарий
  sourceCharacteristics: [HC.On], // Список характеристик, на изменение которых будет реагировать сценарий

  // Опции для сценария. Отображаются в интерфейсе хаба в настройках логики для каждого устройства. 
  // У каждого устройства опции индивидуальные.
  options: {
    // Boolean - Логическое значение (true/false)
    BooleanOption: { // Имя переменнйо опции, доступно из кода.
      type: "Boolean", // Тип опции
      value: true, // Значение по умолчанию
      name: { ru: "Логическая опция", en: "Boolean option" }, // Название опции на русском и английском языках
      desc: { ru: "Опция для включения/выключения функционала", en: "Option to enable/disable functionality" } // Описание опции на русском и английском языках
    },

    // Integer - Целое число с указанием диапазона
    IntegerOption: { 
      type: "Integer", 
      value: 0,
      minValue: 0, // Минимальное значение
      maxValue: 100, // Максимальное значение
      step: 1, // Шаг изменения
      name: { ru: "Целочисленная опция", en: "Integer option" }, 
      desc: { ru: "Опция для установки целого числа", en: "Option for setting an integer value" } 
    },

    // Double - Дробное число с указанием диапазона
    DoubleOption: { 
      type: "Double", 
      value: 0.0,
      minValue: 0.0, // Минимальное значение
      maxValue: 1.0, // Максимальное значение
      step: 0.1, // Шаг изменения
      name: { ru: "Дробная опция", en: "Double option" }, 
      desc: { ru: "Опция для установки дробного числа", en: "Option for setting a floating point value" } 
    },

    // String - Строковое значение с ограничением длины
    StringOption: { 
      type: "String", 
      value: "",
      maxLength: 64, // Максимальная длина строки
      name: { ru: "Строковая опция", en: "String option" }, 
      desc: { ru: "Опция для ввода текста", en: "Option for text input" } 
    },

    // Enum - Перечисление с фиксированными значениями
    EnumOption: { 
      type: "Integer",
      value: 0, // Значение из поля value из values
      formType: "list", // тип поля. Обязателен для реализации выбора из списка
      values: [
        { value: 0, key: "AUTO", name: { ru: "Авто", en: "Auto" } },
        { value: 1, key: "MANUAL", name: { ru: "Ручной", en: "Manual" } },
        { value: 2, key: "SCHEDULED", name: { ru: "По расписанию", en: "Scheduled" } }
      ],
      name: { ru: "Режим работы", en: "Operation mode" }, 
      desc: { ru: "Выбор режима работы сценария", en: "Select scenario operation mode" } 
    },

    // Enum - Перечисление с фиксированными значениями
    ServiceSelect: { 
      type: "Integer",
      value: "", // UUID устройства, которое было выбрано
      values: servicesList, // Переменная, объявленная над блоком info.
      name: { ru: "Режим работы", en: "Operation mode" }, 
      desc: { ru: "Выбор режима работы сценария", en: "Select scenario operation mode" } 
    },
  },

  variables: {
    myVar: undefined, // Простая переменная
    myVarObject: { // Объект с несколькими переменными
      myVar: undefined,
      myVar2: undefined,
    },
    myVarArray: [], // Массив для хранения данных
  }
}

/**
 * Коллбек функция, которая вызывается при изменении характеристики, на которую подписан сценарий.
 * Вызывается после выполнения функции compute и фактической установки значения в хабе.
 * Работает ассинхронно.
 * Является главной функцией и точкой входа в сценарии.
 * @param {Characteristic} source - Характеристика, изменение значения которой вызвало вызов функции
 * @param {*} value - Новое значение характеристики
 * @param {Object} variables - Объект с переменными сценария из поля variables блока info. Значения доступны только в рамках этого сценария, можно писать и читать, сбрасываются при перезагрузке хаба.
 * @param {Object} options - Объект с опциями сценария из поля options блока info. Только для чтения.
 * @param {Object} context - Контекст изменения характеристики. Содержит информацию о том, что вызвало вызов функции
 */
function trigger(source, value, variables, options, context) {
  // ============================================================================
  // ОДНОКРАТНАЯ ИНИЦИАЛИЗАЦИЯ (cron-задачи, подключения и т.п.)
  // ============================================================================
  // ВАЖНО: variables уникален для каждого датчика, поэтому variables.initialized
  // не работает для общей инициализации. Используем паттерн с SCRIPT_VERSION.
  if (_lastInitVersion !== SCRIPT_VERSION) {
    _lastInitVersion = SCRIPT_VERSION;

    // Очистка старых cron-задач при перезагрузке сценария
    if (_cronTask) {
      try { clear(_cronTask); } catch(e) {}
    }

    // Создание новых cron-задач
    if (ENABLE_FEATURE) {
      _cronTask = Cron.schedule(CRON_SCHEDULE, function() {
        log.info("Cron task executed");
      });
      log.info("Сценарий инициализирован, cron-задача создана");
    }
  }

  // ============================================================================
  // ОСНОВНОЙ КОД СЦЕНАРИЯ
  // ============================================================================
  let service = source.getService(); // Получение сервиса, к которому привязана характеристика
  let accessory = service.getAccessory(); // Получение аксессуара
  let serviceType = service.getType(); // Получение типа сервиса (например HC.Switch)
  let type = source.getType(); // Получение типа характеристики (например HC.On)

  // Пример работы с переменными (ВНИМАНИЕ: уникальны для каждого датчика!)
  let myVar = variables.myVar;
  let myVarFromObject = variables.myVarObject.myVar;

  // Получение выбранного сервиса по опции ServiceSelect
  const selectedService = getDevice(options.ServiceSelect)
  if (selectedService) {
    log.info("Выбранный сервис: " + selectedService.getName())  // НЕТ console в SprutHub!
  }

  // Пример работы с опциями
  let booleanOption = options.BooleanOption;
  let isScheduleMode = options.EnumOption === 2;

  // Пример отправки в Telegram
  // global.sendToTelegram("Сообщение");  // Используй global.sendToTelegram, не HttpClient!
}

/**
 * Функция, которая вызывается при изменении характерисстики.
 * Результат функции устанавливается для характеристики а хабе.
 * ВНИМАНИЕ! Функция выполняется синхронно и может замедлять работу хаба или приводить к неожиданному поведению.
 * Применять только при острой необходимости и с особой осторожностью. Не выполнять в ней сложных вычислений или долгих операций.
 * @param {Characteristic} source - Характеристика, изменение значения которой вызвало вызов функции
 * @param {*} value - Новое значение характеристики
 * @param {Object} variables - Объект с переменными сценария из поля variables блока info. Значения доступны только в рамках этого сценария, можно писать и читать, сбрасываются при перезагрузке хаба.
 * @param {Object} options - Объект с опциями сценария из поля options блока info. Только для чтения.
 * @param {Object} context - Контекст изменения характеристики. Содержит информацию о том, что вызвало вызов функции.
 * @returns {*} Значение для установки в характеристику. Обязательно функция должна возвращать значения соответствующего характеристике типа.
 */
function compute(source, value, variables, options, context) {

  //return обязателен.
  return value
}

// Так же можно добавлять свои функции, которые будут доступны только в рамках этого сценария.
// Например:
function myFunction(value) {
  return value * 2;
}


/**
 * Функция подготовки списка характеристик для выбора в настройке логики
 * @param {Array} serviceTypes - Список типов сервисов
 * @param {Array} characteristicTypes - Список типов характеристик
 * @returns {Array} Список сервисов с характеристиками
 */
function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicTypes) {
  let sortedServicesList = []
  let unsortedServicesList = []
  Hub.getAccessories().forEach((a) => {
      a.getServices().filter((s) => serviceTypes.indexOf(s.getType()) >= 0).forEach((s) => {
          let characteristic = undefined
          characteristicTypes.forEach(c => {
              if (!characteristic) {
                  let chr = s.getCharacteristic(c);
                  if (chr) characteristic = chr
              }
          })
          if (characteristic) {
              let displayname = getDeviceName(s)
              unsortedServicesList.push({
                  name: { ru: displayname, en: displayname },
                  value: s.getUUID()
              });
          }
      })
  });
  sortedServicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' })
  unsortedServicesList.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sortedServicesList.push(s))
  return sortedServicesList
}
