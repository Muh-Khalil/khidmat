import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

/** Fades its children in on mount. */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/** Three staggered pulsing dots. */
function DotsLoader() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center gap-1">
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{ opacity: dot }}
          className="h-1.5 w-1.5 rounded-full bg-gray-400"
        />
      ))}
    </View>
  );
}

/** Agent "typing" bubble containing the dots loader. */
export function TypingIndicator() {
  return (
    <View className="mb-2 items-start">
      <View className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5">
        <DotsLoader />
      </View>
    </View>
  );
}
