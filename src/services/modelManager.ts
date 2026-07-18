/**
 * On-device model file management for the embedded llama.rn runtime.
 *
 * The GGUF weights (~3.35 GB) are far too large to bundle in the app binary, so
 * we download them to the device's document directory on first run and load them
 * from there (llama.rn recommends exactly this). Everything here is native-only;
 * the web build never imports it (see `llamaTransport.web.ts`).
 *
 * Default model: Google's official Gemma 4 E2B QAT Q4_0 GGUF — the same E2B-QAT
 * class we validated via Ollama (see EVALUATION.md), chosen to fit an iPhone 17.
 */

import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_URL =
  'https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/main/gemma-4-E2B_q4_0-it.gguf';
const DEFAULT_FILE = 'gemma-4-E2B_q4_0-it.gguf';

export const ModelConfig = {
  url: process.env.EXPO_PUBLIC_GEMMA_GGUF_URL ?? DEFAULT_URL,
  fileName: process.env.EXPO_PUBLIC_GEMMA_GGUF_FILE ?? DEFAULT_FILE,
  /** A finished file must exceed this (a truncated download is smaller). */
  minBytes: Number(process.env.EXPO_PUBLIC_GEMMA_GGUF_MIN_BYTES ?? 500 * 1024 * 1024),
} as const;

export type DownloadProgress = {
  writtenBytes: number;
  totalBytes: number;
  /** 0–1; 0 when the server didn't send a content length. */
  fraction: number;
};

/** Absolute `file://` path where the model lives (or will live) on device. */
export function modelFileUri(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) return '';
  return dir + ModelConfig.fileName;
}

/** True once a complete-looking model file is present on device. */
export async function isModelDownloaded(): Promise<boolean> {
  const uri = modelFileUri();
  if (!uri) return false;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory && (info.size ?? 0) >= ModelConfig.minBytes;
}

type Resumable = ReturnType<typeof FileSystem.createDownloadResumable>;
let active: Resumable | null = null;

/**
 * Ensure the model is on device, downloading it if needed. Resolves to the local
 * `file://` path. Safe to call repeatedly — it no-ops once the file is present.
 */
export async function ensureModelDownloaded(
  onProgress?: (p: DownloadProgress) => void,
): Promise<string> {
  const uri = modelFileUri();
  if (!uri) throw new Error('No document directory available for model storage.');
  if (await isModelDownloaded()) return uri;

  const resumable = FileSystem.createDownloadResumable(ModelConfig.url, uri, {}, (d) => {
    const totalBytes = d.totalBytesExpectedToWrite ?? 0;
    const writtenBytes = d.totalBytesWritten ?? 0;
    onProgress?.({
      writtenBytes,
      totalBytes,
      fraction: totalBytes > 0 ? writtenBytes / totalBytes : 0,
    });
  });
  active = resumable;
  try {
    const result = await resumable.downloadAsync();
    if (!result?.uri) throw new Error('Model download did not complete.');
    if (!(await isModelDownloaded())) {
      // Server returned something too small (e.g. an HTML error page).
      await deleteModel();
      throw new Error('Downloaded model failed the size check — deleted.');
    }
    return result.uri;
  } finally {
    active = null;
  }
}

/** Cancel an in-flight download, if any. */
export async function cancelModelDownload(): Promise<void> {
  if (active) {
    await active.cancelAsync().catch(() => {});
    active = null;
  }
}

/** Remove the model file (to re-download or free space). */
export async function deleteModel(): Promise<void> {
  const uri = modelFileUri();
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}
