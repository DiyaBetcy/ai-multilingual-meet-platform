import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const getWebrtcUrl = () => {
  if (import.meta.env.VITE_WEBRTC_URL) {
    return import.meta.env.VITE_WEBRTC_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:3001`;
    }
  }
  return "http://localhost:3001";
};

const WEBRTC_URL = getWebrtcUrl();

/* Public STUN is enough for localhost/LAN testing. A TURN relay is
   required when both peers are behind symmetric NATs; configure it with
   VITE_TURN_URL, VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL. */
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || "",
    credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
  });
}

function mediaErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera/microphone permission was denied. Allow access for this site in your browser, then rejoin the meeting.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone was found. Connect a device and rejoin the meeting.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera or microphone is already in use by another application. Close it and rejoin.";
    case "OverconstrainedError":
      return "The requested camera or microphone settings are not supported by this device.";
    default:
      return `Could not access the camera or microphone: ${error?.message || "unknown error"}`;
  }
}

export const useWebRTC = (roomId, userName, userId, options = {}) => {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const audioDetectorsRef = useRef(new Map());
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mediaInitPromiseRef = useRef(null);
  const mediaStateRef = useRef({
    micOn: false,
    camOn: false,
    isScreenSharing: false,
  });

  const currentUserIdRef = useRef(null);
  const userNameRef = useRef(userName);
  const handRaisedRef = useRef(false);
  const waitingRoomRef = useRef(Boolean(options.waitingRoom));

  userNameRef.current = userName;
  waitingRoomRef.current = Boolean(options.waitingRoom);

  const mediaReadyRef = useRef(null);
  if (!mediaReadyRef.current) {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    mediaReadyRef.current = { promise, resolve, satisfied: false };
  }

  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [qaQuestions, setQaQuestions] = useState([]);
  const [questionNotice, setQuestionNotice] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [speakingUser, setSpeakingUser] = useState(null);

  const [waitingStatus, setWaitingStatus] = useState("idle");
  const [waitingMessage, setWaitingMessage] = useState("");
  const [waitingParticipants, setWaitingParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(
    Boolean(options.waitingRoom)
  );

  const resolveMediaReady = useCallback(() => {
    const ready = mediaReadyRef.current;
    if (ready && !ready.satisfied) {
      ready.satisfied = true;
      ready.resolve();
    }
  }, []);

  const waitForMediaReady = useCallback(async (timeoutMs = 15000) => {
    if (localStreamRef.current) return;

    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });

    await Promise.race([mediaReadyRef.current.promise, timeout]);
    clearTimeout(timer);
  }, []);

  const applyTranslationAudioMode = useCallback(() => {
    const translationModeOn = window.translationModeOn || false;
    const remoteVideos = document.querySelectorAll("video[id^='video-']");

    remoteVideos.forEach((video) => {
      video.muted = translationModeOn;
      video.volume = translationModeOn ? 0 : 1;
    });
  }, []);

  const stopAudioDetection = useCallback((id) => {
    const stop = audioDetectorsRef.current.get(id);
    if (stop) {
      stop();
      audioDetectorsRef.current.delete(id);
    }
  }, []);

  const setupAudioLevelDetection = useCallback(
    (stream, id) => {
      if (!stream || !id || stream.getAudioTracks().length === 0) return null;

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;

        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastSpokenAt = 0;

        const intervalId = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);

          const average =
            dataArray.reduce((sum, value) => sum + value, 0) /
            dataArray.length;

          if (average > 20) {
            const now = Date.now();
            setSpeakingUser(id);
            lastSpokenAt = now;

            setTimeout(() => {
              setSpeakingUser((prev) =>
                prev === id && Date.now() - lastSpokenAt >= 450 ? null : prev
              );
            }, 500);
          }
        }, 150);

        return () => {
          clearInterval(intervalId);
          source.disconnect();
          audioContext.close().catch(() => {});
        };
      } catch (error) {
        console.warn("Audio level detection unavailable:", error);
        return null;
      }
    },
    []
  );

  const monitorAudio = useCallback(
    (stream, id) => {
      stopAudioDetection(id);
      const cleanup = setupAudioLevelDetection(stream, id);
      if (cleanup) audioDetectorsRef.current.set(id, cleanup);
    },
    [setupAudioLevelDetection, stopAudioDetection]
  );

  const flushIceCandidates = useCallback(async (participantId) => {
    const pc = peerConnectionsRef.current.get(participantId);
    const queued = pendingIceRef.current.get(participantId);

    if (!pc || !pc.remoteDescription || !queued?.length) return;

    pendingIceRef.current.delete(participantId);

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("Could not add queued ICE candidate:", error);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    async (participantId, isInitiator) => {
      let pc = peerConnectionsRef.current.get(participantId);
      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.ontrack = (event) => {
        const stream =
          event.streams[0] ||
          remoteStreamsRef.current.get(participantId) ||
          new MediaStream();

        if (
          !event.streams[0] &&
          event.track &&
          !stream.getTracks().some((track) => track.id === event.track.id)
        ) {
          stream.addTrack(event.track);
        }

        remoteStreamsRef.current.set(participantId, stream);

        setParticipants((previous) =>
          previous.map((participant) =>
            participant.id === participantId
              ? { ...participant, stream }
              : participant
          )
        );

        monitorAudio(stream, participantId);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("ice-candidate", {
            targetId: participantId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          console.warn(`Peer connection failed with ${participantId}`);
          try {
            pc.restartIce();
          } catch (error) {
            console.warn("ICE restart unavailable:", error);
          }
        }
      };

      peerConnectionsRef.current.set(participantId, pc);

      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        await pc.setLocalDescription(offer);

        socketRef.current?.emit("offer", {
          targetId: participantId,
          offer,
        });
      }

      return pc;
    },
    [monitorAudio]
  );

  useEffect(() => {
    const interval = setInterval(applyTranslationAudioMode, 500);
    return () => clearInterval(interval);
  }, [applyTranslationAudioMode]);

  useEffect(() => {
    if (!roomId || !userName) return;

    const socket = io(WEBRTC_URL, {
      // Start with HTTP long-polling (the Socket.IO default) and upgrade
      // to WebSocket. This avoids the "WebSocket is closed before the
      // connection is established" startup race.
      transports: ["polling", "websocket"],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", async () => {
      currentUserIdRef.current = socket.id;
      setIsConnected(true);
      setConnectionError("");

      // Do not publish the participant or create offers until the local
      // tracks are ready. The server starts negotiating immediately after
      // join-room, so joining first caused offers without media.
      await waitForMediaReady();

      if (!socket.connected) return;

      socket.emit("join-room", {
        roomId,
        userName,
        userId: userId || socket.id,
        waitingRoom: waitingRoomRef.current,
      });

      socket.emit("get-questions");
      socket.emit("media-state-change", {
        micOn: mediaStateRef.current.micOn,
        camOn: mediaStateRef.current.camOn,
        isScreenSharing: mediaStateRef.current.isScreenSharing,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      setIsConnected(false);
      setConnectionError(
        `Cannot reach the meeting server at ${WEBRTC_URL}. ${error?.message || ""}`.trim()
      );
    });

    socket.on("participants-list", async (participantsList) => {
      const safeList = Array.isArray(participantsList)
        ? participantsList
        : [];

      setParticipants((previous) => {
        const previousById = new Map(
          previous.map((participant) => [participant.id, participant])
        );

        const mapped = safeList.map((participant) => {
          const existing = previousById.get(participant.id);
          const isYou = participant.id === currentUserIdRef.current;

          return {
            ...existing,
            ...participant,
            isYou,
            stream: isYou
              ? localStreamRef.current || existing?.stream
              : existing?.stream,
            micOn: isYou
              ? mediaStateRef.current.micOn
              : participant.micOn ?? existing?.micOn ?? true,
            camOn: isYou
              ? mediaStateRef.current.camOn
              : participant.camOn ?? existing?.camOn ?? true,
            isScreenSharing: isYou
              ? mediaStateRef.current.isScreenSharing
              : participant.isScreenSharing ??
                existing?.isScreenSharing ??
                false,
            handRaised: existing?.handRaised ?? false,
          };
        });

        const self = mapped.find((participant) => participant.isYou);

        return self
          ? [self, ...mapped.filter((participant) => !participant.isYou)]
          : mapped;
      });

      socket.emit("get-questions");

      const myId = currentUserIdRef.current;

      for (const participant of safeList) {
        if (
          participant.id !== myId &&
          myId &&
          myId < participant.id &&
          !peerConnectionsRef.current.has(participant.id)
        ) {
          try {
            await createPeerConnection(participant.id, true);
          } catch (error) {
            console.error(
              "Failed to create peer connection:",
              participant.id,
              error
            );
          }
        }
      }
    });

    socket.on("user-joined", async (participant) => {
      if (!participant?.id || participant.id === currentUserIdRef.current) {
        return;
      }

      setParticipants((previous) => {
        if (previous.some((item) => item.id === participant.id)) {
          return previous;
        }

        return [...previous, participant];
      });

      const myId = currentUserIdRef.current;

      if (myId && myId < participant.id) {
        try {
          await createPeerConnection(participant.id, true);
        } catch (error) {
          console.error("Failed to create peer connection:", error);
        }
      }
    });

    socket.on("user-left", (data = {}) => {
      const { userId: leftUserId, actualUserId } = data;

      if (leftUserId) {
        const pc = peerConnectionsRef.current.get(leftUserId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(leftUserId);
        }

        stopAudioDetection(leftUserId);
        remoteStreamsRef.current.delete(leftUserId);
        pendingIceRef.current.delete(leftUserId);
      }

      setParticipants((previous) =>
        previous.filter((participant) => {
          if (participant.id === leftUserId) return false;
          if (actualUserId && participant.userId === actualUserId) return false;
          return true;
        })
      );
    });

    socket.on("offer", async ({ fromId, offer } = {}) => {
      if (!fromId || !offer) return;

      try {
        const pc = await createPeerConnection(fromId, false);

        // One peer is polite. If both sides create an offer at the same
        // time, the polite side rolls back and accepts the other offer.
        if (pc.signalingState === "have-local-offer") {
          const polite = currentUserIdRef.current > fromId;
          if (!polite) return;
          await pc.setLocalDescription({ type: "rollback" });
        } else if (pc.signalingState !== "stable") {
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceCandidates(fromId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("answer", { targetId: fromId, answer });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    socket.on("answer", async ({ fromId, answer } = {}) => {
      try {
        const pc = peerConnectionsRef.current.get(fromId);

        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIceCandidates(fromId);
        }
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    socket.on("ice-candidate", async ({ fromId, candidate } = {}) => {
      if (!fromId || !candidate) return;

      const pc = peerConnectionsRef.current.get(fromId);

      if (!pc || !pc.remoteDescription) {
        const queued = pendingIceRef.current.get(fromId) || [];
        queued.push(candidate);
        pendingIceRef.current.set(fromId, queued);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("Error adding ICE candidate:", error);
      }
    });

    socket.on("chat-message", (incoming) => {
      const message = {
        id: String(incoming?.id ?? `${Date.now()}`),
        userId: incoming?.userId ?? incoming?.senderId ?? "",
        userName:
          incoming?.userName ?? incoming?.sender ?? "Participant",
        message: incoming?.message ?? incoming?.text ?? "",
        timestamp: incoming?.timestamp ?? new Date().toISOString(),
      };

      if (!message.message) return;

      setMessages((previous) => {
        if (
          previous.some(
            (item) =>
              item.id === message.id && item.userId === message.userId
          )
        ) {
          return previous;
        }
        return [...previous, message];
      });
    });

    socket.on("new-question", (item) => {
      setQaQuestions((previous) =>
        previous.some((question) => question.id === item.id)
          ? previous
          : [...previous, item]
      );
    });

    socket.on("qna-questions", (questions) => {
      setQaQuestions(Array.isArray(questions) ? questions : []);
    });

    socket.on("question-updated", (updatedQuestion) => {
      setQaQuestions((previous) => {
        const exists = previous.some(
          (question) => question.id === updatedQuestion.id
        );

        if (!exists) return [...previous, updatedQuestion];

        return previous.map((question) =>
          question.id === updatedQuestion.id ? updatedQuestion : question
        );
      });
    });

    socket.on("question-submitted", ({ message } = {}) => {
      setQuestionNotice(message || "Your question has been submitted.");
    });

    socket.on(
      "media-state-changed",
      ({ userId: changedUserId, micOn, camOn, isScreenSharing } = {}) => {
        setParticipants((previous) =>
          previous.map((participant) =>
            participant.id === changedUserId
              ? {
                  ...participant,
                  micOn: micOn ?? participant.micOn,
                  camOn: camOn ?? participant.camOn,
                  isScreenSharing:
                    isScreenSharing ?? participant.isScreenSharing,
                }
              : participant
          )
        );
      }
    );

    socket.on("hand-raise", ({ userId: raisedUserId, raised } = {}) => {
      setParticipants((previous) =>
        previous.map((participant) =>
          participant.id === raisedUserId
            ? { ...participant, handRaised: Boolean(raised) }
            : participant
        )
      );
    });

    socket.on("waiting-for-admission", ({ hostId } = {}) => {
      setWaitingStatus("waiting");
      setWaitingMessage(
        hostId
          ? "The host has been notified. You will join as soon as you are admitted."
          : "Waiting for the host to admit you."
      );
    });

    socket.on("admitted", () => {
      setWaitingStatus("admitted");
      setWaitingMessage("");
      socket.emit("get-questions");
    });

    socket.on("admission-rejected", ({ message } = {}) => {
      setWaitingStatus("rejected");
      setWaitingMessage(
        message || "The host did not admit you to this meeting."
      );
    });

    socket.on("room-settings", ({ waitingRoom: enabled, isHost: host } = {}) => {
      setWaitingRoomEnabled(Boolean(enabled));
      setIsHost(Boolean(host));
    });

    socket.on("host-changed", ({ isHost: host } = {}) => {
      setIsHost(Boolean(host));
    });

    socket.on("waiting-participants", (list) => {
      setWaitingParticipants(Array.isArray(list) ? list : []);
    });

    // Capture the map objects for this effect instance so the cleanup
    // never reads a ref that may have been reassigned by a later render.
    const peerConnections = peerConnectionsRef.current;
    const audioDetectors = audioDetectorsRef.current;
    const remoteStreams = remoteStreamsRef.current;
    const pendingIce = pendingIceRef.current;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();

      audioDetectors.forEach((stop) => stop());
      audioDetectors.clear();

      remoteStreams.clear();
      pendingIce.clear();
    };
  }, [
    roomId,
    userName,
    userId,
    createPeerConnection,
    waitForMediaReady,
    flushIceCandidates,
    stopAudioDetection,
  ]);

  const initializeLocalMedia = useCallback(
    async (video = true, audio = true) => {
      if (localStreamRef.current) {
        resolveMediaReady();
        return localStreamRef.current;
      }

      if (mediaInitPromiseRef.current) {
        return mediaInitPromiseRef.current;
      }

      const acquisition = (async () => {
        let stream = null;
        let warning = "";

        try {
          // Always request both devices so the user can turn either one
          // back on later. The requested initial state is applied with
          // track.enabled, not by stopping and re-acquiring streams.
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
          } catch (initialError) {
            if (initialError?.name === "NotAllowedError") {
              throw initialError;
            }

            const fallbacks = [
              { video: false, audio: true },
              { video: true, audio: false },
            ];

            for (const constraints of fallbacks) {
              try {
                stream = await navigator.mediaDevices.getUserMedia(
                  constraints
                );
                warning =
                  "Only one media device could be started. Check the other device and its browser permission.";
                break;
              } catch {
                // Try the next fallback.
              }
            }

            if (!stream) throw initialError;
          }

          stream.getVideoTracks().forEach((track) => {
            track.enabled = Boolean(video);
          });
          stream.getAudioTracks().forEach((track) => {
            track.enabled = Boolean(audio);
          });

          const videoTrack = stream.getVideoTracks()[0] || null;
          const audioTrack = stream.getAudioTracks()[0] || null;

          cameraTrackRef.current = videoTrack;

          if (localStreamRef.current) {
            localStreamRef.current
              .getTracks()
              .forEach((track) => track.stop());
          }

          localStreamRef.current = stream;
          setLocalStream(stream);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
          }

          const micOn = Boolean(audioTrack?.enabled);
          const camOn = Boolean(videoTrack?.enabled);

          mediaStateRef.current = {
            micOn,
            camOn,
            isScreenSharing: false,
          };

          setIsMuted(!micOn);
          setIsVideoOff(!camOn);

          if (audioTrack) {
            monitorAudio(stream, currentUserIdRef.current || "local");
          }

          // Normally there are no peers yet (join-room waits for media),
          // but this also covers a retry or a late permission grant.
          for (const pc of peerConnectionsRef.current.values()) {
            for (const track of stream.getTracks()) {
              const existingSender = pc
                .getSenders()
                .find((sender) => sender.track?.kind === track.kind);

              if (existingSender) {
                await existingSender.replaceTrack(track).catch(() => {});
              } else {
                pc.addTrack(track, stream);
              }
            }
          }

          setParticipants((previous) =>
            previous.map((participant) =>
              participant.isYou
                ? {
                    ...participant,
                    micOn,
                    camOn,
                    isScreenSharing: false,
                    stream,
                  }
                : participant
            )
          );

          setMediaError(warning);

          socketRef.current?.emit("media-state-change", {
            micOn,
            camOn,
            isScreenSharing: false,
          });

          return stream;
        } catch (error) {
          console.error("Error accessing media devices:", error);
          setMediaError(mediaErrorMessage(error));

          mediaStateRef.current = {
            micOn: false,
            camOn: false,
            isScreenSharing: false,
          };
          setIsMuted(true);
          setIsVideoOff(true);

          setParticipants((previous) =>
            previous.map((participant) =>
              participant.isYou
                ? { ...participant, micOn: false, camOn: false }
                : participant
            )
          );

          socketRef.current?.emit("media-state-change", {
            micOn: false,
            camOn: false,
            isScreenSharing: false,
          });

          return null;
        }
      })();

      mediaInitPromiseRef.current = acquisition;

      try {
        return await acquisition;
      } finally {
        mediaInitPromiseRef.current = null;
        resolveMediaReady();
      }
    },
    [monitorAudio, resolveMediaReady]
  );

  const setLocalVideoRef = useCallback((ref) => {
    localVideoRef.current = ref;

    if (ref && localStreamRef.current) {
      ref.srcObject = localStreamRef.current;
      ref.muted = true;
    }
  }, []);

  const emitMediaState = useCallback(() => {
    socketRef.current?.emit("media-state-change", {
      micOn: mediaStateRef.current.micOn,
      camOn: mediaStateRef.current.camOn,
      isScreenSharing: mediaStateRef.current.isScreenSharing,
    });
  }, []);

  const toggleMicrophone = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      setMediaError(
        "No microphone track is available. Check the microphone and browser permission, then rejoin."
      );
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    const micOn = audioTrack.enabled;

    mediaStateRef.current.micOn = micOn;
    setIsMuted(!micOn);

    setParticipants((previous) =>
      previous.map((participant) =>
        participant.isYou ? { ...participant, micOn } : participant
      )
    );

    emitMediaState();
    return micOn;
  }, [emitMediaState]);

  const toggleCamera = useCallback(() => {
    if (mediaStateRef.current.isScreenSharing) {
      return true;
    }

    const videoTrack = cameraTrackRef.current;

    if (!videoTrack || videoTrack.readyState !== "live") {
      setMediaError(
        "No camera track is available. Check the camera and browser permission, then rejoin."
      );
      return false;
    }

    videoTrack.enabled = !videoTrack.enabled;
    const camOn = videoTrack.enabled;

    mediaStateRef.current.camOn = camOn;
    setIsVideoOff(!camOn);

    setParticipants((previous) =>
      previous.map((participant) =>
        participant.isYou ? { ...participant, camOn } : participant
      )
    );

    emitMediaState();
    return camOn;
  }, [emitMediaState]);

  const restoreCamera = useCallback(async () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    let cameraTrack = cameraTrackRef.current;

    if (!cameraTrack || cameraTrack.readyState !== "live") {
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        cameraTrack = cameraStream.getVideoTracks()[0] || null;
        cameraTrackRef.current = cameraTrack;
      } catch (error) {
        cameraTrack = null;
        setMediaError(mediaErrorMessage(error));
      }
    }

    const newStream = new MediaStream();
    if (cameraTrack) newStream.addTrack(cameraTrack);
    if (audioTrack) newStream.addTrack(audioTrack);

    for (const pc of peerConnectionsRef.current.values()) {
      const videoSender = pc
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack).catch(() => {});
      }
    }

    localStreamRef.current = newStream;
    setLocalStream(newStream);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = newStream;
    }

    mediaStateRef.current.camOn = Boolean(cameraTrack?.enabled);
    mediaStateRef.current.isScreenSharing = false;
    setIsVideoOff(!cameraTrack?.enabled);
    setIsScreenSharing(false);
    emitMediaState();
  }, [emitMediaState]);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    await restoreCamera();
  }, [restoreCamera]);

  const stopScreenShareRef = useRef(stopScreenShare);
  stopScreenShareRef.current = stopScreenShare;

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!localStreamRef.current) {
        setMediaError("Camera/microphone is not ready for screen sharing.");
        return false;
      }

      if (mediaStateRef.current.isScreenSharing) {
        await stopScreenShareRef.current();
        return false;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return false;

      const audioTrack = localStreamRef.current.getAudioTracks()[0] || null;
      const newStream = new MediaStream();

      newStream.addTrack(screenTrack);
      if (audioTrack) newStream.addTrack(audioTrack);

      for (const pc of peerConnectionsRef.current.values()) {
        const videoSender = pc
          .getSenders()
          .find((sender) => sender.track?.kind === "video");

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack).catch(() => {});
        }
      }

      screenTrackRef.current = screenTrack;
      screenTrack.onended = () => {
        stopScreenShareRef.current?.();
      };

      localStreamRef.current = newStream;
      setLocalStream(newStream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      mediaStateRef.current.isScreenSharing = true;
      setIsScreenSharing(true);
      emitMediaState();

      return true;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      return false;
    }
  }, [emitMediaState]);

  const toggleHandRaise = useCallback(() => {
    const newHandRaised = !handRaisedRef.current;
    handRaisedRef.current = newHandRaised;
    setHandRaised(newHandRaised);

    socketRef.current?.emit("hand-raise", {
      raised: newHandRaised,
    });

    setParticipants((previous) =>
      previous.map((participant) =>
        participant.isYou
          ? { ...participant, handRaised: newHandRaised }
          : participant
      )
    );

    return newHandRaised;
  }, []);

  const sendMessage = useCallback((message) => {
    const text = typeof message === "string" ? message.trim() : "";
    const socket = socketRef.current;

    if (!text || !socket?.connected) return false;

    // The server echoes the canonical message back to everyone,
    // including the sender, so do not append an optimistic duplicate.
    socket.emit("chat-message", { message: text });
    return true;
  }, []);

  const submitQuestion = useCallback((question) => {
    const text = typeof question === "string" ? question.trim() : "";
    if (!text) return;

    const socket = socketRef.current;

    if (!socket?.connected) {
      setQuestionNotice("You are not connected to the meeting.");
      return;
    }

    setQuestionNotice("");
    socket.emit("submit-question", { question: text });
  }, []);

  const answerQuestion = useCallback((questionId, answer) => {
    const text = typeof answer === "string" ? answer.trim() : "";
    const socket = socketRef.current;

    if (!socket?.connected || !questionId || !text) return;

    socket.emit("answer-question", {
      questionId,
      answer: text,
    });
  }, []);

  const getQuestions = useCallback(() => {
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit("get-questions");
    }
  }, []);

  const admitParticipant = useCallback((targetId) => {
    if (!targetId) return;
    socketRef.current?.emit("admit-participant", { targetId });
  }, []);

  const rejectParticipant = useCallback((targetId) => {
    if (!targetId) return;
    socketRef.current?.emit("reject-participant", { targetId });
  }, []);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    audioDetectorsRef.current.forEach((stop) => stop());
    audioDetectorsRef.current.clear();

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceRef.current.clear();
  }, []);

  return {
    participants,
    isConnected,
    connectionError,
    mediaError,
    localStream,
    messages,
    qaQuestions,
    questionNotice,
    submitQuestion,
    answerQuestion,
    getQuestions,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    speakingUser,
    waitingStatus,
    waitingMessage,
    waitingParticipants,
    isHost,
    waitingRoomEnabled,
    initializeLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendMessage,
    admitParticipant,
    rejectParticipant,
    cleanup,
    setLocalVideoRef,
  };
};
