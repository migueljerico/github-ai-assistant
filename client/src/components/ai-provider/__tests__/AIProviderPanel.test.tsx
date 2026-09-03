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
    expect(labels).toContain('GPT-OSS 20B (fast)');
    expect(labels).toContain('GPT-OSS 120B');
    // El valor sigue siendo el id real, aunque se muestre la etiqueta amigable
    expect(Array.from(select.options).map(o => o.value)).toContain('openai/gpt-oss-20b');
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

  it('muestra catálogo fallback con Nemotron 3 Ultra recomendado y 15 modelos', () => {
    const { container } = renderPanel();
    selectProvider(container, 'nvidia');

    const select = container.querySelector('#nvidia-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toContain('Nemotron 3 Ultra'); // modelLabel devuelve sin ⭐
    expect(labels).toContain('GLM 5.2');
    expect(labels).toContain('Llama 3.3 70B');
    expect(labels).toContain('DeepSeek V4 Pro');
    expect(select.options.length).toBe(getProvider('nvidia').staticModels.length); // 15 modelos
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

  it('muestra catálogo fallback con modelos free (DeepSeek V4 Flash recomendado)', async () => {
    // Zenmux es modelsNeedKey → sin clave el panel NO llama a fetchModels y muestra
    // el fallback estático (ZENMUX_FALLBACK, 4 free). Verificamos ese comportamiento.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { container } = renderPanel();
    selectProvider(container, 'zenmux');

    const select = container.querySelector('#zenmux-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Sin clave → no hay fetch dinámico; se queda con el fallback (todos free 🆓).
    expect(fetchSpy).not.toHaveBeenCalled();

    const labels = Array.from(select.options).map(o => o.textContent ?? '');
    const zenmuxCount = getProvider('zenmux').staticModels.length;
    expect(labels.length).toBe(zenmuxCount);
    expect(labels).toContain('🆓 DeepSeek V4 Flash'); // nuevo recommended (todos free llevan 🆓)
    Array.from(select.options).forEach(o => expect(o.textContent).toContain('🆓'));
    expect(select.value).toBeTruthy();
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
    sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'groq', model: 'openai/gpt-oss-20b' }));

    const { container } = renderPanel();

    // La tarjeta de Groq sale ya seleccionada (su selector es visible sin hacer clic).
    const select = container.querySelector('#groq-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('openai/gpt-oss-20b');
  });
});

describe('AIProviderPanel — catálogo fijo de Gemini (v3.24.0)', () => {
  it('muestra los 20 modelos fijos sin hacer ningún fetch dinámico', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderPanel();
    selectProvider(container, 'gemini');

    const select = container.querySelector('#gemini-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const values = Array.from(select.options).map(o => o.value);
    // Los 20 modelos operativos del catálogo fijo a día de hoy.
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash-lite',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
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

describe('AIProviderPanel — Kilo (v3.58.0)', () => {
  it('muestra la tarjeta Kilo con emoji ⚖️ y nombre', () => {
    renderPanel();
    expect(screen.getByText('⚖️')).toBeInTheDocument();
    expect(screen.getByText('Kilo')).toBeInTheDocument();
  });

  it('muestra catálogo con 3 modelos free (🆓) cargados vía proxy y Ling 3.0 Flash por defecto', async () => {
    // Kilo tiene modelsEndpoint → el panel carga el catálogo dinámicamente vía
    // fetch (como OpenRouter). Stubeamos fetch con los 3 modelos free y esperamos.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'inclusionai/ling-3.0-flash:free' },
        { id: 'poolside/laguna-s-2.1:free' },
        { id: 'nex-agi/nex-n2-pro:free' },
      ] }),
    }));

    const { container } = renderPanel();
    selectProvider(container, 'kilo');

    const select = container.querySelector('#kilo-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Espera a que termine la carga (vuelve del estado "Cargando modelos...")
    await waitFor(() => expect(select.disabled).toBe(false));

    const labels = Array.from(select.options).map(o => o.textContent ?? '');
    expect(labels).toContain('🆓 inclusionai/ling-3.0-flash:free');
    expect(labels).toContain('🆓 poolside/laguna-s-2.1:free');
    expect(labels).toContain('🆓 nex-agi/nex-n2-pro:free');
    // La rama genérica de fetchModels marca free por sufijo :free (todos lo son)
    Array.from(select.options).forEach(o => expect(o.textContent).toContain('🆓'));
    expect(select.options.length).toBe(3);
  });

  it('cae al fallback estático (3 modelos) si el catálogo dinámico falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

    const { container } = renderPanel();
    selectProvider(container, 'kilo');

    const select = container.querySelector('#kilo-model-select') as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));

    // El fallback KILO_FALLBACK tiene los mismos 3 modelos free
    expect(select.options.length).toBe(3);
    expect(select.value).toBe('inclusionai/ling-3.0-flash:free');
  });

  it('valida prefijo de clave JWT (eyJ)', () => {
    const { container } = renderPanel();
    selectProvider(container, 'kilo');
    const input = container.querySelector('#kilo-key-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe('eyJhbGciOi...');
  });
});

