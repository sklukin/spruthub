# Руководство по настройке SprutHub Metrics

Это руководство поможет настроить сбор метрик с датчиков умного дома и их визуализацию в Grafana.

## Содержание

1. [Установка баз данных](#1-установка-баз-данных)
2. [Настройка скриптов SprutHub](#2-настройка-скриптов-Spruthub)
3. [Настройка Grafana Datasource](#3-настройка-grafana-datasource)
4. [Графики для InfluxDB (InfluxQL)](#4-создание-графиков)
5. [Графики для VictoriaMetrics (PromQL)](#5-графики-для-victoriametrics-promql)

---

## 1. Установка баз данных

Все базы данных запускаются через Docker Compose.

### InfluxDB

InfluxDB используется для точных данных за короткий период (~1 месяц).

```bash
cd docker/influxDB
docker compose up -d
```

После запуска:
1. Открыть http://YOUR_SERVER_IP:8086
2. Создать organization (например: `copper`)
3. Создать bucket (например: `sensors`)
4. Сгенерировать API Token (Data → API Tokens → Generate API Token)

### VictoriaMetrics

VictoriaMetrics используется для долгосрочного хранения (5 лет).

```bash
cd docker/victoriaMetrics
docker compose up -d
```

VictoriaMetrics доступен на http://YOUR_SERVER_IP:8428

Настройка retention уже задана в docker-compose.yaml (`--retentionPeriod=5y`).

### Grafana

```bash
cd docker/grafana
docker compose up -d
```

После запуска:
1. Открыть http://YOUR_SERVER_IP:3000
2. Войти с логином `admin` / паролем `admin`
3. Сменить пароль

---

## 2. Настройка скриптов SprutHub

### VictoriaMetrics

Отредактировать файл `global/victoriMetrics.js`:

```javascript
// Строка 1: изменить адрес сервера
const server = 'http://YOUR_SERVER_IP:8428';
```

### InfluxDB

Отредактировать файл `global/influxDB.js`:

```javascript
// Строки 1-4: настроить подключение
const org = 'copper';                        // ваша organization
const server = 'http://YOUR_SERVER_IP:8086'; // адрес сервера
const token = 'YOUR_INFLUXDB_TOKEN';         // API token из InfluxDB
const bucket = 'sensors';                    // название bucket
```

### Загрузка скриптов в SprutHub

1. Скопировать содержимое файлов из `global/` в глобальные скрипты SprutHub
2. Скопировать содержимое файлов из `logic/` в логические сценарии
3. Скопировать содержимое файлов из `block/` в блочные сценарии (с настройкой cron)

---

## 3. Настройка Grafana Datasource

### Добавление InfluxDB

1. Перейти в **Connections → Data sources → Add data source**
2. Выбрать **InfluxDB**
3. Настроить:
   - **Name**: `InfluxDB` (или любое удобное)
   - **Query Language**: `InfluxQL`
   - **URL**: `http://YOUR_SERVER_IP:8086`
   - **Custom HTTP Headers**:
     - Header: `Authorization`
     - Value: `Token YOUR_INFLUXDB_TOKEN`
   - **Database**: `sensors`
4. Нажать **Save & Test**

### Добавление VictoriaMetrics

1. Перейти в **Connections → Data sources → Add data source**
2. Выбрать **Prometheus**
3. Настроить:
   - **Name**: `VictoriaMetrics`
   - **URL**: `http://YOUR_SERVER_IP:8428`
4. Нажать **Save & Test**

---

## 4. Графики для InfluxDB (InfluxQL)

### Структура данных

Метрики записываются в measurement `sensors` со следующими тегами:

| Тег | Описание | Пример |
|-----|----------|--------|
| `room` | Название комнаты | `Спальня`, `Кухня`, `Улица` |
| `accessory` | Название устройства | `Датчик-температуры-Sonoff` |
| `type` | Тип сервиса HomeKit | `TemperatureSensor`, `HumiditySensor` |
| `service` | Название сервиса | `Датчик-температуры` |

Поле: `value` — значение датчика.

### Типы датчиков (type::tag)

| Тип | Описание | Единица измерения |
|-----|----------|-------------------|
| `TemperatureSensor` | Температура | `celsius` |
| `HumiditySensor` | Влажность | `humidity` |
| `CarbonDioxideSensor` | CO2 | `none` (ppm) |
| `AirQualitySensor` | Качество воздуха (VOC) | `none` |
| `C_WattMeter` | Мощность | `none` (W) |
| `C_VoltMeter` | Напряжение | `none` (V) |
| `C_AmpereMeter` | Ток | `none` (A) |
| `C_KiloWattHourMeter` | Потребление | `none` (kWh) |
| `LightSensor` | Освещённость | `none` (lux) |

### Создание панели с графиком

1. **Dashboard → New → New Dashboard → Add visualization**
2. Выбрать datasource **InfluxDB**
3. Переключиться в режим запроса

### Примеры запросов

#### Температура по комнатам

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'TemperatureSensor') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

**Настройки панели:**
- Alias: `$tag_room $tag_service`
- Unit: `Temperature → Celsius (°C)`

#### Температура на улице и в гараже

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'TemperatureSensor')
  AND ("room"::tag = 'Улица' OR "room"::tag = 'Гараж')
  AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Температура в доме (исключая улицу)

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'TemperatureSensor')
  AND ("room"::tag != 'Улица')
  AND ("room"::tag != 'Дом')
  AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Влажность

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'HumiditySensor')
  AND ("room"::tag != 'Дом')
  AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

**Unit**: `Misc → Humidity (%H)`

#### CO2

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'CarbonDioxideSensor') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Качество воздуха (VOC)

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'AirQualitySensor') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Ваттметры

