// A single retry with a short delay, not a full backoff policy — this is a
// backend adapter smoothing over a flaky network call or an occasional
// malformed reply, not a queue that needs to survive a sustained outage.
// Callers still treat two failures in a row as "this adapter is down right
// now" and move to the next one in the chain.
export async function withRetry<T>(attempt: () => Promise<T | null>, retries = 1, delayMs = 400): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    const result = await attempt();
    if (result !== null) return result;
    if (i < retries) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
