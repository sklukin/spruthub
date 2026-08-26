# Grafana: дашборды и алерты как код

Каталог `grafana/` — источник истины для дашбордов и правил алертов SprutHub.
JSON лежит в репозитории, в Grafana он заливается скриптами по HTTP API.

**Правки через UI перетрутся следующим деплоем.** Порядок такой: поправил в UI →
выгрузил JSON обратно в репозиторий → закоммитил.

```
grafana/
├── dashboards/
│   ├── copper-influxdb.json     — «Copper: датчики дома (InfluxDB)»
│   └── copper-prometheus.json   — «Copper: датчики дома (VictoriaMetrics)»
├── alerts/
│   └── spruthub.json            — правила алертов
├── push.sh                      — заливка дашбордов
└── push-alerts.py               — заливка правил и точек контакта
```

## Откуда берутся данные

Метрики пишет сценарий `logic/statisticsSensors.js` — один и тот же поток уходит в две базы:

| Дашборд | Источник данных | Запросы |
|---|---|---|
| Copper: датчики дома (InfluxDB) | InfluxDB, measurement `sensors` | InfluxQL, `SELECT ... FROM "sensors"` |
| Copper: датчики дома (VictoriaMetrics) | VictoriaMetrics | PromQL, метрика `sensors_value` |

InfluxDB держит короткую историю (~месяц) и удобен для разбора «что было вчера»,
VictoriaMetrics — долгую (5 лет) и обслуживает годовые сравнения (`offset 1y` в панелях).
Измерение `sensors` + поле `value` превращаются в VictoriaMetrics в метрику
`sensors_value`; теги `room`, `service`, `type`, `accessory`, `chrType` становятся лейблами.

## Разовая настройка

1. Grafana → Administration → Users and access → **Service accounts** → создать аккаунт
   с ролью **Editor** → Add token. Получится строка вида `glsa_…`.
2. Узнать uid источников данных (Connections → Data sources → нужный источник, uid в адресной строке).
   Дефолты уже прошиты в скрипты:

   | Источник | Переменная | Значение по умолчанию |
   |---|---|---|
   | VictoriaMetrics (`spruthub`, тип prometheus) | `DS_UID_PROMETHEUS` | `ca323c89-304d-4630-90ab-16c715c6e304` |
   | InfluxDB (`influxdb-sprutHub`) | `DS_UID_INFLUXDB` | `c700f9b8-c600-4a9f-9de7-01f77ae2c52c` |

Токен удобно положить в переменные окружения оболочки, чтобы не вставлять его каждый раз:

```sh
export GRAFANA_URL=http://192.168.1.50:3000
export GRAFANA_TOKEN=glsa_...
```

## Деплой дашбордов

```sh
./grafana/push.sh
```

Скрипт для каждого файла в `grafana/dashboards/` делает `POST /api/dashboards/db`
с `overwrite: true`. Uid дашборда зафиксирован в JSON, поэтому обновляется версия,
а ссылка (`/d/<uid>/…`) не меняется — закладки и ссылки в статьях живут.

Необязательные переменные:

- `FOLDER_UID` — папка в Grafana (по умолчанию General);
- `DS_UID_PROMETHEUS`, `DS_UID_INFLUXDB` — если uid источников отличаются.

### Про `${DS}`

Внутри JSON источник данных записан не uid'ом, а ссылкой на переменную дашборда:
`"uid": "${DS}"` в prometheus-дашборде, `"uid": "${DS_INFLUX}"` в influxdb-дашборде.
Сама переменная объявлена в `templating.list` с типом `datasource`.

- при заливке через `push.sh` в неё подставляется uid из `DS_UID_<ТИП>`;
- при ручном импорте через UI Grafana сама спросит источник.

Имя переменной значения не имеет — `push.sh` смотрит на **тип** источника (поле `query`
у переменной: `prometheus` или `influxdb`) и по нему выбирает переменную окружения.
Поэтому дашборд с двумя разными источниками тоже заработает, если объявить две переменные.

Так один и тот же файл работает и в этой инсталляции, и у любого, кто скопирует дашборд себе.

## Выгрузка изменений обратно в репозиторий

После правок в UI:

```sh
UID=e2d31da1-1c70-4012-a8ae-aff654decf0c   # Copper Prometheus
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "$GRAFANA_URL/api/dashboards/uid/$UID" \
| python3 -c '
import json, sys
d = json.load(sys.stdin)["dashboard"]
d.pop("id", None); d.pop("version", None)
print(json.dumps(d, ensure_ascii=False, indent=2))
' > grafana/dashboards/copper-prometheus.json
```

