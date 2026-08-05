import { describe, it, expect } from 'vitest';
import { modelLabel } from '../modelLabels';

describe('modelLabels', () => {
  it('devuelve la etiqueta descriptiva amigable para los modelos de QwenCloud', () => {
    expect(modelLabel('qwen3.7-flash')).toBe('Qwen 3.7 Flash');
    expect(modelLabel('qwen-plus-character')).toBe('Qwen Plus Character');
    expect(modelLabel('qwen-flash-character')).toBe('Qwen Flash Character');
    expect(modelLabel('qwen3-coder-flash')).toBe('Qwen 3 Coder Flash');
  });

  it('devuelve el id original si el modelo no está en el mapa', () => {
    expect(modelLabel('modelo-desconocido')).toBe('modelo-desconocido');
  });
});
