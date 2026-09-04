import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  TriangleAlert,
} from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import RollCall from '../components/RollCall';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { useHousehold } from '../state/HouseholdProvider';
import { tick, stopVibration } from '../services/alarm';
import { openEmergencySms } from '../services/sms';
import { emergencySmsBody } from '../domain/sms';
import type { HouseholdProfile } from '../domain/types';
import { colors } from '../theme/tokens';

/** How long the button must be held. Long enough to be deliberate. */
const HOLD_MS = 3000;
const FRAME_MS = 50;

/**
 * Emergency SOS.
 *
 * Two requirements pull against each other here: the button must be the easiest
 * thing to find in the app, and it must be nearly impossible to fire by accident.
 * A tap-then-confirm dialog satisfies the second and fails the first — it puts a
 * modal between a drowning person and help.
 *
 * The resolution is a three-second hold on a target that fills most of the
 * screen. There is nothing to aim at and nothing to read, so it works one-handed
 * and in the dark; but a phone jostled in a pocket cannot produce a continuous
 * three-second press on a single element. Each second buzzes, so the hold is
 * confirmed by touch as well as sight.
 *
 * The night ground is not a style choice. This screen is used in the dark and in
 * panic; a cream field at full brightness destroys night vision, and the shift in
 * ground also tells the user at a glance that they have left the reading part of
 * the app.
 *
 * Implementation note: react-native-gesture-handler is not installed, so the
 * hold is Pressable plus an interval. The progress ring width is a computed
 * geometry value and is the one place in this app where a numeric style is
 * correct — it is not a design token and cannot be a utility class.
 *
 * ------------------------------------------------------------------
 * Three ways to ask for help, in the order they are urgent
 * ------------------------------------------------------------------
 * The hold, then 112, then a text message. That order is the layout: everything a
 * person standing in water needs is above the fold.
 *
 * The text message is not hidden behind the offline state. A flood tower is
 * usually reachable and hopelessly congested, which times out an HTTPS POST while
 * letting 140 bytes through, and nothing on this device can tell that apart from
 * a good connection. See services/sms.ts for why it opens with no recipient.
 *
 * Last on the screen, after all three, is the opposite request: the roll-call. It
 * is deliberately last rather than prominent, because a household reporting itself
 * safe is by its own account not in a hurry, and every pixel above it belongs to
 * somebody who is. See RollCall.tsx, which argues the same thing from its side.
 */
