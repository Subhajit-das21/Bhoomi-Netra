import React, { useState } from 'react';
import { Linking, ScrollView, Switch, View } from 'react-native';
import {
  BellRing,
  CloudUpload,
  Languages,
  MapPin,
  MapPinOff,
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
import { useText } from '../state/useText';
import { hasNotificationTransport } from '../services/alarm';
import { clockTime, coordinateLabel, timeAgo } from '../domain/geo';
import {
  LANGUAGE_LABEL,
  TRANSLATIONS_REVIEWED,
  t as translate,
} from '../domain/i18n';
import { colors } from '../theme/tokens';
import type { HouseholdProfile, Language } from '../domain/types';

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
 * ------------------------------------------------------------------
 * This screen used to stay in English
 * ------------------------------------------------------------------
 * The argument was that a machine-translated settings label costs a moment of
 * confusion while a machine-translated "move to higher ground" costs something
 * else entirely, so the alert path was translated and the chrome was not. That was
 * wrong about who reads this screen. Somebody who has set the app to Bengali and
 * arrives here to check whether push notifications work, or to delete their
 * household from the phone, is reading a permissions and privacy screen in a
 * language they did not choose — and the sentences that say "no push in this
 * build" and "the district keeps its copy for two years" are exactly the ones
 * where a reader who cannot follow them is left with a wrong belief about what the
 * app is doing with their family's details.
 *
 * So the whole screen translates, and the unreviewed notice in the language group
 * now covers the chrome as well as the alerts.
 */
export default function Settings() {
  const { t } = useText();
  const { connected, setConnected, freshness, lastSyncAt, replayEscalation } =
    useCitizen();

  const pushReady = hasNotificationTransport();

  return (
    <Screen>
      <View className="px-4 pt-2 pb-3">
        <Display className="text-title text-ink">{t('Settings')}</Display>
        <Data className="text-micro text-ink-soft mt-0.5">
          {t('BHOOMI-NETRA citizen alerts')}
        </Data>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <Group title={t('Alerts')}>
          <Row
            icon={BellRing}
            title={t('Push notifications')}
            detail={
              pushReady
                ? t(
                    'On. Critical alerts for your ward will reach you with the screen off.',
                  )
                : t(
                    'Not available in this build. You will only be alerted while the app is open.',
                  )
            }
            right={
              <Chip
                label={pushReady ? t('On') : t('Unavailable')}
                fill={pushReady ? 'bg-olive' : 'bg-medium'}
                text="text-paper"
              />
            }
          />

          <Row
            icon={Vibrate}
            title={t('Vibration for critical alerts')}
            detail={t(
              'On, and not switchable. A critical alert for the zone you are standing in is the one thing this app will not let you silence.',
            )}
          />

          <View className="pt-3">
            <Button
              label={t('Test a critical alert')}
              variant="secondary"
              onPress={replayEscalation}
            />
            <Body className="text-micro text-ink-soft mt-2 leading-4">
              {t(
                'Plays the real vibration pattern and opens the takeover screen, so you know what it looks like before it matters.',
              )}
            </Body>
          </View>
        </Group>

        <HouseholdGroup />

        <LanguageGroup />

        <LocationGroup />

        <Group title={t('Connection')}>
          <Row
            icon={WifiOff}
            title={t('Simulate no signal')}
            detail={t(
              'Review affordance, not a real setting. Turn it on to see how the app behaves offline. Data is currently {freshness}, last fetched {time}.',
              { freshness: t(freshness), time: clockTime(lastSyncAt) },
            )}
            right={
              <Switch
                value={!connected}
                onValueChange={(v) => setConnected(!v)}
                accessibilityLabel={t('Simulate no signal')}
                trackColor={{ false: colors['paper-deep'], true: colors.high }}
                thumbColor={colors.paper}
                ios_backgroundColor={colors['paper-deep']}
              />
            }
          />
        </Group>

        <Group title={t('About')}>
          <Body className="text-body text-ink leading-6">
            {t(
              'BHOOMI-NETRA watches river levels, rainfall, temperature, smoke and flame from sensor nodes across the district and warns the people nearest to a hazard first.',
            )}
          </Body>
          <Body className="text-body text-ink leading-6 mt-3">
            {t(
              'It is not a substitute for emergency services. For anything happening right now, call 112.',
            )}
          </Body>
          <Data className="text-micro text-ink-soft mt-4 leading-4">
            {t(
              'Sensor data from the district node network. Zone boundaries and shelter status are set by the district authority.',
            )}
          </Data>
        </Group>
      </ScrollView>
    </Screen>
  );
}

/**
 * Where the app thinks the user is, and whether it measured that or assumed it.
 *
 * This row exists because `DEVICE_POSITION` is indistinguishable from a real fix
 * by design — data/device.ts states a plausible 18 m accuracy so that nothing
 * downstream renders differently — and something has to be able to tell the
 * reader which one is driving the zone verdict on the home screen.
 *
 * The refused case gets a button rather than an instruction. "Allow location in
 * your phone's settings" is a dead end on a screen someone is holding because the
 * app already got something wrong; `Linking.openSettings` is core React Native and
 * lands on this app's own permission page on both platforms.
 */
function LocationGroup() {
  const { t } = useText();
  const { position, positionSource, locationPermission } = useCitizen();
  const measured = positionSource === 'device';
  const refused = locationPermission === 'denied';

  const detail = measured
    ? t('{coords}, accurate to {n} m. Fix taken {time}.', {
        coords: coordinateLabel(position),
        n: position.accuracyMetres,
        time: clockTime(position.takenAt),
      })
    : refused
      ? t(
          'This app cannot see your location, so it is working from a stated position near {place}. Zone and shelter answers may be about somewhere you are not.',
          { place: position.locality },
        )
      : t(
          'Waiting for the first fix from this phone. Until it arrives the app is working from a stated position near {place}, so zone and shelter answers may be about somewhere you are not.',
          { place: position.locality },
        );

  return (
    <Group title={t('Location')}>
      <Row
        icon={measured ? MapPin : MapPinOff}
        title={position.locality}
        detail={detail}
        right={
          <Chip
            label={measured ? t('From this phone') : t('Assumed')}
            fill={measured ? 'bg-olive' : 'bg-medium'}
            text="text-paper"
          />
        }
      />

      {refused ? (
        <View className="pb-1">
          <Button
            label={t('Open location permissions')}
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
          <Body className="text-micro text-ink-soft mt-2 leading-4">
            {t(
              'Allow location while using the app. Nothing is sent anywhere until you press SOS, and the app never tracks you with the screen off.',
            )}
          </Body>
        </View>
      ) : null}
    </Group>
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
  const { t } = useText();
  const { household, edit } = useHousehold();
  const lang = household?.profile.language ?? 'en';

  return (
    <Group title={t('Language')}>
      <Row
        icon={Languages}
        title={LANGUAGE_LABEL[lang]}
        detail={
          lang === 'en'
            ? t(
                'The whole app can be read in Bengali or Hindi: the alerts, the SOS screen, the walking directions, the household questions and this screen.',
              )
            : t(
                'The whole app is in this language: the alerts, the SOS screen, the walking directions, the household questions and this screen.',
              )
        }
      />

      {lang !== 'en' && !TRANSLATIONS_REVIEWED ? (
        <View className="flex-row bg-high-wash rounded-md overflow-hidden mb-3">
          <View className="w-1.5 self-stretch bg-high" />
          <View className="flex-1 p-3">
            <Subhead className="text-meta text-ink">
              {t('Not yet checked by a Bengali or Hindi speaker')}
            </Subhead>
            <Body className="text-meta text-ink mt-1 leading-5">
              {t(
                'Every line of this app was translated for this build and nobody has read it back against the English. If a warning reads oddly, trust the action and not the wording — switch to English to compare, and call 112 if you are unsure.',
              )}
            </Body>
          </View>
        </View>
      ) : null}

      <View className="pb-1">
        <Button
          label={t('Change the language')}
          variant="secondary"
          onPress={edit}
        />
        <Body className="text-micro text-ink-soft mt-2 leading-4">
          {t(
            'It is the first of the household questions, so it is kept with the rest of your details — the district writes and calls in the same language.',
          )}
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
  const { lang, t } = useText();
  const { household, retrySync, edit, forgetLocal } = useHousehold();
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  if (!household) {
    return (
      <Group title={t('Your household')}>
        <Row
          icon={Users}
          title={t('Not answered')}
          detail={t(
            'Nothing here tells the app who lives with you, so it assumes one person, no ward and nobody who needs help getting out. Five short steps changes that, and every line in them is optional.',
          )}
        />
        <View className="pb-2">
          <Button
            label={t('Answer the household questions')}
            variant="secondary"
            onPress={edit}
          />
        </View>
      </Group>
    );
  }

  const { profile, synced } = household;
  const who = [
    t(profile.people === 1 ? '{n} person' : '{n} people', { n: profile.people }),
    profile.ward ? t('ward {n}', { n: profile.ward }) : null,
  ]
    .filter((part): part is string => !!part)
    .join(', ');

  const standing = synced
    ? t('{who}. On the district\'s records, last confirmed {when}.', {
        who,
        when: timeAgo(household.saved_at, Date.now(), lang),
      })
    : t('{who}. Saved on this phone {when} and not sent to the district yet.', {
        who,
        when: timeAgo(household.saved_at, Date.now(), lang),
      });
  const needs = needsLine(profile, lang);
  return (
    <Group title={t('Your household')}>
      <Row
        icon={Users}
        title={profile.contact_name ?? t('Saved')}
        detail={needs ? `${standing} ${needs}` : standing}
        right={
          <Chip
            label={synced ? t('On record') : t('This phone only')}
            fill={synced ? 'bg-olive' : 'bg-medium'}
            text="text-paper"
          />
        }
      />

      {!synced ? (
        <View className="pb-3">
          <Button
            label={sending ? t('Sending') : t('Send it to the district now')}
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
              {t(
                'Still no answer from the district\'s server. Your details are safe on this phone, and the app tries again every time it opens.',
              )}
            </Body>
          ) : null}
        </View>
      ) : null}

      <View className="pb-1">
        <Button
          label={t('Review or change these details')}
          variant="secondary"
          onPress={edit}
        />
        <Body className="text-micro text-ink-soft mt-2 leading-4">
          {t(
            'Saving them again resets the two-year clock, so a look once a year is enough to stay on the list.',
          )}
        </Body>
      </View>
      <View className="pt-3 mt-2 border-t border-paper-deep">
        <Button
          label={
            confirmForget
              ? t('Tap again to delete from this phone')
              : t('Delete from this phone')
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
          {t(
            'Clears the answers from this phone only. The district keeps its copy until it is two years old, and reinstalling will offer it back.',
          )}
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
 *
 * The conjunction is a dictionary key rather than a literal ' and ', because the
 * word that joins the last two items in a list is a fact about a language and not
 * about this sentence.
 */
function needsLine(p: HouseholdProfile, lang: Language): string | null {
  const parts: string[] = [];
  if (p.elderly > 0) {
    parts.push(translate(lang, '{n} aged 60 or over', { n: p.elderly }));
  }
  if (p.infants > 0) {
    parts.push(translate(lang, '{n} under two', { n: p.infants }));
  }
  if (p.pregnant > 0) {
    parts.push(translate(lang, '{n} pregnant', { n: p.pregnant }));
  }
  if (p.needs_assistance > 0) {
    parts.push(
      translate(lang, '{n} who cannot leave unaided', { n: p.needs_assistance }),
    );
  }
  if (p.non_swimmers > 0) {
    parts.push(translate(lang, '{n} who cannot swim', { n: p.non_swimmers }));
  }

  if (parts.length === 0) return null;
  const list =
    parts.length === 1
      ? parts[0]
      : translate(lang, '{list} and {last}', {
          list: parts.slice(0, -1).join(', '),
          last: parts[parts.length - 1],
        });
  return translate(lang, 'On record: {list}.', { list });
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
