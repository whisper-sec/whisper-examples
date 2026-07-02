// SPDX-License-Identifier: MIT
// KEYLESS search: fetch the RFC 9083 RDAP object anchored at an agent's /128.
'use strict';

const { keylessGet } = require('../lib/keyless');

const perform = async (z, bundle) => {
  const addr = (bundle.inputData.address || '').trim();
  const response = await keylessGet(z, `/ip/${encodeURIComponent(addr)}`);
  if (response.status === 404) return []; // no identity anchored here
  if (response.status >= 400) {
    const detail =
      (response.data && (response.data.detail || response.data.title)) ||
      `RDAP returned status ${response.status}`;
    throw new z.errors.Error(detail, 'RdapError', response.status);
  }
  const obj = response.data || {};
  return [{ id: obj.handle || addr, ...obj }];
};

module.exports = {
  key: 'rdap_lookup',
  noun: 'RDAP Record',
  display: {
    label: 'RDAP Lookup',
    description:
      'Fetches the public RDAP registration record for a Whisper agent address — keyless, no API key needed.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'address',
        label: 'IP Address',
        type: 'string',
        required: true,
        helpText: 'The agent IPv6 address, e.g. `2a04:2a01:0:42::1`.',
      },
    ],
    sample: {
      id: '2a04:2a01:0:42::1',
      objectClassName: 'ip network',
      handle: '2a04:2a01:0:42::1',
      startAddress: '2a04:2a01:0:42::1',
      endAddress: '2a04:2a01:0:42::1',
      ipVersion: 'v6',
      name: 'WHISPER-AGENT',
      type: 'ASSIGNED',
      status: ['active'],
    },
    outputFields: [
      { key: 'handle', label: 'Handle' },
      { key: 'name', label: 'Network Name' },
      { key: 'startAddress', label: 'Start Address' },
      { key: 'endAddress', label: 'End Address' },
      { key: 'type', label: 'Assignment Type' },
    ],
  },
};
