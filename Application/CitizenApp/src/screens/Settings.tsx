import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import {
  BellRing,
  CloudUpload,
  Languages,
  MapPin,
  Users,
  Vibrate,
  WifiOff,
} from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { useHousehold } from '../state/HouseholdProvider';
import { hasNotificationTransport } from '../services/alarm';
import { clockTime, timeAgo } from '../domain/geo';
import { LANGUAGE_LABEL, TRANSLATIONS_REVIEWED } from '../domain/i18n';
import { colors } from '../theme/tokens';
import type { HouseholdProfile } from '../domain/types';

/**
 * Settings, and an honest account of what this app can and cannot currently do.
 *
 * The notification row is the important one. expo-notifications is not installed
 * in this build, so push cannot be delivered — and the app says exactly that
 * rather than showing a toggle that implies a working channel. A safety tool that
 * overstates its reach is worse than one that admits a gap, because someone will
 * put their phone face-down trusting a push that is never coming.
 *
 * The connectivity switch is a review affordance, labelled as one. NetInfo is not
 * installed either, so there is nothing to detect with; flipping this is how the
 * offline, cached and stale states get exercised on a real device.
 *
 * The household group is the only place a saved or skipped profile can be reached
 * from. Without it, answering the questions once would be irreversible and
 * skipping them would be permanent — a form that can be neither reviewed nor
 * corrected is not consent, it is a one-way collection.
 *
 * This screen stays in English in every language, and the language group says so.
 * Machine-translating a settings screen costs nothing if it is wrong; machine-
 * translating "move to higher ground" is a different kind of mistake, which is why
 * the alert path is translated and carries a notice until somebody has read it.
 */
export default function Settings() {
  const {
    connected,
    setConnected,
    position,
    freshness,
    lastSyncAt,
    replayEscalation,
  } = useCitizen();

  const pushReady = hasNotificationTransport();

  return (
    <Screen>
      <View className="px-4 pt-2 pb-3">
        <Display className="text-title text-ink">Settings</Display>
        <Data className="text-micro text-ink-soft mt-0.5">
          BHOOMI-NETRA citizen alerts
        </Data>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <Group title="Alerts">
          <Row
            icon={BellRing}
            title="Push notifications"
            detail={
              pushReady
                ? 'On. Critical alerts for your ward will reach you with the screen off.'
                : 'Not available in this build. You will only be alerted while the app is open.'
            }
            right={
              <Chip
                label={pushReady ? 'On' : 'Unavailable'}
                fill={pushReady ? 'bg-olive' : 'bg-medium'}
                text="text-paper"
              />
            }
          />

          <Row
            icon={Vibrate}
            title="Vibration for critical alerts"
            detail="On, and not switchable. A critical alert for the zone you are standing in is the one thing this app will not let you silence."
          />

          <View className="pt-3">
            <Button
              label="Test a critical alert"
              variant="secondary"
              onPress={replayEscalation}
            />
            <Body className="text-micro text-ink-soft mt-2 leading-4">
              Plays the real vibration pattern and opens the takeover screen, so
              you know what it looks like before it matters.
            </Body>
          </View>
        </Group>

        <HouseholdGroup />

        <LanguageGroup />

        <Group title="Location">
          <Row
            icon={MapPin}
            title={position.locality}
            detail={`${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)} — accurate to ${position.accuracyMetres} m. Fix taken ${clockTime(position.takenAt)}.`}
          />
        </Group>

        <Group title="Connection">
          <Row
            icon={WifiOff}
            title="Simulate no signal"
            detail={`Review affordance, not a real setting. Turn it on to see how the app behaves offline. Data is currently ${freshness}, last fetched ${clockTime(lastSyncAt)}.`}
            right={
              <Switch
                value={!connected}
                onValueChange={(v) => setConnected(!v)}
                accessibilityLabel="Simulate no signal"
                trackColor={{ false: colors['paper-deep'], true: colors.high }}
                thumbColor={colors.paper}
                ios_backgroundColor={colors['paper-deep']}
              />
            }
          />
        </Group>

        <Group title="About">
          <Body className="text-body text-ink leading-6">
            BHOOMI-NETRA watches river levels, rainfall, temperature, smoke and
            flame from sensor nodes across the district and warns the people
            nearest to a hazard first.
          </Body>
          <Body className="text-body text-ink leading-6 mt-3">
            It is not a substitute for emergency services. For anything happening
            right now, call 112.
          </Body>
          <Data className="text-micro text-ink-soft mt-4 leading-4">
            Sensor data from the district node network. Zone boundaries and
            shelter status are set by the district authority.
          </Data>
        </Group>
      </ScrollView>
    </Screen>
  );
}