export default function Sos() {
  const { sos, startSos, cancelSos, position, containingZone, connected } =
    useCitizen();
  const { household } = useHousehold();

  const [progress, setProgress] = useState(0);
  const [releasedEarly, setReleasedEarly] = useState(false);
  const [smsFailed, setSmsFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSecond = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onPressIn = useCallback(() => {
    if (sos !== 'idle') return;
    setReleasedEarly(false);
    setProgress(0);
    lastSecond.current = 0;
    const startedAt = Date.now();

    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(1, elapsed / HOLD_MS);
      setProgress(next);

      const second = Math.floor(elapsed / 1000);
      if (second > lastSecond.current) {
        lastSecond.current = second;
        tick();
      }

      if (next >= 1) {
        clear();
        startSos();
      }
    }, FRAME_MS);
  }, [clear, sos, startSos]);

  const onPressOut = useCallback(() => {
    if (timer.current) {
      clear();
      // Only complain if they got far enough in that they clearly meant to.
      if (progress > 0.15 && progress < 1) setReleasedEarly(true);
    }
    if (progress < 1) setProgress(0);
  }, [clear, progress]);

  const reset = useCallback(() => {
    stopVibration();
    setProgress(0);
    setReleasedEarly(false);
    cancelSos();
  }, [cancelSos]);

  /**
   * Hand the written message to the messaging app.
   *
   * Not gated on `connected`, deliberately. The case this exists for is a tower
   * that is technically reachable and carrying ten times its usual load, where the
   * POST to Supabase will time out and a text will not — and the app cannot tell
   * that state apart from a good connection from here.
   */
  const sendSms = useCallback(() => {
    setSmsFailed(false);
    void openEmergencySms(
      emergencySmsBody(position, household?.profile ?? null, containingZone),
    ).then((opened) => setSmsFailed(!opened));
  }, [containingZone, household, position]);

  if (sos === 'sent' || sos === 'queued') {
    return <SosResult state={sos} locality={position.locality} onDone={reset} />;
  }

  const secondsLeft = Math.max(1, Math.ceil((HOLD_MS * (1 - progress)) / 1000));
  const holding = progress > 0 && progress < 1;
  const sending = sos === 'sending';

  return (
    <Screen ground="night">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-5 pt-3">
          <Display className="text-headline text-paper">Emergency SOS</Display>
          <Body className="text-body text-paper mt-2 leading-6 opacity-90">
            Sends your location to the district control room and to your
            emergency contacts. Use it when you need someone to come to you.
          </Body>
        </View>

        <View className="px-5 pt-6">
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Send emergency SOS"
            accessibilityHint="Hold for three seconds to send"
            accessibilityState={{ busy: sending }}
          >
            <View
              className={`h-56 rounded-lg items-center justify-center overflow-hidden ${
                sending ? 'bg-high' : holding ? 'bg-high' : 'bg-critical'
              }`}
            >
              {/* The fill rises from the bottom as the hold completes. */}
              {holding ? (
                <View
                  className="absolute left-0 right-0 bottom-0 bg-critical"
                  style={{ height: `${progress * 100}%` }}
                />
              ) : null}

              {sending ? (
                <>
                  <Display className="text-siren text-paper">SENDING</Display>
                  <Data className="text-body text-paper mt-2">
                    Reaching the control room
                  </Data>
                </>
              ) : holding ? (
                <>
                  <Display className="text-siren text-paper">
                    {String(secondsLeft)}
                  </Display>
                  <Subhead className="text-body-lg text-paper mt-1">
                    Keep holding
                  </Subhead>
                </>
              ) : (
                <>
                  <Display className="text-siren text-paper">SOS</Display>
                  <Subhead className="text-body-lg text-paper mt-1">
                    Hold for 3 seconds
                  </Subhead>
                </>
              )}
            </View>
          </Pressable>

          {releasedEarly ? (
            <View className="flex-row items-start mt-3">
              <TriangleAlert color={colors.brand} size={17} strokeWidth={2.5} />
              <Body className="text-meta text-paper ml-2 flex-1 leading-5">
                Nothing was sent — you let go early. Hold until the count reaches
                zero.
              </Body>
            </View>
          ) : (
            <Body className="text-meta text-paper mt-3 leading-5 opacity-80">
              The hold is deliberately slow so this cannot happen in your pocket.
            </Body>
          )}
        </View>

        {!connected ? (
          <View className="mx-5 mt-6 flex-row bg-night-soft rounded-lg p-4">
            <MessageSquare color={colors.brand} size={19} strokeWidth={2.5} />
            <View className="flex-1 ml-3">
              <Subhead className="text-body text-paper">
                No signal right now
              </Subhead>
              <Body className="text-meta text-paper mt-1 leading-5 opacity-90">
                Your SOS will be saved and sent the moment your phone finds a
                network. Nobody has it yet. A text message gets through on a
                tower that cannot carry anything else — send one below, and call
                112 if you can.
              </Body>
            </View>
          </View>
        ) : null}

        <View className="mx-5 mt-6">
          <Subhead className="text-body text-paper mb-2">
            What gets sent
          </Subhead>
          <View className="bg-night-soft rounded-lg p-4">
            <Payload label="Your location" value={position.locality} />
            <Payload
              label="Coordinates"
              value={`${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)} within ${position.accuracyMetres} m`}
            />
            <Payload
              label="Hazard at your location"
              value={
                containingZone
                  ? `${containingZone.name}, marked ${containingZone.severity}`
                  : 'No marked zone at your location'
              }
            />
            <Payload
              label="Who is in the house"
              value={
                household
                  ? householdLine(household.profile)
                  : 'Not recorded — the questions in Settings add this'
              }
            />
            <Payload label="Your phone number" value="From your SIM" last />
          </View>
        </View>

        <View className="mx-5 mt-6">
          <Button
            label="Call 112 instead"
            icon={PhoneCall}
            variant="secondary"
            onPress={() => {
              void Linking.openURL('tel:112');
            }}
          />
          <Body className="text-micro text-paper mt-2 leading-4 opacity-80">
            112 reaches police, fire and ambulance. Call it if you are hurt or
            trapped — a voice call gets a person, not a queue.
          </Body>

          <View className="mt-4">
            <Button
              label="Send it as a text message"
              icon={MessageSquare}
              variant="quiet-inverse"
              onPress={sendSms}
            />
          </View>
          <Body className="text-micro text-paper mt-2 leading-4 opacity-80">
            {smsFailed
              ? 'This phone has no messaging app to open. Nothing was sent.'
              : 'Opens your messages with everything above already written. Choose who to send it to — a relative, a neighbour, your ward councillor.'}
          </Body>
        </View>

        <RollCall position={position} />
      </ScrollView>
    </Screen>
  );
}

