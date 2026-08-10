import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CodeHealthCharts from '../CodeHealthCharts';
import type { CodeHealth } from '../../../services/assistantActions';

const mockDataEmpty: CodeHealth = {
  repoName: 'user/repo',
  filesAnalyzed: 5,
  truncated: false,
  languages: [],
  commits: [
    { weekStart: '2026-08-03', count: 5 },
    { weekStart: '2026-08-10', count: 12 },
  ],
  debt: {
    total: 0,
    byFile: [],
  },
};

const mockDataWithContent: CodeHealth = {
  repoName: 'user/repo',
  filesAnalyzed: 20,
  truncated: false,
  languages: [
    { language: 'TypeScript', count: 15 },
    { language: 'CSS', count: 3 },
  ],
  commits: [
    { weekStart: '2026-08-03', count: 8 },
  ],
  debt: {
    total: 3,
    byFile: [
      { path: 'src/App.tsx', count: 2 },
      { path: 'src/services/gemini.ts', count: 1 },
    ],
  },
};

describe('CodeHealthCharts (#44)', () => {
  it('renderiza mensaje cuando no hay lenguajes ni marcadores de deuda', () => {
    render(<CodeHealthCharts data={mockDataEmpty} />);
    expect(screen.getByText(/Distribución de lenguajes/i)).toBeInTheDocument();
    expect(screen.getByText(/No se reconocieron lenguajes/i)).toBeInTheDocument();
    expect(screen.getByText(/Commits por semana/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin marcadores de deuda/i)).toBeInTheDocument();
  });

  it('renderiza gráficos y secciones cuando hay datos de lenguajes y deuda técnica', () => {
    render(<CodeHealthCharts data={mockDataWithContent} />);
    expect(screen.getByText(/Distribución de lenguajes/i)).toBeInTheDocument();
    expect(screen.getByText(/Commits por semana/i)).toBeInTheDocument();
    expect(screen.getByText(/Deuda técnica — 3 marcadores/i)).toBeInTheDocument();
  });
});
