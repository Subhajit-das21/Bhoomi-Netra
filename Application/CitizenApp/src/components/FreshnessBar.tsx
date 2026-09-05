import React from 'react';
import { Pressable, View } from 'react-native';
import { CloudOff, RefreshCw, Radio, TriangleAlert } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Body, Data, Subhead } from './ui/Type';
import { colors } from '../theme/tokens';
import { clockTime, duration } from '../domain/geo';
import { t as translate } from '../domain/i18n';
import { useText } from '../state/useText';
import type { DataFreshness, Language } from '../domain/types';

interface FreshnessBarProps {
  freshness: DataFreshness;
  lastSyncAt: string;
  isRefreshing: boolean;
  onRetry: () => void;
}

/**
 * Says how much to trust the screen.
 *
 * Treated as a first-class piece of the interface rather than a spinner: in a
 * flood, acting on a 40-minute-old water level is a real hazard, so the age of
 * the data is stated in words and the bar escalates in weight as it ages.
 *
 * The states are deliberately not interchangeable in tone. "Live" is quiet and
 * stays out of the way. "Stale" is loud, because the user is about to make a
 * decision on numbers that may no longer be true.
 */
const PRESENTATION: Record<
  DataFreshness,
  { ground: string; text: string; icon: LucideIcon; iconColor: string }
> = {
  live: {
    ground: 'bg-olive',
    text: 'text-paper',
    icon: Radio,
    iconColor: colors.paper,
  },
  cached: {
    ground: 'bg-medium',
    text: 'text-paper',
    icon: CloudOff,
    iconColor: colors.paper,
  },
  stale: {
    ground: 'bg-high',
    text: 'text-paper',
    icon: TriangleAlert,
    iconColor: colors.paper,
  },
  offline: {
    ground: 'bg-night',
    text: 'text-paper',
    icon: CloudOff,
    iconColor: colors.paper,
  },
};

/**
 * The four states as sentences. Called twice per render — once for the
 * accessibility label and once for the visible text — so it is a plain function
 * of the language rather than a hook, the same shape `householdLine` uses on the
 * SOS screen.
 *
 * The offline case names 112 and does not translate it. Three digits are three
 * digits in every language on the coast, and a reader who has lost signal needs
 * the number to look like the number.
 */
function message(
  freshness: DataFreshness,
  lastSyncAt: string,
  lang: Language,
): string {
  switch (freshness) {
    case 'live':
      return translate(lang, 'Live. Updated {time}.', {
        time: clockTime(lastSyncAt),
      });
    case 'cached':
      return translate(lang, 'No signal. Showing what we saved at {time}.', {
        time: clockTime(lastSyncAt),
      });
    case 'stale':
      return translate(
        lang,
        'No signal for {span}. These numbers may be out of date.',
        { span: duration(lastSyncAt, Date.now(), lang) },
      );
    case 'offline':
      return translate(
        lang,
        'No signal and nothing saved yet. Call 112 for emergencies.',
      );
  }
}

export default function FreshnessBar({
  freshness,
  lastSyncAt,
  isRefreshing,
  onRetry,
}: FreshnessBarProps) {
  const { lang, t } = useText();
  const p = PRESENTATION[freshness];
  const Icon = p.icon;
  const isLive = freshness === 'live';
  const line = message(freshness, lastSyncAt, lang);

  return (
    <View
      className={`flex-row items-center px-4 ${isLive ? 'py-1.5' : 'py-3'} ${p.ground}`}
      accessibilityRole={isLive ? 'text' : 'alert'}
      accessibilityLiveRegion={isLive ? 'none' : 'polite'}
      accessibilityLabel={line}
    >
      <Icon color={p.iconColor} size={isLive ? 13 : 17} strokeWidth={2.5} />

      <View className="flex-1 ml-2">
        {isLive ? (
          <Data className={`text-micro ${p.text}`}>{line}</Data>
        ) : (
          <Body className={`text-meta leading-5 ${p.text}`}>{line}</Body>
        )}
      </View>

      {!isLive ? (
        <Pressable
          onPress={onRetry}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel={t('Try to reconnect')}
          className="flex-row items-center min-h-[44px] pl-3 justify-end"
        >
          <RefreshCw
            color={colors.paper}
            size={15}
            strokeWidth={2.5}
          />
          <Subhead className="text-micro text-paper ml-1.5">
            {isRefreshing ? t('Trying') : t('Retry')}
          </Subhead>
        </Pressable>
      ) : null}
    </View>
  );
}
