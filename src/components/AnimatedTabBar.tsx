import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ITEM_SIZE = 50;
const ITEM_GAP = 4;

// Routes to completely hide from the tab bar
const HIDDEN_ROUTES = [
  'explore',
  'appointment-detail',
  'urinalysis',
  'edit-profile',
  'app-appearance',
  'chat',
  'vitals',
  'search',
  'history',
  'calendar',
  'security',
  'privacy',
  'upload-record',
];

type TabBarItemProps = {
  isFocused: boolean;
  isScanner?: boolean;
  options: any;
  onPress: () => void;
  onLongPress: () => void;
};

function TabBarItem({ isFocused, isScanner, options, onPress, onLongPress }: TabBarItemProps) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [isFocused]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
  }));

  const iconColor = isScanner ? '#ffffff' : isFocused ? '#ffffff' : '#71717a';
  const bgColor = isScanner ? '#6366f1' : '#27272a';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        width: TAB_ITEM_SIZE,
        height: TAB_ITEM_SIZE,
        marginHorizontal: ITEM_GAP / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Active / scanner background */}
      {isScanner ? (
        <View
          style={{
            position: 'absolute',
            width: TAB_ITEM_SIZE,
            height: TAB_ITEM_SIZE,
            borderRadius: TAB_ITEM_SIZE / 2,
            backgroundColor: bgColor,
          }}
        />
      ) : (
        <Animated.View
          style={[
            bgStyle,
            {
              position: 'absolute',
              width: TAB_ITEM_SIZE,
              height: TAB_ITEM_SIZE,
              borderRadius: TAB_ITEM_SIZE / 2,
              backgroundColor: bgColor,
            },
          ]}
        />
      )}

      {/* Icon */}
      {options.tabBarIcon?.({
        color: iconColor,
        size: 22,
        focused: isFocused,
      })}
    </Pressable>
  );
}

export function AnimatedTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter(
    (route: any) => !HIDDEN_ROUTES.includes(route.name),
  );

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: 20,
        right: 20,
        height: 68,
        backgroundColor: '#09090b',
        borderRadius: 34,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
      }}
    >
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const isFocused =
          state.routes.findIndex((r: any) => r.key === route.key) === state.index;
        const isScanner = route.name === 'scanner';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabBarItem
            key={route.key}
            isFocused={isFocused}
            isScanner={isScanner}
            options={options}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}
