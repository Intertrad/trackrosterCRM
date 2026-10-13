/* global URL, console, fetch, process, setTimeout */

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const requireWorker = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } =
  requireWorker('@aws-sdk/client-s3');
const { getSignedUrl } = requireWorker('@aws-sdk/s3-request-presigner');

const s3Endpoint = required('PROVIDER_S3_ENDPOINT');
const bucket = required('PROVIDER_S3_BUCKET');
const accessKeyId = required('PROVIDER_S3_ACCESS_KEY_ID');
const secretAccessKey = required('PROVIDER_S3_SECRET_ACCESS_KEY');
const mailpitUrl = required('PROVIDER_MAILPIT_URL').replace(/\/$/, '');
const s3 = new S3Client({
  region: process.env.PROVIDER_S3_REGION ?? 'auto',
  endpoint: s3Endpoint,
  forcePathStyle: process.env.PROVIDER_S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId, secretAccessKey },
});

const key = `contract/${randomUUID()}.txt`;
const body = 'trackroster-provider-contract';

await ensureBucket();
await s3.send(
  new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }),
);
const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
if ((await object.Body.transformToString()) !== body) throw new Error('S3 round trip mismatch');
const signedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
  expiresIn: 60,
});
const signedResponse = await fetch(signedUrl);
if (!signedResponse.ok || (await signedResponse.text()) !== body)
  throw new Error(`S3 signed GET failed with HTTP ${signedResponse.status}`);
await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

const ready = await fetch(`${mailpitUrl}/readyz`);
if (!ready.ok) throw new Error(`Mailpit readiness failed with HTTP ${ready.status}`);
const recipient = `contract-${randomUUID()}@example.test`;
const send = await fetch(`${mailpitUrl}/api/v1/send`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    From: { Email: 'accounts@trackroster.test', Name: 'TrackRoster' },
    To: [{ Email: recipient }],
    Subject: 'TrackRoster provider contract probe',
    Text: 'provider contract probe',
  }),
});
if (!send.ok) throw new Error(`Mailpit send failed with HTTP ${send.status}`);
await waitForIndexedMessage(recipient);

console.log(
  JSON.stringify({
    s3: { roundTrip: true, signedGet: true },
    mailpit: { ready: true, send: true, indexed: true },
  }),
);

async function ensureBucket() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? error.name : undefined;
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw error;
  }
}

async function waitForIndexedMessage(recipient) {
  const deadline = Date.now() + 5_000;
  const query = encodeURIComponent(`to:${recipient}`);
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/search?query=${query}`);
    if (!response.ok) throw new Error(`Mailpit search failed with HTTP ${response.status}`);
    const result = await response.json();
    if (result.messages?.length) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Mailpit did not index the provider probe message within 5 seconds');
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the local provider contract probe`);
  return value;
}
