// SPDX-License-Identifier: MIT
// Whisper on AWS Lambda (Node, Function URL or API Gateway). npm i whisper-id
import { verify, rdap } from "whisper-id";

export const handler = async (event) => {
  const addr = event?.queryStringParameters?.addr;
  if (!addr) return { statusCode: 400, body: "usage: ?addr=<agent /128 or fqdn>" };
  const isAgent = await verify(addr); // keyless
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null }),
  };
};
