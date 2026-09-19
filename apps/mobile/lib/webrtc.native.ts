// Native (iOS/Android) build: react-native-webrtc provides its own classes
// matching the browser WebRTC API surface closely enough that the call
// logic in useTeleconsult.ts can import from '@/lib/webrtc' without caring
// which platform it's running on. See webrtc.web.ts for the other half.
export { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream } from 'react-native-webrtc';
