// ── providerPrefs (#40) ───────────────────────────────────────────────────────
// Recuerda SOLO el proveedor de IA y el modelo elegidos (datos NO secretos) en
// sessionStorage, para no tener que volver a seleccionarlos en cada recarga.
//
// ⚠️ Zero-Storage intacto: la **API key NUNCA se guarda** aquí ni en ningún storage
// del navegador — sigue viviendo solo en memoria de React (AIProviderContext). El
// id del proveedor ("groq"/"gemini"/"openrouter") y el nombre del modelo no son
// credenciales, así que persistirlos no debilita el modelo de seguridad.

import { PROVIDERS, type AIProviderType } from '../services/providers';

const STORAGE_KEY = 'ai_provider_pref';

export interface ProviderPref {
  provider: AIProviderType;
  model: string;
  /** #73: timeout de la llamada IA en ms. null/undefined = default (180s). */
  timeoutMs?: number;
}

/** Guarda proveedor + modelo (no la key). Degradación silenciosa si no hay storage. */
export function saveProviderPref(provider: AIProviderType, model: string, timeoutMs?: number): void {
  try {
    const pref: ProviderPref = { provider, model };
    if (typeof timeoutMs === 'number') pref.timeoutMs = timeoutMs;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* sessionStorage no disponible (modo privado, etc.) — no es crítico */
  }
}

/** Lee la preferencia guardada, validando que el proveedor exista en el registro. */
export function loadProviderPref(): ProviderPref | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProviderPref>;
    if (
      parsed &&
      typeof parsed.provider === 'string' &&
      parsed.provider in PROVIDERS &&
      typeof parsed.model === 'string' &&
      parsed.model.length > 0
    ) {
      const pref: ProviderPref = { provider: parsed.provider as AIProviderType, model: parsed.model };
      // #73: solo conserva timeoutMs si es un número válido (>0).
      if (typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0) pref.timeoutMs = parsed.timeoutMs;
      return pref;
    }
  } catch {
    /* JSON corrupto — se ignora */
  }
  return null;
}

/** Borra la preferencia (al desconectar). */
export function clearProviderPref(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
