import React from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Subhead } from './Type';
import { colors } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet' | 'quiet-inverse' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  icon?: LucideIcon;
  /** Stretch to the full width of the parent. Default for primary actions. */
  block?: boolean;
}

/**
 * Every button is at least 48dp tall — the Android accessibility minimum, and
 * the smallest thing a wet or shaking thumb can reliably hit.
 *
 * Pressed state changes the fill, not just the opacity: a 50% opacity press
 * state is invisible in direct sunlight.
 *
 * No trailing arrow glyphs. The label says what happens.
 */
const FILL: Record<Variant, { rest: string; pressed: string; text: string; icon: string }> = {
  primary: {
    rest: 'bg-night',
    pressed: 'bg-night-soft',
    text: 'text-paper',
    icon: colors.paper,
  },
  secondary: {
    rest: 'bg-paper-deep border border-ink-soft',
    pressed: 'bg-paper',
    text: 'text-ink',
    icon: colors.ink,
  },
  quiet: {
    rest: 'bg-transparent',
    pressed: 'bg-paper-deep',
    text: 'text-ink',
    icon: colors.ink,
  },
  /**
   * For quiet actions sitting on a night or critical ground, where `quiet`'s ink
   * label drops to 2.45:1 and effectively disappears. Cream on red oxide is
   * 6.22:1, and the border gives the target an edge without adding a second fill.
   */
  'quiet-inverse': {
    rest: 'bg-transparent border border-paper',
    pressed: 'bg-night-soft',
    text: 'text-paper',
    icon: colors.paper,
  },
  danger: {
    rest: 'bg-critical',
    pressed: 'bg-high',
    text: 'text-paper',
    icon: colors.paper,
  },
};

export default function Button({
  label,
  variant = 'primary',
  icon: Icon,
  block = true,
  disabled,
  ...rest
}: ButtonProps) {
  const fill = FILL[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
    >
      {({ pressed }) => (
        <View
          className={`min-h-[48px] px-5 flex-row items-center justify-center rounded-md ${
            block ? 'w-full' : 'self-start'
          } ${pressed ? fill.pressed : fill.rest} ${disabled ? 'opacity-40' : ''}`}
        >
          {Icon ? (
            <View className="mr-2">
              <Icon color={fill.icon} size={19} strokeWidth={2.5} />
            </View>
          ) : null}
          {/*
            One line when the row shrink-wraps, free to wrap when it does not.

            A content-sized row asks Android to measure the label and then lay it
            out again inside the width it reported, and for Bengali the two passes
            disagree: `আমি দেখেছি` measured as one line, wrapped after `আমি`, and
            the second word was clipped below a box that had no room for it. There
            is no width for it to wrap into in a shrink-wrapped row, so saying so
            is the fix.

            Block buttons get no such limit on purpose. Their width comes from the
            parent and their height can grow, and `Walk to {shelter}` carries a
            hall name somebody has to read in full — an ellipsis there would be
            hiding the one word that says where to go.
          */}
          <Subhead
            className={`text-body ${fill.text}`}
            numberOfLines={block ? undefined : 1}
          >
            {label}
          </Subhead>
        </View>
      )}
    </Pressable>
  );
}
