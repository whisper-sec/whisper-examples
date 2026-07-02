// SPDX-License-Identifier: MIT
// Whisper keyless identity surface - pure HTTPS GETs against rdap.whisper.online.
// No credential is ever attached to these requests (middleware only injects the key
// for the control endpoint), so they work on a key-free connection.
'use strict';

const KEYLESS_BASE = 'https://rdap.whisper.online';
const RDAP_ACCEPT = 'application/rdap+json, application/json;q=0.9, */*;q=0.1';

const keylessGet = (z, path, params) =>
  z.request({
    url: `${KEYLESS_BASE}${path}`,
    method: 'GET',
    params: params || {},
    headers: { Accept: RDAP_ACCEPT },
    skipThrowForStatus: true,
  });

module.exports = { KEYLESS_BASE, keylessGet };
