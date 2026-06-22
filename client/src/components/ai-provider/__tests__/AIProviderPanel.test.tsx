import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIProviderContextProvider } from '../../../context/AIProviderContext';
import AIProviderPanel from '../AIProviderPanel';

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
function selectGroq(container: HTMLElement) {
  fireEvent.click(container.querySelector('#select-groq-btn') as HTMLElement);
}

describe('AIProviderPanel — selector de modelos Groq', () => {
  it('muestra el catálogo fallback con etiquetas amigables (no ids crudos)', () => {
    const { container } = renderPanel();
    selectGroq(container);

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
    selectGroq(container);
    expect(screen.getByText(/Modelo · 2 disponibles/)).toBeInTheDocument();
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
});
