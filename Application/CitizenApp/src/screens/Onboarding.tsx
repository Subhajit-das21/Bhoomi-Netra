import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Counter from '../components/ui/Counter';
import Field, { Choice, type Option } from '../components/ui/Field';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { startingProfile, useHousehold } from '../state/HouseholdProvider';
import { timeAgo } from '../domain/geo';
import type { HouseholdProfile, Language, Tenure } from '../domain/types';

/**
 * The questions, asked once.
 *
 * A full screen rather than a dialog over the feed. A modal says "deal with this
 * to get back to what you were doing"; this is the first thing the app does, and
 * five steps of typing behind a scrim with a live alert feed showing through it
 * would be both harder to read and a lie about which one matters.
 *
 * ------------------------------------------------------------------
 * Nothing here is required
 * ------------------------------------------------------------------
 * Every field can be left empty, and the whole flow has an exit on the first
 * step. Forcing somebody to hand over their address before a safety app will show
 * them a flood warning is indefensible — the app has to run without any of this,
 * degraded to guessing, which is exactly what it did before this screen existed.
 *
 * From step two onward the exit becomes "Save what I have" instead of "Not now",
 * because the migration is right that a household which gave its ward and no
 * address is more use to a rescue team than one that abandoned the form. Throwing
 * away four answered steps to leave is the wrong default.
 *
 * ------------------------------------------------------------------
 * Why the counts are asked one at a time
 * ------------------------------------------------------------------
 * Elderly, infants, pregnant, needs-assistance and non-swimmers each count the
 * same people over again, and `households_counts_fit` caps each at `people`
 * rather than capping their sum. An eighty-year-old who cannot swim belongs in
 * two lines, and a form that made them pick one would quietly under-report the
 * person most likely to drown. The copy on step four says so, because a user who
 * is not told will assume the columns add up and answer wrongly.
 *
 * "Step 3 of 5" is the one numbered marker in this app. It is here because these
 * steps really are sequential and somebody deciding whether to start needs to
 * know how long it is — not as decoration above a heading.
 */

/** Each in its own script, so somebody who cannot read English can find theirs. */
const LANGUAGES: readonly Option<Language>[] = [
  { value: 'bn', label: 'বাংলা', detail: 'Bengali' },
  { value: 'hi', label: 'हिन्दी', detail: 'Hindi' },
  { value: 'en', label: 'English', detail: 'ইংরেজি / अंग्रेज़ी' },
];
const TENURES: readonly Option<Tenure>[] = [
  { value: 'own', label: 'We own it' },
  { value: 'rent', label: 'We rent it' },
  {
    value: 'other',
    label: 'Something else',
    detail: 'Staying with family, staff quarters, or no fixed home',
  },
];

const STEPS = 5;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * When a restored profile was last confirmed.
 *
 * `timeAgo` under a week, a calendar date after it. "243 days ago" is arithmetic
 * somebody has to do in their head to work out whether these details are stale;
 * "12 January 2026" is the same fact already resolved, and an eight-month-old
 * profile reads eight months old at a glance.
 */
