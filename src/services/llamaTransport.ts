/**
 * Embedded on-device transport — real Gemma 4 inference running *inside the app
 * process* via llama.rn (llama.cpp). This is the true-on-device path the
 * On-Device track requires: no server, no network, reasoning never leaves the
 * phone. Contrast with `OllamaTransport`, which is the dev/simulator path.
 *
 * Requirements (see ON_DEVICE.md):
 *   • a custom dev build (Expo Go can't load native modules)
 *   • a physical Metal device — iOS inference is NOT supported in the Simulator
 *   • the GGUF downloaded on device (handled by `modelManager`)
 *
 * llama.rn is imported dynamically and only on native, so the module is never
 * required in Expo Go / web (the web build resolves `llamaTransport.web.ts`).
 */

import { Platform } from 'react-native';

import type { GemmaTransport, GenerateOpts } from './gemma';
import { isModelDownloaded, modelFileUri } from './modelManager';

type LlamaModule = typeof import('llama.rn');
type LlamaCtx = Awaited<ReturnType<LlamaModule['initLlama']>>;

const LlamaConfig = {
  nCtx: Number(process.env.EXPO_PUBLIC_GEMMA_N_CTX ?? 4096),
  nGpuLayers: Number(process.env.EXPO_PUBLIC_GEMMA_N_GPU_LAYERS ?? 99),
  timeoutMs: Number(process.env.EXPO_PUBLIC_GEMMA_TIMEOUT_MS ?? 22000),
  label: process.env.EXPO_PUBLIC_GEMMA_MODEL ?? 'gemma4:e2b-it-qat',
} as const;

export class LlamaTransport implements GemmaTransport {
  private mod: LlamaModule | null = null;
  private ctx: LlamaCtx | null = null;
  private initPromise: Promise<LlamaCtx | null> | null = null;
  private detail = '';

  private isNative(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  private async loadModule(): Promise<LlamaModule | null> {
    if (this.mod) return this.mod;
    if (!this.isNative()) {
      this.detail = 'llama.rn runs on device only.';
      return null;
    }
    try {
      this.mod = await import('llama.rn');
      return this.mod;
    } catch {
      this.detail = 'llama.rn native module missing — build a dev client.';
      return null;
    }
  }

  /** Lazily initialize (and cache) a single model context. */
  private async getContext(): Promise<LlamaCtx | null> {
    if (this.ctx) return this.ctx;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const mod = await this.loadModule();
      if (!mod) return null;
      if (!(await isModelDownloaded())) {
        this.detail = 'Model not downloaded yet.';
        return null;
      }
      const ctx = await mod.initLlama({
        // llama.cpp opens a filesystem path; strip the file:// scheme from the URI.
        model: modelFileUri().replace(/^file:\/\//, ''),
        n_ctx: LlamaConfig.nCtx,
        n_gpu_layers: LlamaConfig.nGpuLayers, // offload to Metal
        use_mlock: true,
      });
      this.ctx = ctx;
      this.detail = 'Gemma loaded in-process via llama.rn.';
      return ctx;
    })();

    try {
      return await this.initPromise;
    } catch (e) {
      this.detail = e instanceof Error ? e.message : 'llama.rn init failed.';
      return null;
    } finally {
      this.initPromise = null;
    }
  }

  async generate(prompt: string, opts?: GenerateOpts) {
    const started = Date.now();
    const ctx = await this.getContext();
    if (!ctx) throw new Error(this.detail || 'llama.rn context unavailable');

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctx.stopCompletion().catch(() => {});
    }, LlamaConfig.timeoutMs);

    // Stream tokens straight out of llama.cpp as they're sampled — the realest
    // possible "watch it think" signal (in-process, no network involved at all).
    let streamed = '';
    let pieces = 0;
    const onPartial = opts?.onToken
      ? (data: { token?: string }) => {
          if (typeof data?.token === 'string' && data.token) {
            streamed += data.token;
            pieces += 1;
            opts.onToken?.(streamed, pieces);
          }
        }
      : undefined;

    try {
      const res = await ctx.completion(
        {
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }, // constrain to a JSON object
          n_predict: opts?.maxTokens ?? 512,
          temperature: opts?.temperature ?? 0.4,
        },
        onPartial,
      );
      if (timedOut) throw new Error(`Timed out after ${LlamaConfig.timeoutMs}ms`);
      const text = (res.text ?? res.content ?? '').trim();
      if (!text) throw new Error('Empty completion');
      return { text, latencyMs: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  async probe() {
    const started = Date.now();
    const base = { model: shortName(LlamaConfig.label), baseUrl: 'llama.rn (embedded)' };
    if (!this.isNative()) {
      return { available: false, latencyMs: 0, ...base };
    }
    const mod = await this.loadModule();
    const downloaded = await isModelDownloaded().catch(() => false);
    return { available: !!mod && downloaded, latencyMs: Date.now() - started, ...base };
  }

  /** Free the native context (e.g. on teardown). */
  async release(): Promise<void> {
    if (this.ctx) {
      await this.ctx.release().catch(() => {});
      this.ctx = null;
    }
  }
}

function shortName(model: string): string {
  return model.replace(/^.*\//, '');
}
