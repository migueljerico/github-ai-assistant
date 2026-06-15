# 🤝 Guía de contribución

Gracias por tu interés en mejorar **GitHub AI Assistant**. Este documento complementa al [README.md](README.md) y se centra en el flujo de trabajo para desarrolladores: tests, integración continua y estándares de código.

> 💡 **Nota:** Para la configuración inicial del entorno local, instalación de dependencias y variables de entorno, consulta la sección "🚀 Inicio rápido" del [README.md](README.md) (incluyendo el uso de `.env.example`).

---

## 📋 Tabla de contenidos

1. [Tests](#-tests)
2. [CI/CD con GitHub Actions](#-cicd-con-github-actions)
3. [Cobertura de código](#-cobertura-de-código)
4. [Estándares de código](#-estándares-de-código)
5. [Flujo de trabajo para Pull Requests](#-flujo-de-trabajo-para-pull-requests)

---

## 🧪 Tests

El proyecto utiliza **[Vitest](https://vitest.dev/)** junto con **[Testing Library](https://testing-library.com/)** para garantizar la estabilidad de la arquitectura Zero-Storage y la lógica de los plugins.

### Ejecutar tests

```bash
cd client
npm run test:run       # Ejecuta los tests una vez
npm run test           # Modo watch (se re-ejecutan al guardar cambios)
npm run test:coverage  # Genera reporte de cobertura

Estructura y prioridades de testing
Los tests viven junto al código que prueban, en carpetas __tests__/.
Prioridad
Qué testar
Por qué
🔴 Alta
AuthContext y AIProviderContext
Garantizan que NO se usa sessionStorage (Zero-Storage).
🔴 Alta
Plugins (/plugins/*.ts)
Lógica crítica de negocio y ejecución de herramientas.
🟡 Media
Parsing de streaming SSE
Evita regresiones en la UI al recibir respuestas del LLM.
Ejemplo de test (Zero-Storage)

import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ... (componente de prueba) ...

describe('AuthContext - Zero-Storage', () => {
  beforeEach(() => {
    // Mockeamos sessionStorage para verificar que NUNCA se llama
    Object.defineProperty(window, 'sessionStorage', { 
      value: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } 
    });
  });

  it('NO debería usar sessionStorage en ningún momento', async () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    screen.getByText('Login').click();
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
  });
});

🔄 CI/CD con GitHub Actions
El proyecto incluye un pipeline automatizado en .github/workflows/ci.yml que valida cada Pull Request.
Qué hace el pipeline
Instala dependencias y verifica tipos con TypeScript.
Ejecuta la suite de tests de Vitest.
(Opcional) Sube el reporte de cobertura a Codecov.
Secrets necesarios en el repositorio
Para habilitar todas las funciones del pipeline, configura en Settings → Secrets and variables → Actions:
CODECOV_TOKEN: (Opcional) Para el badge de cobertura.

📊 Cobertura de código
Utilizamos Codecov para monitorizar la calidad del código.
Conecta tu repositorio en codecov.io.
Añade el badge al final del README.md:
markdown

[![codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg)](https://codecov.io/gh/migueljerico/github-ai-assistant)

📏 Estándares de código
TypeScript Estricto: "strict": true en tsconfig.json. Evitar any implícitos.
React: Componentes funcionales con hooks. Estado global gestionado exclusivamente mediante Context API (Zero-Storage).
Commits: Usar el formato Conventional Commits:
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
test: añadir o modificar tests
refactor: cambio de código que no corrige un bug ni añade una feature
🔀 Flujo de trabajo para Pull Requests
Crea una rama descriptiva: git checkout -b feat/nueva-funcionalidad o fix/error-especifico.
Asegúrate de que los tests pasan localmente: npm run test:run.
Haz commit siguiendo los estándares de Conventional Commits.
Abre un Pull Request contra main. El CI se ejecutará automáticamente.
⚠️ Importante: No se aceptarán PRs que rompan los tests existentes o que introduzcan el uso de localStorage/sessionStorage para credenciales.

❓ ¿Dudas?
Abre un issue describiendo tu problema. ¡Gracias por contribuir! 🚀


---
