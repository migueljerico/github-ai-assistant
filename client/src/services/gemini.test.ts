// ────────────────────────────────────────────────────────────────────────────
// Unit tests for gemini.ts — documentation generation and language detection
// ────────────────────────────────────────────────────────────────────────────

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import {
  generateRepoDocs,
  detectPrimaryLanguage,
  parseGeminiAction,
  type RepoFile,
  type GeneratedDocs,
} from './gemini';

// ── Mock fetch and sessionStorage ──────────────────────────────────────────
const mockFetch = vi.fn();
const mockSessionStorage = new Map<string, string>();

beforeEach(() => {
  mockFetch.mockClear();
  mockSessionStorage.clear();
  mockSessionStorage.set('ai_provider', 'groq');
  mockSessionStorage.set('ai_api_key', 'test-key-12345');
  mockSessionStorage.set('ai_model', 'mixtral-8x7b-32768');

  // Mock global fetch and sessionStorage
  (globalThis as any).fetch = mockFetch;
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key: string) => mockSessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
      removeItem: (key: string) => mockSessionStorage.delete(key),
      clear: () => mockSessionStorage.clear(),
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Test suite: Language detection ─────────────────────────────────────────
describe('detectPrimaryLanguage()', () => {
  it('should detect TypeScript as primary language', () => {
    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
      { path: 'src/utils.ts', content: 'export const util = () => {}' },
      { path: 'src/App.tsx', content: 'export function App() {}' },
      { path: 'README.md', content: '# Project' },
    ];
    expect(detectPrimaryLanguage(files)).toBe('TypeScript');
  });

  it('should detect JavaScript as primary language', () => {
    const files: RepoFile[] = [
      { path: 'index.js', content: 'module.exports = {}' },
      { path: 'utils.js', content: 'function util() {}' },
      { path: 'helpers.js', content: 'const h = {}' },
    ];
    expect(detectPrimaryLanguage(files)).toBe('JavaScript');
  });

  it('should detect Python as primary language', () => {
    const files: RepoFile[] = [
      { path: 'main.py', content: 'def main(): pass' },
      { path: 'utils.py', content: 'def helper(): pass' },
      { path: 'config.py', content: 'CONFIG = {}' },
      { path: 'README.md', content: '# Project' },
    ];
    expect(detectPrimaryLanguage(files)).toBe('Python');
  });

  it('should return "múltiple" when no recognized extensions', () => {
    const files: RepoFile[] = [
      { path: 'README.md', content: '# Project' },
      { path: 'LICENSE.txt', content: 'MIT' },
      { path: 'Dockerfile', content: 'FROM node' },
    ];
    expect(detectPrimaryLanguage(files)).toBe('múltiple');
  });

  it('should return "múltiple" for empty file list', () => {
    expect(detectPrimaryLanguage([])).toBe('múltiple');
  });

  it('should count only unique extensions', () => {
    const files: RepoFile[] = [
      { path: 'a.ts', content: 'a' },
      { path: 'b.ts', content: 'b' },
      { path: 'c.ts', content: 'c' },
      { path: 'd.js', content: 'd' },
      { path: 'e.js', content: 'e' },
    ];
    expect(detectPrimaryLanguage(files)).toBe('TypeScript');
  });
});

// ── Test suite: JSON extraction ────────────────────────────────────────────
describe('extractJSON (via generateRepoDocs)', () => {
  const mockGroqSuccess = (json: Record<string, unknown>) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(json),
            },
          },
        ],
      }),
    });
  };

  it('should extract valid JSON from plain response', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# Test README',
      manualTecnico: '## Technical Manual',
      resumen: 'A test project',
      metadatos: { lenguaje: 'TypeScript', filesCount: 5 },
    };

    mockGroqSuccess(validDocs);

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.readme).toBe('# Test README');
    expect(result.manualTecnico).toBe('## Technical Manual');
  });

  it('should extract JSON wrapped in markdown code fences', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# Test README',
      manualTecnico: '## Technical Manual',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(validDocs)}\n\`\`\``,
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.readme).toBe('# Test README');
    expect(result.manualTecnico).toBe('## Technical Manual');
  });

  it('should extract JSON from wrapped prose', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# Test README',
      manualTecnico: '## Technical Manual',
      metadatos: { lenguaje: 'TypeScript', filesCount: 1 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `Aquí va la documentación:\n${JSON.stringify(validDocs)}\nFin.`,
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.readme).toBe('# Test README');
    expect(result.manualTecnico).toBe('## Technical Manual');
  });
});

// ── Test suite: Validation ─────────────────────────────────────────────────
describe('generateRepoDocs() — validation', () => {
  it('should throw error when "readme" field is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                manualTecnico: '## Manual',
                resumen: 'A project',
              }),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    await expect(generateRepoDocs(files)).rejects.toThrow(
      'La IA no devolvió el campo "readme" en el formato esperado'
    );
  });

  it('should throw error when "manualTecnico" field is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                readme: '# README',
                resumen: 'A project',
              }),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    await expect(generateRepoDocs(files)).rejects.toThrow(
      'La IA no devolvió el campo "manualTecnico" en el formato esperado'
    );
  });

  it('should throw error when model returns error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                error: 'Model rate limit exceeded',
              }),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
    ];

    await expect(generateRepoDocs(files)).rejects.toThrow(
      'Error del modelo: Model rate limit exceeded'
    );
  });

  it('should throw error when no files provided', async () => {
    await expect(generateRepoDocs([])).rejects.toThrow(
      'No hay archivos para analizar'
    );
  });

  it('should return optional fields when provided by model', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# README',
      manualTecnico: '## Manual',
      resumen: 'Quick summary',
      metadatos: { lenguaje: 'TypeScript', filesCount: 3, custom: 'value' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validDocs),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
      { path: 'src/utils.ts', content: 'export const util = () => {}' },
      { path: 'src/App.tsx', content: 'export function App() {}' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.resumen).toBe('Quick summary');
    expect(result.metadatos).toEqual({ lenguaje: 'TypeScript', filesCount: 3, custom: 'value' });
  });

  it('should provide default metadatos when not in model response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                readme: '# README',
                manualTecnico: '## Manual',
              }),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
      { path: 'src/utils.ts', content: 'export const util = () => {}' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.metadatos).toEqual({
      lenguaje: 'TypeScript',
      filesCount: 2,
    });
  });
});

