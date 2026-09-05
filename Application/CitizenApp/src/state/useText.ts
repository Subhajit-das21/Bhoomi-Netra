import { useCallback, useMemo } from 'react';
import { t } from '../domain/i18n';
import { useHousehold } from './HouseholdProvider';
import type { Language } from '../domain/types';

/**
 * The language this phone reads, and one function for saying things in it.
 *
 * ------------------------------------------------------------------
 * Why the household holds the language
 * ------------------------------------------------------------------
 * There is no separate language setting, and adding one would be a worse app. The
 * onboarding flow already asks — it has to, because the district writes and calls
 * in whatever the household answered — so a second control would be a second
 * answer to the same question, and the two would disagree within a week.
 *
 * A phone with no profile reads English. That is not a guess about the reader; it
 * is the only thing the app knows, and it is why the language question sits on the
 * first onboarding step rather than the fifth.
 *
 * ------------------------------------------------------------------
 * Why `t` and not a component
 * ------------------------------------------------------------------
 * Half the strings on the critical path are not JSX. `directive`, `headline` and
 * `spokenSeverity` are pure functions in domain/, they end up in a notification
 * body and an accessibility label as well as on screen, and a <Trans> element
 * cannot go in either. So the unit is a string in, a string out, and the screens
 * pass `lang` down into the copy layer.
 */
export interface Text {
  lang: Language;
  /** `t('Leave now')`, or `t('Walk to {shelter}', { shelter: name })`. */
  t: (en: string, vars?: Record<string, string | number>) => string;
}

export function useText(): Text {
  const { household } = useHousehold();
  const lang = household?.profile.language ?? 'en';

  const bound = useCallback(
    (en: string, vars?: Record<string, string | number>) => t(lang, en, vars),
    [lang],
  );

  return useMemo(() => ({ lang, t: bound }), [lang, bound]);
}
