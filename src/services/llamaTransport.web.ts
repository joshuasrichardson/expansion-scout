/**
 * Web stub for the embedded transport. llama.rn is native-only, so on web this
 * transport simply reports "unavailable" and the resolver falls back to Ollama
 * (dev) or the deterministic path. Metro resolves this file for the web bundle,
 * which keeps `llama.rn` out of the web build entirely.
 */

import type { GemmaTransport } from './gemma';

export class LlamaTransport implements GemmaTransport {
  async generate(): Promise<{ text: string; latencyMs: number }> {
    throw new Error('llama.rn is not available on web.');
  }

  async probe() {
    return { available: false, model: 'llama.rn', baseUrl: 'llama.rn (embedded)', latencyMs: 0 };
  }

  async release(): Promise<void> {
    /* no-op */
  }
}