/**
 * Which language the app is speaking, and how far the translation reaches.
 *
 * The unreviewed notice is the reason this group exists at all. Bengali and Hindi
 * here were written by a machine, and evacuation copy translated by a machine can
 * be wrong in the one direction that matters — a mistranslated "do not wade" reads
 * as permission. Until a native speaker signs the dictionaries off, a reader is
 * owed that fact in the language they chose and in English, next to the switch that
 * turned it on. `TRANSLATIONS_REVIEWED` in domain/i18n.ts removes this notice.
 *
 * Deliberately not a second language picker. Onboarding already asks, and a
 * setting here would be a second answer to the same question — two places to
 * change it, one of which would be stale within a week. The button goes to the one
 * that exists.
 */
function LanguageGroup() {
  const { household, edit } = useHousehold();
  const lang = household?.profile.language ?? 'en';

  return (
    <Group title="Language">
      <Row
        icon={Languages}
        title={LANGUAGE_LABEL[lang]}
        detail={
          lang === 'en'
            ? 'Alerts, the SOS screen and the walking directions can be read in Bengali or Hindi. This screen and the household questions stay in English.'
            : 'Alerts, the SOS screen and the walking directions are in this language. This screen and the household questions stay in English.'
        }
      />

      {lang !== 'en' && !TRANSLATIONS_REVIEWED ? (
        <View className="flex-row bg-high-wash rounded-md overflow-hidden mb-3">
          <View className="w-1.5 self-stretch bg-high" />
          <View className="flex-1 p-3">
            <Subhead className="text-meta text-ink">
              Not yet checked by a Bengali or Hindi speaker
            </Subhead>
            <Body className="text-meta text-ink mt-1 leading-5">
              These translations were written for this build and nobody has read
              them back against the English. If a warning reads oddly, trust the
              action and not the wording — switch to English to compare, and call
              112 if you are unsure.
            </Body>
          </View>
        </View>
      ) : null}

      <View className="pb-1">
        <Button
          label="Change the language"
          variant="secondary"
          onPress={edit}
        />
        <Body className="text-micro text-ink-soft mt-2 leading-4">
          It is the first of the household questions, so it is kept with the rest
          of your details — the district writes and calls in the same language.
        </Body>
      </View>
    </Group>
  );
}

/**
 * Your household: what is on record, whether the district has it, and the two
 * ways out of it.
 *
 * The sync chip is the load-bearing part. An unsynced profile still improves
 * shelter choice and still fills an SMS, because both of those happen on this
 * phone — but no control room can see it, and a tick next to a row Supabase never
 * received would be telling somebody they are on a rescue list they are not on.
 */
