// ─── #53 (v3.50.0): Sugerencia de commit semántico ──────────────────────────
//
// La app edita ficheros vía la GitHub API (createOrUpdateFile), NO tiene working
// tree local. Por eso "analizar el diff pendiente" no aplica: sugerimos el
// mensaje ANTES de crear el commit, usando los commits recientes del repo como
// few-shot de estilo y un prompt dedicado (Conventional Commits).
//
// Zero-Storage: la sugerencia vive solo en la conversación/textarea del modal.
// No se persiste en servidor; la API key viaja en cada llamada como siempre.
//
// Toda la lógica está aquí para poder testearla aislada (mock callAI +
// listRecentCommits), sin montar el modal completo.

import type { GeminiAction } from '../types';
import { listRecentCommits } from './github';
import { callAI } from './gemini';
import type { AIProviderType } from './providers';
import type { Language } from '../context/LanguageContext';
import commitMessagePrompt from '../prompts/commit-message.md?raw';

// Re-exportado para tests y para que el modal pueda mostrar el prompt si hace falta.
export const COMMIT_MESSAGE_PROMPT = commitMessagePrompt.trimEnd();

/** Cuántos commits recientes usar como few-shot de estilo. */
const FEWSHOT_COUNT = 10;

/**
 * Construye el mensaje de usuario para pedir la sugerencia al LLM.
 * Exportada para tests unitarios (sin red ni dependencias).
 *
 * Resume la acción en datos útiles para el mensaje de commit: archivo, método,
 * descripción natural y un extracto del contenido propuesto. NO envía el contenido
 * completo si es muy largo (podría saturar contexto y filtrar detalle irrelevante).
 */
export function buildSuggestionUserMessage(
  action: GeminiAction,
  recentCommitMessages: string[],
): string {
  const lines: string[] = [];

  lines.push('## Acción a commitear');
  lines.push(`- Tipo: ${action.tipo}`);
  lines.push(`- Método HTTP: ${action.metodo}`);
  if (action.archivo) lines.push(`- Archivo: ${action.archivo}`);
  if (action.repo) lines.push(`- Repo: ${action.repo}`);
  lines.push(`- Descripción: ${action.accion}`);

  // Extracto del contenido propuesto (solo primeros líneas, acotado).
  if (action.contenidoPropuesto) {
    const head = action.contenidoPropuesto.split('\n').slice(0, 15).join('\n');
    const truncated = action.contenidoPropuesto.split('\n').length > 15
      ? '\n… (contenido truncado para el mensaje de commit)'
      : '';
    lines.push('');
    lines.push('## Extracto del contenido propuesto');
    lines.push('```');
    lines.push(head + truncated);
    lines.push('```');
  }

  if (recentCommitMessages.length > 0) {
    lines.push('');
    lines.push('## Últimos commits del repo (imita su estilo si es consistente)');
    for (const m of recentCommitMessages) {
      // Solo la primera línea de cada commit (sin cuerpo).
      const firstLine = m.split('\n')[0].trim();
      if (firstLine) lines.push(`- ${firstLine}`);
    }
  } else {
    lines.push('');
    lines.push('## Últimos commits del repo');
    lines.push('(repo sin commits previos o no accesibles — usa Conventional Commits puro)');
  }

  lines.push('');
  lines.push('Propón UN mensaje de commit en una sola línea.');
  return lines.join('\n');
}

/**
 * Limpia la salida del LLM para garantizar el formato de commit de una línea.
 * - Quita comillas/bloques de código que el modelo pueda añadir.
 * - Se queda con la primera línea no vacía.
 * - Acota a 200 caracteres como salvaguarda.
 */
export function sanitizeCommitMessage(raw: string): string {
  let s = (raw || '').trim();
  // Quitar fences de código ``` si el modelo los envolvió.
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  // Quitar comillas envolventes.
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Primera línea no vacía (descarta cuerpo si el modelo lo añadió).
  const firstLine = s.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? s;
  // Salvaguarda de longitud (un commit header razonable).
  return firstLine.slice(0, 200);
}

/**
 * Punto de entrada del módulo. Pide al LLM un mensaje de commit semántico para
 * la acción dada, usando el historial reciente del repo como few-shot.
 *
 * Devuelve un mensaje limpio (una línea, Conventional Commits). Si algo falla
 * (red, API, sin apiKey/model), NO lanza: devuelve un fallback estable para que
 * el modal siempre tenga algo que mostrar. El usuario puede editarlo igualmente.
 *
 * @param repoOwner/repoName  repo al que va dirigida la acción (para few-shot).
 *                            Si son null/undefined se omite el few-shot.
 */
export async function suggestCommitMessage(args: {
  action: GeminiAction;
  token: string;
  repoOwner?: string | null;
  repoName?: string | null;
  provider: AIProviderType;
  apiKey: string;
  model: string;
  lang?: Language;
}): Promise<string> {
  const { action, token, provider, apiKey, model } = args;

  // 1) Few-shot: commits recientes del repo destino (best-effort).
  let recent: string[] = [];
  if (args.repoOwner && args.repoName) {
    try {
      const commits = await listRecentCommits(token, args.repoOwner, args.repoName, FEWSHOT_COUNT);
      recent = commits.map(c => c.message);
    } catch {
      // Si no podemos leer el historial (repo privado sin permiso, 404, red…),
      // seguimos sin few-shot. El prompt lo contempla.
    }
  }

  // 2) Sugerencia vía LLM.
  const userMsg = buildSuggestionUserMessage(action, recent);
  try {
    const raw = await callAI(
      [{ role: 'user', content: userMsg }],
      COMMIT_MESSAGE_PROMPT,
      provider,
      apiKey,
      model,
      'action',
    );
    const cleaned = sanitizeCommitMessage(raw);
    if (cleaned) return cleaned;
  } catch {
    // El usuario sigue pudiendo escribir su mensaje; devolvemos fallback abajo.
  }

  // 3) Fallback determinista: no depende de red ni de modelo.
  return fallbackCommitMessage(action);
}

/**
 * Mensaje de commit determinista cuando el LLM no está disponible o falla.
 * Mantiene Conventional Commits (chore/feat/docs) según el tipo de acción.
 */
export function fallbackCommitMessage(action: GeminiAction): string {
  const type = action.metodo === 'POST' && action.tipo === 'creacion' ? 'feat'
    : action.tipo === 'listado' || action.tipo === 'lectura' ? 'docs'
    : 'chore';
  const target = action.archivo || action.accion || 'archivo';
  // Sin acentos en el scope para evitar problemas de shell/CI en algunos entornos.
  const safeTarget = target.replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 60) || 'archivo';
  return `${type}: ${safeTarget}`;
}