/**
 * One line naming the people a boat would be coming for.
 *
 * The same facts the text message carries, shortened to fit a row. Only the
 * counts above zero: somebody checking this before they hold the button wants to
 * know whether the district will bring a stretcher, and four zeroes would bury
 * the one number that answers that.
 */
function householdLine(profile: HouseholdProfile): string {
  const parts = [
    `${profile.people} ${profile.people === 1 ? 'person' : 'people'}`,
  ];

  const assisted =
    profile.elderly +
    profile.infants +
    profile.pregnant +
    profile.needs_assistance;
  if (assisted > 0) parts.push(`${assisted} needing help to move`);
  if (profile.non_swimmers > 0) {
    parts.push(`${profile.non_swimmers} who cannot swim`);
  }

  return parts.join(', ');
}

function Payload({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View className={last ? '' : 'mb-3'}>
      <Data className="text-micro text-paper opacity-70">{label}</Data>
      <Body className="text-meta text-paper mt-0.5 leading-5">{value}</Body>
    </View>
  );
}

/**
 * The confirmation.
 *
 * `sent` and `queued` are kept visually distinct on purpose. A queued SOS that
 * looks like a sent SOS is the single most dangerous thing this screen could do:
 * someone would sit and wait for help that has not been asked for yet.
 */
function SosResult({
  state,
  locality,
  onDone,
}: {
  state: 'sent' | 'queued';
  locality: string;
  onDone: () => void;
}) {
  const queued = state === 'queued';

  return (
    <Screen ground="night">
      <View className="flex-1 px-6 justify-center">
        {queued ? (
          <Clock color={colors.brand} size={44} strokeWidth={2.5} />
        ) : (
          <CheckCircle2 color={colors.paper} size={44} strokeWidth={2.5} />
        )}

        <Display className="text-display text-paper mt-4 leading-10">
          {queued ? 'Saved, not sent yet' : 'Help has been asked for'}
        </Display>

        <Body className="text-body-lg text-paper mt-3 leading-7 opacity-90">
          {queued
            ? 'Your phone has no signal. The SOS is stored and will go out by SMS as soon as a network appears. Nobody has been alerted yet.'
            : `The district control room has your location in ${locality} and your emergency contacts have been messaged.`}
        </Body>

        {queued ? (
          <View className="mt-5 bg-critical rounded-lg p-4">
            <Subhead className="text-body text-paper">
              Do not wait for this
            </Subhead>
            <Body className="text-meta text-paper mt-1 leading-5">
              If you are in danger now, move to higher ground or call 112 from a
              phone with signal.
            </Body>
          </View>
        ) : (
          <View className="mt-5">
            <Data className="text-meta text-paper opacity-80 leading-5">
              Keep your phone with you. The control room may call this number.
            </Data>
          </View>
        )}

        <View className="mt-7">
          <Button
            label={queued ? 'Back to alerts' : 'Done'}
            variant="secondary"
            onPress={onDone}
          />
        </View>
      </View>
    </Screen>
  );
}
