import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// DiffViewer integra dos librerías externas:
//   - `diff` (Diff.createPatch) → genera el patch unificado.
//   - `diff2html` (html export) → convierte ese patch en HTML side-by-side.
//
// Ambas son módulos ESM, así que no se puede usar `vi.spyOn` sobre su namespace
// (limitación documentada de Vitest). En su lugar mockeamos con factory que
// reexporta el módulo real y reemplaza solo el export objetivo por un `vi.fn`
// que espiamos desde el propio mock.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('diff', async () => {
  const actual = await vi.importActual<typeof import('diff')>('diff');
  return {
    ...actual,
    createPatch: vi.fn(actual.createPatch),
  };
});

// Mock por defecto de diff2html: pasa el patch a un marcador determinista
// para no depender de la salida HTML completa de la librería (que puede
// cambiar entre versiones y romper los tests).
vi.mock('diff2html', () => ({
  html: vi.fn((patch: string) => `<div data-testid="d2h-output">${patch}</div>`),
}));

import { createPatch } from 'diff';
import { html as diff2html } from 'diff2html';
import DiffViewer from '../DiffViewer';

const createPatchMock = vi.mocked(createPatch);
const diff2htmlMock = vi.mocked(diff2html);

describe('DiffViewer', () => {
  beforeEach(() => {
    createPatchMock.mockClear();
    diff2htmlMock.mockClear();
    // Restaurar implementación por defecto por si algún test la sobreescribió.
    diff2htmlMock.mockImplementation((patch: string) =>
      `<div data-testid="d2h-output">${patch}</div>`,
    );
  });

  // ── Render básico y cabecera ────────────────────────────────────────────────
  it('muestra el nombre del archivo en la cabecera', () => {
    render(<DiffViewer filename="README.md" oldContent="a" newContent="b" />);
    expect(screen.getByText(/📄 README\.md/)).toBeInTheDocument();
  });

  it('muestra las leyendas "Eliminado" y "Añadido" en español', () => {
    render(<DiffViewer filename="f.txt" oldContent="a" newContent="b" />);
    expect(screen.getByText('● Eliminado')).toBeInTheDocument();
    expect(screen.getByText('● Añadido')).toBeInTheDocument();
  });

  it('renderiza el contenedor diff con la clase diff-wrapper', () => {
    const { container } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    expect(container.querySelector('.diff-wrapper')).toBeInTheDocument();
  });

  // ── Generación del patch (createPatch) ─────────────────────────────────────
  it('invoca createPatch al montar', () => {
    render(<DiffViewer filename="app.js" oldContent="old" newContent="new" />);
    expect(createPatchMock).toHaveBeenCalledTimes(1);
  });

  it('pasa filename, oldContent y newContent a createPatch', () => {
    render(
      <DiffViewer filename="src/app.ts" oldContent="linea vieja" newContent="linea nueva" />,
    );
    expect(createPatchMock).toHaveBeenCalledWith(
      'src/app.ts',
      'linea vieja',
      'linea nueva',
      'Versión actual',
      'Versión propuesta',
    );
  });

  it('usa las claves de i18n currentVersion/proposedVersion como headers del patch', () => {
    render(<DiffViewer filename="f.txt" oldContent="x" newContent="y" />);
    const [, , , currentHeader, proposedHeader] = createPatchMock.mock.calls[0];
    expect(currentHeader).toBe('Versión actual');
    expect(proposedHeader).toBe('Versión propuesta');
  });

  // ── Conversión a HTML (diff2html) e inyección ──────────────────────────────
  it('invoca diff2html con outputFormat side-by-side y matching lines', () => {
    render(<DiffViewer filename="f.txt" oldContent="a" newContent="b" />);
    expect(diff2htmlMock).toHaveBeenCalledTimes(1);
    const [patch, opts] = diff2htmlMock.mock.calls[0];
    expect(typeof patch).toBe('string');
    expect(patch).toContain('f.txt');
    expect(opts).toMatchObject({
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side',
    });
  });

  it('inyecta el HTML devuelto por diff2html en el contenedor', () => {
    const { container } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    const wrapper = container.querySelector('.diff-wrapper') as HTMLElement;
    expect(wrapper.innerHTML).toContain('d2h-output');
  });

  // ── Re-renders: el efecto reacciona a los cambios de props ─────────────────
  it('regenera el diff cuando cambia el contenido propuesto', () => {
    const { rerender } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    expect(createPatchMock).toHaveBeenCalledTimes(1);

    rerender(<DiffViewer filename="f.txt" oldContent="a" newContent="c" />);
    expect(createPatchMock).toHaveBeenCalledTimes(2);
    expect(createPatchMock.mock.calls[1][2]).toBe('c');
  });

  it('regenera el diff cuando cambia el contenido actual', () => {
    const { rerender } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    rerender(<DiffViewer filename="f.txt" oldContent="Z" newContent="b" />);
    expect(createPatchMock).toHaveBeenCalledTimes(2);
    expect(createPatchMock.mock.calls[1][1]).toBe('Z');
  });

  it('regenera el diff cuando cambia el nombre del archivo', () => {
    const { rerender } = render(
      <DiffViewer filename="a.txt" oldContent="x" newContent="y" />,
    );
    rerender(<DiffViewer filename="b.txt" oldContent="x" newContent="y" />);
    expect(createPatchMock).toHaveBeenCalledTimes(2);
    expect(createPatchMock.mock.calls[1][0]).toBe('b.txt');
  });

  it('NO regenera el diff cuando las props son idénticas', () => {
    const { rerender } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    rerender(<DiffViewer filename="f.txt" oldContent="a" newContent="b" />);
    // React no vuelve a llamar al efecto si las deps son ===
    expect(createPatchMock).toHaveBeenCalledTimes(1);
  });

  // ── Casos límite de contenido ──────────────────────────────────────────────
  it('maneja contenido idéntico (sin cambios) sin romper', () => {
    render(<DiffViewer filename="f.txt" oldContent="igual" newContent="igual" />);
    expect(createPatchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/📄 f\.txt/)).toBeInTheDocument();
  });

  it('maneja creación de archivo (oldContent vacío)', () => {
    const { container } = render(
      <DiffViewer filename="nuevo.md" oldContent="" newContent="# Nuevo" />,
    );
    expect(createPatchMock).toHaveBeenCalledWith(
      'nuevo.md',
      '',
      '# Nuevo',
      'Versión actual',
      'Versión propuesta',
    );
    expect(container.querySelector('.diff-wrapper')?.innerHTML).toContain('d2h-output');
  });

  it('maneja eliminación completa (newContent vacío)', () => {
    render(<DiffViewer filename="old.md" oldContent="todo" newContent="" />);
    expect(createPatchMock).toHaveBeenCalledWith(
      'old.md',
      'todo',
      '',
      'Versión actual',
      'Versión propuesta',
    );
  });

  it('maneja contenido multilinea', () => {
    const oldMulti = 'línea 1\nlínea 2\nlínea 3';
    const newMulti = 'línea 1\nlínea MODIFICADA\nlínea 3';
    render(<DiffViewer filename="multi.txt" oldContent={oldMulti} newContent={newMulti} />);
    expect(createPatchMock).toHaveBeenCalledWith(
      'multi.txt',
      oldMulti,
      newMulti,
      'Versión actual',
      'Versión propuesta',
    );
  });

  // ── Resiliencia ante errores de diff2html ──────────────────────────────────
  it('propaga excepciones de diff2html (no las silencia implícitamente)', () => {
    // Forzamos que diff2html lance para confirmar que el componente no envuelve
    // la llamada en un try/catch que oculte el error en producción.
    diff2htmlMock.mockImplementationOnce(() => {
      throw new Error('diff2html boom');
    });
    expect(() =>
      render(<DiffViewer filename="f.txt" oldContent="a" newContent="b" />),
    ).toThrow(/diff2html boom/);
  });

  it('renderiza correctamente cuando diff2html devuelve cadena vacía', () => {
    diff2htmlMock.mockReturnValueOnce('');
    const { container } = render(
      <DiffViewer filename="f.txt" oldContent="a" newContent="b" />,
    );
    const wrapper = container.querySelector('.diff-wrapper') as HTMLElement;
    expect(wrapper.innerHTML).toBe('');
    // La cabecera sigue presente
    expect(screen.getByText(/📄 f\.txt/)).toBeInTheDocument();
  });
});
