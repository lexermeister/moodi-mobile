import assert from 'node:assert/strict';
import test from 'node:test';
import { restartDemoRequest } from '../src/features/recordings/demoResetApi.ts';

test('reset succeeds only for the backend no-content response', async () => {
  const calls = [];
  await restartDemoRequest('https://demo.example', async (url, init) => {
    calls.push([url, init.method]); return new Response(null, { status: 204 });
  });
  assert.deepEqual(calls, [['https://demo.example/demo/data', 'DELETE']]);
  await assert.rejects(restartDemoRequest('https://demo.example', async () =>
    new Response('<html>Tunnel unavailable</html>', { status: 200 })), /No device data was cleared/);
});

test('an offline tunnel is distinguished from an unavailable reset feature', async () => {
  await assert.rejects(restartDemoRequest('https://demo.example', async () =>
    new Response('Tunnel offline', { status: 404 })), /backend address is unavailable/);
  await assert.rejects(restartDemoRequest('https://demo.example', async url =>
    url.endsWith('/health') ? Response.json({ status: 'ok' }) : new Response(null, { status: 404 })),
  /disabled or missing/);
});

test('transport and server failures preserve device data', async () => {
  await assert.rejects(restartDemoRequest('https://demo.example', async () => { throw new Error('offline'); }),
    /Could not reach.*No device data was cleared/);
  await assert.rejects(restartDemoRequest('https://demo.example', async () => new Response(null, { status: 500 })),
    /Could not clear backend demo data.*No device data was cleared/);
});
