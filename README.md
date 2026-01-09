# SprutHub Scenarios

Коллекция сценариев для SprutHub — автоматизация умного дома.

## Сценарии

### AWTRIX Temperature Display

Отображение температуры с датчиков на часах Ulanzi TC001 (AWTRIX 3).

- Все датчики → все часы
- Цвет по температуре (фиолетовый → синий → зелёный → красный)
- Автоматическая настройка часов при сохранении сценария

**Документация:** [docs/awtrixTemperature-setup.md](docs/awtrixTemperature-setup.md) | [Тесты](docs/awtrixTemperature-tests.md)

---

### Metrics Collection

Сбор метрик с датчиков и отправка в time-series базы данных для визуализации в Grafana.

![result](result.png)

**Возможности:**
- Сбор данных с температурных, влажностных, CO2 датчиков
- Мониторинг потребления энергии (ваттметры, амперметры, вольтметры)
- Отправка метрик в InfluxDB и VictoriaMetrics
- Отчёты в Telegram

**Документация:** [docs/start.md](docs/start.md)

#### Быстрый старт

```bash
# Запуск баз данных
cd docker/influxDB && docker compose up -d
cd docker/victoriaMetrics && docker compose up -d
cd docker/grafana && docker compose up -d
```

#### Почему две базы данных?

| База | Назначение | Retention |
|------|------------|-----------|
| InfluxDB | Точные данные за короткий период | ~1 месяц |
| VictoriaMetrics | Долгосрочное хранение | 5 лет |

#### Способы сбора метрик

- **Trigger** — при каждом изменении датчика
- **Cron** — периодически, для почасовых отчётов в Grafana

## Структура

```
logic/           # Логические сценарии (с info блоком)
block/           # Простые сценарии (cron)
global/          # Глобальные функции
docker/          # Docker Compose для баз данных
docs/            # Документация
```
