/**
 * BHOOMI-NETRA Citizen — design tokens (single source of truth).
 *
 * Plain CommonJS so tailwind.config.js (Node) and the TS app can both read it.
 * Nothing here imports react-native; platform-dependent values live in type.ts.
 *
 * Palette rationale
 * -----------------
 * Drawn from Indian pigment traditions rather than SaaS blues: lime-wash cream
 * walls, geru (red oxide), haldi (turmeric ochre), terracotta, indigo dye.
 * `night` and `brand` are lifted verbatim from the BHOOMI-NETRA landing page
 * (--primary and --brand, converted from oklch) so the app and the web presence
 * are recognisably the same product.
 *
 * Severity is a heat ramp — indigo (cool, informational) to red oxide (hot,
 * life-threatening). No green anywhere: green reads "go" and this app never
 * tells anyone to go. All-clear uses a muted khaki olive instead.
 *
 * Every colour below is used only in roles verified at >= 4.5:1 WCAG contrast.
 * `brand` is 1.95:1 on paper and is therefore BANNED as text on paper — it is a
 * fill and a night-ground accent only. See severity.ts for the enforced pairings.
 */

const colors = {
  // Grounds
  paper: '#F3EADC', // lime-wash cream — the default ground
  'paper-deep': '#E7DAC6', // recessed surface, wells, disabled fields
  night: '#0F172B', // landing --primary — map, nav, SOS, critical takeover
  'night-soft': '#1B2740', // raised surface on a night ground

  // Ink
  ink: '#171310', // primary text on paper (15.49:1)
  'ink-soft': '#5A4F45', // secondary text on paper (6.67:1)

  // Severity heat ramp — matches the Supabase alerts.severity enum exactly
  low: '#34556E', // indigo — informational, monitor
  medium: '#85600F', // haldi ochre — prepare
  high: '#B54415', // terracotta — act now
  critical: '#A81B0D', // geru red oxide — leave now

  /**
   * A pre-blended 10% terracotta tint over paper, used as the `high` card
   * ground. Pre-blended rather than `bg-high/10` on purpose: Tailwind emits
   * modern `rgb(r g b / a)` syntax, which React Native's colour parser does not
   * accept, so the opacity-modifier form is a silent-failure risk.
   */
  'high-wash': '#EDD9C8',

  // Support
  brand: '#F98F3A', // landing --brand. Fills and night grounds ONLY, never text on paper.
  olive: '#55663A', // all-clear / stable
};

/** Corner radii. Deliberately restrained — this is a notice board, not a card kit. */
const radius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '14px',
  full: '9999px',
};

/**
 * Type scale. Larger than a typical mobile app at every step: this is read at
 * arm's length, outdoors, in a hurry, often by someone who is frightened.
 */
const fontSize = {
  micro: ['11px', '15px'],
  meta: ['13px', '18px'],
  body: ['16px', '24px'],
  'body-lg': ['18px', '27px'],
  title: ['22px', '27px'],
  headline: ['28px', '32px'],
  display: ['36px', '38px'],
  siren: ['46px', '46px'],
};

module.exports = { colors, radius, fontSize };
