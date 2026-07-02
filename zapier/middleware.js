// SPDX-License-Identifier: MIT
// HTTP middleware: inject X-API-Key only on control-plane requests; never on the
// keyless identity endpoints (conservative — the key travels only where it is needed).
'use strict';

const includeApiKey = (request, z, bundle) => {
  if (
    bundle.authData &&
    bundle.authData.api_key &&
    request.url &&
    request.url.startsWith('https://graph.whisper.security/')
  ) {
    request.headers = request.headers || {};
    request.headers['X-API-Key'] = bundle.authData.api_key;
  }
  return request;
};

module.exports = { befores: [includeApiKey], afters: [] };
