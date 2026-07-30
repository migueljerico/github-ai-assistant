import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getMimeType,
  validateAssetFile,
  addAssetsToReleaseNotes,
  uploadReleaseAsset,
  uploadReleaseAssets,
  type ReleaseAsset,
} from '../releaseAssets';

// Helper: construye un File real (jsdom lo provee) con el contenido y nombre dados.
const makeFile = (name: string, content = 'x', size?: number): File => {
  const file = new File([content], name);
  // Si se fuerza un size distinto (p. ej. para probar el límite), lo sobrescribimos.
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('releaseAssets — getMimeType', () => {
  it('resuelve el MIME por extensión conocida', () => {
    expect(getMimeType('report.pbix')).toBe('application/octet-stream');
    expect(getMimeType('archive.zip')).toBe('application/zip');
    expect(getMimeType('setup.exe')).toBe('application/octet-stream');
    expect(getMimeType('installer.msi')).toBe('application/octet-stream');
    expect(getMimeType('doc.pdf')).toBe('application/pdf');
    expect(getMimeType('sheet.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(getMimeType('text.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(getMimeType('data.json')).toBe('application/json');
    expect(getMimeType('notes.txt')).toBe('text/plain');
    expect(getMimeType('README.md')).toBe('text/markdown');
    expect(getMimeType('data.csv')).toBe('text/csv');
    expect(getMimeType('query.sql')).toBe('text/plain');
  });

  it('cae a application/octet-stream para extensiones desconocidas o sin extensión', () => {
    expect(getMimeType('movie.mkv')).toBe('application/octet-stream');
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
    expect(getMimeType('sinextension')).toBe('application/octet-stream');
  });

  it('no distingue mayúsculas/minúsculas en la extensión', () => {
    expect(getMimeType('DOC.PDF')).toBe('application/pdf');
    expect(getMimeType('Sheet.XLSX')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});

describe('releaseAssets — validateAssetFile', () => {
  it('valida un archivo dentro del tamaño permitido', () => {
    const file = makeFile('report.pdf', 'contenido', 1024);
    expect(validateAssetFile(file)).toEqual({ valid: true });
  });

  it('rechaza archivos que exceden el tamaño máximo (MB)', () => {
    const file = makeFile('big.pbix', 'x', 150 * 1024 * 1024); // 150MB > 100MB default
    const result = validateAssetFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Archivo demasiado grande');
    expect(result.error).toContain('150.00MB');
  });

  it('respeta un maxSizeMB personalizado', () => {
    const file = makeFile('big.pbix', 'x', 5 * 1024 * 1024); // 5MB
    expect(validateAssetFile(file, 2).valid).toBe(false); // 5MB > 2MB
    expect(validateAssetFile(file, 10)).toEqual({ valid: true }); // 5MB < 10MB
  });

  it('rechaza extensiones de archivo peligrosas', () => {
    for (const ext of ['exe', 'msi', 'bat', 'cmd', 'sh', 'scr']) {
      const result = validateAssetFile(makeFile(`file.${ext}`));
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`.${ext}`);
    }
  });

  it('acepta extensiones permitidas (zip, pdf, xlsx, pbix...)', () => {
    expect(validateAssetFile(makeFile('a.zip'))).toEqual({ valid: true });
    expect(validateAssetFile(makeFile('a.pdf'))).toEqual({ valid: true });
    expect(validateAssetFile(makeFile('a.xlsx'))).toEqual({ valid: true });
  });
});

describe('releaseAssets — addAssetsToReleaseNotes', () => {
  it('devuelve las notas base sin cambios si no hay assets', () => {
    expect(addAssetsToReleaseNotes('notas base', [])).toBe('notas base');
  });

  it('añade una sección de descargas con un enlace por asset', () => {
    const out = addAssetsToReleaseNotes('notas', [
      { url: 'https://x/a.zip', name: 'a.zip' },
      { url: 'https://x/b.pdf', name: 'b.pdf' },
    ]);
    expect(out).toContain('## 📦 Descargas');
    expect(out).toContain('[a.zip](https://x/a.zip)');
    expect(out).toContain('[b.pdf](https://x/b.pdf)');
  });
});

describe('releaseAssets — uploadReleaseAsset', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sube el asset y devuelve {url, name} cuando la respuesta es ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ browser_download_url: 'https://x/a.zip', name: 'a.zip' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const asset: ReleaseAsset = { name: 'a.zip', file: makeFile('a.zip', 'data'), contentType: 'application/zip' };
    const result = await uploadReleaseAsset('tok', 'owner', 'repo', 42, asset);

    expect(result).toEqual({ url: 'https://x/a.zip', name: 'a.zip' });
    // Verifica URL, método y cabeceras de la petición.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://uploads.github.com/repos/owner/repo/releases/42/assets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'token tok',
          'Content-Type': 'application/zip',
        }),
        body: asset.file,
      }),
    );
  });

  it('lanza con el mensaje del backend cuando la respuesta NO es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ message: 'asset too large' }),
    }));

    const asset: ReleaseAsset = { name: 'a.zip', file: makeFile('a.zip'), contentType: 'application/zip' };
    await expect(uploadReleaseAsset('tok', 'owner', 'repo', 42, asset)).rejects.toThrow('asset too large');
  });

  it('cae al statusText si el cuerpo de error no tiene message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      json: async () => { throw new Error('no json'); }, // res.json() falla → {}
    }));

    const asset: ReleaseAsset = { name: 'a.zip', file: makeFile('a.zip'), contentType: 'application/zip' };
    await expect(uploadReleaseAsset('tok', 'owner', 'repo', 42, asset)).rejects.toThrow('Forbidden');
  });
});

describe('releaseAssets — uploadReleaseAssets', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sube varios assets y notifica el progreso por callback', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({ browser_download_url: `https://x/f${calls}`, name: `f${calls}` }),
      };
    }));

    const onProgress = vi.fn();
    const assets: ReleaseAsset[] = [
      { name: 'f1', file: makeFile('f1.zip'), contentType: 'application/zip' },
      { name: 'f2', file: makeFile('f2.pdf'), contentType: 'application/pdf' },
    ];
    const results = await uploadReleaseAssets('tok', 'owner', 'repo', 7, assets, onProgress);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ url: 'https://x/f1', name: 'f1' });
    // El callback de progreso se invoca una vez por asset con (current, total, name).
    expect(onProgress).toHaveBeenCalledWith(1, 2, 'f1');
    expect(onProgress).toHaveBeenCalledWith(2, 2, 'f2');
  });

  it('propaga el error del primer asset que falla y detiene la subida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'boom' }),
    }));

    const assets: ReleaseAsset[] = [
      { name: 'f1', file: makeFile('f1.zip'), contentType: 'application/zip' },
      { name: 'f2', file: makeFile('f2.zip'), contentType: 'application/zip' },
    ];
    await expect(uploadReleaseAssets('tok', 'owner', 'repo', 7, assets)).rejects.toThrow('boom');
  });
});