// #73: timeout automático configurable en el panel.
describe('AIProviderPanel — timeout (#73)', () => {
  it('renderiza el input de timeout al seleccionar un proveedor', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    const input = container.querySelector('#groq-timeout-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('number');
    expect(input.placeholder).toBe('180'); // default
  });

  it('muestra la etiqueta y el hint traducidos', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    expect(screen.getByText('Timeout (segundos)')).toBeInTheDocument();
    expect(screen.getByText(/La generación se cancela/)).toBeInTheDocument();
  });

  it('actualiza el valor del input al cambiarlo', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    const input = container.querySelector('#groq-timeout-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '180' } });
    expect(input.value).toBe('180');
  });

  it('vaciar el input lo deja vacío (default)', () => {
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    const input = container.querySelector('#groq-timeout-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '180' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('hidrata el valor guardado al montar (preferencia recordada)', () => {
    // Pre-puebla sessionStorage con un timeout guardado.
    sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'groq', model: getProvider('groq').defaultModel, timeoutMs: 90000 }));
    const { container } = renderPanel();
    selectProvider(container, 'groq');
    const input = container.querySelector('#groq-timeout-input') as HTMLInputElement;
    expect(input.value).toBe('90'); // 90000ms → 90s
  });
});

describe('AIProviderPanel — interacción de teclado y visibilidad de clave', () => {
  it('selecciona un proveedor mediante teclado (Enter / Espacio)', () => {
    const { container } = renderPanel();
    const groqCard = container.querySelector('#select-groq-btn') as HTMLElement;
    expect(groqCard).toBeInTheDocument();

    fireEvent.keyDown(groqCard, { key: 'Enter' });
    expect(container.querySelector('#groq-model-select')).toBeInTheDocument();

    const geminiCard = container.querySelector('#select-gemini-btn') as HTMLElement;
    fireEvent.keyDown(geminiCard, { key: ' ' });
    expect(container.querySelector('#gemini-model-select')).toBeInTheDocument();
  });

  it('permite ingresar el Account ID en Cloudflare y conmuta visibilidad de clave', () => {
    const { container } = renderPanel();
    selectProvider(container, 'cloudflare');

    const accountInput = container.querySelector('#cloudflare-accountid-input') as HTMLInputElement;
    expect(accountInput).toBeInTheDocument();
    fireEvent.change(accountInput, { target: { value: 'acc-12345' } });
    expect(accountInput.value).toBe('acc-12345');

    const keyInput = container.querySelector('#cloudflare-key-input') as HTMLInputElement;
    expect(keyInput.type).toBe('password');

    const toggleBtn = container.querySelector('button[aria-label="Mostrar u ocultar clave API"]') || container.querySelector('.key-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn as HTMLElement);

    expect(keyInput.type).toBe('text');
  });

  it('maneja el flujo exitoso de validación y conexión', async () => {
    const geminiService = await import('../../../services/gemini');
    const spy = vi.spyOn(geminiService, 'validateProviderKey').mockResolvedValue({ valid: true });

    const { container } = renderPanel();
    selectProvider(container, 'groq');

    const keyInput = container.querySelector('#groq-key-input') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'gsk_validkey123456789' } });

    const connectBtn = container.querySelector('#ai-connect-btn') as HTMLElement;
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    spy.mockRestore();
  });

  it('maneja el flujo de error de validación mostrando mensaje de error', async () => {
    const geminiService = await import('../../../services/gemini');
    const spy = vi.spyOn(geminiService, 'validateProviderKey').mockResolvedValue({ valid: false, error: 'Clave inválida proporcionada' });

    const { container } = renderPanel();
    selectProvider(container, 'groq');

    const keyInput = container.querySelector('#groq-key-input') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'gsk_invalidkey' } });

    const connectBtn = container.querySelector('#ai-connect-btn') as HTMLElement;
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByText(/Clave inválida proporcionada/)).toBeInTheDocument();
    });

    spy.mockRestore();
  });
});

describe('AIProviderPanel — Gemini con Gemini 3.7 y 3.8 Flash', () => {
  it('renderiza el selector de Gemini con 20 modelos y permite seleccionar Gemini 3.8 Flash', () => {
    const { container } = renderPanel();
    selectProvider(container, 'gemini');

    const select = container.querySelector('#gemini-model-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('gemini-3.8-flash');
    expect(options).toContain('gemini-3.7-flash');
    expect(options).toContain('gemini-2.5-flash');
    expect(options.length).toBe(20);

    fireEvent.change(select, { target: { value: 'gemini-3.8-flash' } });
    expect(select.value).toBe('gemini-3.8-flash');
  });
});


