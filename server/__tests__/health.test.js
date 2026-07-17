import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRequire } from 'node:module';

// #25-parte2 (v3.40.0): tests del healthcheck extendido en GET /health.
//
// Patrón: app aislada (como rateLimit.test.js) que reproduce la MISMA lógica
// de la ruta /health de server/index.js — sin importar index.js, que arrancaría
// el servidor entero. Si la lógica de /health cambia en index.js, debe cambiar
// aquí también (HEALTH_VARS y el shape del JSON).

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');
const HEALTH_VARS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET'];

// Réplica exacta del handler /health de server/index.js.
const createTestApp = () => {
  const app = express();
  app.get('/health', (_req, res) => {
    const env = {};
    for (const k of HEALTH_VARS) env[k] = Boolean(process.env[k]);
    res.status(200).json({
      status: 'ok',
      version: VERSION,
      uptime: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      env,
    });
  });
  return app;
};

// Snapshot de las vars críticas para restaurarlas tras cada test que las muta.
let envSnapshot;

describe('Health Check extendido (/health)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    envSnapshot = {};
    for (const k of HEALTH_VARS) envSnapshot[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of HEALTH_VARS) {
      if (envSnapshot[k] === undefined) delete process.env[k];
      else process.env[k] = envSnapshot[k];
    }
  });

  it('responde 200 con status:"ok" (compatibilidad con la sonda de Cloud Run)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('incluye la versión y coincide con package.json', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version.length).toBeGreaterThan(0);
    expect(res.body.version).toBe(VERSION);
  });

  it('uptime es un número >= 0 y crece entre dos llamadas', async () => {
    const res1 = await request(app).get('/health');
    // Pequeña espera para que process.uptime() avance de forma apreciable.
    await new Promise((r) => setTimeout(r, 50));
    const res2 = await request(app).get('/health');
    expect(typeof res1.body.uptime).toBe('number');
    expect(res1.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res2.body.uptime).toBeGreaterThan(res1.body.uptime);
  });

  it('timestamp es una fecha ISO 8601 válida (parseable y reciente)', async () => {
    const res = await request(app).get('/health');
    const ts = new Date(res.body.timestamp);
    expect(ts.toString()).not.toBe('Invalid Date');
    // Dentro de una ventana amplia de ±60s respecto al reloj del test.
    const now = Date.now();
    expect(Math.abs(now - ts.getTime())).toBeLessThan(60_000);
  });

  it('nodeVersion empieza por "v"', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.nodeVersion).toBe('string');
    expect(res.body.nodeVersion.startsWith('v')).toBe(true);
  });

  it('env contiene las 3 variables críticas y todas son booleanos', async () => {
    const res = await request(app).get('/health');
    expect(res.body.env).toBeDefined();
    for (const k of HEALTH_VARS) {
      expect(k in res.body.env).toBe(true);
      expect(typeof res.body.env[k]).toBe('boolean');
    }
  });

  it('reporta false cuando una variable crítica falta', async () => {
    // Forzamos ausencia de todas las críticas para un resultado determinista.
    for (const k of HEALTH_VARS) delete process.env[k];
    const res = await request(app).get('/health');
    expect(res.body.env.GITHUB_CLIENT_ID).toBe(false);
    expect(res.body.env.GITHUB_CLIENT_SECRET).toBe(false);
    expect(res.body.env.SESSION_SECRET).toBe(false);
  });

  it('reporta true cuando una variable crítica está presente', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-secret';
    process.env.SESSION_SECRET = 'test-session';
    const res = await request(app).get('/health');
    expect(res.body.env.GITHUB_CLIENT_ID).toBe(true);
    expect(res.body.env.GITHUB_CLIENT_SECRET).toBe(true);
    expect(res.body.env.SESSION_SECRET).toBe(true);
    // Aun presentes, el body no expone los valores reales.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('test-id');
    expect(body).not.toContain('test-secret');
    expect(body).not.toContain('test-session');
  });
});
