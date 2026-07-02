// SPDX-License-Identifier: MIT
// Two-tier authentication (Postel: liberal in what we accept). The API key is OPTIONAL:
// leave it blank and the connection still works for the keyless actions (verify identity,
// RDAP, egress IP); supply a whisper_live_ key and the full control plane unlocks
// (register, list, policy, logs, revoke, egress config).
'use strict';

const { callControl } = require('./lib/control');
const { keylessGet } = require('./lib/keyless');

const test = async (z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    // Keyed tier: prove the key against the control plane with a harmless read.
    const { records } = await callControl(z, bundle, 'list', { kind: 'agents' });
    return { tier: 'control', agents: records.length };
  }
  // Keyless tier: prove connectivity to the public identity surface.
  const response = await keylessGet(z, '/egress-ip');
  if (response.status >= 400) {
    throw new z.errors.Error(
      'Could not reach the Whisper keyless identity API (rdap.whisper.online). Try again.',
      'ConnectivityError',
      response.status,
    );
  }
  return { tier: 'keyless', egress_ip: response.data && response.data.ip };
};

const connectionLabel = (z, bundle) =>
  bundle.inputData.tier === 'control'
    ? 'Whisper — full control plane'
    : 'Whisper — keyless (verify only)';

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'Whisper API Key',
      type: 'password',
      required: false,
      helpText:
        'Optional. Leave blank for the keyless tier (Verify Agent Identity, RDAP Lookup, ' +
        'Egress IP — public checks, no account needed). Paste your `whisper_live_…` key to ' +
        'unlock the full control plane: register agents, list your fleet, set DNS policy, ' +
        'read logs, revoke, and fetch egress config. Get a key at [whisper.online](https://whisper.online).',
    },
  ],
  test,
  connectionLabel,
};
