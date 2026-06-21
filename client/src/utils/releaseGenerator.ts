/**
 * Release Generator Utility — Create GitHub releases with documentation
 */

export interface ReleaseOptions {
  version: string;
  title: string;
  body: string;
  isDraft?: boolean;
  isPrerelease?: boolean;
  targetCommitish?: string;
}

/**
 * Generate a release on GitHub
 * 
 * @param token - GitHub OAuth token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param options - Release options
 * @returns Release URL
 */
export async function createGitHubRelease(
  token: string,
  owner: string,
  repo: string,
  options: ReleaseOptions
): Promise<{ url: string; id: number }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      tag_name: options.version,
      name: options.title,
      body: options.body,
      draft: options.isDraft || false,
      prerelease: options.isPrerelease || false,
      target_commitish: options.targetCommitish || 'main',
    }),
  });

  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>;
    throw new Error(`Error al crear release: ${(err?.message as string) || res.statusText}`);
  }

  const data = await res.json() as { html_url: string; id: number };
  return { url: data.html_url, id: data.id };
}

/**
 * Generate release notes from document content
 * 
 * @param documentContent - Content from uploaded document
 * @param repoName - Repository name for context
 * @returns Formatted release notes
 */
export function generateReleaseNotesFromDocument(
  documentContent: string,
  repoName: string
): string {
  let releaseNotes = `# Release Notes - ${repoName}\n\n`;
  releaseNotes += `## 📋 Documentación Adjunta\n\n`;
  releaseNotes += `### Contenido del Documento\n\n`;
  
  // Add first 500 chars of document as summary
  const summary = documentContent.substring(0, 500);
  releaseNotes += summary;
  
  if (documentContent.length > 500) {
    releaseNotes += `\n\n*[Documento completo disponible en los assets del release]*\n`;
  }
  
  return releaseNotes;
}

/**
 * Suggest a version number based on current releases
 * 
 * @param token - GitHub OAuth token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Suggested version (e.g., "v1.2.0")
 */
export async function suggestNextVersion(
  token: string,
  owner: string,
  repo: string
): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      const data = await res.json() as { tag_name: string };
      const currentVersion = data.tag_name.replace(/^v/, '');
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      
      // Suggest patch version bump
      return `v${major}.${minor}.${patch + 1}`;
    }
  } catch {
    // Ignore errors, return default
  }

  return 'v1.0.0';
}
