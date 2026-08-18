import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {Shell} from "../Layout";
import {scenes} from "../data";
import {C, inStyle, mono} from "../theme";

export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const tools = [
    ["gentether_resolve_edit_target", "Find the real edit surface"],
    ["gentether_check_patch", "BLOCK, REVIEW or ALLOW"],
    ["gentether_plan_regeneration", "Return commands and tests"],
  ];

  return (
    <Shell eyebrow="Agent-native guardrail" caption={scenes[6].caption}>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 65, alignItems: "center", height: "100%"}}>
        <div>
          <h1 style={{...inStyle(frame, fps), margin: "14px 0 22px", fontSize: 68, lineHeight: .9, letterSpacing: "-.065em"}}>
            Ask the graph<br />before writing.
          </h1>
          <p style={{...inStyle(frame, fps, 15), color: C.muted, fontSize: 19, lineHeight: 1.55}}>
            Web UI, HTTP API and MCP tools share the same deterministic gate and HydraDB evidence.
          </p>
        </div>
        <div style={{borderTop: `1px solid ${C.line}`}}>
          {tools.map(([name, detail], index) => (
            <div key={name} style={{...inStyle(frame, fps, 22 + index * 13), padding: "21px 0", borderBottom: `1px solid ${C.line}`}}>
              <div style={{fontFamily: mono, color: C.acid, fontSize: 14}}>{name}</div>
              <div style={{color: C.muted, fontSize: 13, marginTop: 7}}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 42,
          right: 42,
          bottom: 82,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          opacity: interpolate(frame, [durationInFrames - 110, durationInFrames - 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{fontSize: 35, fontWeight: 850, letterSpacing: "-.04em"}}>
          Edit the source. <span style={{color: C.acid}}>Never the artifact.</span>
        </div>
        <div style={{fontFamily: mono, color: C.muted, fontSize: 12}}>Hack Hydra 2026 · Track 02B</div>
      </div>
    </Shell>
  );
};
