import { describe, it, expect, vi, beforeEach } from 'vitest';

// #26 (v4.0.52): cubre ramas de github.ts no alcanzadas por los tests de
// servicios que lo mockean (docPublisher/threadSummary/assistantActions…):
//   · compareCommits con respuesta sin commits  → `data.commits ?? []` (L125)
//   · fetchRepoTreeRecursive con getRepo sin default_branch → `|| 'main'` (L497)
//   · árbol con blob SIN `size` → `item.size ?? 0` (L528 / L542)
//   · blob cuyo contents API devuelve `content: ''` → rama falsa del ternario (L541)
//   · TODOS los wrappers REST (getUser, createRepo, issues, PRs, git data…),
//     que son envoltorios finos de ghFetch que ningún módulo ejercita de verdad.
// El arnés es un fetch global con routing por URL (patrón providers.test.ts).

import {
  compareCommits,
  fetchRepoTreeRecursive,
  encodeBase64,
  ghFetch,
  GitHubAPIError,
  getUser,
  listUserRepos,
  getLatestReleaseTag,
  listRecentCommits,
  listCommitDates,
  getCommit,
  createRepo,
  updateRepo,
  repoExists,
  encodeBase64Bytes,
  createOrUpdateBinaryFile,
  createOrUpdateFile,
  deleteFile,
  listIssues,
  createIssue,
  updateIssueState,
  commentOnIssue,
  getIssueOrPr,
  getIssueComments,
  getPullReviewComments,
  listPullRequests,
  createPullRequest,
  mergePullRequest,
  listBranches,
  getBranchSha,
  createBranch,
  deleteBranch,
  createBlob,
  createTree,
  createCommit,
  updateRef,
  listWorkflows,
  listWorkflowRuns,
  triggerWorkflowRun,
  listAllRepos,
} from '../github';

const TOKEN = 'ghp_test';

describe('compareCommits — respuesta sin commits (#26, v4.0.52)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('{} del compare API → lista vacía (rama nullish del ??)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await compareCommits(TOKEN, 'o', 'r', 'main', 'feat');
    expect(out).toEqual([]);
  });
});

describe('ghFetch — error con GitHubAPIError (#26, v4.0.52)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('respuesta 4xx (404) lanza GitHubAPIError con mensaje del body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ghFetch(TOKEN, '/repos/o/r')).rejects.toMatchObject({
      name: 'GitHubAPIError',
      status: 404,
      message: 'Not Found',
    });
  });
});

