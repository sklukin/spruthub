#!/usr/bin/env sh
# Заливка дашбордов из dashboards/*.json в Grafana через HTTP API.
#   GRAFANA_URL=http://monitoring.home.arpa:3000 GRAFANA_TOKEN=glsa_xxx ./push.sh
# Опционально: DS_UID (uid датасорса, по умолчанию spruthub), FOLDER_UID (папка в Grafana).
set -eu
: "${GRAFANA_URL:?нужен GRAFANA_URL}"
: "${GRAFANA_TOKEN:?нужен GRAFANA_TOKEN}"
DS_UID="${DS_UID:-${DS_UID_PROMETHEUS:-ca323c89-304d-4630-90ab-16c715c6e304}}"
# Дашборд Copper-архив смотрит в старую базу InfluxDB, а не в VictoriaMetrics
DS_INFLUX_UID="${DS_INFLUX_UID:-${DS_UID_INFLUXDB:-c700f9b8-c600-4a9f-9de7-01f77ae2c52c}}"
FOLDER_UID="${FOLDER_UID:-}"
export DS_UID DS_INFLUX_UID FOLDER_UID

cd "$(dirname "$0")"

for f in dashboards/*.json; do
  echo "==> $f"
  # ponytail: панели ссылаются на ${DS}, здесь задаём переменной значение — селектор наверху остаётся рабочим
  python3 -c '
import json, os, sys
d = json.load(open(sys.argv[1]))
# у переменной-датасорса поле query — это тип плагина, по нему и выбираем uid
uids = {"prometheus": os.environ["DS_UID"], "influxdb": os.environ["DS_INFLUX_UID"]}
for v in d["templating"]["list"]:
    if v["type"] == "datasource":
        uid = uids.get(v.get("query"), os.environ["DS_UID"])
        v["current"] = {"text": uid, "value": uid}
json.dump({"dashboard": d, "folderUid": os.environ["FOLDER_UID"], "overwrite": True}, sys.stdout)
' "$f" \
  | curl -sS --fail-with-body -X POST "$GRAFANA_URL/api/dashboards/db" \
      -H "Authorization: Bearer $GRAFANA_TOKEN" \
      -H 'Content-Type: application/json' --data-binary @-
  echo
done
