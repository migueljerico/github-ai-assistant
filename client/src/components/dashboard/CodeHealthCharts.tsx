import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import type { CodeHealth } from '../../services/assistantActions';

// #44 — TODO el código de Recharts vive aquí; se carga en su PROPIO chunk vía
// React.lazy desde CodeHealthModal (import dinámico) para no engordar el bundle inicial.

const LANG_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#fb7185', '#94a3b8', '#cbd5e1'];

// Etiqueta de eje X compacta para fechas YYYY-MM-DD → DD/MM.
const shortWeek = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export default function CodeHealthCharts({ data }: { data: CodeHealth }) {
  const { languages, commits, debt } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Distribución de lenguajes */}
      <section>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>🗂️ Distribución de lenguajes</h3>
        {languages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No se reconocieron lenguajes en el árbol del repo.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, languages.length * 34)}>
            <BarChart data={languages} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="language" stroke="var(--text-muted)" fontSize={12} width={90} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
              <Bar dataKey="count" name="Archivos" radius={[0, 4, 4, 0]}>
                {languages.map((_, i) => <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Frecuencia de commits */}
      <section>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>📈 Commits por semana (últimas 12)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={commits} margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="weekStart" tickFormatter={shortWeek} stroke="var(--text-muted)" fontSize={11} />
            <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} labelFormatter={v => `Semana del ${shortWeek(String(v))}`} />
            <Bar dataKey="count" name="Commits" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Deuda técnica */}
      <section>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>
          🧹 Deuda técnica — {debt.total} marcador{debt.total !== 1 ? 'es' : ''} (TODO/FIXME/HACK/XXX)
        </h3>
        {debt.byFile.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin marcadores de deuda en los archivos analizados. 🎉</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, debt.byFile.length * 30)}>
            <BarChart data={debt.byFile} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="path" stroke="var(--text-muted)" fontSize={11} width={160} tickFormatter={(p: string) => p.split('/').pop() ?? p} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
              <Bar dataKey="count" name="Marcadores" fill="#fb7185" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
