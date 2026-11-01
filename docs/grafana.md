# Grafana: дашборды, алерты и доставка

Каталог `grafana/` содержит конфигурацию Grafana и скрипты доставки.
Дашборды Copper и правила умного дома импортированы из `homelab/grafana`, commit
`15ebebc02020f1f8ae8a307f2b442e2e7965d94c`. UID дашбордов и правил сохранены:
деплой обновляет существующие объекты. Прежние файлы `copper-influxdb.json`
и `copper-prometheus.json` заменены актуальными версиями с теми же UID.

## Состав

| Файл в `grafana/dashboards/` | Дашборд |
|---|---|
| `copper-influx.json` | Датчики дома, InfluxDB |
| `copper-sensors.json` | Датчики дома, VictoriaMetrics |

В `grafana/alerts/` находятся `copper.json` (12 правил умного дома) и
`spruthub.json` (1 правило доступности метрик хаба) — всего 13 правил.

Мониторинг хостов, Proxmox и ИБП, scrape-конфигурация и общие настройки
уведомлений управляются инфраструктурным репозиторием `homelab/proxmox`.
Этот репозиторий доставляет только дашборды и группы правил умного дома.

## Forgejo Actions

[Workflow](../.forgejo/workflows/grafana.yml) проверяет JSON, shell-синтаксис
и тесты Grafana API. На push в `main`, затрагивающий `grafana/**` или сам
workflow, затем публикует дашборды и алерты умного дома.
Ручной запуск доступен через `workflow_dispatch` на `main`.
Pull request запускает только проверки.

Доставка выполняется локальным Forgejo runner с меткой `ubuntu-latest`.
GitHub Actions продолжает проверять JavaScript: облачный runner не имеет
доступа к локальной Grafana.

В Actions secrets репозитория `homelab/spruthub` нужен `GRAFANA_TOKEN` —
service account token Grafana с правами на запись дашбордов и алертов.
Уведомления используют уже настроенную маршрутизацию Grafana по меткам
`service=copper` и `service=spruthub`.

Actions variables:

| Переменная | По умолчанию |
|---|---|
| `GRAFANA_URL` | `http://monitoring.home.arpa:3000` |
| `DS_UID` | `ca323c89-304d-4630-90ab-16c715c6e304` (VictoriaMetrics) |
| `DS_INFLUX_UID` | `c700f9b8-c600-4a9f-9de7-01f77ae2c52c` (InfluxDB) |

Forgejo не позволяет прочитать значения существующих secrets: их нужно
добавить в новую репу из исходного безопасного хранилища.

При переключении доставки нужно отключить прежний автодеплой тех же объектов
в `homelab/grafana` или `homelab/proxmox`: независимые workflow могут
перезаписывать одну конфигурацию. Изменения в этих репах здесь не выполняются.

## Локальная проверка и доставка

```sh
python3 -m unittest discover -s grafana/tests -v
sh -n grafana/push.sh
```

Перед доставкой задать `GRAFANA_URL` и `GRAFANA_TOKEN`
в окружении, затем из любого каталога:

```sh
./grafana/push.sh
./grafana/push-alerts.py
```

`DS_UID` и `DS_INFLUX_UID` меняют источники данных. Для совместимости
поддерживаются прежние имена `DS_UID_PROMETHEUS` и `DS_UID_INFLUXDB`;
новые имена имеют приоритет. `FOLDER_UID` задаёт папку дашбордов.

Дашборды публикуются с `overwrite: true`; datasource-переменные получают UID
из окружения. Скрипт алертов обновляет группы правил умного дома. POST группы заменяет всю группу.
Полностью удалённые группы автоматически не удаляются.

Условие правил: выражение вернуло значение больше нуля. Для отсутствующих
метрик подходят `absent(metric)` и `(up{…} == bool 0) or absent(up{…})`.
Временная ошибка Grafana `database is locked` повторяется до трёх попыток;
остальные ошибки сохраняют неуспешный результат доставки.

Правки через UI нужно возвращать в JSON/шаблоны репозитория: следующий деплой
применяет сохранённую здесь конфигурацию.