function savedWhen(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'at some point';
  if (Date.now() - then < 7 * 86_400_000) return timeAgo(iso);
  const d = new Date(then);
  return `on ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Onboarding() {
  const state = useHousehold();
  const { household, restorable, identityIsDurable, save, decline } = state;

  const [draft, setDraft] = useState<HouseholdProfile>(() => startingProfile(state));
  const [step, setStep] = useState(1);
  /** Set by the first answer. Stops a late restore probe reopening the offer. */
  const [started, setStarted] = useState(false);
  const [offerHandled, setOfferHandled] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = household !== null;

  function set<K extends keyof HouseholdProfile>(
    key: K,
    value: HouseholdProfile[K],
  ) {
    setStarted(true);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  /**
   * Lowering the household size lowers every count with it.
   *
   * The counters clamp what they are handed, but a value already above a newly
   * lowered ceiling would sit there untouched — and `households_counts_fit` would
   * reject the save on the last tap, after five steps, with nothing on screen
   * explaining which line was wrong.
   */
  function setPeople(people: number) {
    setStarted(true);
    setDraft((d) => ({
      ...d,
      people,
      elderly: Math.min(d.elderly, people),
      infants: Math.min(d.infants, people),
      pregnant: Math.min(d.pregnant, people),
      needs_assistance: Math.min(d.needs_assistance, people),
      non_swimmers: Math.min(d.non_swimmers, people),
    }));
  }

  /**
   * Takes the profile rather than reading `draft`, because the restore offer
   * saves a profile it has only just put into state and would otherwise write the
   * value this render closed over — an empty one.
   */
  async function finish(profile: HouseholdProfile = draft) {
    setSaving(true);
    // Resolves after the network attempt, but the local write and the gate flip
    // happen first — so this screen is gone long before Supabase answers.
    await save(profile);
  }

  if (restorable && !offerHandled && !started) {
    return (
      <RestoreOffer
        profile={restorable.profile}
        confirmedAt={restorable.updated_at}
        busy={saving}
        onAccept={() => {
          setOfferHandled(true);
          void finish(restorable.profile);
        }}
        onReview={() => {
          setDraft(restorable.profile);
          setOfferHandled(true);
        }}
      />
    );
  }

  const last = step === STEPS;

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        // Android resizes the window itself under Expo's default softwareKeyboard
        // setting, so padding here would double-count and leave a dead strip.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="px-4 pt-2 pb-3">
          <View className="flex-row items-center justify-between mb-3">
            {step > 1 ? (
              <Button
                label="Back"
                variant="quiet"
                block={false}
                onPress={() => setStep(step - 1)}
              />
            ) : (
              <Button
                label={editing ? 'Cancel' : 'Not now'}
                variant="quiet"
                block={false}
                onPress={decline}
              />
            )}
            <Data className="text-micro text-ink-soft">
              Step {step} of {STEPS}
            </Data>
          </View>
          <Progress step={step} />
        </View>

        <ScrollView
          className="flex-1"
          // Without this the first tap on Continue only dismisses the keyboard,
          // which reads as a dead button.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View className="px-4">
            {step === 1 ? (
              <StepConsent
                value={draft.language}
                onChange={(v) => set('language', v)}
                durable={identityIsDurable}
                editing={editing}
              />
            ) : null}

            {step === 2 ? <StepWhere draft={draft} set={set} /> : null}

            {step === 3 ? (
              <StepPeople draft={draft} set={set} setPeople={setPeople} />
            ) : null}

            {step === 4 ? <StepNeeds draft={draft} set={set} /> : null}

            {step === 5 ? <StepAdvice draft={draft} set={set} /> : null}
          </View>
        </ScrollView>

        {/* pb-6 rather than pb-4: there is no tab bar under this screen, so the
            footer sits directly above the system gesture area. Same pad BottomNav
            uses for the same reason. */}
        <View className="px-4 pt-3 pb-6 border-t border-paper-deep">
          <Button
            label={last ? 'Save these details' : 'Continue'}
            disabled={saving}
            onPress={() => (last ? void finish() : setStep(step + 1))}
          />
          {!last && step > 1 ? (
            <View className="mt-2">
              <Button
                label="Save what I have"
                variant="quiet"
                disabled={saving}
                onPress={() => void finish()}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Progress as fill weight, not a coloured bar.
 *
 * The same device severity uses: a hairline for what has not happened yet, a
 * thicker rule for where you are, ink-soft for what is done. It survives
 * greyscale and sunlight, and it does not spend an accent colour on something as
 * unimportant as which of five steps this is.
 */
function Progress({ step }: { step: number }) {
  return (
    <View className="flex-row items-end">
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          className={`flex-1 rounded-sm ${i > 0 ? 'ml-1' : ''} ${
            i + 1 < step
              ? 'h-[2px] bg-ink-soft'
              : i + 1 === step
                ? 'h-[4px] bg-ink'
                : 'h-[1px] bg-paper-deep'
          }`}
        />
      ))}
    </View>
  );
}
/** Writes one field of the draft. Generic so a `Tenure` cannot land in `ward`. */
type Setter = <K extends keyof HouseholdProfile>(
  key: K,
  value: HouseholdProfile[K],
) => void;

/** The question at the top of a step. One per screen, phrased as a question. */
function Ask({ title }: { title: string }) {
  return <Display className="text-headline text-ink mb-3">{title}</Display>;
}

function StepConsent({
  value,
  onChange,
  durable,
  editing,
}: {
  value: Language;
  onChange: (value: Language) => void;
  durable: boolean;
  editing: boolean;
}) {
  return (
    <View>
      <Ask title={editing ? 'Check your details' : 'Who is in your house?'} />

      <Body className="text-body text-ink leading-6 mb-3">
        When water rises, a rescue team works from a list. If your house is on it
        they know how many people to plan for and who cannot walk out unaided. If
        it is not, they knock and hope.
      </Body>
      <Body className="text-body text-ink leading-6 mb-5">
        Five short steps, and every line is optional — answer what you like and
        leave the rest. The app works without any of this. It just has to guess.
      </Body>

      <Choice
        label="Which language do you read?"
        options={LANGUAGES}
        value={value}
        onChange={onChange}
        help="Changes the app to that language as well as telling the district which one to write and call in. Alerts, the SOS screen and the walking directions are translated; Settings and these questions stay in English."
      />

      <View className="border-t border-paper-deep pt-3 mt-1">
        <Subhead className="text-meta text-ink mb-1">What happens to this</Subhead>
        <Body className="text-meta text-ink-soft leading-5">
          Kept on this phone and with the district authority. Not sold, not shared
          with anyone else, and deleted after two years unless you look at it
          again. You can change or delete it from Settings whenever you like.
        </Body>
        {!durable ? (
          <Body className="text-meta text-high leading-5 mt-2">
            This phone will not give the app a lasting identity, so these answers
            will not come back if you reinstall it. Everything else works normally.
          </Body>
        ) : null}
      </View>
    </View>
  );
}
function StepWhere({ draft, set }: { draft: HouseholdProfile; set: Setter }) {
  return (
    <View>
      <Ask title="Where should help go?" />

      <Field
        label="Name of one adult here"
        value={draft.contact_name ?? ''}
        onChangeText={(t) => set('contact_name', t)}
        placeholder="e.g. Ruma Das"
        autoCapitalize="words"
        help="So a responder can ask for someone by name at the door instead of shouting."
      />

      <Field
        label="Ward number"
        value={draft.ward ?? ''}
        onChangeText={(t) => set('ward', t)}
        placeholder="e.g. 58"
        keyboardType="number-pad"
        maxLength={4}
        help="Alerts are ranked by ward, which makes this the most useful line on the form."
      />

      <Field
        label="Address"
        value={draft.address ?? ''}
        onChangeText={(t) => set('address', t)}
        multiline
        placeholder="House, lane, nearest landmark"
        autoCapitalize="sentences"
        help="Plain directions beat a map pin. Write it the way you would tell a neighbour, not the way a form wants it."
      />
    </View>
  );
}

function StepPeople({
  draft,
  set,
  setPeople,
}: {
  draft: HouseholdProfile;
  set: Setter;
  setPeople: (people: number) => void;
}) {
  return (
    <View>
      <Ask title="Who lives here?" />

      <Counter
        label="People in the house"
        help="Everyone who sleeps here tonight, children included."
        value={draft.people}
        onChange={setPeople}
        min={1}
        max={60}
      />

      <View className="mt-5">
        <Choice
          label="Is the house yours?"
          options={TENURES}
          value={draft.tenure}
          onChange={(v) => set('tenure', v)}
          help="It tells the district who has a house to return to once the water drops. It changes what help you are offered, never whether you get any."
        />
      </View>
    </View>
  );
}
function StepNeeds({ draft, set }: { draft: HouseholdProfile; set: Setter }) {
  const { people } = draft;

  return (
    <View>
      <Ask title="Who would need help getting out?" />

      <Body className="text-body text-ink leading-6 mb-4">
        These lines count the same {people}{' '}
        {people === 1 ? 'person' : 'people'} over again, so they are not meant to
        add up. Someone over sixty who also cannot swim belongs in two of them.
        Count them in both.
      </Body>

      <Counter
        label="Aged 60 or over"
        help="Slower on a flooded road, and first onto a boat."
        value={draft.elderly}
        onChange={(v) => set('elderly', v)}
        max={people}
      />
      <Counter
        label="Under two years old"
        help="Carried, not walked. It changes which shelter is right."
        value={draft.infants}
        onChange={(v) => set('infants', v)}
        max={people}
      />
      <Counter
        label="Pregnant"
        value={draft.pregnant}
        onChange={(v) => set('pregnant', v)}
        max={people}
      />
      <Counter
        label="Cannot leave the house unaided"
        help="A wheelchair, a stretcher, or anyone who cannot manage stairs alone."
        value={draft.needs_assistance}
        onChange={(v) => set('needs_assistance', v)}
        max={people}
      />

      <Body className="text-micro text-ink-soft leading-4 mt-3">
        {people === 1
          ? 'One person lives here, so every line above is 0 or 1. Go back a step to change that.'
          : `Each line stops at ${people}, the number you gave a step ago.`}
      </Body>
    </View>
  );
}
function StepAdvice({ draft, set }: { draft: HouseholdProfile; set: Setter }) {
  return (
    <View>
      <Ask title="Two things that change the advice" />

      <Counter
        label="Cannot swim"
        help="Above zero, nobody here is told to wade a flooded lane, however short the route looks."
        value={draft.non_swimmers}
        onChange={(v) => set('non_swimmers', v)}
        max={draft.people}
      />

      <View className="mt-5">
        <Field
          label="Animals here"
          value={draft.livestock ?? ''}
          onChangeText={(t) => set('livestock', t)}
          placeholder="e.g. 2 goats, 6 hens"
          help="People die refusing to leave animals behind. Told about them, a plan can include them instead of arguing at the door."
        />
      </View>
    </View>
  );
}

/**
 * "We still have your details."
 *
 * Shown after a reinstall, when the store is empty but the server had a row for
 * this handset. It lists what it found rather than asking for blind trust — a
 * button that says "use these details" without showing them is asking somebody to
 * confirm an address they cannot see.
 *
 * The date is the point of the panel. An eight-month-old profile should look
 * eight months old, because the household may have moved, grown, or buried
 * somebody since, and confirming it unread is worse than typing it again.
 */
function RestoreOffer({
  profile,
  confirmedAt,
  busy,
  onAccept,
  onReview,
}: {
  profile: HouseholdProfile;
  confirmedAt: string;
  busy: boolean;
  onAccept: () => void;
  onReview: () => void;
}) {
  const summary = [
    profile.contact_name,
    profile.ward ? `Ward ${profile.ward}` : null,
    `${profile.people} ${profile.people === 1 ? 'person' : 'people'} in the house`,
    profile.address,
  ].filter((line): line is string => !!line);
  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 pt-4">
          <Display className="text-headline text-ink">
            We still have your details
          </Display>
          <Data className="text-meta text-ink-soft mt-1.5">
            Last confirmed {savedWhen(confirmedAt)}
          </Data>

          <Body className="text-body text-ink leading-6 mt-4">
            This phone had a household profile on the district's records, and it is
            still there. You do not have to type it again.
          </Body>

          <View className="bg-paper-deep rounded-md px-4 py-3 mt-4">
            {summary.map((line, i) => (
              <Body
                key={i}
                className={`text-body text-ink leading-6 ${i > 0 ? 'mt-0.5' : ''}`}
              >
                {line}
              </Body>
            ))}
          </View>

          <Body className="text-meta text-ink-soft leading-5 mt-4">
            Go through the questions if any of it has changed, or if this phone is
            not yours — answering again replaces what is above.
          </Body>
        </View>
      </ScrollView>

      <View className="px-4 pt-3 pb-6 border-t border-paper-deep">
        <Button label="Use these details" disabled={busy} onPress={onAccept} />
        <View className="mt-2">
          <Button
            label="Go through the questions"
            variant="secondary"
            disabled={busy}
            onPress={onReview}
          />
        </View>
      </View>
    </Screen>
  );
}
