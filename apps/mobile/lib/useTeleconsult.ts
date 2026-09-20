import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSULTATION_JOIN_ROOM, CONSULTATION_SIGNAL_EVENT, type ConsultationSignal } from '@swasthya-setu/shared-types';

import { connectSocket } from '@/lib/socket';
import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, type MediaStream } from '@/lib/webrtc';

export type CallState =
  | 'requesting-media'
  | 'waiting-for-peer'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'error';

// STUN alone only resolves direct/LAN-reachable pairs; most real mobile
// carrier NATs are symmetric and need a TURN relay to connect at all. A
// free-tier TURN URL/credentials can be supplied via EXPO_PUBLIC_TURN_*
// (e.g. Metered, Twilio NTS) — falls back to the openrelay.metered.ca demo
// relay (public, rate-limited, fine for a pilot, not for production scale)
// so calls still work off-LAN even before those env vars are set.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: process.env.EXPO_PUBLIC_TURN_URL ?? 'turn:openrelay.metered.ca:80',
    username: process.env.EXPO_PUBLIC_TURN_USERNAME ?? 'openrelayproject',
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? 'openrelayproject',
  },
];

interface UseTeleconsultOptions {
  accessToken: string | undefined;
  consultationId: string;
  // The consultation's creator already has a waiting room open (started it
  // first); whoever isn't the creator sends the SDP offer once they join,
  // rather than both sides racing to offer at once.
  isInitiator: boolean;
  initialVideoEnabled: boolean;
  // False until the consultation record (and so `isInitiator`) has
  // actually loaded — starting media/signaling any earlier would run with
  // a meaningless default value instead of waiting for the real one.
  enabled: boolean;
}

export function useTeleconsult({
  accessToken,
  consultationId,
  isInitiator,
  initialVideoEnabled,
  enabled,
}: UseTeleconsultOptions) {
  const [state, setState] = useState<CallState>('requesting-media');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(initialVideoEnabled);
  const [micEnabled, setMicEnabled] = useState(true);

  const pcRef = useRef<InstanceType<typeof RTCPeerConnection> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (!accessToken || !enabled) return;
    let cancelled = false;
    const socket = connectSocket(accessToken);

    async function start() {
      try {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: initialVideoEnabled });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        if (!cancelled) {
          setErrorMessage('Could not access the camera/microphone. Check permissions and try again.');
          setState('error');
        }
        return;
      }

      socket.emit(CONSULTATION_JOIN_ROOM, { consultationId }, async (allowed: boolean) => {
        if (cancelled) return;
        if (!allowed) {
          setErrorMessage("You don't have access to this consultation.");
          setState('error');
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

        pc.ontrack = (event: { streams: MediaStream[] }) => {
          if (!cancelled) setRemoteStream(event.streams[0]);
        };
        pc.onicecandidate = (event: { candidate: unknown }) => {
          if (event.candidate) {
            socket.emit(CONSULTATION_SIGNAL_EVENT, {
              consultationId,
              signal: { kind: 'ice-candidate', candidate: event.candidate },
            });
          }
        };
        const onStateChange = () => {
          const status = (pc as unknown as { connectionState?: string; iceConnectionState?: string });
          const combined = status.connectionState ?? status.iceConnectionState;
          if (cancelled) return;
          if (combined === 'connected') setState('connected');
          else if (combined === 'failed' || combined === 'disconnected') {
            setErrorMessage('The call connection was lost.');
            setState('error');
          }
        };
        (pc as unknown as { onconnectionstatechange: () => void }).onconnectionstatechange = onStateChange;
        (pc as unknown as { oniceconnectionstatechange: () => void }).oniceconnectionstatechange = onStateChange;

        socket.on(CONSULTATION_SIGNAL_EVENT, async (signal: ConsultationSignal) => {
          if (cancelled) return;
          try {
            if (signal.kind === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit(CONSULTATION_SIGNAL_EVENT, { consultationId, signal: { kind: 'answer', sdp: answer.sdp } });
              setState('connecting');
            } else if (signal.kind === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
              setState('connecting');
            } else if (signal.kind === 'ice-candidate') {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as never)).catch(() => {});
            } else if (signal.kind === 'bye') {
              setState('ended');
            }
          } catch {
            // A stray/late signal (e.g. an ICE candidate that arrives after
            // the connection already failed) shouldn't crash the call.
          }
        });

        setState('waiting-for-peer');

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit(CONSULTATION_SIGNAL_EVENT, { consultationId, signal: { kind: 'offer', sdp: offer.sdp } });
          setState('connecting');
        }
      });
    }

    start();

    return () => {
      cancelled = true;
      socket.off(CONSULTATION_SIGNAL_EVENT);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, consultationId, isInitiator, enabled]);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  }, []);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicEnabled(track.enabled);
  }, []);

  const hangUp = useCallback(() => {
    if (accessToken) {
      connectSocket(accessToken).emit(CONSULTATION_SIGNAL_EVENT, { consultationId, signal: { kind: 'bye' } });
    }
    cleanup();
    setState('ended');
  }, [accessToken, consultationId, cleanup]);

  return { state, errorMessage, localStream, remoteStream, videoEnabled, toggleVideo, micEnabled, toggleMic, hangUp };
}
