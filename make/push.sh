#!/usr/bin/env sh
# SPDX-License-Identifier: MIT
# Sync this folder's app source into a Make (Integromat) custom app.
#
#   MAKE_API_TOKEN=<token> ./push.sh <app-name> [zone] [version]
#
# <app-name> is the name Make generated when you created the app shell
# (Custom apps -> Create app), e.g. whisper-abcdef. The connection created
# with the app shares that name. Idempotent: safe to re-run.
set -eu

APP=${1:?usage: MAKE_API_TOKEN=... ./push.sh <app-name> [zone] [version]}
ZONE=${2:-eu1}
VER=${3:-1}
: "${MAKE_API_TOKEN:?set MAKE_API_TOKEN}"
API="https://$ZONE.make.com/api/v2"
DIR=$(dirname "$0")/app

req() { # req METHOD PATH CONTENT-TYPE BODY-FILE
  m=$1; p=$2; ct=$3; f=$4
  # the connection name equals the app name - rewrite the reference on the fly
  sed "s/whisper-jijvrd/$APP/g" "$f" | curl -sfS -X "$m" \
    -H "Authorization: Token $MAKE_API_TOKEN" -H "content-type: $ct" \
    --data-binary @- "$API$p" > /dev/null
  echo "  $m $p"
}

echo "app metadata + base + readme"
req PATCH "/sdk/apps/$APP/$VER"        application/json "$DIR/app.json"
req PUT   "/sdk/apps/$APP/$VER/base"   application/json "$DIR/base.json"
req PUT   "/sdk/apps/$APP/$VER/readme" text/markdown    "$DIR/readme.md"

echo "connection $APP"
req PUT "/sdk/apps/connections/$APP/api"        application/json "$DIR/connection/api.json"
req PUT "/sdk/apps/connections/$APP/parameters" application/json "$DIR/connection/parameters.json"

for d in "$DIR"/modules/*/; do
  m=$(basename "$d")
  echo "module $m"
  # create if missing (POST is rejected with 400 when it already exists)
  sed "s/whisper-jijvrd/$APP/g" "$d/module.json" | curl -s -X POST \
    -H "Authorization: Token $MAKE_API_TOKEN" -H "content-type: application/json" \
    --data-binary @- "$API/sdk/apps/$APP/$VER/modules" > /dev/null || true
  for s in api expect interface samples; do
    if [ -s "$d/$s.json" ]; then
      req PUT "/sdk/apps/$APP/$VER/modules/$m/$s" application/json "$d/$s.json"
    fi
  done
done
echo "done - the app is live to your organization."
