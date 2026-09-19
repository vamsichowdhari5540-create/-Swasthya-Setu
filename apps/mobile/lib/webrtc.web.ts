// Web build: the browser already implements the real WebRTC APIs — no
// library needed. Metro picks this file over webrtc.native.ts when
// bundling for the `web` platform (the `.web.ts` extension), so the call
// logic in useTeleconsult.ts stays identical across platforms.
export const RTCPeerConnection = globalThis.RTCPeerConnection;
export const RTCIceCandidate = globalThis.RTCIceCandidate;
export const RTCSessionDescription = globalThis.RTCSessionDescription;
export const mediaDevices = navigator.mediaDevices;
export const MediaStream = globalThis.MediaStream;
