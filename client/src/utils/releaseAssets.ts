/**
 * Release Assets Manager — Handle binary file uploads to GitHub releases
 * 
 * Manages uploading .pbix, .exe, .zip and other binary files to release assets
 */

export interface ReleaseAsset {
  name: string;
  file: File;
  contentType: string;
}

/**
 * Determine MIME type for file based on extension
 * 
 * @param fileName - File name
 * @returns MIME type string
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    'pbix': 'application/octet-stream',
    'zip': 'application/zip',
    'exe': 'application/octet-stream',
    'msi': 'application/octet-stream',
    'pdf': 'application/pdf',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'json': 'application/json',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'csv': 'text/csv',
    'sql': 'text/plain',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Upload a file as a release asset to GitHub
 * 
 * @param token - GitHub OAuth token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param releaseId - Release ID (from create release response)
 * @param asset - Asset file to upload
 * @returns Asset URL
 */
export async function uploadReleaseAsset(
  token: string,
  owner: string,
  repo: string,
  releaseId: number,
  asset: ReleaseAsset
): Promise<{ url: string; name: string }> {
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': asset.contentType,
      'Content-Length': asset.file.size.toString(),
    },
    body: asset.file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Error al subir asset: ${(err?.message as string) || res.statusText}`);
  }

  const data = await res.json() as { browser_download_url: string; name: string };
  return { url: data.browser_download_url, name: data.name };
}

/**
 * Upload multiple assets to a release
 * 
 * @param token - GitHub OAuth token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param releaseId - Release ID
 * @param assets - Array of assets to upload
 * @param onProgress - Callback for progress updates
 * @returns Array of uploaded asset URLs
 */
export async function uploadReleaseAssets(
  token: string,
  owner: string,
  repo: string,
  releaseId: number,
  assets: ReleaseAsset[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Array<{ url: string; name: string }>> {
  const results: Array<{ url: string; name: string }> = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress?.(i + 1, assets.length, asset.name);

    try {
      const result = await uploadReleaseAsset(token, owner, repo, releaseId, asset);
      results.push(result);
    } catch (err) {
      console.error(`Error uploading ${asset.name}:`, err);
      throw err;
    }
  }

  return results;
}

/**
 * Generate markdown for release notes with asset links
 * 
 * @param baseNotes - Original release notes
 * @param assets - Uploaded assets
 * @returns Enhanced release notes with asset section
 */
export function addAssetsToReleaseNotes(
  baseNotes: string,
  assets: Array<{ url: string; name: string }>
): string {
  if (assets.length === 0) return baseNotes;

  let notes = baseNotes;
  notes += '\n\n## 📦 Descargas\n\n';

  assets.forEach(asset => {
    notes += `- [${asset.name}](${asset.url})\n`;
  });

  return notes;
}

/**
 * Validate file for upload as release asset
 * 
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB (default: 100)
 * @returns Validation result
 */
export function validateAssetFile(
  file: File,
  maxSizeMB: number = 100
): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Archivo demasiado grande. Máximo ${maxSizeMB}MB, tu archivo tiene ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
    };
  }

  // Check for suspicious file types
  const blockedExtensions = ['exe', 'msi', 'bat', 'cmd', 'sh', 'scr'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (blockedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: .${ext}`,
    };
  }

  return { valid: true };
}
