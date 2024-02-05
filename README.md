# spruthub


## Scripts
- Report about temperature to telegram
- Semd metrics to InfluxDB
- Send metrics to VictoriaMetrics

The right choice is VictoriMetrics

## About Metrics
What way for send
- By cron
- By trigge 

Why both? If you want in grafana some report per hour and you have script base only trigger - you dont have enouth data

