import React, { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Check } from 'lucide-react-native';
import { Body, Subhead } from './Type';
import { colors } from '../../theme/tokens';

/**
 * Text entry, and the first of it in this project.
 *
 * Everything before this screen was read-only: an alert feed, a map, a shelter
 * list, one SOS button. Nothing asked the user to type. So this file establishes
 * the input side of the system, and there are three decisions in it worth stating
 * because they are not the React Native defaults.
 *
 *   The well is `paper-deep`, the same recessed surface the disabled and secondary
 *   states use. A field on this ground reads as a place something goes rather than
 *   as a card, which keeps it out of the identical-rounded-rectangle vocabulary the
 *   rest of the app avoids.
 *
 *   Focus is drawn, not implied. React Native gives a TextInput no focus ring on
 *   Android beyond the cursor, and NativeWind v2 has no `focus:` variant, so the
 *   border weight is switched from hairline to 2px ink in component state. Without
 *   it there is no way to tell which of five fields the keyboard is pointed at,
 *   which fails the same accessibility requirement a missing focus outline does on
 *   the web.
 *
 *   Errors are terracotta, not red. `critical` is geru red oxide and means "leave
 *   the house now" everywhere else in this app; spending it on "that ward number
 *   does not look right" would flatten the one distinction the whole severity ramp
 *   is built to protect.
 */

interface FieldProps extends Omit<TextInputProps, 'style' | 'className'> {
  label: string;
  /** Sits under the field, in ink-soft. Says why the question is being asked. */
  help?: string;
  /** Replaces `help` when set. Terracotta, never red. */
  error?: string;
}

export default function Field({
  label,
  help,
  error,
  multiline,
  ...rest
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  const border = error
    ? 'border-high border-2'
    : focused
      ? 'border-ink border-2'
      : 'border-ink-soft border';

  return (
    <View className="mb-4">
      <Subhead className="text-body text-ink mb-1.5">{label}</Subhead>

      <View className={`bg-paper-deep rounded-md ${border}`}>
        <TextInput
          // 52dp rather than the 48 a button gets. A field is aimed at with a
          // thumb and then typed into while the keyboard covers half the screen,
          // and the extra four points is what keeps the caret clear of the well's
          // own border on Android.
          className={`px-3 text-body text-ink ${
            multiline ? 'py-3 min-h-[92px]' : 'min-h-[52px]'
          }`}
          // Both of these are props rather than styles, so no Tailwind class can
          // reach them. The RN default placeholder is a pale grey that vanishes
          // on cream, and the default selection colour is the platform blue —
          // the one hue this palette does not contain.
          placeholderTextColor={colors['ink-soft']}
          selectionColor={colors.high}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          {...rest}
        />
      </View>

      {error ? (
        <Body className="text-meta text-high mt-1.5 leading-5">{error}</Body>
      ) : help ? (
        <Body className="text-meta text-ink-soft mt-1.5 leading-5">{help}</Body>
      ) : null}
    </View>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  /** One line, when the choice needs explaining. Omitted for obvious options. */
  detail?: string;
}

interface ChoiceProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  help?: string;
}

/**
 * Pick one. Full-width rows rather than a segmented control.
 *
 * A segmented control would be tidier and wrong twice over: the labels here are
 * words in three different scripts, which no equal-width segment can hold, and a
 * segment small enough to fit three of them across a phone is smaller than the
 * 48dp minimum this app holds every other target to.
 *
 * The selected row is filled `night` rather than ticked in an accent. That reads
 * at arm's length, in sunlight, and in greyscale — the same reasoning that makes
 * severity a fill weight instead of a colour.
 */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  help,
}: ChoiceProps<T>) {
  return (
    <View className="mb-4">
      <Subhead className="text-body text-ink mb-1.5">{label}</Subhead>

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className="mb-2"
          >
            {({ pressed }) => (
              <View
                className={`min-h-[52px] px-3 py-2 flex-row items-center rounded-md border ${
                  selected
                    ? 'bg-night border-night'
                    : pressed
                      ? 'bg-paper-deep border-ink'
                      : 'bg-paper border-ink-soft'
                }`}
              >
                <View className="flex-1">
                  <Subhead
                    className={`text-body-lg ${selected ? 'text-paper' : 'text-ink'}`}
                  >
                    {option.label}
                  </Subhead>
                  {option.detail ? (
                    <Body
                      className={`text-meta mt-0.5 leading-5 ${
                        selected ? 'text-paper-deep' : 'text-ink-soft'
                      }`}
                    >
                      {option.detail}
                    </Body>
                  ) : null}
                </View>
                {selected ? (
                  <Check color={colors.paper} size={20} strokeWidth={3} />
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}

      {help ? (
        <Body className="text-meta text-ink-soft leading-5">{help}</Body>
      ) : null}
    </View>
  );
}
