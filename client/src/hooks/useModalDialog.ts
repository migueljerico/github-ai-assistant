import { useEffect, useRef } from 'react';

// ── useModalDialog (#39) ─────────────────────────────────────────────────────────
// Accesibilidad compartida por los modales (ConfirmModal, DocModal, FilePublishModal):
//   • cierre con `Esc`,
//   • focus-trap con `Tab`/`Shift+Tab` (el foco no escapa del diálogo),
//   • foco inicial dentro del modal y restaurado al elemento previo al cerrarse.
// Devuelve un `ref` que se ata al contenedor `.modal`. Patrón useEffect + useRef ya
// presente en el repo (p. ej. InstructionSuggestions.tsx).
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Mantener la última `onClose` sin re-suscribir el listener en cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Excluye controles ocultos (p. ej. los `<input type="file">` con display:none
    // de los modales de publicación) para que el trap no enfoque algo invisible.
    const isVisible = (el: HTMLElement) =>
      !el.hidden &&
      el.style.display !== 'none' &&
      el.style.visibility !== 'hidden' &&
      (el as HTMLInputElement).type !== 'hidden';

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);

    // Foco inicial: el primer elemento focusable, o el propio contenedor.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      node.tabIndex = -1;
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
