import React from 'react';
import { Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Body, Data, Subhead } from './Type';
import { colors } from '../../theme/tokens';

/**
 * A number, set by tapping.
 *
 * Used for every count the household flow asks for: how many people live here,
 * how many are over sixty, how many cannot swim. All of them could have been
 * `<TextInput keyboardType="number-pad">` and all of them are better as this.
 *
 * The reason is the keyboard. A numeric keypad covers the lower half of the
 * screen, which on this step hides the four questions below the one being
 * answered, and it puts a text cursor between the user and a value that is almost
 * always 0, 1 or 2. Two taps beats a keyboard for a number under ten, and nobody
 * can typo a stepper into claiming eleven infants.
 *
 * The value is set in the `data` face — monospaced, tabular — so it does not jump
 * sideways as it crosses from 9 to 10. The same reason the sensor readings use it.
 */

interface CounterProps {
  label: string;
  /** One line under the label. Says what the number is for, not how to tap. */
  help?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function Counter({
  label,
  help,
  value,
  onChange,
  min = 0,
  max = 60,
}: CounterProps) {
  // Clamped here rather than at every call site, so a caller lowering `max` can
  // never leave a value above it on screen. `households_counts_fit` in 007
  // rejects that combination, and a form that offers a state the database refuses
  // is a form that fails on the last tap.
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));

  return (
    <View className="flex-row items-center py-2.5 border-b border-paper-deep">
      <View className="flex-1 pr-3">
        <Subhead className="text-body text-ink">{label}</Subhead>
        {help ? (
          <Body className="text-micro text-ink-soft mt-0.5 leading-4">{help}</Body>
        ) : null}
      </View>

      <View className="flex-row items-center">
        <Step
          kind="down"
          label={`One fewer, ${label}`}
          disabled={value <= min}
          onPress={() => set(value - 1)}
        />
        {/* Fixed width, so the two buttons do not shift as the digits change. */}
        <View className="w-11 items-center">
          <Data
            className="text-title text-ink"
            accessibilityLabel={`${label}: ${value}`}
          >
            {value}
          </Data>
        </View>
        <Step
          kind="up"
          label={`One more, ${label}`}
          disabled={value >= max}
          onPress={() => set(value + 1)}
        />
      </View>
    </View>
  );
}

/**
 * 44dp square. Below the 48 a full-width button gets, and deliberately: five of
 * these rows have to fit on one screen without scrolling past the question they
 * belong to, and 44 is the point where Apple's minimum and a thumb still agree.
 */
function Step({
  kind,
  label,
  disabled,
  onPress,
}: {
  kind: 'up' | 'down';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = kind === 'up' ? Plus : Minus;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          className={`w-11 h-11 items-center justify-center rounded-md border ${
            disabled
              ? 'bg-paper border-paper-deep'
              : pressed
                ? 'bg-night border-night'
                : 'bg-paper-deep border-ink-soft'
          }`}
        >
          <Icon
            color={disabled ? colors['paper-deep'] : pressed ? colors.paper : colors.ink}
            size={20}
            strokeWidth={3}
          />
        </View>
      )}
    </Pressable>
  );
}
