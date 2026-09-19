import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage, type AppLanguage } from '@/lib/i18n';

// Speech input for selected fields, per Phase 8's Build list. expo-speech
// is text-to-speech only (checked docs.expo.dev/versions/v57.0.0 before
// writing this, per AGENTS.md) — real speech *recognition* needs a native
// module (expo-speech-recognition), which needs a custom dev build and
// breaks the Expo-Go workflow this whole project runs on. The browser's
// own SpeechRecognition API needs neither: it's built into Chrome/Edge on
// the web build, so that's what this uses. Native shows the mic as an
// honest "not available in this build" state instead of a silent no-op —
// the guardrail ("voice must complement the interface, critical actions
// stay reachable by touch") is satisfied either way, since typing always
// works everywhere.
const SPEECH_LOCALES: Record<AppLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getBrowserSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const { language, t } = useLanguage();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const SpeechRecognitionCtor = getBrowserSpeechRecognition();

  if (!SpeechRecognitionCtor) {
    return (
      <Pressable
        accessibilityLabel={t('voice_webOnly')}
        onPress={() => Alert.alert(t('voice_webOnly'))}
        style={[styles.button, styles.buttonDisabled]}>
        <Ionicons name="mic-off-outline" size={18} color="#9a9a9a" />
      </Pressable>
    );
  }

  const handlePress = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = SPEECH_LOCALES[language];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <Pressable
      accessibilityLabel={listening ? t('voice_listening') : t('voice_speak')}
      onPress={handlePress}
      style={[styles.button, listening && styles.buttonActive]}>
      <Ionicons name={listening ? 'mic' : 'mic-outline'} size={18} color={listening ? '#fff' : '#2e7d5f'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f4ee',
  },
  buttonActive: {
    backgroundColor: '#c0392b',
  },
  buttonDisabled: {
    backgroundColor: '#f0f0f0',
  },
});
