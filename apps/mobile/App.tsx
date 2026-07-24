import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';
import { Loading } from './components/ui';
import { ChallengesScreen } from './screens/ChallengesScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MapScreen } from './screens/MapScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RecordScreen } from './screens/RecordScreen';
import { ShopScreen } from './screens/ShopScreen';
import { SocialScreen } from './screens/SocialScreen';
import { colors, font } from './theme';

const Tab = createBottomTabNavigator();

/** Emoji tab icons keep the bundle free of an icon-font dependency. */
const TAB_ICON: Record<string, string> = {
  Map: '🗺️',
  Record: '⏺️',
  Social: '👥',
  History: '📜',
  Rank: '🏆',
  Profile: '👤',
  Challenges: '🎯',
  Shop: '🪙',
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.base,
    card: colors.base,
    text: colors.ink,
    border: 'rgba(154,167,189,0.12)',
    primary: colors.volt,
  },
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICON[name] ?? '•'}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        // Stable handle for device tests. Matching tabs by label is ambiguous:
        // "History" is both a tab label and that screen's title.
        tabBarButtonTestID: `tab-${route.name}`,
        tabBarActiveTintColor: colors.volt,
        tabBarInactiveTintColor: colors.ink3,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.base,
          borderTopColor: 'rgba(154,167,189,0.12)',
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Social" component={SocialScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Rank" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {/* Reachable from Profile; hidden from the bar to keep it to six tabs. */}
      <Tab.Screen
        name="Challenges"
        component={ChallengesScreen}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }
  return user ? <Tabs /> : <LoginScreen />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.base }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </NavigationContainer>
  );
}
