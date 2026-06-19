# Fold Security

- Treat `fold:v1:` tokens, room URLs with `#key`, copied agent handoffs, and
  `.fold/rooms.json` as decryption-capable secrets.
- The room key belongs client-side. Never send URL fragments or room secrets to
  server APIs.
- Routine JSON output should stay redacted. If command output contains
  `fold:v1:`, `#key=`, or `roomSecret`, handle it as secret-bearing invite or
  profile output.
- The server may see plaintext routing metadata such as `roomId`, sequence, and
  sender id. Markdown bodies, comments, proposals, and timeline payloads are
  decrypted client-side.
- Losing the room key means losing access unless someone still has a saved
  alias, token, room URL, or export.
