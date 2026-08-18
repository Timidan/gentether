import type React from "react";
import {Easing, interpolate, spring} from "remotion";

export const C = {
  bg: "#0b0c09",
  panel: "#151610",
  panel2: "#1d1f17",
  text: "#f4f4ec",
  muted: "#a8aa9e",
  line: "rgba(244,244,236,.14)",
  acid: "#ccff4f",
  blue: "#899bff",
  danger: "#ff765f",
  warning: "#f4c766",
  success: "#8de59b",
};

export const font = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
export const mono = "SFMono-Regular, Consolas, Liberation Mono, monospace";

export const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

export const inStyle = (frame: number, fps: number, delay = 0): React.CSSProperties => {
  const progress = spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 130, mass: 0.8}});
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`,
  };
};
