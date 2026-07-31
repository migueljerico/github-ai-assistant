import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Theme } from '../../context/ThemeContext';

/** #71 — Icono y etiqueta según el estado actual (lo que se muestra). */
const THEME_META: Record<Theme, { emoji: string; labelKey: string }> = {
  light: { emoji: '☀️', labelKey: 'header.theme.light' },
  dark: { emoji: '🌙', labelKey: 'header.theme.dark' },
  auto: { emoji: '🌓', labelKey: 'header.theme.auto' },
};

/**
 * #71 — Botón cíclico de tema: claro → oscuro → auto → claro…
 * Muestra el estado ACTUAL. Solo-icono en móvil (igual que el resto del header).
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const meta = THEME_META[theme];

  return (
    <button
      id="toggle-theme-btn"
      className="btn btn-ghost btn-sm"
      onClick={toggle}
      title={t(meta.labelKey)}
      aria-label={t('header.theme.toggle', { current: t(meta.labelKey) })}
    >
      {meta.emoji} <span className="btn-label">{t(meta.labelKey)}</span>
    </button>
  );
}
