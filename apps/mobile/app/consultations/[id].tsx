import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import {
  CONSULTATION_CHANGED_EVENT,
  type Consultation,
} from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useTeleconsult } from '@/lib/useTeleconsult';
import { CallVideoView } from '@/components/CallVideoView';
import { useLanguage } from '@/lib/i18n';

type ScreenState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; consultation: Consultation };

export default function ConsultationCallScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { session, profile } = useAuth();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const ended = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Consultation>(session, `/api/consultations/${id}`)
      .then(async (consultation) => {
        if (cancelled) return;
        // The creator already has the waiting room open; anyone else
        // joining is what flips the consultation to "active" server-side.
        if (consultation.createdByUserId !== profile?.id) {
          await apiFetch<Consultation>(session, `/api/consultations/${id}/join`, { method: 'PATCH' });
        }
        if (!cancelled) setState({ kind: 'ready', consultation });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: 'Could not open this consultation.' });
      });
    return () => {
      cancelled = true;
    };
  }, [session, profile, id]);

  const isInitiator = state.kind === 'ready' && state.consultation.createdByUserId !== profile?.id;
  const initialVideoEnabled = state.kind === 'ready' ? state.consultation.mode === 'video' : true;

  const {
    state: callState,
    errorMessage,
    localStream,
    remoteStream,
    videoEnabled,
    toggleVideo,
    micEnabled,
    toggleMic,
    hangUp,
  } = useTeleconsult({
    accessToken: session?.access_token,
    consultationId: id,
    isInitiator,
    initialVideoEnabled,
    enabled: state.kind === 'ready',
  });

  const endCall = async () => {
    if (ended.current) return;
    ended.current = true;
    hangUp();
    try {
      await apiFetch(session, `/api/consultations/${id}/end`, { method: 'PATCH' });
    } catch {
      // The call already tore down locally; if this fails the metadata
      // simply gets finalized whenever someone next opens the consultation.
    }
    router.back();
  };

  // If the other side ends the call first, follow them out.
  useEffect(() => {
    if (!session?.access_token) return;
    const socket = connectSocket(session.access_token);
    const handler = (updated: Consultation) => {
      if (updated.id === id && updated.status === 'ended' && !ended.current) {
        ended.current = true;
        hangUp();
        router.back();
      }
    };
    socket.on(CONSULTATION_CHANGED_EVENT, handler);
    return () => {
      socket.off(CONSULTATION_CHANGED_EVENT, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, id]);

  if (state.kind === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: '#c0392b', textAlign: 'center' }}>{state.message}</Text>
      </View>
    );
  }

  if (callState === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: '#000', padding: 24 }]}>
        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 16 }}>{errorMessage}</Text>
        <Pressable style={styles.endButton} onPress={() => router.back()}>
          <Text style={styles.endButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.call}>
      {remoteStream ? (
        <CallVideoView stream={remoteStream} style={styles.remoteVideo} />
      ) : (
        <View style={[styles.remoteVideo, styles.center]} lightColor="#000" darkColor="#000">
          <ActivityIndicator color="#fff" />
          <Text style={styles.statusText}>
            {callState === 'requesting-media' && 'Requesting camera access…'}
            {callState === 'waiting-for-peer' && 'Waiting for the other participant to join…'}
            {callState === 'connecting' && 'Connecting…'}
          </Text>
        </View>
      )}

      {localStream && videoEnabled && (
        <CallVideoView stream={localStream} mirror muted style={styles.localVideo} />
      )}

      <View style={styles.controls} lightColor="rgba(0,0,0,0.55)" darkColor="rgba(0,0,0,0.55)">
        <Pressable style={styles.controlButton} onPress={toggleMic}>
          <Text style={styles.controlButtonText}>{micEnabled ? 'Mute' : 'Unmute'}</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={toggleVideo}>
          <Text style={styles.controlButtonText}>{videoEnabled ? 'Video Off' : 'Video On'}</Text>
        </Pressable>
        <Pressable style={styles.endButton} onPress={endCall}>
          <Text style={styles.endButtonText}>{t('call_endCall')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  call: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    flex: 1,
  },
  localVideo: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingBottom: 32,
  },
  controlButton: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  endButton: {
    backgroundColor: '#c0392b',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
