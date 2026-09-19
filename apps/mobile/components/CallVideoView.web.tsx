import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

// Deliberately the ambient DOM `MediaStream` (this file only builds for the
// web target), not the one re-exported from '@/lib/webrtc' — that import
// resolves to react-native-webrtc's own MediaStream class at the type
// level (see tsconfig's moduleSuffixes), which isn't structurally the same
// type the DOM's <video>.srcObject expects.
export function CallVideoView({
  stream,
  mirror,
  muted,
  style,
}: {
  stream: MediaStream | null;
  mirror?: boolean;
  muted?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  // A plain DOM element (this file only builds for the web target), so its
  // `style` must be a single flat object, unlike React Native's array form
  // — the caller's RN StyleSheet.create() result is already a plain object
  // under react-native-web, so it spreads here without needing .flatten().
  const flatStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000',
    ...(mirror ? { transform: 'scaleX(-1)' } : null),
    ...style,
  };

  return <video ref={ref} autoPlay playsInline muted={muted} style={flatStyle} />;
}
