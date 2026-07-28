/**
 * Thin wrapper over the native `EyeDropper` API (Chrome 95+). Feature-detected
 * so callers can disable the control where the API is missing. Needs no
 * extension permission — it runs in the popup on a user gesture.
 */

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperInstance {
  open: (options?: { signal?: AbortSignal }) => Promise<EyeDropperResult>;
}
type EyeDropperCtor = new () => EyeDropperInstance;

function ctor(): EyeDropperCtor | undefined {
  return (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;
}

export function isEyeDropperSupported(): boolean {
  return typeof ctor() === 'function';
}

/** Opens the eyedropper and resolves the picked hex, or null if cancelled/unsupported. */
export async function pickColor(): Promise<string | null> {
  const Ctor = ctor();
  if (!Ctor) return null;
  try {
    const { sRGBHex } = await new Ctor().open();
    return sRGBHex.toLowerCase();
  } catch {
    return null; // user pressed Esc → AbortError
  }
}
