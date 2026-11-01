// OPTIONS (e2e/options.spec.ts): the one react-dom/server function the surface tests use. react-dom ships no types and
// no type package is installed (no new dependency); this declares just that signature.
declare module 'react-dom/server' {
  export function renderToStaticMarkup(element: import('react').ReactElement): string;
}
