import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIProviderContextProvider } from '../../../context/AIProviderContext';
import AIProviderPanel from '../AIProviderPanel';
import { getProvider } from '../../../services/providers';

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function renderPanel() {
  return render(
    <AIProviderContextProvider>
      <AIProviderPanel />
    </AIProviderContextProvider>,
  );
}

/** Selecciona la tarjeta de Groq para que se muestre el selector de modelos. */
function selectProvider(container: HTMLElement, providerId: string) {
  fireEvent.click(container.querySelector(`#select-${providerId}-btn`) as HTMLElement);
}

describe('AIProviderPanel — selector de modelos Groq', () => {
  it('muestra el catálogo fallback con etiquetas amigables (no ids crudos)', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');

    const select = container.querySelector('#groq-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toContain('Llama 3.3 70B');
    expect(labels).toContain('Llama 3.1 8B');
    // El valor sigue siendo el id real, aunque se muestre la etiqueta amigable
    expect(Array.from(select.options).map(o => o.value)).toContain('llama-3.3-70b-versatile');
    // Hay más de una opción (descarta la percepción de "solo hay uno")
    expect(select.options.length).toBeGreaterThan(1);
  });

  it('muestra el contador de modelos disponibles junto al selector', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    // El conteo se deriva del catálogo estático de Groq (no se hardcodea el número).
    const groqCount = getProvider('groq').staticModels.length;
    expect(screen.getByText(new RegExp(`Modelo · ${groqCount} disponibles`))).toBeInTheDocument();
  });
});

describe('AIProviderPanel — NVIDIA NIM', () => {
  it('muestra la tarjeta NIM con emoji 🟢 y descripción', () => {
    renderPanel();
    expect(screen.getByText('🟢')).toBeInTheDocument();
    expect(screen.getByText('NVIDIA Build (NIM)')).toBeInTheDocument();
    expect(screen.getByText(/Modelos optimizados/)).toBeInTheDocument();
  });

  it('muestra catálogo fallback con Nemotron 3 Ultra recomendado y 12 modelos', () => {
    const { container } = renderPanel();
    selectProvider(container, 'nvidia');

    const select = container.querySelector('#nvidia-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toContain('Nemotron 3 Ultra'); // modelLabel devuelve sin ⭐
    expect(labels).toContain('GLM 5.2');
    expect(labels).toContain('Llama 3.3 70B');
    expect(labels).toContain('Codestral 22B (código)');
    expect(select.options.length).toBe(12); // fallback tiene 12 modelos
  });

  it('valida prefijo de clave nvapi-', () => {
    const { container } = renderPanel();
    selectProvider(container, 'nvidia');
    const input = container.querySelector('#nvidia-key-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe('nvapi-...');
  });
});

describe('AIProviderPanel — Zenmux', () => {
  it('muestra la tarjeta Zenmux con emoji 🧘 y descripción', () => {
    renderPanel();
    expect(screen.getByText('🧘')).toBeInTheDocument();
    expect(screen.getByText('Zenmux')).toBeInTheDocument();
    expect(screen.getByText(/Pasarela unificada/)).toBeInTheDocument();
  });

  it('muestra catálogo fallback con 7 modelos free y Step 3.7 Flash recomendado', () => {
    const { container } = renderPanel();
    selectProvider(container, 'zenmux');

    const select = container.querySelector('#zenmux-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toContain('🆓 Step 3.7 Flash');
    expect(labels).toContain('🆓 Grok 4.5 (500K ctx)');
    expect(labels).toContain('🆓 GLM 4.7 Flash');
    expect(labels).toContain('🆓 GLM 4.6V Flash');
    // Todos los 7 son free
    Array.from(select.options).forEach(o => expect(o.textContent).toContain('🆓'));
    expect(select.options.length).toBe(7);
  });

  it('valida prefijo de clave sk-ai-v1-', () => {
    const { container } = renderPanel();
    selectProvider(container, 'zenmux');
    const input = container.querySelector('#zenmux-key-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe('sk-ai-v1-...');
  });
});

describe('AIProviderPanel — recuerda proveedor/modelo (#40)', () => {
  it('arranca en el proveedor recordado con su modelo (sin tener que reseleccionar)', () => {
    // Simula una recarga: hay una preferencia guardada (no la key).
    sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'groq', model: 'llama-3.3-70b-versatile' }));

    const { container } = renderPanel();

    // La tarjeta de Groq sale ya seleccionada (su selector es visible sin hacer clic).
    const select = container.querySelector('#groq-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('llama-3.3-70b-versatile');
  });
});

describe('AIProviderPanel — catálogo fijo de Gemini (v3.24.0)', () => {
  it('muestra los 6 modelos fijos sin hacer ningún fetch dinámico', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderPanel();
    // Selecciona Gemini para que se muestre el selector de modelos.
    fireEvent.click(container.querySelector('#select-gemini-btn') as HTMLElement);

    const select = container.querySelector('#gemini-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const values = Array.from(select.options).map(o => o.value);
    // Los 7 modelos operativos del catálogo fijo (incl. gemini-3-flash-preview).
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash',
      'gemma-4-31b-it',
    ]);

    // No hay catálogo dinámico: fetch nunca se llama para Gemini.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no muestra el aviso de deprecación obsoleto', () => {
    const { container } = renderPanel();
    fireEvent.click(container.querySelector('#select-gemini-btn') as HTMLElement);
    // La nota de deprecación fue eliminada del catálogo fijo.
    expect(screen.queryByText(/deprecados/i)).not.toBeInTheDocument();
  });
});

describe('AIProviderPanel — OpenRouter (#15)', () => {
  it('renderiza la tarjeta de OpenRouter con modelos etiquetados como gratuitos 🆓', async () => {
    // El catálogo dinámico falla → cae al fallback estático (modelos :free)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

    const { container } = renderPanel();
    fireEvent.click(container.querySelector('#select-openrouter-btn') as HTMLElement);

    const select = container.querySelector('#openrouter-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Espera a que termine la carga (vuelve del estado "Cargando modelos...")
    await waitFor(() => expect(select.disabled).toBe(false));

    const labels = Array.from(select.options).map(o => o.textContent ?? '');
    expect(labels.some(l => l.startsWith('🆓'))).toBe(true);
  });

  it('al cargar el catálogo elige por defecto un modelo free fiable (Gemma)', async () => {
    // Catálogo con varios :free; pickDefaultModel debe preferir Gemma sobre el
    // default estático (deepseek) y sobre otros gratuitos arbitrarios.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'aaa/aardvark:free', name: 'Aardvark' },
          { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
          { id: 'openai/gpt-4o', name: 'GPT-4o', pricing: { prompt: '1', completion: '2' } },
        ],
      }),
    }));

    const { container } = renderPanel();
    fireEvent.click(container.querySelector('#select-openrouter-btn') as HTMLElement);
    const select = container.querySelector('#openrouter-model-select') as HTMLSelectElement;

    await waitFor(() => expect(select.disabled).toBe(false));
    await waitFor(() => expect(select.value).toBe('google/gemma-4-31b-it:free'));
  });
});
