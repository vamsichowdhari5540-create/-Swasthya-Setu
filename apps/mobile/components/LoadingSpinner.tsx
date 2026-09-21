import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A branded ring rather than the platform's default spinner — a small
// touch, but this app's loading state is the single most-seen piece of UI
// in a live demo (it's what's on screen between almost every tap), so it's
// worth it looking intentional. Built on react-native-svg, already a
// dependency for the QR code, so this adds no new native module.
export function LoadingSpinner({ size = 40, color }: { size?: number; color?: string }) {
  const colorScheme = useColorScheme();
  const tint = color ?? Colors[colorScheme].tint;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const strokeWidth = Math.max(2.5, size / 12);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Faint full ring so the moving arc reads as "spinning", not just a floating dash. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tint}
          strokeWidth={strokeWidth}
          opacity={0.18}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tint}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * 0.28} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
}
