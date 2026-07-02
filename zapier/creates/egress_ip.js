// SPDX-License-Identifier: MIT
// KEYLESS action: the caller's current egress IP as seen by Whisper. From a Zap this is
// Zapier's own egress address — useful as a connectivity/plumbing check.
'use strict';

const { keylessGet } = require('../lib/keyless');

const perform = async (z, bundle) => {
  const response = await keylessGet(z, '/egress-ip');
  if (response.status >= 400) {
    throw new z.errors.Error(
      `egress-ip returned status ${response.status}`,
      'EgressIpError',
      response.status,
    );
  }
  const data = response.data || {};
  return { id: data.ip || 'egress-ip', ...data };
};

module.exports = {
  key: 'egress_ip',
  noun: 'Egress IP',
  display: {
    label: 'Get Egress IP',
    description:
      "Returns this step's current egress IP as seen by Whisper — keyless, no API key needed.",
  },
  operation: {
    perform,
    inputFields: [],
    sample: { id: '2001:db8::1', ip: '2001:db8::1' },
    outputFields: [{ key: 'ip', label: 'Egress IP' }],
  },
};
