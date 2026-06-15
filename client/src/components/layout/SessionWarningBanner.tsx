// ────────────────────────────────────────────────────────────────────
// SessionWarningBanner — #13 advertencia de caducidad de sesión
//
// Muestra un banner amber no intrusivo cuando el token de GitHub o la clave
// de IA llevan más de WARN_AFTER_MS activos en memoria de React.
//
// ZERO-STORAGE: Reads timestamps from React context, NOT from sessionStorage.
//
// - No bloquea la UI — es UX defensiva, no enforcement
// - Revisión cada minuto via setInterval
// - Cada aviso se puede cerrar individualmente
// - El aviso de GitHub incluye botón "Reconectar" que lanza el flujo OAuth
// ────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAIProvider } from '../../context/AIProviderContext';

const WARN_AFTER = 8 * 60 * 60 * 1000; // 8 horas en ms
const CHECK_EVERY = 60_000; // comprobar cada minuto

type WarnType = 'github' | 'ai';

interface Warning {
  type: WarnType;
  label: string;
  hours: number;
}

export default function SessionWarningBanner() {
  const { isAuthenticated, connectedAt: ghConnectedAt, initiateOAuth } = useAuth();
  const { isConnected, connectedAt: aiConnectedAt } = useAIProvider();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [dismissed, setDismissed] = useState<Set<WarnType>>(new Set());

  const checkTTL = useCallback(() => {
    const now = Date.now();
    const next: Warning[] = [];

    if (isAuthenticated && ghConnectedAt) {
      const elapsed = now - ghConnectedAt;
      if (elapsed >= WARN_AFTER) {
        next.push({
          type: 'github',
          label: 'Token de GitHub',
          hours: Math.floor(elapsed / (60 * 60 * 1000)),
        });
      }
    }

    if (isConnected && aiConnectedAt) {
      const elapsed = now - aiConnectedAt;
      if (elapsed >= WARN_AFTER) {
        next.push({
          type: 'ai',
          label: 'Clave de IA',
          hours: Math.floor(elapsed / (60 * 60 * 1000)),
        });
      }
    }

    // Evitar re-renders innecesarios comparando por valor
    setWarnings(prev => {
      const same =
        prev.length === next.length &&
        prev.every((p, i) => p.type === next[i].type && p.hours === next[i].hours);
      return same ? prev : next;
    });
  }, [isAuthenticated, isConnected, ghConnectedAt, aiConnectedAt]);

  // Limpiar dismissed cuando el aviso desaparece (ej: usuario reconectó)
  useEffect(() => {
    setDismissed(prev => {
      const active = new Set(warnings.map(w => w.type));
      const cleaned = new Set([...prev].filter(t => active.has(t)));
      return cleaned.size === prev.size ? prev : cleaned;
    });
  }, [warnings]);

  useEffect(() => {
    checkTTL();
    const id = setInterval(checkTTL, CHECK_EVERY);
    return () => clearInterval(id);
  }, [checkTTL]);

  const visible = warnings.filter(w => !dismissed.has(w.type));
  if (visible.length === 0) return null;

  return (
    <div className="session-warning-bar">
      {visible.map(w => (
        <div key={w.type} className="session-warning-item">
          ⚠️ <strong>{w.label}</strong> lleva activo más de {w.hours}h.{
            ' '
          }
          {w.type === 'github'
            ? 'Reconecta para evitar errores inesperados con la API de GitHub.'
            : 'Considera volver a introducir tu clave de IA.'}
          {w.type === 'github' && (
            <button onClick={initiateOAuth} className="btn-link">
              Reconectar GitHub
            </button>
          )}
          <button
            onClick={() =>
              setDismissed(prev => new Set([...prev, w.type]))
            }
            aria-label={`Cerrar aviso de ${w.label}`}
            title="Cerrar aviso"
            className="btn-close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
