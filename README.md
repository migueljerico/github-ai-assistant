# 🤖 GitHub AI Assistant

![Estado](https://img.shields.io/badge/Estado-Publicado-4CAF50?style=for-the-badge)
[![Versión](https://img.shields.io/badge/Versión-v4.0.25-blue?style=for-the-badge)](https://github.com/migueljerico/github-ai-assistant/releases)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)](./LICENSE)
[![CI](https://github.com/migueljerico/github-ai-assistant/actions/workflows/ci.yml/badge.svg?style=for-the-badge)](https://github.com/migueljerico/github-ai-assistant/actions/workflows/ci.yml)
[![E2E](https://img.shields.io/github/actions/workflow/status/migueljerico/github-ai-assistant/e2e.yml?style=for-the-badge&label=E2E%20Tests&logo=playwright&logoColor=white)](https://github.com/migueljerico/github-ai-assistant/actions/workflows/e2e.yml)
[![Codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/graph/badge.svg?token=B1VDL0Y04G)](https://codecov.io/gh/migueljerico/github-ai-assistant)

> Asistente Zero-Storage para analizar, documentar y gestionar repositorios de GitHub mediante lenguaje natural.
>
> Proyecto de portfolio del curso de Análisis de Datos e Inteligencia Artificial (2026), construido en 2 meses por un profesional de negocio sin experiencia previa en programación.

---

## 🚀 App en producción

[![Ver App en Producción](https://img.shields.io/badge/Ver_App-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://github-ai-assistant-748914382449.us-central1.run.app/)

Conecta tu cuenta de GitHub mediante OAuth, elige tu proveedor de IA preferido y empieza a trabajar con tus repositorios en lenguaje natural.

> Tu token de GitHub y tus claves de IA viven únicamente en memoria durante la sesión. No se almacenan en localStorage, sessionStorage, cookies, IndexedDB ni en ningún servidor.

---

## 📸 Vista previa

![Vista previa del asistente de IA](./screenshots/Captura_Asistente_IA_Inicio.png)
![Conexión con GitHub](./screenshots/Captura_Asistente_IA_Conexión_GitHub.png)
![Interfaz principal](./screenshots/Captura_Asistente_IA_interfaz.png)
![Actualización](./screenshots/Captura_Asistente_IA_Actualización.png)

---

## 🎯 Qué hace

**GitHub AI Assistant** permite operar sobre GitHub como si estuvieras hablando con una persona.

En lugar de conocer endpoints, payloads, comandos Git o detalles de la GitHub REST API, escribes lo que quieres hacer en lenguaje natural y la aplicación:

1. Interpreta la intención mediante IA.
2. Propone una acción.
3. Muestra el plan al usuario.
4. Espera confirmación explícita.
5. Ejecuta la operación en GitHub.

Todo bajo el principio:

**Propón → Confirma → Ejecuta**

---

## ✨ Capacidades principales

- Chat en lenguaje natural con modos Auto, Opinión, Acción y Revisión.
- Multi-proveedor de IA con selección dinámica de modelos.
- Carga de contexto de repositorio para opiniones y acciones más fundamentadas.
- Adjuntado de archivos locales como contexto para el chat o la documentación.
- Documentación asistida de repositorios, archivos y documentos específicos.
- Publicación de documentación mediante commit directo, Draft PR o Release.
- Generación de changelog, resumen de hilos, salud del código y auditoría de seguridad.
- Historial de acciones, exportación e importación de conversación.
- Interfaz multilingüe, tema claro/oscuro y diseño accesible.

---

## 🧠 Proveedores de IA

La aplicación puede trabajar con múltiples proveedores:

- Google Gemini
- Groq Cloud
- NVIDIA NIM
- Zenmux
- OpenCode Zen
- Cloudflare Workers AI
- Ollama Cloud
- Kilo
- BazaarLink
- QwenCloud

---

## 🔐 Zero-Storage

El proyecto está diseñado para minimizar el almacenamiento de credenciales y datos sensibles.

- El token de GitHub vive en memoria durante la sesión.
- Las claves de proveedores de IA no se persisten en el navegador.
- No se usan cookies, localStorage, sessionStorage ni IndexedDB para credenciales.
- El backend actúa como proxy mínimo para OAuth y algunos proveedores de IA.

---

## 🧭 Empezar

Para instalar y ejecutar el proyecto en local, consulta la guía completa en [docs/INSTALACION.md](docs/INSTALACION.md).

```bash
git clone https://github.com/migueljerico/github-ai-assistant.git
cd github-ai-assistant
cp .env.example .env
npm install
npm run dev
```

---

## 📚 Documentación

| Documento | Contenido |
| --- | --- |
| [MANUAL_TECNICO.md](MANUAL_TECNICO.md) | Arquitectura, componentes y decisiones técnicas |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Diagramas y flujo principal |
| [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md) | Funcionalidades de producto |
| [docs/INSTALACION.md](docs/INSTALACION.md) | Instalación y configuración |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | Modelo de seguridad y Zero-Storage |
| [docs/TESTING_CALIDAD.md](docs/TESTING_CALIDAD.md) | Estrategia de pruebas y calidad |
| [docs/DESARROLLO_IA.md](docs/DESARROLLO_IA.md) | Proceso de desarrollo con IA |
| [docs/COMPARATIVA_COPILOT.md](docs/COMPARATIVA_COPILOT.md) | Comparativa con GitHub Copilot |
| [MEJORAS_FUTURAS.md](MEJORAS_FUTURAS.md) | Roadmap de mejoras pendientes |
| [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) | Historial de mejoras implementadas |
| [CHANGELOG.md](CHANGELOG.md) | Cambios por versión |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guía para contribuir |

---

## 🧪 Testing y calidad

El proyecto usa Vitest, Testing Library y Playwright, además de CI con GitHub Actions y Codecov.

```bash
cd client
npm run test:run
npm run test:coverage
```

Para pruebas del servidor:

```bash
npm run test:server
```

Para pruebas E2E:

```bash
npx playwright test
```

---

## 🤝 Contribuir

Si quieres contribuir, lee [CONTRIBUTING.md](CONTRIBUTING.md). El flujo recomendado es:

1. Crea una rama para el cambio.
2. Añade o actualiza tests cuando aplique.
3. Verifica lint, tests unitarios y E2E.
4. Abre un Pull Request describiendo el cambio.

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](./LICENSE).