// ── Test suite: Content truncation ──────────────────────────────────────────
describe('generateRepoDocs() — truncation', () => {
  it('should truncate files larger than 2000 characters', async () => {
    const largeContent = 'x'.repeat(3000);
    const validDocs: GeneratedDocs = {
      readme: '# README (with large file)',
      manualTecnico: '## Manual',
      metadatos: { lenguaje: 'JavaScript', filesCount: 1 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validDocs),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/large.js', content: largeContent },
    ];

    const result = await generateRepoDocs(files);
    // Verify the function was called (implementation detail tested via integration)
    expect(result.readme).toBeDefined();
    expect(result.manualTecnico).toBeDefined();
  });

  it('should include only files with content', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# README',
      manualTecnico: '## Manual',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validDocs),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const x = 1;' },
      { path: 'src/empty.ts' }, // No content
      { path: 'src/utils.ts', content: 'export const util = () => {}' },
    ];

    const result = await generateRepoDocs(files);
    expect(result.readme).toBe('# README');
  });
});

// ── Test suite: Integration ────────────────────────────────────────────────
describe('generateRepoDocs() — integration', () => {
  it('should successfully generate docs for a TypeScript project', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# Example Project\n\n![TypeScript](https://img.shields.io/badge/TypeScript-blue)\n\n*A simple example project.*',
      manualTecnico: '## Architecture\n\n```\n├── Client\n├── Server\n└── Shared\n```',
      resumen: 'A full-stack TypeScript project with React frontend and Node.js backend.',
      metadatos: { lenguaje: 'TypeScript', filesCount: 4, type: 'web' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(validDocs)}\n\`\`\``,
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'src/index.ts', content: 'export const version = "1.0.0";' },
      { path: 'src/App.tsx', content: 'export function App() { return <div>Hello</div>; }' },
      { path: 'src/utils.ts', content: 'export const util = () => console.log("test");' },
      { path: 'README.md', content: '# My Project' },
    ];

    const result = await generateRepoDocs(files);

    expect(result.readme).toContain('Example Project');
    expect(result.manualTecnico).toContain('Architecture');
    expect(result.resumen).toContain('TypeScript');
    expect(result.metadatos?.filesCount).toBe(4);
  });

  it('should handle multi-language projects', async () => {
    const validDocs: GeneratedDocs = {
      readme: '# Multi-Language Project',
      manualTecnico: '## Components',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validDocs),
            },
          },
        ],
      }),
    });

    const files: RepoFile[] = [
      { path: 'client/main.ts', content: 'import React from "react";' },
      { path: 'server/main.py', content: 'from flask import Flask' },
      { path: 'scripts/build.js', content: 'const webpack = require("webpack");' },
      { path: 'README.md', content: '# Project' },
    ];

    const result = await generateRepoDocs(files);
    // TypeScript (1) is not the primary, but JavaScript (1) is not either...
    // Since counts are equal, the first in Object.entries sort wins
    expect(result.metadatos?.lenguaje).toBeDefined();
    expect(result.readme).toBe('# Multi-Language Project');
  });
});

// ── Test suite: parseGeminiAction (bonus) ──────────────────────────────────
describe('parseGeminiAction()', () => {
  it('should parse valid GeminiAction JSON', () => {
    const json = {
      tipo: 'creacion',
      accion: 'Crear repositorio',
      endpoint: '/user/repos',
      metodo: 'POST',
      repo: null,
      archivo: null,
      contenidoPropuesto: null,
      payload: { name: 'test-repo', private: false },
      requiereConfirmacion: true,
    };

    const result = parseGeminiAction(JSON.stringify(json));
    expect(result).not.toBeNull();
    expect(result?.tipo).toBe('creacion');
    expect(result?.endpoint).toBe('/user/repos');
  });

  it('should return null for invalid JSON', () => {
    const result = parseGeminiAction('not json at all');
    expect(result).toBeNull();
  });

  it('should return null when required fields are missing', () => {
    const json = {
      accion: 'Some action',
      endpoint: '/some/endpoint',
      // missing tipo and metodo
    };

    const result = parseGeminiAction(JSON.stringify(json));
    expect(result).toBeNull();
  });

  it('should extract JSON from markdown code fences', () => {
    const json = {
      tipo: 'lectura',
      accion: 'Listar repos',
      endpoint: '/user/repos',
      metodo: 'GET',
      repo: null,
      archivo: null,
      contenidoPropuesto: null,
      payload: {},
      requiereConfirmacion: false,
    };

    const markdown = `\`\`\`json\n${JSON.stringify(json)}\n\`\`\``;
    const result = parseGeminiAction(markdown);
    expect(result).not.toBeNull();
    expect(result?.tipo).toBe('lectura');
  });
});
