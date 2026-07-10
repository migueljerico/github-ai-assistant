# 🤖 GitHub AI Assistant

![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![GitHub OAuth](https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_Cloud-F55036?style=for-the-badge&logo=groq&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-6566F1?style=for-the-badge&logo=openai&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-Publicado-4CAF50?style=for-the-badge)
![Versión](https://img.shields.io/badge/Versión-v3.30.2-blue?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)
[![codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg)](https://codecov.io/gh/migueljerico/github-ai-assistant)


> **Asistente Zero-Storage para analizar, documentar y gestionar repositorios de GitHub mediante lenguaje natural.**
>
> Proyecto de portfolio del curso de **Análisis de Datos e Inteligencia Artificial (2026)**, construido en 30 días por un profesional de negocio sin experiencia previa en programación.

---

## 🚀 App en producción

[![Ver App en Producción](https://img.shields.io/badge/Ver_App-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://github-ai-assistant-748914382449.us-central1.run.app/)

Conecta tu cuenta de GitHub mediante OAuth, elige tu proveedor de IA preferido y empieza a trabajar con tus repositorios en lenguaje natural.

> Tu token de GitHub y tus claves de IA viven únicamente en memoria durante la sesión.  
> No se almacenan en `localStorage`, `sessionStorage`, cookies, IndexedDB ni en ningún servidor.

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

> **Propón → Confirma → Ejecuta**

---

## 📊 Métricas del proyecto

| Aspecto | Detalle |
|---|---|
| ⏱️ Tiempo de desarrollo | 30 días desde cero |
| 🤖 Proveedores soportados | Groq · Google Gemini · OpenRouter |
| 🧠 Modelos disponibles | Gemini, Llama, OpenAI, Claude y otros vía OpenRouter |
| ⚡ Latencia observada | ~400ms Groq / ~1.2s Gemini, variable según modelo y contexto |
| 🛡️ Seguridad | Zero-Storage: credenciales solo en memoria React |
| 🧪 Tests | 504 tests automatizados |
| 🌍 Deploy | Google Cloud Run |
| 📦 Stack | React + TypeScript + Express + Vite |

---

## ✨ Funcionalidades principales

| Área | Qué permite hacer |
|---|---|
| 💬 Lenguaje natural | Pedir acciones sobre GitHub sin conocer la API |
| ✅ Confirmación segura | Toda escritura requiere revisión y aprobación |
| 🗂️ Multi-repo | Aplicar acciones a varios repositorios |
| 🤖 Documentación automática | Generar README + MANUAL_TECNICO |
| 📤 Publicación | Commit directo, Draft PR o GitHub Release |
| 📎 Archivos locales | Analizar PDF, DOCX, Excel/CSV, Power BI y texto/código |
| 📝 Issues/PRs | Resumir hilos con TL;DR, decisiones y pendientes |
| 📋 Changelog | Generar changelog desde commits recientes o desde el último release |
| 📊 Salud del código | Dashboard con lenguajes, commits y deuda técnica |
| 🌐 i18n | Interfaz bilingüe ES/EN |
| 🔑 Multi-proveedor IA | Groq, Gemini y OpenRouter con clave del usuario |

Más detalle en ./docs/FUNCIONALIDADES.md.

---

## 🆚 Diferencia frente a GitHub Copilot

GitHub Copilot es excelente como copiloto de código dentro del editor.

GitHub AI Assistant cubre otro terreno:

> **Operar, analizar, documentar y publicar proyectos de GitHub mediante lenguaje natural.**

La ventaja diferencial no es “hacer lo mismo gratis”, sino ser un asistente abierto, autoalojable, multi-proveedor y orientado a operaciones de GitHub con confirmación previa.

Ver comparativa completa en ./docs/COMPARATIVA_COPILOT.md.

---

## 🏗️ Arquitectura resumida

```text
Usuario
  ↓ lenguaje natural

Frontend React + TypeScript + Vite
  ├── GitHub API directa
  ├── Groq directo
  ├── OpenRouter directo
  └── Gemini vía proxy Express

Backend Express thin
  ├── OAuth GitHub
  ├── Proxy Gemini
  ├── Rate limiting
  └── Health check
```

El backend es intencionalmente mínimo: gestiona OAuth, sirve el frontend en producción y actúa como proxy para Gemini por las restricciones regionales de la API en navegadores de la UE/EEA.

Ver arquitectura completa en ./docs/ARQUITECTURA.md.

---

## 🧱 Estructura del proyecto

```text
github-ai-assistant/
├── client/
│   ├── src/
│   │   ├── components/        # Componentes React de UI
│   │   ├── context/           # Contextos globales: auth, IA, historial, idioma
│   │   ├── hooks/             # Hooks reutilizables
│   │   ├── prompts/           # System prompts en Markdown
│   │   ├── services/          # GitHub API, IA, acciones, publicación
│   │   ├── types/             # Tipos TypeScript compartidos
│   │   ├── utils/             # Utilidades puras y testeables
│   │   ├── App.tsx            # Orquestación principal de la interfaz
│   │   └── main.tsx           # Entrada del frontend
│   ├── package.json
│   └── vite.config.ts
│
├── server/
│   └── index.js               # Backend Express: OAuth, proxy Gemini, health check
│
├── docs/
│   ├── FUNCIONALIDADES.md
│   ├── COMPARATIVA_COPILOT.md
│   ├── INSTALACION.md
│   ├── ARQUITECTURA.md
│   ├── SEGURIDAD.md
│   ├── TESTING_CALIDAD.md
│   └── DESARROLLO_IA.md
│
├── CHANGELOG.md               # Historial versionado del proyecto
├── MANUAL_TECNICO.md          # Documentación técnica extendida
├── MEJORAS_FUTURAS.md         # Roadmap y sprints pendientes
├── METODOLOGIA_IA.md          # Metodología humano ↔ IA
├── CLAUDE.md                  # Memoria operativa para agentes IA
├── Dockerfile                 # Build multi-stage para Cloud Run
├── package.json               # Scripts raíz y servidor
├── package-lock.json
├── .env.example
└── README.md
```

---

## 🔒 Seguridad

El proyecto sigue una arquitectura **Zero-Storage**:

- El token de GitHub vive solo en memoria React.
- Las claves de IA viven solo en memoria React.
- No hay persistencia automática de credenciales.
- Las acciones de escritura se confirman antes de ejecutar.
- OAuth usa `state` anti-CSRF generado con CSPRNG.
- El proxy Gemini tiene rate limiting.
- Los endpoints propuestos por IA se validan antes de ejecutar.

Ver detalle en ./docs/SEGURIDAD.md.

---

## 🧪 Testing y calidad

El proyecto usa **Vitest**, **React Testing Library**, **GitHub Actions** y **Codecov**.

- **504 tests automatizados**
- Tests unitarios, integración y componentes
- Tests del servidor
- CI con lint + tests + cobertura
- CD hacia Cloud Run

Ver detalle en ./docs/TESTING_CALIDAD.md.

---

## 🛠️ Stack tecnológico

| Tecnología | Uso |
|---|---|
| React 18 + TypeScript | Interfaz, estado y componentes |
| Vite | Bundler y entorno de desarrollo |
| Express.js | OAuth, proxy Gemini y servidor de producción |
| GitHub REST API v3 | Operaciones sobre repositorios |
| Groq Cloud | Inferencia rápida |
| Google Gemini | Modelo de IA vía proxy |
| OpenRouter | Pasarela a múltiples modelos |
| Recharts | Dashboard de salud del código |
| Vitest | Testing |
| Codecov | Cobertura |
| Docker | Build de producción |
| Google Cloud Run | Despliegue serverless |

---

## ⚙️ Instalación local

Ver guía completa en ./docs/INSTALACION.md.

Resumen rápido:

```bash
npm install
cd client && npm install && cd ..
cp .env.example .env
npm run dev
```

Abre:

```text
http://localhost:5173
```

---

## 🧠 Desarrollo asistido por IA

Este proyecto fue construido con un flujo humano ↔ IA basado en validación cruzada, revisión crítica y dogfooding.

- **Claude / Claude Code:** arquitectura, revisión crítica, implementación asistida y documentación.
- **Antigravity 2.0:** construcción inicial agéntica de la versión full-stack.
- **ZCode / step-3.7-flash-free (GLM-5.2):** cierre de versiones, build, sincronización de documentación y release desde v3.25.0.
- **GLM-5.2 (web, Zhipu):** i18n Fase 1 (v3.20.0) y tareas puntuales previas.
- **Gemini, Gemma, DeepSeek, Qwen y otros modelos:** revisión de arquitectura, propuestas de mejora y contraste técnico.
- **Nemotron 3 Super 120B (NVIDIA, vía OpenRouter):** validación cruzada en Z.ai — sugirió incluir el deploy automático de Cloud Run en la rutina de cierre y corregir la regla de oro (commit → push → tag → release → deploy) en `CLAUDE.md`.
- **Tencent HY3 (OpenRouter):** retomó el proyecto y cerró **#57 (v3.27.0)**: unificó la UI de documentación en un único flujo stepper (4 pasos: alcance → generar → revisar → destino + método), fusionando los botones divergentes "Documentar repo" y "Documentar y publicar" y eliminando `DocModal`/`FilePublishModal`. Previamente, por dogfooding (06/07), había aportado la poda de #33 (revisores) y #35 (auto-labels); validado por el autor y confirmado.
- **GLM-5.2 (builtin:zai-coding-plan/GLM-5.2):** cerró **#50 y #51 (v3.28.0)** — presupuesto de contexto adaptativo por proveedor (Groq free con TPM bajo: 6 archivos/60 líneas frente a 12/80), reintento automático con menos contexto ante error de TPM/context-length, fix del mensaje de error duplicado y bloque plegable "Archivos consultados para esta respuesta" que hace transparente el `contextRanker`.
- **Microsoft 365 Copilot — GPT-5 Razonamiento:** revisión editorial del README, propuesta de modularización documental y reestructuración de la documentación en archivos separados.

Además, el proyecto se desarrolló aplicando **dogfooding**: la propia app se usó para cargar y analizar el repositorio `github-ai-assistant`, revisar su arquitectura, detectar límites reales de contexto, contrastar propuestas entre modelos y generar nuevas mejoras del roadmap.

Ver detalle en ./docs/DESARROLLO_IA.md.

Ninguna salida de IA se tomó como verdad absoluta. Cada propuesta se revisó contra los principios del proyecto:

- Zero-Storage.
- Confirmación previa.
- Mantenibilidad.
- Testing.
- Coherencia arquitectónica.
- Claridad para usuarios no técnicos.
- Valor real como portfolio profesional.

La reorganización documental del proyecto separa el README principal —más breve y orientado a impacto— de la documentación extendida:

```text
docs/
├── FUNCIONALIDADES.md
├── COMPARATIVA_COPILOT.md
├── INSTALACION.md
├── ARQUITECTURA.md
├── SEGURIDAD.md
├── TESTING_CALIDAD.md
└── DESARROLLO_IA.md
```

Ver proceso completo en ./docs/DESARROLLO_IA.md y ./METODOLOGIA_IA.md.


---

## 📚 Contexto formativo

Este proyecto forma parte del programa de formación en **Análisis de Datos e Inteligencia Artificial (INAEM, 2026)**.

El objetivo fue explorar cómo una persona sin experiencia previa en programación puede construir una aplicación full-stack real utilizando IA como acelerador, manteniendo criterios de arquitectura, seguridad, testing, documentación y despliegue.

> *“No soy ingeniero de software. Soy un profesional de negocio que ha aprendido a construir productos de IA pensando como un ingeniero.”*

---

## 🔮 Roadmap

Ver ./MEJORAS_FUTURAS.md.

---

<p align="center">
Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> con asistencia de IA, validación cruzada y revisión crítica · 2026
</p>