Дальше глазами по diff проверить, что uid источников остались `${DS}` — если в Grafana
добавили новую панель, в ней будет прошит настоящий uid, его надо заменить руками.

`id` и `version` из файла выкидываются намеренно: `id` уникален для инсталляции,
а `version` при `overwrite: true` всё равно игнорируется и только шумит в истории git.

## Алерты

```sh
./grafana/push-alerts.py
```

Формат файла компактный — скрипт разворачивает его в громоздкий формат Grafana сам:

```json
{
  "folder": "SprutHub",
  "folderUid": "spruthub",
  "interval": "1m",
  "service": "spruthub",
  "groups": {
    "spruthub-metrics": [
      {
        "uid": "spruthub-metrics-absent",
        "title": "SprutHub: метрики датчиков не приходят",
        "expr": "absent(sensors_value)",
        "for": "10m",
        "severity": "critical",
        "summary": "Короткая строка в уведомлении",
        "description": "Что смотреть и куда идти"
      }
    ]
  }
}
```

Добавить правило = дописать объект в массив. Папка в Grafana создаётся скриптом,
если её ещё нет. POST на группу заменяет её целиком, поэтому запуск идемпотентен:
удалил правило из файла — оно исчезло и в Grafana. Целиком удалённую **группу**
скрипт не трогает, её убирать руками.

⚠️ **Условие у всех правил одно: «выражение вернуло значение больше нуля».**
Выражения пишутся так, чтобы серия возвращалась **только при проблеме**. Поэтому
`up == 0` работать не будет — серия вернётся со значением `0`, и правило промолчит.
Правильные формы: `absent(metric)`, `(up{…} == bool 0) or absent(up{…})`, `metric > порог`.

Алерты считаются только по VictoriaMetrics: InfluxDB здесь короткая история для графиков.

### Что уже есть

| Правило | Когда сработает |
|---|---|
| `spruthub-metrics-absent` | 10 минут ни одной серии `sensors_value` |

Это единственное, чего не поймает встроенный health check `statisticsSensors.js`:
тот шлёт в Telegram, когда базы недоступны, но умирает вместе с хабом. Правило в Grafana
смотрит с другой стороны и ловит именно тишину от хаба.

### Куда уходят уведомления

Маршрутизация задаётся в Grafana → Alerting → **Notification policies** и в репозитории
не хранится. У правил проставлены метки `severity` (`warning`/`critical`) и `service`
(`spruthub`) — по ним удобно строить маршруты. По умолчанию всё уходит в default policy.

Если понадобится своя точка контакта, `push-alerts.py` умеет их заливать: положить рядом
файл с ключом `contactPoints`, а секреты указывать не значением, а именем переменной
окружения в поле `secretEnv` (образец — `homelab/grafana/alerts/contact-points.json`).

## Почему нет CI

В `homelab/grafana` заливку делает Forgejo Actions на раннере внутри локальной сети.
Этот репозиторий лежит на GitHub, а Grafana — на `192.168.1.50`, куда облачный раннер
не достучится. Поднимать self-hosted runner ради двух дашбордов дороже, чем раз в месяц
запустить скрипт руками.

Если раннер в локалке всё-таки появится, workflow — десяток строк:

```yaml
name: grafana
on:
  push: { branches: [main], paths: ['grafana/**'] }
  workflow_dispatch:
jobs:
  push:
    runs-on: self-hosted
    env:
      GRAFANA_URL: ${{ secrets.GRAFANA_URL }}
      GRAFANA_TOKEN: ${{ secrets.GRAFANA_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - run: ./grafana/push.sh
      - run: ./grafana/push-alerts.py
```

## Грабли на память

**VictoriaMetrics отдаёт 429, Grafana показывает 500.** У VictoriaMetrics
`search.maxConcurrentRequests` по умолчанию равен удвоенному числу ядер, лишние запросы ждут
в очереди `search.maxQueueDuration` (10 с) и получают 429. Дашборд на два десятка панелей
выпускает запросы разом и упирается в потолок. Лечится с двух сторон: флаг
`--search.maxConcurrentRequests=64` контейнеру VictoriaMetrics и `refresh: 15m` в обоих
дашбордах плюс свёрнутые строки — панели внутри свёрнутой строки Grafana не опрашивает
вовсе. В `copper-prometheus.json` открыт только «Обзор», остальные пять строк свёрнуты.

**Дашборд `Copper Prometheus 2`** в Grafana есть, но в репозиторий не взят: это черновик
на одну панель. Понадобится — выгрузить тем же curl'ом.
