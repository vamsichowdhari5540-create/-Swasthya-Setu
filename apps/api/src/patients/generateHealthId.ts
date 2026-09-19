import { randomBytes } from 'node:crypto';

// Deliberately excludes ambiguous characters (0/O, 1/I/L) since this gets
// hand-copied occasionally even though the primary path is QR scanning.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Opaque only: no facility, date or name encoding — see the Phase 2
// guardrail (schema.sql) against putting medical or identifying structure
// into the QR payload itself.
export function generateHealthId(): string {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return `SS-${code}`;
}
