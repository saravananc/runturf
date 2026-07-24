import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Btn, ErrorNote, Input } from '../components/ui';
import { colors, font, radius, space, type } from '../theme';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.mark}>
          <Text style={s.markGlyph}>⚡</Text>
        </View>
        <Text style={s.title}>RunTurf</Text>
        <Text style={s.subtitle}>Run. Capture territory. Defend your turf.</Text>

        <View style={{ height: space(6) }} />

        <Input
          testID="login-username"
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          returnKeyType="next"
        />
        <Input
          testID="login-password"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error ? <ErrorNote message={error} /> : null}
        <Btn
          testID="login-submit"
          label={busy ? 'One sec…' : mode === 'login' ? 'Sign in' : 'Create account'}
          disabled={busy || !username.trim() || !password}
          onPress={submit}
        />
        <Text
          style={s.link}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </Text>
        <Text style={s.demo}>Demo account: demo / demo1234</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  container: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(3) },
  mark: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.volt,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  markGlyph: { fontSize: 32 },
  title: {
    fontFamily: font.extrabold,
    fontSize: type.display,
    color: colors.ink,
    textAlign: 'center',
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
  },
  link: {
    fontFamily: font.medium,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
    padding: space(2.5),
  },
  demo: {
    fontFamily: font.regular,
    fontSize: type.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: space(4),
  },
});
