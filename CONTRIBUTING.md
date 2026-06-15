# 🤝 Guía de contribución

Gracias por tu interés en mejorar **GitHub AI Assistant**. Este documento complementa al [README.md](README.md) y se centra en el flujo de trabajo para desarrolladores: tests, integración continua y estándares de código.

> 💡 **Nota:** Para la configuración inicial del entorno local, instalación de dependencias y variables de entorno, consulta la sección `🚀 Inicio rápido` del [README.md](README.md) (incluyendo el uso de `.env.example`).

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

---
