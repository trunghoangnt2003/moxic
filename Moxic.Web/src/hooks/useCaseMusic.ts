import { useCallback, useEffect, useRef, useState } from "react";
import type { SpinMusicTrack } from "../lib/luckySpinApi";

const MUTE_KEY = "moxic:case-music-muted";
const TARGET_VOLUME = 0.55;
const FADE_IN_MS = 300;
const DEFAULT_FADE_OUT_MS = 1800;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(value: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // storage unavailable (private mode / blocked) — keep the in-memory value only
  }
}

/**
 * Case-page music: one random enabled track per visit. `start()` MUST be called synchronously
 * inside the click handler (before any await) so browsers treat play() as a user gesture.
 * Fades in over 300 ms, `fadeOut()` ramps to silence then pauses (iOS ignores volume, the
 * pause still stops it). Mute is persisted in localStorage.
 */
export function useCaseMusic(tracks: SpinMusicTrack[] | undefined) {
  const [track, setTrack] = useState<SpinMusicTrack | null>(null);
  const [muted, setMuted] = useState<boolean>(readMuted);
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Pick one track per mount as soon as the list is known (state adjustment during render).
  if (!track && tracks && tracks.length > 0) {
    // Cosmetic choice only — Math.random is fine here.
    setTrack(tracks[Math.floor(Math.random() * tracks.length)]);
  }

  const cancelRamp = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const ramp = useCallback(
    (audio: HTMLAudioElement, from: number, to: number, ms: number, onDone?: () => void) => {
      cancelRamp();
      const startedAt = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / ms);
        try {
          audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
        } catch {
          // some browsers throw on volume changes; ignore
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          onDone?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [cancelRamp]
  );

  useEffect(() => {
    if (!track) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.loop = true;
    audio.src = track.url;
    audioRef.current = audio;
    return () => {
      cancelRamp();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [track, cancelRamp]);

  const start = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || mutedRef.current) return;
    cancelRamp();
    try {
      audio.currentTime = 0;
      audio.volume = 0;
    } catch {
      // ignore
    }
    const played = audio.play();
    if (played) played.catch(() => undefined);
    ramp(audio, 0, TARGET_VOLUME, FADE_IN_MS);
  }, [cancelRamp, ramp]);

  const stop = useCallback(() => {
    cancelRamp();
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try {
      audio.volume = TARGET_VOLUME;
    } catch {
      // ignore
    }
  }, [cancelRamp]);

  const fadeOut = useCallback(
    (ms: number = DEFAULT_FADE_OUT_MS) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      ramp(audio, audio.volume, 0, ms, () => {
        audio.pause();
        try {
          audio.volume = TARGET_VOLUME;
        } catch {
          // ignore
        }
      });
    },
    [ramp]
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    writeMuted(next);
    if (next) stop();
  }, [stop]);

  return { hasTrack: !!track, muted, toggleMute, start, fadeOut, stop };
}
