import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { markFeatureSeen } from '../utils/featureHints';
import { ParsedSet, parseSetPhrase } from '../utils/voiceSetParser';

// Only one recognition session exists at a time; module-level owner id makes
// sure only the button that started it reacts to the events.
let activeOwner: number | null = null;
let ownerSeq = 0;

export default function VoiceSetButton({
  onSet,
  onStatus,
  size = 36,
}: {
  /** Called with the parsed set when a phrase is understood. */
  onSet: (set: ParsedSet) => void;
  /** Status line for the parent to render ("Listening…", errors, echo). */
  onStatus: (message: string | null) => void;
  size?: number;
}) {
  const [listening, setListening] = useState(false);
  const myId = useRef<number>(0);

  const finish = () => {
    if (activeOwner === myId.current) activeOwner = null;
    setListening(false);
  };

  useSpeechRecognitionEvent('result', (event) => {
    if (activeOwner !== myId.current) return;
    const transcript = event.results?.[0]?.transcript ?? '';
    if (!event.isFinal) {
      onStatus(transcript ? `"${transcript}"` : 'Listening…');
      return;
    }
    finish();
    const parsed = parseSetPhrase(transcript);
    if (parsed) {
      onStatus(
        `Heard "${transcript}" → ${parsed.weight != null ? `${parsed.weight} kg` : 'bodyweight'} × ${parsed.reps}`
      );
      onSet(parsed);
    } else {
      onStatus(`Couldn't read "${transcript}" — try "sixty by eight"`);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (activeOwner !== myId.current) return;
    finish();
    // "no-speech" is the normal silence timeout — keep the message gentle.
    onStatus(event.error === 'no-speech' ? 'Heard nothing — tap and try again' : 'Mic error — try again');
  });

  useSpeechRecognitionEvent('end', () => {
    if (activeOwner !== myId.current) return;
    finish();
  });

  const toggle = async () => {
    markFeatureSeen('voice-logging');
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      onStatus('Allow the microphone in Settings → gymbro to log by voice');
      return;
    }
    myId.current = ++ownerSeq;
    activeOwner = myId.current;
    setListening(true);
    onStatus('Listening… say "sixty by eight"');
    // Prefer fully on-device recognition (offline, private, no quota of any
    // kind); fall back to Apple's dictation service when the device lacks the
    // local model — still zero Gemini usage either way.
    const onDevice =
      typeof ExpoSpeechRecognitionModule.supportsOnDeviceRecognition === 'function'
        ? ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()
        : false;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      // Bias toward set-logging vocabulary — reduces "for" being merged into
      // the numbers ("sixty for eight" → "6048").
      contextualStrings: ['by', 'for', 'reps', 'kilos', 'kg', 'bodyweight'],
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size / 3 },
        listening && styles.btnActive,
      ]}
      activeOpacity={0.8}
      onPress={toggle}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons
        name={listening ? 'stop' : 'mic-outline'}
        size={Math.round(size * 0.5)}
        color={listening ? '#EF4444' : '#22C55E'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
});
