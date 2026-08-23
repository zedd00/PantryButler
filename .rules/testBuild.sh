#!/bin/bash

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

OUTPUT=$(npx vite build --minify false --logLevel error --outDir "$TMPDIR/.dist" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "$OUTPUT"
fi

exit $EXIT_CODE
