# 🤖 GitHub AI Assistant

![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![GitHub OAuth](https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_Cloud-F55036?style=for-the-badge&logo=groq&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-Publicado-4CAF50?style=for-the-badge)
![Versión](https://img.shields.io/badge/Versión-v2.1.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)
[![codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg)](https://codecov.io/gh/migueljerico/github-ai-assistant)

> **Proyecto de portfolio — Curso Análisis de Datos e IA (2025–2026)**
>
> Gestiona tus repositorios de GitHub escribiendo en lenguaje natural — con confirmación previa, historial de sesión y documentación automática, impulsado por **Groq Cloud** o **Google Gemini**.

**Asistente de IA que entiende tu código.** Se conecta a tus repos de GitHub, lee tu codebase y responde preguntas sobre tu proyecto — con una arquitectura de seguridad que protege tus credenciales.

> Construido en 30 días por un profesional de negocio sin experiencia previa en programación.

---

## 📊 Métricas del proyecto

| Aspecto | Detalle |
|---|---|
| ⏱️ Tiempo de desarrollo | 30 días (desde cero) |
| 🤖 Modelos soportados | Groq (Llama 3.3) + Gemini 2.5 Flash |
| ⚡ Latencia media | ~400ms (Groq) / ~1.2s (Gemini) |
| 🛡️ Seguridad | Token GitHub en memoria React; claves IA en sessionStorage |
| 🌍 Deploy | Google Cloud Run (HTTPS, auto-scaling) |
| 📦 Stack | React + TypeScript + Express + Vite |

---

## 🎯 ¿Qué hace este asistente?

A diferencia de un chatbot convencional, este asistente:

- ✅ **Lee tu código real** de cualquier repo de GitHub (público o privado)
- ✅ **Responde con contexto** de tu proyecto, no respuestas genéricas
- ✅ **Protege tu token de GitHub** con arquitectura de memoria React (anti-XSS)
- ✅ **Funciona con múltiples modelos** (Groq para velocidad, Gemini para calidad)
- ✅ **Documenta repositorios completos** generando README + MANUAL_TECNICO automáticamente

### Ejemplo de uso real:

> **Tú:** *"Lista mis repositorios privados"*
> 
> **Asistente:** *"Voy a consultar la API de GitHub... He encontrado 5 repositorios privados. ¿Quieres que te muestre los detalles de alguno en particular?"*

---

## 🔗 Acceso a la Aplicación

[![Ver App en Producción](https://img.shields.io/badge/Ver_App-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://github-ai-assistant-748914382449.us-central1.run.app/)

> Conecta tu cuenta de GitHub (OAuth) y tu proveedor de IA preferido para empezar.
> Tu token de GitHub **nunca sale de la memoria del navegador** — no se almacena en ningún servidor.

---

## 📋 Descripción del Proyecto

**GitHub AI Assistant** es una aplicación web conversacional de código abierto que actúa como capa de abstracción inteligente sobre la GitHub REST API v3. El usuario escribe sus intenciones en lenguaje natural — sin necesidad de conocer endpoints, payloads ni codificación Base64 — y el agente de IA las interpreta, propone la acción y espera confirmación antes de ejecutar.

El proyecto evolucionó de un prototipo en **Google AI Studio** a una aplicación full-stack completa, diseñada y construida íntegramente con asistencia de agentes de IA: **Claude** (Anthropic) como arquitecto y revisor, y **Antigravity 2.0** (Google) como entorno de desarrollo agéntico.

---

## ✨ Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 💬 **Chat en lenguaje natural** | Escribe instrucciones como "crea un repo público llamado mi-proyecto" y la IA las ejecuta |
| ✅ **Panel de confirmación** | Toda operación de escritura muestra lo que va a hacer y espera tu aprobación |
| 📋 **Historial de sesión** | Log exportable de todas las acciones con estado (✅ ❌ ⏸️ ⏳) |
| 📄 **Plantillas predefinidas** | README, `.gitignore` y licencias por tipo de proyecto, pre-formuladas para el chat |
| 🗂️ **Operaciones multi-repo** | Aplica la misma acción a varios repositorios seleccionados simultáneamente |
| 🤖 **Documenta tu repositorio entero** | El agente lee hasta 80 archivos y genera README + MANUAL_TECNICO de forma automática |
| 🔑 **Doble proveedor de IA** | Soporte para **Groq Cloud** y **Google Gemini 2.5 Flash** — usas tu propia clave |
| 🔒 **Autenticación OAuth** | Flujo GitHub OAuth completo con fallback a PAT manual |

---

## 🛠️ Proceso de Desarrollo — Cómo se construyó esta app

Este proyecto es el resultado de un proceso de desarrollo agéntico en múltiples fases, donde la IA no solo ejecutó código sino que tomó decisiones arquitectónicas.

### Fase 1 — Prototipo en Google AI Studio

La primera versión de la app fue construida directamente en **Google AI Studio**, configurando un agente de Gemini mediante ingeniería de prompts. Operaba como una caja negra: el usuario escribía una instrucción, el agente la ejecutaba directamente sobre la GitHub API sin confirmación previa. Autenticación solo por PAT. El resultado fue desplegado en **Google Cloud Run**.

### Fase 2 — Diseño arquitectónico con Claude (Anthropic)

Se inició una consultoría técnica con **Claude Sonnet** (claude.ai) para auditar el concepto y diseñar la arquitectura de la v2. Claude identificó los problemas críticos del prototipo (ausencia de confirmación previa, key de IA expuesta en servidor, sin historial) y propuso una arquitectura full-stack con:

- Backend Express **thin** (solo OAuth — la IA se llama desde el cliente)
- Panel de confirmación para operaciones de escritura
- Historial de sesión exportable
- Soporte dual Groq/Gemini con clave del usuario
- OAuth de GitHub

Claude también revisó el plan de implementación generado por Antigravity y detectó 8 problemas antes de que se escribiera una sola línea de código (incluyendo la exposición de la Gemini API key al frontend).

### Fase 3 — Construcción con Antigravity 2.0

La construcción del código se realizó con **Antigravity 2.0** (plataforma de desarrollo agéntico de Google, presentada en I/O 2026), usando **Claude** como modelo subyacente del agente. A partir del prompt maestro diseñado en la Fase 2, Antigravity generó la estructura completa del proyecto:
