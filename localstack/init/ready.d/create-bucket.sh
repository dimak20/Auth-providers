#!/bin/sh
# Runs inside LocalStack once S3 is ready: creates the media bucket.
set -e
awslocal s3 mb "s3://${S3__BUCKET}" 2>/dev/null || true
echo "bucket ${S3__BUCKET} ready"
