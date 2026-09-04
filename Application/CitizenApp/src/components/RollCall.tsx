import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CircleCheck, TriangleAlert, Users } from 'lucide-react-native';
import Button from './ui/Button';
import { Body, Subhead } from './ui/Type';
import { clockTime, timeAgo } from '../domain/geo';
import { useHousehold, type RollCallOutcome } from '../state/HouseholdProvider';
import type { UserPosition } from '../domain/types';
import { colors } from '../theme/tokens';

/**
 * The roll-call: "we are safe, stop looking for us."
 *
 * This is the highest-value thing in Phase 3 and the least obvious. Rescue teams
 * in a flood repeatedly search houses whose occupants left hours earlier, because
 * nothing tells them the house is empty — hours of boat time spent on addresses
 * that are already fine while somebody two streets away waits. One tap from the
 * household closes that gap, and the household is the only party who can.
 *
 * ------------------------------------------------------------------
 * Why it lives next to SOS, and why it is confirmed rather than held
 * ------------------------------------------------------------------
 * It is the exact inverse of the button above it, so it belongs on the same
 * screen: whatever state a household is in, the answer is one of these two.
 *
 * SOS refuses a confirmation dialog because a drowning person cannot read one,
 * and pays for that with a three-second hold. This does the opposite. Somebody
 * reporting in is, by their own account, safe and not in a hurry, so a sentence
 * they have to read is affordable — and it is necessary, because the cost of an
 * accidental tap here is a search team crossing your address off. So: two taps,
 * with the consequence stated in between, and no timer.
 *
 * Olive, not green. `olive` is the token this palette carries for all-clear
 * precisely so that "safe" never renders as the go half of a traffic light —
 * see theme/tokens.js.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'working' }
  | { kind: 'failed'; reason: 'no-profile' | 'not-synced' | 'unreachable' };

export default function RollCall({ position }: { position: UserPosition }) {
  const { household, markSafe, edit } = useHousehold();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const safeAt = household?.safe_at ?? null;

  const report = useCallback(
    async (safe: boolean) => {
      setPhase({ kind: 'working' });
      const outcome: RollCallOutcome = await markSafe(
        safe,
        safe
          ? { latitude: position.latitude, longitude: position.longitude }
          : null,
      );
      setPhase(
        outcome.ok ? { kind: 'idle' } : { kind: 'failed', reason: outcome.reason },
      );
    },
    [markSafe, position],
  );

  // Nothing to take off a list. Said plainly, with the way in, rather than a
  // disabled button that leaves somebody tapping at it.
  if (!household) {
    return (
      <Frame>
        <Subhead className="text-body text-paper">
          Tell the district you are safe
        </Subhead>
        <Body className="text-meta text-paper mt-1 leading-5 opacity-90">
          Answer the household questions first. A message with no address adds a
          name to a list of unknowns instead of taking one off the search list.
        </Body>
        <View className="mt-3">
          <Button
            label="Answer the questions"
            variant="quiet-inverse"
            icon={Users}
            onPress={edit}
          />
        </View>
      </Frame>
    );
  }

  if (safeAt !== null) {
    return (
      <Frame>
        <View className="flex-row items-start">
          <CircleCheck color={colors.olive} size={19} strokeWidth={2.5} />
          <View className="flex-1 ml-3">
            <Subhead className="text-body text-paper">
              The district has you marked safe
            </Subhead>
            <Body className="text-meta text-paper mt-1 leading-5 opacity-90">
              Reported at {clockTime(safeAt)}, {timeAgo(safeAt)}. Your house is
              not on the rescue list.
            </Body>
          </View>
        </View>

        <Body className="text-meta text-paper mt-3 leading-5 opacity-90">
          Water rises again. If anything changes, take this back — nobody will
          think less of you for it.
        </Body>

        <View className="mt-3">
          <Button
            label={
              phase.kind === 'working' ? 'Telling them…' : 'We need help after all'
            }
            variant="danger"
            disabled={phase.kind === 'working'}
            onPress={() => void report(false)}
          />
        </View>

        {phase.kind === 'failed' ? <Failure reason={phase.reason} /> : null}
      </Frame>
    );
  }

  return (
    <Frame>
      <Subhead className="text-body text-paper">
        Tell the district you are safe
      </Subhead>
      <Body className="text-meta text-paper mt-1 leading-5 opacity-90">
        {household.profile.people > 1
          ? `If all ${household.profile.people} of you are somewhere safe and nobody needs help, this takes your house off the rescue list.`
          : 'If you are somewhere safe and do not need help, this takes your house off the rescue list.'}
      </Body>

      {phase.kind === 'confirming' ? (
        <>
          <View className="flex-row items-start mt-3">
            <TriangleAlert color={colors.brand} size={17} strokeWidth={2.5} />
            <Body className="text-meta text-paper ml-2 flex-1 leading-5">
              A search team will stop looking for this address. Only send this if
              everyone is accounted for.
            </Body>
          </View>
          <View className="mt-3">
            <Button
              label="Yes, take us off the list"
              onPress={() => void report(true)}
            />
          </View>
          <View className="mt-2">
            <Button
              label="Not yet"
              variant="quiet-inverse"
              onPress={() => setPhase({ kind: 'idle' })}
            />
          </View>
        </>
      ) : (
        <View className="mt-3">
          <Button
            label={phase.kind === 'working' ? 'Telling them…' : 'We are safe'}
            icon={CircleCheck}
            disabled={phase.kind === 'working'}
            onPress={() => setPhase({ kind: 'confirming' })}
          />
        </View>
      )}

      {phase.kind === 'failed' ? <Failure reason={phase.reason} /> : null}
    </Frame>
  );
}

/**
 * The failure copy, which has to be blunt in one specific way: it must say that
 * nothing was reported. A household that believes it has been taken off the
 * search list, and has not, is worse off than one that never tapped.
 */
function Failure({
  reason,
}: {
  reason: 'no-profile' | 'not-synced' | 'unreachable';
}) {
  const text =
    reason === 'unreachable'
      ? 'No answer from the district. Nothing has been reported — try again when you have a signal.'
      : reason === 'not-synced'
        ? 'Your answers are still only on this phone, so there is no record to update. Nothing has been reported.'
        : 'There are no household details to report. Nothing has been sent.';

  return (
    <View className="flex-row items-start mt-3 bg-critical rounded-md p-3">
      <TriangleAlert color={colors.paper} size={17} strokeWidth={2.5} />
      <Body className="text-meta text-paper ml-2 flex-1 leading-5">{text}</Body>
    </View>
  );
}

/** The raised block this sits in, matching the other panels on the SOS screen. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-5 mt-6">
      <View className="bg-night-soft rounded-lg p-4">{children}</View>
    </View>
  );
}
