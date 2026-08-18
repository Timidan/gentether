import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {C, fade, font} from "./theme";

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      backgroundImage:
        "radial-gradient(circle at 14% 8%, rgba(204,255,79,.12), transparent 28%), radial-gradient(circle at 86% 16%, rgba(137,155,255,.11), transparent 30%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
      backgroundSize: "auto, auto, 38px 38px, 38px 38px",
    }}
  />
);

const Brand: React.FC = () => (
  <div style={{display: "flex", alignItems: "center", gap: 11, fontWeight: 800, fontSize: 21}}>
    <div style={{width: 28, display: "grid", gap: 3}}>
      {[20, 15, 20].map((width, index) => (
        <span
          key={index}
          style={{
            height: 4,
            width,
            borderRadius: 99,
            background: C.acid,
            transform: `rotate(${index === 0 ? 18 : index === 2 ? -18 : 0}deg)`,
          }}
        />
      ))}
    </div>
    GenTether
  </div>
);

const Engine: React.FC = () => {
  const frame = useCurrentFrame();
  const glow = 0.35 + Math.sin(frame / 8) * 0.12;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        border: `1px solid ${C.line}`,
        borderRadius: 99,
        padding: "8px 12px",
        background: "rgba(20,21,16,.82)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: C.success,
          boxShadow: `0 0 18px rgba(141,229,155,${glow})`,
        }}
      />
      HydraDB · graph evidence
    </div>
  );
};

const Caption: React.FC<{text: string}> = ({text}) => (
  <div style={{position: "absolute", left: 100, right: 100, bottom: 24, display: "flex", justifyContent: "center"}}>
    <div
      style={{
        maxWidth: 1010,
        background: "rgba(5,6,4,.9)",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "11px 17px",
        fontSize: 19,
        lineHeight: 1.35,
        textAlign: "center",
        boxShadow: "0 18px 60px rgba(0,0,0,.35)",
      }}
    >
      {text}
    </div>
  </div>
);

export const Shell: React.FC<{eyebrow: string; caption: string; children: React.ReactNode}> = ({eyebrow, caption, children}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill style={{fontFamily: font, color: C.text, opacity: fade(frame, durationInFrames)}}>
      <Backdrop />
      <div style={{position: "absolute", inset: "26px 42px 76px"}}>
        <div style={{height: 48, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <Brand />
          <Engine />
        </div>
        <div style={{position: "absolute", top: 70, bottom: 0, left: 0, right: 0}}>
          <div style={{color: C.acid, fontSize: 13, fontWeight: 850, letterSpacing: ".17em", textTransform: "uppercase"}}>
            {eyebrow}
          </div>
          {children}
        </div>
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};
