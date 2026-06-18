import { describe, it, expect } from 'vitest';
import type { ChatMessage, GeminiAction, GitHubUser } from '../types';

describe('Types - Validación de tipos', () => {
  it('debería permitir crear un ChatMessage válido', () => {
    const message: ChatMessage = {
      id: '123',
      role: 'user',
      content: 'Hola',
      timestamp: new Date(),
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hola');
  });

  it('debería permitir crear un GeminiAction válido', () => {
    const action: GeminiAction = {
      tipo: 'lectura',
      accion: 'Listar repos',
      endpoint: '/user/repos',
      metodo: 'GET',
      requiereConfirmacion: false,
    };

    expect(action.tipo).toBe('lectura');
    expect(action.metodo).toBe('GET');
  });

  it('debería permitir crear un GitHubUser válido', () => {
    const user: GitHubUser = {
      login: 'testuser',
      id: 123,
      avatar_url: 'https://example.com/avatar.png',
      name: 'Test User',
    };

    expect(user.login).toBe('testuser');
    expect(user.id).toBe(123);
  });
});
