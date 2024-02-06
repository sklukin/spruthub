# spruthub


## Scripts
- Report about temperature to telegram
- Semd metrics to InfluxDB
- Send metrics to VictoriaMetrics

Use InfluxDB for more Accuracy 
Use VictoriaMetrics for more retintion data (like 5y)

InfluxDB usualy work well with period about month

## About Metrics
What way for send
- By cron
- By trigger

Why both? If you want in grafana some report per hour and you have script base only trigger - you dont have enouth data