```sql
SELECT max("value")
FROM "sensors"
WHERE ("type"::tag = 'C_WattMeter') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Вольтметры

```sql
SELECT max("value")
FROM "sensors"
WHERE ("type"::tag = 'C_VoltMeter') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Амперметры

```sql
SELECT max("value")
FROM "sensors"
WHERE ("type"::tag = 'C_AmpereMeter') AND $timeFilter
GROUP BY time($__interval), "room"::tag, "service"::tag
fill(null)
```

#### Потребление энергии за час (kWh)

```sql
SELECT difference(max("value"))
FROM "sensors"
WHERE ("type"::tag = 'C_KiloWattHourMeter')
  AND ("room"::tag = 'Дом')
  AND $timeFilter
GROUP BY time(1h)
```

#### Суммарная мощность в доме

```sql
SELECT sum("value") / 10
FROM "sensors"
WHERE ("type"::tag = 'C_WattMeter')
  AND ("room"::tag = 'Дом')
  AND $timeFilter
GROUP BY time(1m)
```

#### Средняя температура в доме (агрегированная)

```sql
SELECT mean("value")
FROM "sensors"
WHERE ("type"::tag = 'TemperatureSensor')
  AND ("room"::tag != 'Улица')
  AND ("room"::tag != 'Дом')
  AND $timeFilter
GROUP BY time(1h)
fill(null)
```

### Рекомендуемые настройки панели

| Параметр | Значение |
|----------|----------|
| **Line interpolation** | Smooth |
| **Line width** | 1-2 |
| **Point size** | 2-3 |
| **Show points** | Always |
| **Span nulls** | true |
| **Decimals** | 2 |

### Полезные фильтры

Исключить определённые комнаты или устройства:

```sql
AND ("room"::tag != 'Котельня')
AND ("accessory"::tag != 'Tion-Breezer-ESP')
AND ("service"::tag != 'Внешняя-температура')
```

Выбрать только определённые комнаты:

```sql
AND ("room"::tag = 'Спальня' OR "room"::tag = 'Кабинет')
```

---

## 5. Графики для VictoriaMetrics (PromQL)

VictoriaMetrics использует язык запросов PromQL. Метрика называется `sensors_value` с лейблами `room`, `accessory`, `type`, `service`.

### Создание панели

1. **Dashboard → New → Add visualization**
2. Выбрать datasource **VictoriaMetrics** (Prometheus)
3. Использовать режим **Builder** или **Code**

### Базовые запросы

#### Температура по комнатам

```promql
max by(room, service) (sensors_value{type="TemperatureSensor"})
```

**Настройки:**
- Legend: `{{room}} - {{service}}`
- Unit: `Temperature → Celsius (°C)`
- Interval: `10m`

