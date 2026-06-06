import assert from 'node:assert/strict';
import { EncryptedYjsClient } from './client.js';
import { EncryptedAppendLogServer } from './server.js';

const roomId = 'spike-room';
const roomSecret = 'fragment-key-never-sent-to-server';
const secretMarkdown = '# Agent plan\n\nThis plaintext must never be visible to the server.';

const server = new EncryptedAppendLogServer();
const serverUrl = await server.start();

try {
  const alice = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'alice' });
  const bob = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'bob' });

  await alice.connect();
  await bob.connect();

  alice.markdown.insert(0, secretMarkdown);
  await bob.waitForText(secretMarkdown);

  const persisted = server.store.serialized(roomId);
  assert.equal(persisted.includes(secretMarkdown), false, 'server append log leaked plaintext markdown');
  assert.equal(persisted.includes(roomSecret), false, 'server append log leaked room secret');

  bob.disconnect();

  const reloaded = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'reloaded' });
  await reloaded.connect();
  assert.equal(reloaded.markdown.toString(), secretMarkdown, 'reloaded client failed to reconstruct Yjs document');

  let wrongKeyFailed = false;
  const wrongKeyClient = new EncryptedYjsClient({
    serverUrl,
    roomId,
    roomSecret: 'wrong-fragment-key',
    clientId: 'wrong-key',
  });
  try {
    await wrongKeyClient.connect();
  } catch {
    wrongKeyFailed = true;
  } finally {
    wrongKeyClient.disconnect();
  }
  assert.equal(wrongKeyFailed, true, 'wrong room key unexpectedly decrypted persisted updates');

  alice.disconnect();
  reloaded.disconnect();

  console.log('✓ E2EE Yjs append-log spike passed');
  console.log('→ Two clients synchronized through encrypted WebSocket update records');
  console.log('→ A fresh client reloaded persisted encrypted updates');
  console.log('→ Server-side append log did not contain plaintext markdown or the room key');
  console.log('→ Wrong room key could not decrypt the room');
  console.log('Verdict: viable_with_constraints for a v1 custom encrypted append-log provider spike');
} finally {
  await server.stop();
}