describe('fetchRepoTreeRecursive — ramas restantes (#26, v4.0.52)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('árbol con blob sin size, fichero vacío y binario; getRepo sin default_branch → rama "main" + sides nulos', async () => {
    const routes: Array<{ match: RegExp; payload: unknown }> = [
      { match: /^https:\/\/api\.github\.com\/repos\/o\/r$/, payload: {} }, // sin default_branch
      {
        match: /\/git\/trees\/main\?/,
        payload: {
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', size: 40, sha: 's1' },
            { path: 'src/app.ts', type: 'blob', sha: 's2' }, // sin `size` → ?? 0
            { path: 'docs/captura.png', type: 'blob', size: 10, sha: 's3' }, // binario
            { path: 'vacio.txt', type: 'blob', size: 0, sha: 's4' },
          ],
        },
      },
      { match: /\/contents\/README\.md$/, payload: { content: encodeBase64('# README') } },
      { match: /\/contents\/src\/app\.ts$/, payload: { content: encodeBase64('export {}') } },
      { match: /\/contents\/vacio\.txt$/, payload: { content: '' } }, // ternario lado '' (L541)
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const hit = routes.find(r => r.match.test(url));
      if (!hit) return { ok: false, status: 404, json: async () => ({ message: 'No route: ' + url }) };
      return { ok: true, json: async () => hit.payload };
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r');

    // 3 blobs de texto elegibles (binario fuera), ordenados por prioridad:
    // README (0) < src/ (2) < vacio.txt (resto). El fichero sin `size` entra con size 0.
    expect(out.totalScanned).toBe(3);
    expect(out.allPaths).toEqual(['README.md', 'src/app.ts', 'vacio.txt']);
    expect(out.binaryPaths).toEqual(['docs/captura.png']);
    expect(out.truncated).toBe(false);

    // Contenido y size en el resultado: vacio.txt con content '' (ternario falso)
    const vacio = out.files.find(f => f.path === 'vacio.txt');
    expect(vacio).toBeDefined();
    expect(vacio!.content).toBe('');
    // src/app.ts sin size en el árbol → size 0 (rama nullish del ??)
    expect(out.files.find(f => f.path === 'src/app.ts')!.content).toBe('export {}');
    expect(out.files.find(f => f.path === 'src/app.ts')!.size).toBe(0);
    // README con contenido decodificado
    expect(out.files.find(f => f.path === 'README.md')!.content).toBe('# README');
    // El getRepo por defecto (sin branch) fue consultado una vez
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/repos/o/r'))).toBe(true);
  });

  it('con defaultBranch explícito: no consulta getRepo y lee el árbol de esa rama', async () => {
    const routes: Array<{ match: RegExp; payload: unknown }> = [
      {
        match: /\/git\/trees\/dev\?/,
        payload: { truncated: false, tree: [{ path: 'doc.md', type: 'blob', size: 12, sha: 's1' }] },
      },
      { match: /\/contents\/doc\.md$/, payload: { content: encodeBase64('hola') } },
    ];
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const hit = routes.find(r => r.match.test(url));
      return { ok: true, json: async () => (hit ? hit.payload : {}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r', 'dev');
    expect(out.allPaths).toEqual(['doc.md']);
    // nunca consultó /repos/o/r (el meta) porque la rama llegó explícita
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/repos/o/r'))).toBe(false);
  });

  it('sin defaultBranch: el meta inicial decide la rama (aunque trees/main esté 404, nunca se consulta)', async () => {
    const routes: Array<{ match: RegExp; payload: unknown; status?: number }> = [
      { match: /\/git\/trees\/main\?/, payload: { message: 'Not Found' }, status: 404 },
      { match: /^https:\/\/api\.github\.com\/repos\/o\/r$/, payload: { default_branch: 'trunk' } },
      {
        match: /\/git\/trees\/trunk\?/,
        payload: { truncated: true, tree: [{ path: 'a.md', type: 'blob', size: 4, sha: 's1' }] },
      },
      { match: /\/contents\/a\.md$/, payload: { content: encodeBase64('hola') } },
    ];
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const hit = routes.find(r => r.match.test(url));
      return { ok: (hit?.status ?? 200) !== 404, status: hit?.status ?? 200, json: async () => hit!.payload };
    });
    vi.stubGlobal('fetch', fetchMock);

    // SIN defaultBranch: la 1ª llamada es getRepo → default_branch 'trunk'; el
    // árbol consultado es trees/trunk (éxito a la primera). La ruta trees/main 404
    // queda sin usar: con meta inicial correcto el catch de L510 no se alcanza.
    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r');
    expect(out.truncated).toBe(true); // treeRes.truncated propagado
    expect(out.allPaths).toEqual(['a.md']);
  });
});

// ── Wrappers REST de github.ts (v4.0.52 #26) ─────────────────────────────────
// El resto de funciones son envoltorios finos de ghFetch que los módulos
// consumidores SIEMPRE mockean, así que ningún test las ejercitaba de verdad.
// Arnés: fetch global con routing por URL + captura de método/body. Los fallos
// 4xx (404/400/422 y el 429 con GitHubAPIError) NO se reintentan, así que cada
// llamada implica exactamente 1 fetch y los tests no tienen esperas.
interface FetchCall { url: string; method: string; body?: unknown }
interface Route { match: RegExp; payload?: unknown; status?: number; headers?: Record<string, string> }

function routeFetch(routes: Route[]) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push({
      url: href,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const hit = routes.find(r => r.match.test(href));
    if (!hit) return { ok: false, status: 404, json: async () => ({ message: `No route: ${href}` }) };
    const status = hit.status ?? 200;
    const res: Record<string, unknown> = { ok: status < 400, status, json: async () => hit.payload };
    if (hit.headers) res.headers = { get: (h: string) => hit.headers?.[h] };
    return res;
  });
  return { fetchMock, calls };
}

/** Aserción compacta: hubo una llamada con método+URL (y opcionalmente body).
 *  `from` permite buscar la n-ésima llamada cuando la URL se repite. Devuelve
 *  el índice encontrado para encadenar la siguiente búsqueda. */
function expectCall(calls: FetchCall[], method: string, urlRe: RegExp, body?: unknown, from = 0): number {
  const idx = calls.findIndex((c, i) => i >= from && c.method === method && urlRe.test(c.url));
  expect(idx, `llamada esperada: ${method} ${urlRe.source}`).toBeGreaterThanOrEqual(0);
  if (body !== undefined) expect(calls[idx].body).toEqual(body);
  return idx;
}

