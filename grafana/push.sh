#!/usr/bin/env sh
# Заливка дашбордов из dashboards/*.json в Grafana через HTTP API.
#   GRAFANA_URL=http://192.168.1.50:3000 GRAFANA_TOKEN=glsa_xxx ./grafana/push.sh
# Опционально: DS_UID_PROMETHEUS, DS_UID_INFLUXDB (uid датасорсов), FOLDER_UID (папка в Grafana).
set -eu
: "${GRAFANA_URL:?нужен GRAFANA_URL}"
: "${GRAFANA_TOKEN:?нужен GRAFANA_TOKEN}"
DS_UID_PROMETHEUS="${DS_UID_PROMETHEUS:-ca323c89-304d-4630-90ab-16c715c6e304}"
DS_UID_INFLUXDB="${DS_UID_INFLUXDB:-c700f9b8-c600-4a9f-9de7-01f77ae2c52c}"
FOLDER_UID="${FOLDER_UID:-}"
export DS_UID_PROMETHEUS DS_UID_INFLUXDB FOLDER_UID

# Дашборды ищутся рядом со скриптом, а не в текущем каталоге: запуск из корня
# репозитория и из любого другого места должен давать один результат.
cd "$(dirname "$0")"

for f in dashboards/*.json; do
  echo "==> $f"
  # Панели ссылаются на ${DS}, здесь переменной задаётся значение — селектор наверху
  # остаётся рабочим. Uid берётся по типу источника (prometheus / influxdb).
  python3 -c '
import json, os, sys
d = json.load(open(sys.argv[1]))
for v in d["templating"]["list"]:
    if v["type"] == "datasource":
        uid = os.environ["DS_UID_" + v["query"].upper()]
        v["current"] = {"text": uid, "value": uid}
json.dump({"dashboard": d, "folderUid": os.environ["FOLDER_UID"], "overwrite": True}, sys.stdout)
' "$f" \
  | curl -sS --fail-with-body -X POST "$GRAFANA_URL/api/dashboards/db" \
      -H "Authorization: Bearer $GRAFANA_TOKEN" \
      -H 'Content-Type: application/json' --data-binary @-
  echo
done
