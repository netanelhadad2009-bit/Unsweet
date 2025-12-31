import { StyleSheet, Dimensions, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';
import { Theme } from '../../constants/Theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRAPH_WIDTH = SCREEN_WIDTH * 0.9;
const GRAPH_HEIGHT = 400;

export function ProgressGraph() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for starting point
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Define dramatic transformation curve
  // Start point at struggle → brief dip → dramatic upward surge
  const startX = 30;
  const startY = GRAPH_HEIGHT - 60;
  const dipX = 80;
  const dipY = GRAPH_HEIGHT - 40; // The lowest point (detox struggle)
  const midX = GRAPH_WIDTH * 0.4;
  const midY = GRAPH_HEIGHT - 100;
  const riseX = GRAPH_WIDTH * 0.65;
  const riseY = GRAPH_HEIGHT - 180;
  const endX = GRAPH_WIDTH - 30;
  const endY = 50; // High point (success)

  const pathData = `
    M ${startX} ${startY}
    Q ${dipX - 10} ${startY + 5}, ${dipX} ${dipY}
    Q ${dipX + 30} ${dipY - 20}, ${midX} ${midY}
    Q ${midX + 40} ${midY - 50}, ${riseX} ${riseY}
    Q ${riseX + 30} ${riseY - 50}, ${endX} ${endY}
  `.trim();

  // Create fill path for gradient area under the line
  const fillPathData = `
    ${pathData}
    L ${endX} ${GRAPH_HEIGHT}
    L ${startX} ${GRAPH_HEIGHT}
    Z
  `.trim();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
        <Defs>
          <LinearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Theme.colors.primary} stopOpacity="0.35" />
            <Stop offset="0.5" stopColor={Theme.colors.primary} stopOpacity="0.15" />
            <Stop offset="1" stopColor={Theme.colors.primary} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="startGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B00000" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#B00000" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Subtle grid lines for depth */}
        <Path
          d={`M ${startX} ${GRAPH_HEIGHT - 70} L ${endX} ${GRAPH_HEIGHT - 70}`}
          stroke="#E8EAED"
          strokeWidth="1"
          strokeDasharray="6,6"
        />
        <Path
          d={`M ${startX} ${GRAPH_HEIGHT - 140} L ${endX} ${GRAPH_HEIGHT - 140}`}
          stroke="#E8EAED"
          strokeWidth="1"
          strokeDasharray="6,6"
        />
        <Path
          d={`M ${startX} ${GRAPH_HEIGHT - 210} L ${endX} ${GRAPH_HEIGHT - 210}`}
          stroke="#E8EAED"
          strokeWidth="1"
          strokeDasharray="6,6"
        />

        {/* Filled area under the line */}
        <Path
          d={fillPathData}
          fill="url(#graphGradient)"
        />

        {/* Main transformation line - thicker for impact */}
        <Path
          d={pathData}
          stroke={Theme.colors.primary}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Starting point - PAIN POINT with glow effect */}
        <G>
          {/* Outer glow */}
          <Circle
            cx={startX}
            cy={startY}
            r="18"
            fill="#B00000"
            opacity="0.15"
          />
          {/* Middle ring */}
          <Circle
            cx={startX}
            cy={startY}
            r="12"
            fill="#B00000"
            opacity="0.25"
          />
          {/* Core dot */}
          <Circle
            cx={startX}
            cy={startY}
            r="8"
            fill="#B00000"
          />
        </G>

        {/* Ending point - SUCCESS with highlight */}
        <G>
          {/* Outer glow */}
          <Circle
            cx={endX}
            cy={endY}
            r="16"
            fill={Theme.colors.primary}
            opacity="0.2"
          />
          {/* Core dot */}
          <Circle
            cx={endX}
            cy={endY}
            r="10"
            fill={Theme.colors.primary}
          />
          {/* Inner highlight */}
          <Circle
            cx={endX}
            cy={endY}
            r="4"
            fill="#FFFFFF"
            opacity="0.6"
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
