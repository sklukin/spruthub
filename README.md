# spruthub


## Scripts
- send report about temps to telegram
- send data about temperature and humidity to inFluxDB and then crate report in grafana

## About influxDB
First script react on trigger and second on start by cron per some period (like hour)
Why? If you want in grafana some report per hour and you have script base only trigger - you dont have enouth data

