/**
 * Resolución de referencia a repositorio desde la entrada del usuario.
 *
 * Patrón repetido en varios handlers de App.tsx (#42): el usuario puede escribir
 * `owner/repo` o solo `repo` (en cuyo caso el owner es el usuario autenticado).
 * Extraído como utilidad pura para deduplicar y poder testearlo.
 */

export interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * Devuelve `{ owner, repo }` a partir de una entrada `owner/repo` o `repo`.
 * Si no hay `/`, se usa `defaultOwner` (normalmente el login del usuario).
 */
export function resolveRepoRef(input: string, defaultOwner: string): RepoRef {
  let trimmed = input.trim();
  // Eliminar prefijos de URL completas de GitHub (e.g. "https://github.com/owner/repo.git")
  trimmed = trimmed.replace(/^https?:\/\/(?:www\.)?github\.com\//i, '');
  trimmed = trimmed.replace(/\.git$/i, '');

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }
  return { owner: defaultOwner, repo: trimmed };
}
