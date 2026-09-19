import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { MediaStream } from '@/lib/webrtc';

export function CallVideoView({
  stream,
  mirror,
  style,
}: {
  stream: MediaStream | null;
  mirror?: boolean;
  muted?: boolean; // no-op on native: RTCView never plays local audio back
  style?: StyleProp<ViewStyle>;
}) {
  if (!stream) return <View style={[styles.placeholder, style]} />;
  return (
    <RTCView streamURL={stream.toURL()} style={[styles.video, style]} mirror={mirror} objectFit="cover" />
  );
}

const styles = StyleSheet.create({
  video: { flex: 1, backgroundColor: '#000' },
  placeholder: { flex: 1, backgroundColor: '#000' },
});