#### Температура (исключая служебные датчики)

```promql
max by(room, service) (sensors_value{type="TemperatureSensor", service!~"Температура-ESP|Внешняя-температура"})
```

#### Температура на улице

```promql
sensors_value{type="TemperatureSensor", room="Улица"}
```

#### Средняя температура в доме

```promql
avg by(type) (sensors_value{type="TemperatureSensor", room!~"Котельня|Улица|Дом", accessory!~"Tion-Breezer-ESP", service!~"Внешняя-температура"})
```

#### Влажность по комнатам

```promql
max by(room, service) (sensors_value{type="HumiditySensor"})
```

**Unit**: `Misc → Humidity (%H)`

#### Средняя влажность в доме

```promql
avg by(type) (sensors_value{type="HumiditySensor", room!~"Улица|Дом"})
```

#### CO2 по комнатам

```promql
sum by(room, service) (sensors_value{type="CarbonDioxideSensor"})
```

#### Средний CO2

```promql
avg by(type) (sensors_value{type="CarbonDioxideSensor"})
```

#### Качество воздуха (VOC)

```promql
sum by(room, service) (sensors_value{type="AirQualitySensor"})
```

### Энергопотребление

#### Суммарная мощность в доме (Вт)

```promql
sum(sensors_value{type=~"C_WattMeter", room=~"Дом"})
```

#### Потребление за час (kWh)

```promql
increase(sensors_value{type=~"C_KiloWattHourMeter", room=~"Дом"}[1h])
```

**Interval**: `1h`

#### Потребление за сутки (kWh)

```promql
increase(sensors_value{type=~"C_KiloWattHourMeter", room=~"Дом"}[24h])
```

**Interval**: `24h`

### Сравнение с прошлым годом

VictoriaMetrics поддерживает `offset` для сравнения с историческими данными.

#### Температура: текущая vs год назад

**Query A** (текущая):
```promql
max by(room, service) (sensors_value{type="TemperatureSensor", room="Дом"})
```
Legend: `{{room}} - {{service}}`

**Query B** (год назад):
```promql
max by(room, service) (sensors_value{type="TemperatureSensor", room="Дом"}) offset 1y
```
Legend: `{{room}} - {{service}} -1y`

#### Средняя температура: текущая vs год назад

```promql
avg by(type) (sensors_value{type="TemperatureSensor", room!~"Котельня|Улица|Дом", accessory!~"Tion-Breezer-ESP"}) offset 1y
```

#### Влажность: текущая vs год назад

```promql
avg by(type) (sensors_value{type="HumiditySensor", room!~"Улица|Дом"}) offset 1y
```

#### CO2: текущий vs год назад

```promql
avg by(type) (sensors_value{type="CarbonDioxideSensor"}) offset 1y
```

### Синтаксис фильтров PromQL

| Оператор | Описание | Пример |
|----------|----------|--------|
| `=` | Точное совпадение | `room="Спальня"` |
| `!=` | Не равно | `room!="Улица"` |
| `=~` | Regex совпадение | `room=~"Спальня\|Кабинет"` |
| `!~` | Regex исключение | `room!~"Улица\|Дом"` |

### Агрегирующие функции

| Функция | Описание |
|---------|----------|
| `sum by(label)` | Сумма по группе |
| `avg by(label)` | Среднее по группе |
| `max by(label)` | Максимум по группе |
| `min by(label)` | Минимум по группе |
| `increase(metric[interval])` | Прирост за интервал |

### Переменная интервала в Grafana

Для динамического интервала создайте переменную:

1. **Dashboard Settings → Variables → New**
2. **Type**: Interval
3. **Name**: `interval1`
4. **Values**: `1m,10m,30m,1h,6h,12h,1d,7d,14d,30d`

Использование в запросе:
```promql
avg by(type) (sensors_value{type="HumiditySensor"}[$interval1])
```

---

## Примечания

- **InfluxDB** лучше подходит для детального анализа за последний месяц
- **VictoriaMetrics** используйте для долгосрочных трендов (годы) и сравнения с прошлым годом (`offset 1y`)
- Данные собираются двумя способами:
  - **По триггеру** — при каждом изменении датчика
  - **По cron** — периодически, для агрегированных отчётов
