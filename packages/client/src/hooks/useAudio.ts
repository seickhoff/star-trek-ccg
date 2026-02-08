import { useRef, useCallback, useEffect } from "react";

/**
 * Audio sound effect IDs
 */
export type SoundEffect =
  | "chirp"
  | "transporter"
  | "warp"
  | "turbolift"
  | "suspense"
  | "autodestruct";

/**
 * Map of sound effects to audio file paths
 */
const AUDIO_FILES: Record<SoundEffect, string> = {
  chirp: "/audio/tng_chirp3_clean.mp3",
  transporter: "/audio/tng_transporter10.mp3",
  warp: "/audio/tng_warp_exit.mp3",
  turbolift: "/audio/tng_turbolift_1.mp3",
  suspense: "/audio/suspense_04.mp3",
  autodestruct: "/audio/tng_autodestruct.mp3",
};

/**
 * Hook for playing audio sound effects
 * Pre-loads audio elements for instant playback
 */
export function useAudio(enabled = true) {
  // Store audio elements
  const audioRefs = useRef<Record<SoundEffect, HTMLAudioElement | null>>({
    chirp: null,
    transporter: null,
    warp: null,
    turbolift: null,
    suspense: null,
    autodestruct: null,
  });

  // Initialize audio elements
  useEffect(() => {
    if (!enabled) return;

    const sounds = Object.keys(AUDIO_FILES) as SoundEffect[];
    const refs = audioRefs.current;

    for (const sound of sounds) {
      const audio = new Audio(AUDIO_FILES[sound]);
      audio.preload = "auto";
      refs[sound] = audio;
    }

    // Cleanup
    return () => {
      for (const sound of sounds) {
        const audio = refs[sound];
        if (audio) {
          audio.pause();
          audio.src = "";
        }
        refs[sound] = null;
      }
    };
  }, [enabled]);

  /**
   * Play a sound effect
   */
  const play = useCallback(
    (sound: SoundEffect) => {
      if (!enabled) return;

      const audio = audioRefs.current[sound];
      if (audio) {
        // Reset to start and play
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors (user hasn't interacted yet)
        });
      }
    },
    [enabled]
  );

  /**
   * Stop a sound effect
   */
  const stop = useCallback(
    (sound: SoundEffect) => {
      if (!enabled) return;

      const audio = audioRefs.current[sound];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
    [enabled]
  );

  /**
   * Stop all sounds
   */
  const stopAll = useCallback(() => {
    if (!enabled) return;

    const sounds = Object.keys(AUDIO_FILES) as SoundEffect[];
    for (const sound of sounds) {
      const audio = audioRefs.current[sound];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [enabled]);

  return {
    play,
    stop,
    stopAll,
  };
}

/**
 * Game event to sound effect mapping
 */
export const GAME_SOUNDS = {
  // Phase changes
  phaseChange: "chirp" as SoundEffect,
  newTurn: "turbolift" as SoundEffect,

  // Ship movement
  moveShip: "warp" as SoundEffect,

  // Personnel actions
  beam: "transporter" as SoundEffect,
  deploy: "chirp" as SoundEffect,

  // Mission/dilemma
  missionAttempt: "suspense" as SoundEffect,
  missionComplete: "chirp" as SoundEffect,
  dilemmaReveal: "suspense" as SoundEffect,

  // Game end
  victory: "chirp" as SoundEffect,
  defeat: "autodestruct" as SoundEffect,
} as const;