describe('wrappers REST de github.ts (v4.0.52 #26)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getUser y listUserRepos: GET /user y /user/repos?per_page=100', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/user\/repos\?per_page=100$/, payload: [{ name: 'r', owner: { login: 'u' } }] },
      { match: /\/user$/, payload: { login: 'u' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await getUser(TOKEN)).toEqual({ login: 'u' });
    expect(await listUserRepos(TOKEN)).toHaveLength(1);
    expectCall(calls, 'GET', /\/user$/);
    expectCall(calls, 'GET', /\/user\/repos\?per_page=100$/);
  });

  it('getLatestReleaseTag: tag_name, sin tag_name → null, 404 → null y 400 → propaga', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/a\/b\/releases\/latest$/, payload: { tag_name: 'v1.2.3' } },
      { match: /\/repos\/c\/d\/releases\/latest$/, payload: {} }, // sin tag_name → ?? null
      { match: /\/repos\/e\/f\/releases\/latest$/, payload: { message: 'Not Found' }, status: 404 },
      { match: /\/repos\/g\/h\/releases\/latest$/, payload: { message: 'Bad Request' }, status: 400 },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await getLatestReleaseTag(TOKEN, 'a', 'b')).toBe('v1.2.3');
    expect(await getLatestReleaseTag(TOKEN, 'c', 'd')).toBeNull();
    expect(await getLatestReleaseTag(TOKEN, 'e', 'f')).toBeNull(); // sin releases aún
    await expect(getLatestReleaseTag(TOKEN, 'g', 'h')).rejects.toMatchObject({ name: 'GitHubAPIError', status: 400 });
    expect(calls).toHaveLength(4);
  });

  it('listRecentCommits/listCommitDates: per_page default y explícito; fechas con fallback a committer y filtrado', async () => {
    const commits = [
      { sha: 's1', commit: { message: 'm1', author: { date: '2024-01-01' } } },
      { sha: 's2', commit: { message: 'm2', committer: { date: '2024-01-02' } } },
      { sha: 's3', commit: { message: 'm3' } }, // sin fechas → filtrado
    ];
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/o\/r\/commits\?/, payload: commits },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await listRecentCommits(TOKEN, 'o', 'r')).toEqual([
      { sha: 's1', message: 'm1' }, { sha: 's2', message: 'm2' }, { sha: 's3', message: 'm3' },
    ]);
    await listRecentCommits(TOKEN, 'o', 'r', 7);
    expect(await listCommitDates(TOKEN, 'o', 'r')).toEqual(['2024-01-01', '2024-01-02']);
    await listCommitDates(TOKEN, 'o', 'r', 10);

    expectCall(calls, 'GET', /commits\?per_page=50$/);
    expectCall(calls, 'GET', /commits\?per_page=7$/);
    expectCall(calls, 'GET', /commits\?per_page=100$/);
    expectCall(calls, 'GET', /commits\?per_page=10$/);
  });

  it('getCommit: mapea el detalle y usa [] cuando `files` falta (?? [])', async () => {
    const detail = {
      sha: 'abc',
      commit: { message: 'feat: x', author: { name: 'n', email: 'e', date: 'd' } },
      files: [{ filename: 'f.ts', status: 'modified', additions: 1, deletions: 0, changes: 1 }],
    };
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/a\/b\/commits\/s1$/, payload: detail },
      { match: /\/repos\/c\/d\/commits\/s2$/, payload: { sha: 'x', commit: detail.commit } }, // sin files
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCommit(TOKEN, 'a', 'b', 's1')).toEqual({
      sha: 'abc',
      message: 'feat: x',
      author: { name: 'n', email: 'e', date: 'd' },
      files: detail.files,
    });
    expect((await getCommit(TOKEN, 'c', 'd', 's2')).files).toEqual([]);
    expectCall(calls, 'GET', /commits\/s1$/);
  });

  it('createRepo/updateRepo: POST con defaults (auto_init) y PATCH de metadatos', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/user\/repos$/, payload: { name: 'n' } },
      { match: /\/repos\/o\/r$/, payload: { name: 'r' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await createRepo(TOKEN, 'n');
    await createRepo(TOKEN, 'n2', 'desc', true);
    await updateRepo(TOKEN, 'o', 'r', { description: 'nueva' });

    const firstRepoPost = expectCall(calls, 'POST', /\/user\/repos$/, { name: 'n', description: '', private: false, auto_init: true });
    expectCall(calls, 'POST', /\/user\/repos$/, { name: 'n2', description: 'desc', private: true, auto_init: true }, firstRepoPost + 1);
    expectCall(calls, 'PATCH', /\/repos\/o\/r$/, { description: 'nueva' });
  });

  it('repoExists: true (200), false (404) y propaga otros errores (400)', async () => {
    const { fetchMock } = routeFetch([
      { match: /\/repos\/si\/existe$/, payload: { name: 'existe' } },
      { match: /\/repos\/no\/existe$/, payload: { message: 'Not Found' }, status: 404 },
      { match: /\/repos\/boom\/existe$/, payload: { message: 'Bad Request' }, status: 400 },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await repoExists(TOKEN, 'si', 'existe')).toBe(true);
    expect(await repoExists(TOKEN, 'no', 'existe')).toBe(false);
    await expect(repoExists(TOKEN, 'boom', 'existe')).rejects.toMatchObject({ name: 'GitHubAPIError', status: 400 });
  });

  it('encodeBase64Bytes: chunking por 32 KB (dos pasadas) y roundtrip de texto', () => {
    expect(encodeBase64Bytes(new Uint8Array([104, 111, 108, 97]))).toBe(btoa('hola'));
    const big = new Uint8Array(0x8001); // 32769 bytes → 2 iteraciones del chunk
    big[0] = 65;
    big[0x8000] = 90;
    const decoded = atob(encodeBase64Bytes(big));
    expect(decoded.length).toBe(0x8001);
    expect(decoded.charCodeAt(0)).toBe(65);
    expect(decoded.charCodeAt(0x8000)).toBe(90);
  });

  it('createOrUpdateBinaryFile/createOrUpdateFile/deleteFile: PUT y DELETE en /contents con sha/branch opcionales', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { fetchMock, calls } = routeFetch([
      { match: /\/contents\//, payload: { commit: { sha: 'c1' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await createOrUpdateBinaryFile(TOKEN, 'o', 'r', 'img.png', bytes, 'subo binario', 'sha0', 'feat');
    expectCall(calls, 'PUT', /\/contents\/img\.png$/, {
      message: 'subo binario', content: encodeBase64Bytes(bytes), sha: 'sha0', branch: 'feat',
    });
    await createOrUpdateBinaryFile(TOKEN, 'o', 'r', 'img2.png', bytes, 'binario nuevo'); // sin sha ni branch
    expectCall(calls, 'PUT', /\/contents\/img2\.png$/, { message: 'binario nuevo', content: encodeBase64Bytes(bytes) });

    await createOrUpdateFile(TOKEN, 'o', 'r', 'docs/a.md', 'texto', 'msg'); // sin sha ni branch
    expectCall(calls, 'PUT', /\/contents\/docs\/a\.md$/, { message: 'msg', content: encodeBase64('texto') });
    await createOrUpdateFile(TOKEN, 'o', 'r', 'docs/b.md', 'texto2', 'msg2', 'sha1', 'dev'); // actualización en rama
    expectCall(calls, 'PUT', /\/contents\/docs\/b\.md$/, { message: 'msg2', content: encodeBase64('texto2'), sha: 'sha1', branch: 'dev' });

    await deleteFile(TOKEN, 'o', 'r', 'docs/a.md', 'sha0', 'borro');
    expectCall(calls, 'DELETE', /\/contents\/docs\/a\.md$/, { message: 'borro', sha: 'sha0' });
  });

  it('fetchRepoTreeRecursive: priorityScore ordena por prioridad y el cap de 120 activa truncated', async () => {
    const tree = [
      { path: 'otro.txt', type: 'blob', size: 10, sha: 's1' },
      { path: 'script.py', type: 'blob', size: 10, sha: 's2' },
      { path: 'tsconfig.json', type: 'blob', size: 10, sha: 's3' },
      { path: 'MEJORAS_FUTURAS.md', type: 'blob', size: 10, sha: 's4' },
      { path: 'package.json', type: 'blob', size: 10, sha: 's5' },
      { path: 'README.md', type: 'blob', size: 10, sha: 's6' },
      { path: 'src/app.ts', type: 'blob', size: 10, sha: 's7' },
      { path: 'carpeta', type: 'tree', sha: 's8' }, // no blob → fuera
      { path: 'logo.png', type: 'blob', size: 10, sha: 's9' }, // binario → fuera del texto
    ];
    const many = Array.from({ length: 121 }, (_, i) => ({ path: `m/f${i}.md`, type: 'blob', size: 4, sha: `x${i}` }));

    const { fetchMock, calls } = routeFetch([
      { match: /\/git\/trees\/main\?/, payload: { truncated: false, tree: [...many, ...tree] } },
      { match: /\/contents\//, payload: { content: encodeBase64('x') } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r', 'main');

    // 121 (m/*) + 7 textos = 128 blobs elegibles → cap 120 → truncated
    expect(out.totalScanned).toBe(128);
    expect(out.files).toHaveLength(120);
    expect(out.truncated).toBe(true);
    // El sort es estable: en el score-1, MEJORAS_FUTURAS.md precede a package.json
    // porque así venían en el árbol original. Orden: README(0) < docs raíz(1) y
    // package.json(1) < src/(2) < tsconfig.json(3) < script.py(4) < resto(5).
    expect(out.allPaths.slice(0, 6)).toEqual([
      'README.md', 'MEJORAS_FUTURAS.md', 'package.json', 'src/app.ts', 'tsconfig.json', 'script.py',
    ]);
    expect(out.allPaths[out.allPaths.length - 1]).toBe('otro.txt');
    expect(out.binaryPaths).toEqual(['logo.png']);
    expect(calls.filter(c => /\/contents\//.test(c.url))).toHaveLength(120);
  });

  it('fetchRepoTreeRecursive: getRepo 404 o sin default_branch → rama "main" (catch + || de L497)', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/a\/b$/, payload: { message: 'Not Found' }, status: 404 },
      { match: /\/repos\/c\/d$/, payload: { default_branch: '' } },
      { match: /\/git\/trees\/main\?/, payload: { truncated: false, tree: [{ path: 'x.md', type: 'blob', size: 2, sha: 's' }] } },
      { match: /\/contents\/x\.md$/, payload: { content: encodeBase64('y') } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const out1 = await fetchRepoTreeRecursive(TOKEN, 'a', 'b'); // getRepo 404 → catch → 'main'
    expect(out1.allPaths).toEqual(['x.md']);
    const out2 = await fetchRepoTreeRecursive(TOKEN, 'c', 'd'); // default_branch '' → || 'main'
    expect(out2.allPaths).toEqual(['x.md']);
    expect(calls.filter(c => /\/git\/trees\/main\?/.test(c.url))).toHaveLength(2);
  });

  it('fetchRepoTreeRecursive: árbol 404 y meta con la MISMA rama → propaga el 404 (else de L517)', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/o\/r$/, payload: { default_branch: 'main' } },
      { match: /\/git\/trees\/main\?/, payload: { message: 'Not Found' }, status: 404 },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRepoTreeRecursive(TOKEN, 'o', 'r')).rejects.toMatchObject({ name: 'GitHubAPIError', status: 404 });
    // getRepo consultado 2 veces (inicial + re-check del catch) y el árbol 1 vez
    expect(calls.filter(c => /\/repos\/o\/r$/.test(c.url))).toHaveLength(2);
  });

  it('fetchRepoTreeRecursive: error no-404 del árbol (400) con branch explícita → propaga (else de L520)', async () => {
    const { fetchMock } = routeFetch([
      { match: /\/git\/trees\/dev\?/, payload: { message: 'Bad Request' }, status: 400 },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRepoTreeRecursive(TOKEN, 'o', 'r', 'dev')).rejects.toMatchObject({ name: 'GitHubAPIError', status: 400 });
  });

  it('fetchRepoTreeRecursive: contents que falla se descarta vía allSettled y el resto entra', async () => {
    const { fetchMock, calls } = routeFetch([
      {
        match: /\/git\/trees\/main\?/,
        payload: {
          truncated: false,
          tree: [
            { path: 'a.md', type: 'blob', size: 4, sha: 's1' },
            { path: 'b.md', type: 'blob', size: 4, sha: 's2' },
          ],
        },
      },
      { match: /\/contents\/a\.md$/, payload: { message: 'Not Found' }, status: 404 },
      { match: /\/contents\/b\.md$/, payload: { content: encodeBase64('hola') } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r', 'main');

    expect(out.files).toEqual([{ path: 'b.md', content: 'hola', size: 4 }]);
    expect(out.allPaths).toEqual(['a.md', 'b.md']); // el árbol completo sí incluye a.md
    expect(calls.filter(c => /\/contents\//.test(c.url))).toHaveLength(2);
  });

  it('issues: listIssues (state default y explícito), createIssue (defaults), updateIssueState y commentOnIssue', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/issues\?state=/, payload: [{ number: 1 }] },
      { match: /\/repos\/o\/r\/issues$/, payload: { number: 2 } },
      { match: /\/issues\/7$/, payload: { number: 7 } },
      { match: /\/issues\/7\/comments$/, payload: { id: 9, body: 'hola', created_at: 't' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await listIssues(TOKEN, 'o', 'r');
    await listIssues(TOKEN, 'o', 'r', 'closed');
    await createIssue(TOKEN, 'o', 'r', 'Título');
    await createIssue(TOKEN, 'o', 'r', 'T2', 'cuerpo', ['bug'], ['yo']);
    await updateIssueState(TOKEN, 'o', 'r', 7, 'closed');
    expect(await commentOnIssue(TOKEN, 'o', 'r', 7, 'hola')).toEqual({ id: 9, body: 'hola', created_at: 't' });

    expectCall(calls, 'GET', /issues\?state=open&per_page=100$/);
    expectCall(calls, 'GET', /issues\?state=closed&per_page=100$/);
    const firstIssuePost = expectCall(calls, 'POST', /\/repos\/o\/r\/issues$/, { title: 'Título', body: '', labels: [], assignees: [] });
    expectCall(calls, 'POST', /\/repos\/o\/r\/issues$/, { title: 'T2', body: 'cuerpo', labels: ['bug'], assignees: ['yo'] }, firstIssuePost + 1);
    expectCall(calls, 'PATCH', /\/issues\/7$/, { state: 'closed' });
    expectCall(calls, 'POST', /\/issues\/7\/comments$/, { body: 'hola' });
  });

  it('getIssueOrPr + getIssueComments: paginado 100+1', async () => {
    const mk = (i: number) => ({ id: i, body: `b${i}`, user: { login: 'u' }, created_at: '2024-01-01T00:00:00Z' });
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/o\/r\/issues\/5$/, payload: { number: 5, title: 't', body: null, state: 'open', html_url: 'u', user: null, pull_request: {} } },
      { match: /\/issues\/5\/comments\?per_page=100&page=1$/, payload: Array.from({ length: 100 }, (_, i) => mk(i)) },
      { match: /\/issues\/5\/comments\?per_page=100&page=2$/, payload: [mk(100)] },
      { match: /\/issues\/5\/comments/, payload: [] },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const issue = await getIssueOrPr(TOKEN, 'o', 'r', 5);
    expect(issue.pull_request).toBeDefined(); // es un PR disfrazado de issue
    const comments = await getIssueComments(TOKEN, 'o', 'r', 5);
    expect(comments).toHaveLength(101);
    expect(comments[0]).toEqual(mk(0));
    expect(comments[100]).toEqual(mk(100));
    expectCall(calls, 'GET', /issues\/5\/comments\?per_page=100&page=1$/);
    expectCall(calls, 'GET', /issues\/5\/comments\?per_page=100&page=2$/);
  });

  it('getPullReviewComments: paginado 100+1 sobre /pulls/{n}/comments', async () => {
    const mk = (i: number) => ({ id: i, body: `b${i}`, user: null, created_at: 't', path: 'a.ts', line: 3 });
    const { fetchMock, calls } = routeFetch([
      { match: /\/pulls\/9\/comments\?per_page=100&page=1$/, payload: Array.from({ length: 100 }, (_, i) => mk(i)) },
      { match: /\/pulls\/9\/comments\?per_page=100&page=2$/, payload: [mk(100)] },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const out = await getPullReviewComments(TOKEN, 'o', 'r', 9);
    expect(out).toHaveLength(101);
    expectCall(calls, 'GET', /pulls\/9\/comments\?per_page=100&page=1$/);
    expectCall(calls, 'GET', /pulls\/9\/comments\?per_page=100&page=2$/);
  });

  it('PRs: listPullRequests (default y explícito), createPullRequest (defaults) y mergePullRequest (método default y explícito)', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/pulls\?state=/, payload: [{ number: 1 }] },
      { match: /\/repos\/o\/r\/pulls$/, payload: { number: 2 } },
      { match: /\/pulls\/3\/merge$/, payload: { sha: 'm', merged: true, message: 'ok' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await listPullRequests(TOKEN, 'o', 'r');
    await listPullRequests(TOKEN, 'o', 'r', 'all');
    await createPullRequest(TOKEN, 'o', 'r', 'T', 'feat', 'main');
    await createPullRequest(TOKEN, 'o', 'r', 'T2', 'feat', 'main', 'cuerpo', true);
    await mergePullRequest(TOKEN, 'o', 'r', 3);
    expect(await mergePullRequest(TOKEN, 'o', 'r', 3, 'squash', 'Título', 'Mensaje')).toEqual({ sha: 'm', merged: true, message: 'ok' });

    expectCall(calls, 'GET', /pulls\?state=open&per_page=100$/);
    expectCall(calls, 'GET', /pulls\?state=all&per_page=100$/);
    const firstPrPost = expectCall(calls, 'POST', /\/repos\/o\/r\/pulls$/, { title: 'T', head: 'feat', base: 'main', body: '', draft: false });
    expectCall(calls, 'POST', /\/repos\/o\/r\/pulls$/, { title: 'T2', head: 'feat', base: 'main', body: 'cuerpo', draft: true }, firstPrPost + 1);
    const firstMerge = expectCall(calls, 'PUT', /pulls\/3\/merge$/, { merge_method: 'merge' }); // undefineds se descartan en JSON
    expectCall(calls, 'PUT', /pulls\/3\/merge$/, { merge_method: 'squash', commit_title: 'Título', commit_message: 'Mensaje' }, firstMerge + 1);
  });

  it('branches: listBranches, getBranchSha, createBranch y deleteBranch (sin headers extra → `|| {}` de ghFetch)', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/branches\?per_page=100$/, payload: [{ name: 'main' }] },
      { match: /\/git\/ref\/heads\/main$/, payload: { object: { sha: 'SHA1' } } },
      { match: /\/git\/refs$/, payload: { ref: 'refs/heads/feat' } },
      { match: /\/git\/refs\/heads\//, payload: {} },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await listBranches(TOKEN, 'o', 'r')).toEqual([{ name: 'main' }]);
    expect(await getBranchSha(TOKEN, 'o', 'r', 'main')).toBe('SHA1');
    await createBranch(TOKEN, 'o', 'r', 'feat', 'SHA1');
    await deleteBranch(TOKEN, 'o', 'r', 'feat');

    expectCall(calls, 'GET', /branches\?per_page=100$/);
    expectCall(calls, 'GET', /git\/ref\/heads\/main$/);
    expectCall(calls, 'POST', /\/git\/refs$/, { ref: 'refs/heads/feat', sha: 'SHA1' });
    expectCall(calls, 'DELETE', /git\/refs\/heads\/feat$/);
  });

  it('git data: createBlob (encoding default), createTree (con/sin base_tree), createCommit y updateRef', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/git\/blobs$/, payload: { sha: 'B1' } },
      { match: /\/git\/trees$/, payload: { sha: 'T1' } },
      { match: /\/git\/commits$/, payload: { sha: 'C1' } },
      { match: /\/git\/refs\//, payload: { ok: true } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await createBlob(TOKEN, 'o', 'r', 'contenido')).toEqual({ sha: 'B1' });
    expect(await createBlob(TOKEN, 'o', 'r', 'YmFzZTY0', 'base64')).toEqual({ sha: 'B1' });
    expect(await createTree(TOKEN, 'o', 'r', 'BT', [{ path: 'a', sha: 'sa' }, { path: 'b', sha: 'sb', mode: '100755' }])).toEqual({ sha: 'T1' });
    expect(await createTree(TOKEN, 'o', 'r', null, [{ path: 'c', sha: 'sc' }])).toEqual({ sha: 'T1' });
    expect(await createCommit(TOKEN, 'o', 'r', 'msg', 'T1', ['p1', 'p2'])).toEqual({ sha: 'C1' });
    await updateRef(TOKEN, 'o', 'r', 'heads/main', 'C1');

    const firstBlob = expectCall(calls, 'POST', /git\/blobs$/, { content: 'contenido', encoding: 'utf-8' });
    expectCall(calls, 'POST', /git\/blobs$/, { content: 'YmFzZTY0', encoding: 'base64' }, firstBlob + 1);
    const firstTree = expectCall(calls, 'POST', /git\/trees$/, {
      tree: [
        { path: 'a', mode: '100644', type: 'blob', sha: 'sa' }, // sin mode → ?? '100644'
        { path: 'b', mode: '100755', type: 'blob', sha: 'sb' },
      ],
      base_tree: 'BT',
    });
    expectCall(calls, 'POST', /git\/trees$/, { tree: [{ path: 'c', mode: '100644', type: 'blob', sha: 'sc' }] }, firstTree + 1); // sin base_tree
    expectCall(calls, 'POST', /git\/commits$/, { message: 'msg', tree: 'T1', parents: ['p1', 'p2'] });
    expectCall(calls, 'PATCH', /git\/refs\/heads\/main$/, { sha: 'C1', force: false });
  });

  it('workflows: listWorkflows, listWorkflowRuns (con/sin status) y triggerWorkflowRun', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/actions\/workflows$/, payload: { workflows: [{ id: 1, name: 'CI' }] } },
      { match: /\/workflows\/99\/runs\?status=/, payload: { workflow_runs: [{ id: 5 }] } },
      { match: /\/workflows\/99\/runs$/, payload: { workflow_runs: [] } },
      { match: /\/actions\/runs\/5\/rerun$/, payload: { rerun: true } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await listWorkflows(TOKEN, 'o', 'r')).toEqual([{ id: 1, name: 'CI' }]);
    expect(await listWorkflowRuns(TOKEN, 'o', 'r', 99)).toEqual([]);
    expect(await listWorkflowRuns(TOKEN, 'o', 'r', 99, 'success')).toEqual([{ id: 5 }]);
    expect(await triggerWorkflowRun(TOKEN, 'o', 'r', 5)).toEqual({ rerun: true });

    expectCall(calls, 'GET', /actions\/workflows$/);
    expectCall(calls, 'GET', /workflows\/99\/runs$/);
    expectCall(calls, 'GET', /workflows\/99\/runs\?status=success$/);
    expectCall(calls, 'POST', /actions\/runs\/5\/rerun$/);
  });

  it('listAllRepos: paginado 100+1 hasta que una página viene incompleta', async () => {
    const repos = (n0: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ name: `r${n0 + i}`, owner: { login: 'u' } }));
    const { fetchMock, calls } = routeFetch([
      { match: /\/user\/repos\?per_page=100&page=1&sort=updated$/, payload: repos(0, 100) },
      { match: /\/user\/repos\?per_page=100&page=2&sort=updated$/, payload: repos(100, 1) },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const all = await listAllRepos(TOKEN);
    expect(all).toHaveLength(101);
    expect(all[100]).toEqual({ name: 'r100', owner: { login: 'u' } });
    expectCall(calls, 'GET', /user\/repos\?per_page=100&page=1&sort=updated$/);
    expectCall(calls, 'GET', /user\/repos\?per_page=100&page=2&sort=updated$/);
  });

  it('fetchRepoTreeRecursive: branch explícita 404 → re-fetch con la default_branch real del meta (then de L512)', async () => {
    const { fetchMock, calls } = routeFetch([
      { match: /\/repos\/o\/r$/, payload: { default_branch: 'trunk' } },
      { match: /\/git\/trees\/main\?/, payload: { message: 'Not Found' }, status: 404 },
      { match: /\/git\/trees\/trunk\?/, payload: { truncated: true, tree: [{ path: 'a.md', type: 'blob', size: 4, sha: 's1' }] } },
      { match: /\/contents\/a\.md$/, payload: { content: encodeBase64('hola') } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    // Con branch explícita 'main' NO hay getRepo inicial: el árbol 404 → catch →
    // meta → 'trunk' ≠ 'main' → re-fetch del árbol en trunk (L512-516).
    const out = await fetchRepoTreeRecursive(TOKEN, 'o', 'r', 'main');
    expect(out.truncated).toBe(true);
    expect(out.allPaths).toEqual(['a.md']);
    expect(calls.filter(c => /\/git\/trees\/trunk\?/.test(c.url))).toHaveLength(1);
  });

  it('compareCommits: mapea los commits del payload (callback del map)', async () => {
    const { fetchMock } = routeFetch([
      { match: /\/compare\/main\.\.\.feat$/, payload: { commits: [{ sha: 's1', commit: { message: 'm1' } }, { sha: 's2', commit: { message: 'm2' } }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await compareCommits(TOKEN, 'o', 'r', 'main', 'feat')).toEqual([
      { sha: 's1', message: 'm1' }, { sha: 's2', message: 'm2' },
    ]);
  });

  it('ghFetch: 429 → GitHubAPIError con rateLimitInfo, mensaje pedagógico y SIN reintento', async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'API rate limit exceeded' }),
      headers: { get: (h: string) => (h === 'X-RateLimit-Reset' ? String(reset) : '0') },
    });
    vi.stubGlobal('fetch', fetchMock);

    const err = await ghFetch(TOKEN, '/repos/o/r').catch(e => e) as GitHubAPIError;
    expect(err.name).toBe('GitHubAPIError');
    expect(err.status).toBe(429);
    expect(err.message).toContain('Rate limit alcanzado');
    expect(err.rateLimitInfo?.resetTime).toBe(reset);
    expect(err.rateLimitInfo?.remainingSeconds).toBeGreaterThanOrEqual(595);
    // 429 con GitHubAPIError no es transitorio → 1 sola llamada (sin backoff de 800/1600 ms)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ghFetch: body sin message y json() roto → mensaje fallback "GitHub API <status>: <path>"', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({}) }) // sin message
      .mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.reject(new Error('json roto')) }); // catch(() => ({}))
    vi.stubGlobal('fetch', fetchMock);

    await expect(ghFetch(TOKEN, '/x')).rejects.toMatchObject({ name: 'GitHubAPIError', message: 'GitHub API 422: /x' });
    await expect(ghFetch(TOKEN, '/y')).rejects.toMatchObject({ name: 'GitHubAPIError', message: 'GitHub API 422: /y' });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 422 no se reintenta
  });
});
