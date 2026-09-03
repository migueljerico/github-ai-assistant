import { describe, it, expect } from 'vitest';
import { modelLabel } from '../modelLabels';

describe('modelLabels', () => {
  it('devuelve la etiqueta descriptiva amigable para los modelos de Gemini (incluidos 3.7 y 3.8 Flash)', () => {
    expect(modelLabel('gemini-3.8-flash')).toBe('Gemini 3.8 Flash');
    expect(modelLabel('gemini-3.7-flash')).toBe('Gemini 3.7 Flash');
    expect(modelLabel('gemini-2.5-flash')).toBe('Gemini 2.5 Flash');
    expect(modelLabel('gemini-3.6-flash')).toBe('Gemini 3.6 Flash');
    expect(modelLabel('gemini-3.5-flash')).toBe('Gemini 3.5 Flash');
    expect(modelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
  });

  it('devuelve la etiqueta descriptiva amigable para los modelos de QwenCloud', () => {
    expect(modelLabel('qwen3.7-flash')).toBe('Qwen 3.7 Flash');
    expect(modelLabel('qwen-plus-character')).toBe('Qwen Plus Character');
    expect(modelLabel('qwen-flash-character')).toBe('Qwen Flash Character');
    expect(modelLabel('qwen3-coder-flash')).toBe('Qwen 3 Coder Flash');
  });

  it('devuelve la etiqueta descriptiva para modelos de Groq, NIM, Zenmux, Cloudflare y BazaarLink', () => {
    expect(modelLabel('openai/gpt-oss-20b')).toBe('GPT-OSS 20B (fast)');
    expect(modelLabel('qwen/qwen3.8-27b')).toBe('Qwen 3.8 27B');
    expect(modelLabel('qwen/qwen3.6-27b')).toBe('Qwen 3.6 27B');
    expect(modelLabel('nvidia/nemotron-3-ultra-550b-a55b')).toBe('Nemotron 3 Ultra');
    expect(modelLabel('deepseek/deepseek-v4-flash-free')).toBe('DeepSeek V4 Flash');
    expect(modelLabel('@cf/qwen/qwen3-30b-a3b-fp8')).toBe('Qwen3 30B A3B');
    expect(modelLabel('auto:free')).toBe('Auto Router (free)');
  });

  it('devuelve el id original si el modelo no está en el mapa', () => {
    expect(modelLabel('modelo-desconocido')).toBe('modelo-desconocido');
  });
});
