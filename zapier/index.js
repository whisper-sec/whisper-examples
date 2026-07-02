// SPDX-License-Identifier: MIT
// Whisper Agent Identity — a two-tier Zapier integration (Zapier Platform CLI).
//   Tier 1 (keyless): Verify Agent Identity, RDAP Lookup, Get Egress IP — no API key.
//   Tier 2 (keyed):   Register Agent, New Agent, Find Agents, Set DNS Policy,
//                     Get Agent Logs, Get Egress Config, Revoke Agent — whisper_live_ key.
// Auth is optional (Postel): a key-free connection serves tier 1; a key unlocks tier 2.
'use strict';

const authentication = require('./authentication');
const { befores = [], afters = [] } = require('./middleware');

const newAgent = require('./triggers/new_agent');
const registerAgent = require('./creates/register_agent');
const setPolicy = require('./creates/set_policy');
const revokeAgent = require('./creates/revoke_agent');
const connectEgress = require('./creates/connect_egress');
const egressIp = require('./creates/egress_ip');
const verifyIdentity = require('./searches/verify_identity');
const rdapLookup = require('./searches/rdap_lookup');
const listAgents = require('./searches/list_agents');
const getLogs = require('./searches/get_logs');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,
  beforeRequest: [...befores],
  afterResponse: [...afters],

  triggers: {
    [newAgent.key]: newAgent,
  },

  creates: {
    [registerAgent.key]: registerAgent,
    [setPolicy.key]: setPolicy,
    [revokeAgent.key]: revokeAgent,
    [connectEgress.key]: connectEgress,
    [egressIp.key]: egressIp,
  },

  searches: {
    [verifyIdentity.key]: verifyIdentity,
    [rdapLookup.key]: rdapLookup,
    [listAgents.key]: listAgents,
    [getLogs.key]: getLogs,
  },

  resources: {},

  // Predictable inputs: never auto-strip {{curlies}} from untransformed input data.
  flags: { cleanInputData: false },
};
