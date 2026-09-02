import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import FreshnessBar from '../components/FreshnessBar';
import DataGap from '../components/DataGap';
import ZoneStatus from '../components/ZoneStatus';
import AlertCard from '../components/AlertCard';
import { useCitizen } from '../state/CitizenProvider';
import { clockTime } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { AlertWithContext } from '../domain/types';

interface AlertFeedProps {
  onOpenAlert: (alert: AlertWithContext) => void;
  onOpenMap: () => void;
}

/** Alerts nearer than this are "your area"; beyond it, district context. */
const NEAR_M = 3000;

/**
 * The feed. The screen someone opens at 2 a.m. when their phone has just buzzed.
 *
 * Ordering is urgency first (severity, then recency) — that ranking lives in the
 * domain layer so the feed, the notification and the takeover cannot disagree.
 * On top of that the list is split by proximity, because severity says how bad a
 * thing is and distance says whether it is yours. A critical fire 40 km away and
 * a critical flood on your street are not the same message, and a single flat
 * list by severity would present them identically.
 *
 * The top card is given a prominent variant rather than a carousel or a hero
 * image: the most urgent thing gets more page, and nothing about it moves.
 */
export default function AlertFeed({ onOpenAlert, onOpenMap }: AlertFeedProps) {
  const {
    alerts,
    freshness,
    lastSyncAt,
    isRefreshing,
    loadState,
    failure,
    refresh,
    position,
    containingZone,
    nearestZoneMetres,
  } = useCitizen();

  const { near, district } = useMemo(() => {
    return {
      near: alerts.filter((a) => a.distanceMetres < NEAR_M),
      district: alerts.filter((a) => a.distanceMetres >= NEAR_M),
    };
  }, [alerts]);

  const lead = near[0] ?? district[0] ?? null;
  const restOfNear = lead && near.includes(lead) ? near.slice(1) : near;

  /**
   * With no data, this screen shows the gap and nothing else — not the zone card
   * and not the empty state.
   *
   * The zone card is withheld because without zones it would say "you are outside
   * all risk zones", which is the app inventing an all-clear out of a failed
   * request. The empty state is withheld for the same reason in stronger terms:
   * "nothing is affecting your area right now" is true when the district reports
   * nothing and false when we could not ask, and those two cases produce an
   * identical empty array.
   */
  const hasData = loadState === 'ready';

  return (
    <Screen>
      <View className="px-4 pt-2 pb-3 flex-row items-end justify-between">
        <View>
          <Display className="text-title text-ink">BHOOMI-NETRA</Display>
          <Data className="text-micro text-ink-soft mt-0.5">
            {position.locality}
          </Data>
        </View>
      </View>

      <FreshnessBar
        freshness={freshness}
        lastSyncAt={lastSyncAt}
        isRefreshing={isRefreshing}
        onRetry={refresh}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.ink}
            colors={[colors.ink]}
            progressBackgroundColor={colors['paper-deep']}
          />
        }
      >
        {!hasData ? (
          <DataGap
            state={loadState === 'first-load' ? 'first-load' : 'failed'}
            failure={failure}
            locality={position.locality}
            onRetry={refresh}
            isRefreshing={isRefreshing}
          />
        ) : null}

        {hasData ? (
          <ZoneStatus
            zone={containingZone}
            nearestMetres={nearestZoneMetres}
            position={position}
            onPress={onOpenMap}
          />
        ) : null}

        {hasData && alerts.length === 0 ? (
          <EmptyFeed locality={position.locality} lastSyncAt={lastSyncAt} />
        ) : null}

        {lead ? (
          <AlertCard alert={lead} prominent onPress={() => onOpenAlert(lead)} />
        ) : null}

        {restOfNear.length > 0 ? (
          <SectionHeading
            title="Also near you"
            note={`Within ${NEAR_M / 1000} km`}
          />
        ) : null}
        {restOfNear.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onPress={() => onOpenAlert(alert)}
          />
        ))}

        {district.length > 0 && district[0] !== lead ? (
          <SectionHeading
            title="Elsewhere in the district"
            note="Not in your area"
          />
        ) : null}
        {district
          .filter((a) => a !== lead)
          .map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onPress={() => onOpenAlert(alert)}
            />
          ))}

        {alerts.length > 0 ? (
          <Data className="text-micro text-ink-soft text-center mt-4 px-8 leading-4">
            {`Checked at ${clockTime(lastSyncAt)}. Pull down to check again.`}
          </Data>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * A section break, not an eyebrow label. Sentence case, ink weight, and it
 * carries a second line of real information rather than decorative tracking.
 */
function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <View className="mx-4 mt-4 mb-2 flex-row items-baseline justify-between">
      <Subhead className="text-body text-ink">{title}</Subhead>
      <Data className="text-micro text-ink-soft">{note}</Data>
    </View>
  );
}

/**
 * The empty state. Says what is true, why the screen is blank, and what the app
 * will do next — an empty feed here is good news and should read like it, while
 * still making clear that silence is not the same as being unmonitored.
 */
function EmptyFeed({
  locality,
  lastSyncAt,
}: {
  locality: string;
  lastSyncAt: string;
}) {
  return (
    <View className="mx-4 mb-3 rounded-lg bg-paper-deep p-5 items-start">
      <Inbox color={colors.olive} size={22} strokeWidth={2.5} />
      <Display className="text-title text-ink mt-3">
        No active alerts near you
      </Display>
      <Body className="text-body text-ink mt-2 leading-6">
        {`Nothing is affecting ${locality} right now. Sensors are still reporting, and this screen will change on its own if that stops being true.`}
      </Body>
      <Data className="text-micro text-ink-soft mt-3">
        {`Last checked ${clockTime(lastSyncAt)}`}
      </Data>
    </View>
  );
}
