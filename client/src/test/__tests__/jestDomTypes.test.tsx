// Test de regresión #132 (v4.0.49): shim de tipos para `@testing-library/jest-dom`
// sobre vitest 5. Sin este test, un cambio accidental en `client/src/test/jest-dom.d.ts`
// (o la aparición de un nuevo `expect(...).toBeInTheDocument()` que dejara de compilar)
// volvería a romper `tsc -b` con TS2339 sin que ningún test lo detectara.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Sample() {
  return <button data-testid="ok">ok</button>;
}

describe('jest-dom types (shim vitest 5) #132', () => {
  it('compila y resuelve toBeInTheDocument sobre Assertion<R, T>', () => {
    render(<Sample />);
    expect(screen.getByTestId('ok')).toBeInTheDocument();
    expect(screen.getByTestId('ok')).toHaveTextContent('ok');
    expect(screen.getByTestId('ok')).toHaveAttribute('data-testid', 'ok');
  });
});
