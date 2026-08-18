import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Shell} from "../Layout";
import {scenes} from "../data";
import {C, inStyle, mono} from "../theme";

export const GraphScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nodes = [
    ["Source spec", "api/openapi.yaml", C.blue, "FEEDS"],
    ["Generator", "npm run generate:api", C.warning, "GENERATES"],
    ["Artifact", "src/generated/api-client.ts", C.danger, "IMPORTS"],
    ["Consumers", "orders.ts · checkout.ts", C.acid, "IMPORTS"],
    ["Test", "tests/checkout.test.ts", C.success, ""],
  ] as const;

  return (
    <Shell eyebrow="The repository as provenance" caption={scenes[1].caption}>
      <h1 style={{...inStyle(frame, fps), margin: "15px 0 22px", fontSize: 62, lineHeight: .95, letterSpacing: "-.055em"}}>
        Not nearby text.<br /><span style={{color: C.acid}}>A typed chain of custody.</span>
      </h1>
      <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 13, marginTop: 45}}>
        {nodes.map(([label, detail, color, edge], index) => {
          const progress = spring({frame: frame - 20 - index * 12, fps, config: {damping: 18, stiffness: 140}});
          return (
            <div key={label} style={{position: "relative"}}>
              <div
                style={{
                  opacity: progress,
                  transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
                  border: `1px solid ${color}88`,
                  borderRadius: 16,
                  padding: "18px 15px",
                  background: `${color}0f`,
                  minHeight: 115,
                }}
              >
                <div style={{color, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11, fontWeight: 850}}>{label}</div>
                <div style={{fontFamily: mono, fontSize: 14, lineHeight: 1.45, marginTop: 14}}>{detail}</div>
              </div>
              {edge && index < nodes.length - 1 ? (
                <div style={{position: "absolute", right: -16, top: 130, zIndex: 3, color: frame > 42 + index * 12 ? C.acid : "#55584f", fontFamily: mono, fontSize: 9, whiteSpace: "nowrap"}}>
                  {edge} →
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Shell>
  );
};
