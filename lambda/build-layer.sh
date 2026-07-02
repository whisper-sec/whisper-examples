#!/bin/sh
# SPDX-License-Identifier: MIT
# Build the whisper-id-egress Lambda layer zip — pure-Python wheels only, so ONE
# layer serves python3.12+3.13 on both x86_64 and arm64, buildable on any host.
set -eu
rm -rf build layer.zip && mkdir -p build/python
pip install --target build/python \
  --implementation py --abi none --platform any --only-binary=:all: \
  "whisper-id[socks]" requests
rm -rf build/python/bin && find build/python -name __pycache__ -type d -exec rm -rf {} +
(cd build && zip -qr ../layer.zip python)
echo "layer.zip ready — publish with:"
echo "  aws lambda publish-layer-version --layer-name whisper-id-egress \\"
echo "    --zip-file fileb://layer.zip --compatible-runtimes python3.12 python3.13 \\"
echo "    --compatible-architectures x86_64 arm64 --license-info MIT"
