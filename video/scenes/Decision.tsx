import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {Shell} from "../Layout";
import {C, inStyle, mono} from "../theme";

export type DecisionKind = "BLOCK" | "REVIEW" | "ALLOW";

const decisions = {
  BLOCK: {
    color: C.danger,
    files: ["src/generated/api-client.ts"],
    title: "Wrong edit target",
    text: "Edit api/openapi.yaml and regenerate the client.",
  },
  REVIEW: {
    color: C.warning,
    files: ["api/openapi.yaml"],
    title: "Generated output is stale",
    text: "Run npm run generate:api and include the output.",
  },
  ALLOW: {
    color: C.success,
    files: ["api/openapi.yaml", "src/generated/api-client.ts"],
    title: "Generation contract satisfied",
    text: "Run the connected test before merge.",
  },
} as const;

export const DecisionScene: React.FC<{kind: DecisionKind; caption: string}> = ({kind, caption}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const decision = decisions[kind];

  return (
    <Shell eyebrow="Pre-execution patch gate" caption={caption}>
      <h1 style={{...inStyle(frame, fps), margin: "15px 0 26px", fontSize: 56, letterSpacing: "-.05em"}}>Proposed patch</h1>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18}}>
        <div style={{...inStyle(frame, fps, 12), border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, background: C.panel}}>
          <div style={{fontSize: 12, color: C.muted, marginBottom: 13}}>CHANGED FILES</div>
          {decision.files.map((file) => (
            <div key={file} style={{fontFamily: mono, fontSize: 15, padding: "15px 14px", borderRadius: 11, background: "#10110d", border: `1px solid ${C.line}`, marginBottom: 10}}>
              {file}
            </div>
          ))}
          <div style={{marginTop: 18, color: C.muted, fontSize: 13}}>HydraDB lookup</div>
          <div style={{fontFamily: mono, color: C.acid, fontSize: 13, marginTop: 7}}>source → command → output → consumers → tests</div>
        </div>
        <div style={{...inStyle(frame, fps, 25), border: `1px solid ${decision.color}88`, borderRadius: 18, padding: 24, background: `${decision.color}0d`, position: "relative", overflow: "hidden"}}>
          <div style={{position: "absolute", right: -70, bottom: -80, width: 220, height: 220, borderRadius: "50%", background: decision.color, filter: "blur(90px)", opacity: .16}} />
          <div style={{fontSize: 13, color: C.muted}}>DECISION</div>
          <div style={{color: decision.color, fontSize: 64, fontWeight: 900, lineHeight: 1, marginTop: 12, letterSpacing: "-.05em"}}>{kind}</div>
          <div style={{fontSize: 25, fontWeight: 750, marginTop: 34}}>{decision.title}</div>
          <p style={{color: C.muted, fontSize: 17, lineHeight: 1.55}}>{decision.text}</p>
          <div style={{marginTop: 24, borderTop: `1px solid ${C.line}`, paddingTop: 16, fontFamily: mono, fontSize: 12, color: C.acid}}>
            evidence: HydraDB path returned
          </div>
        </div>
      </div>
    </Shell>
  );
};
