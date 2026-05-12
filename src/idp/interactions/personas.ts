/**
 * Theme tokens for known relying-party personas. Kept in sync with
 * `swirlock-chatbot-ui/src/app/core/personas/*.persona.ts` — only the
 * subset of tokens the IdP screens actually use is needed here.
 *
 * The persona id is bubbled in as a query parameter (`persona=<id>`)
 * on /authorize and /session/end requests. Unknown / missing persona
 * → DEFAULT_THEME.
 */
export interface PersonaTheme {
  bg: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  accentContrast: string;
}

const GIGI: PersonaTheme = {
  bg: '#262627',
  surface: '#1f1f20',
  surfaceElevated: '#2c2c2e',
  accent: '#f5b916',
  accentContrast: '#1a1a1b',
};

const GIGINA: PersonaTheme = {
  bg: '#262627',
  surface: '#1f1f20',
  surfaceElevated: '#2c2c2e',
  accent: '#ec5e9b',
  accentContrast: '#1a1a1b',
};

const PERSONAS: Record<string, PersonaTheme> = {
  'gigi-the-robot': GIGI,
  'gigina-robotina': GIGINA,
};

export const DEFAULT_THEME = GIGI;

export function resolveTheme(personaId: unknown): PersonaTheme {
  if (typeof personaId !== 'string') return DEFAULT_THEME;
  return PERSONAS[personaId] ?? DEFAULT_THEME;
}