function HouseholdGroup() {
  const { household, retrySync, edit, forgetLocal } = useHousehold();
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  if (!household) {
    return (
      <Group title="Your household">
        <Row
          icon={Users}
          title="Not answered"
          detail="Nothing here tells the app who lives with you, so it assumes one person, no ward and nobody who needs help getting out. Five short steps changes that, and every line in them is optional."
        />
        <View className="pb-2">
          <Button
            label="Answer the household questions"
            variant="secondary"
            onPress={edit}
          />
        </View>
      </Group>
    );
  }

  const { profile, synced } = household;
  const who = [
    `${profile.people} ${profile.people === 1 ? 'person' : 'people'}`,
    profile.ward ? `ward ${profile.ward}` : null,
  ]
    .filter((part): part is string => !!part)
    .join(', ');

  const standing = synced
    ? `${who}. On the district's records, last confirmed ${timeAgo(household.saved_at)}.`
    : `${who}. Saved on this phone ${timeAgo(household.saved_at)} and not sent to the district yet.`;
  const needs = needsLine(profile);
  return (
    <Group title="Your household">
      <Row
        icon={Users}
        title={profile.contact_name ?? 'Saved'}
        detail={needs ? `${standing} ${needs}` : standing}
        right={
          <Chip
            label={synced ? 'On record' : 'This phone only'}
            fill={synced ? 'bg-olive' : 'bg-medium'}
            text="text-paper"
          />
        }
      />

      {!synced ? (
        <View className="pb-3">
          <Button
            label={sending ? 'Sending' : 'Send it to the district now'}
            variant="secondary"
            icon={CloudUpload}
            disabled={sending}
            onPress={() => {
              setSending(true);
              setSendFailed(false);
              void retrySync().then((ok) => {
                setSending(false);
                setSendFailed(!ok);
              });
            }}
          />
          {sendFailed ? (
            <Body className="text-meta text-high mt-2 leading-5">
              Still no answer from the district's server. Your details are safe on
              this phone, and the app tries again every time it opens.
            </Body>
          ) : null}
        </View>
      ) : null}

      <View className="pb-1">
        <Button
          label="Review or change these details"
          variant="secondary"
          onPress={edit}
        />
        <Body className="text-micro text-ink-soft mt-2 leading-4">
          Saving them again resets the two-year clock, so a look once a year is
          enough to stay on the list.
        </Body>
      </View>
      <View className="pt-3 mt-2 border-t border-paper-deep">
        <Button
          label={
            confirmForget
              ? 'Tap again to delete from this phone'
              : 'Delete from this phone'
          }
          // Two taps, and the second one is red oxide. The same friction SOS uses,
          // in reverse: easy to reach, impossible to fire by accident in a pocket.
          variant={confirmForget ? 'danger' : 'quiet'}
          onPress={() => {
            if (!confirmForget) {
              setConfirmForget(true);
              return;
            }
            setConfirmForget(false);
            void forgetLocal();
          }}
        />
        <Body className="text-micro text-ink-soft mt-2 leading-4">
          Clears the answers from this phone only. The district keeps its copy
          until it is two years old, and reinstalling will offer it back.
        </Body>
      </View>
    </Group>
  );
}

/**
 * The vulnerability counts as one sentence, skipping the zeroes.
 *
 * Written as a record of what was answered, not as a claim about what the app does
 * with it. Household-aware shelter ranking is the next piece of work, and a line
 * here saying shelter choice already accounts for these would be describing a
 * commit that does not exist.
 */
function needsLine(p: HouseholdProfile): string | null {
  const parts: string[] = [];
  if (p.elderly > 0) parts.push(`${p.elderly} aged 60 or over`);
  if (p.infants > 0) parts.push(`${p.infants} under two`);
  if (p.pregnant > 0) parts.push(`${p.pregnant} pregnant`);
  if (p.needs_assistance > 0) {
    parts.push(`${p.needs_assistance} who cannot leave unaided`);
  }
  if (p.non_swimmers > 0) parts.push(`${p.non_swimmers} who cannot swim`);

  if (parts.length === 0) return null;
  if (parts.length === 1) return `On record: ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `On record: ${parts.slice(0, -1).join(', ')} and ${last}.`;
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="px-4 pt-5">
      <Subhead className="text-body text-ink mb-1">{title}</Subhead>
      <View className="border-t border-paper-deep pt-1">{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  title,
  detail,
  right,
}: {
  icon: React.ComponentType<{ color: string; size: number; strokeWidth: number }>;
  title: string;
  detail: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start py-3">
      <View className="mt-0.5">
        <Icon color={colors.ink} size={19} strokeWidth={2.5} />
      </View>
      <View className="flex-1 ml-3">
        <Subhead className="text-body text-ink">{title}</Subhead>
        <Body className="text-meta text-ink-soft mt-1 leading-5">{detail}</Body>
      </View>
      {right ? <View className="ml-3 mt-0.5">{right}</View> : null}
    </View>
  );
}
