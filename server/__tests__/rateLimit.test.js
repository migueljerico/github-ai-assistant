import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Crear app de prueba con rate limiter
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5, // 5 peticiones para testing
    message: { error: 'Rate limit exceeded' },
  });
  
  app.post('/api/test', limiter, (req, res) => {
    res.json({ success: true });
  });
  
  return app;
};

describe('Rate Limiting', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  it('debería permitir peticiones dentro del límite', async () => {
    const res = await request(app).post('/api/test').send({ data: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  
  it('debería bloquear peticiones que exceden el límite', async () => {
    // Hacer 6 peticiones (límite es 5)
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/test').send({ data: 'test' });
    }
    
    // La 6ª debería ser bloqueada
    const res = await request(app).post('/api/test').send({ data: 'test' });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Rate limit');
  });
});
