// Re-aumenta @testing-library/jest-dom sobre vitest 5 (#132, v4.0.49).
// En vitest 5, `Assertion` ahora requiere DOS parámetros genéricos (R, T)
// en vez de uno; la aumentación oficial de jest-dom 7.x no se fusiona con
// esta nueva firma y TS2339 revienta en cada `expect(...).toBeInTheDocument()`.
// `T` queda sin uso dentro del cuerpo de las interfaces (los matchers de
// jest-dom solo necesitan el genérico R); los `eslint-disable` selectivos
// son obligatorios porque la regla de "interface sin miembros == supertipo"
// rompe el patrón canónico de declaration merging de vitest.
import 'vitest';
import { type TestingLibraryMatchers as _TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'; // gitleaks:allow

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends _TestingLibraryMatchers<unknown, R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining
    extends _TestingLibraryMatchers<unknown, unknown> {}
}

export {};
