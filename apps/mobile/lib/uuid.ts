// A client-generated id only ever needs to be unique per device, never
// cryptographically unguessable — this keeps the outbox free of a native
// crypto dependency that behaves differently across Hermes/web.
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
