import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {Shell} from "../Layout";
import {scenes} from "../data";
import {C, inStyle, mono} from "../theme";

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const caret = Math.floor(frame / 9) % 2 === 0 ? 1 : 0;
  return (
    <Shell eyebrow="Hack Hydra · Track 02B" caption={scenes[0].caption}>
      <div style={{display: "grid", gridTemplateColumns: "1.12fr .88fr", gap: 54, alignItems: "center", height: "100%"}}>
        <div>
          <h1 style={{...inStyle(frame, fps), margin: "14px 0 0", fontSize: 82, lineHeight: .9, letterSpacing: "-.07em"}}>
            Edit the source.<br />
            <span style={{color: C.acid, fontWeight: 520}}>Never the artifact.</span>
          </h1>
          <p style={{...inStyle(frame, fps, 15), marginTop: 28, maxWidth: 640, color: C.muted, fontSize: 21, lineHeight: 1.5}}>
            A graph-native provenance gate that stops coding agents from patching generated code directly.
          </p>
        </div>
        <div style={{...inStyle(frame, fps, 25), border: `1px solid ${C.line}`, borderRadius: 20, padding: 18, background: C.panel, boxShadow: "0 38px 100px rgba(0,0,0,.35)"}}>
          <div style={{display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 12, marginBottom: 12}}>
            <span>agent.patch</span><span>derived artifact</span>
          </div>
          <div style={{border: `1px solid ${C.line}`, borderRadius: 13, padding: 20, background: "#10110d", fontFamily: mono, fontSize: 17, lineHeight: 1.7}}>
            <span style={{color: C.muted}}>target</span><br />
            <span style={{color: C.danger}}>src/generated/api-client.ts</span>
            <span style={{opacity: caret, color: C.acid}}>▌</span>
          </div>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14}}>
            <span style={{color: C.muted, fontSize: 13}}>The next codegen run deletes this fix.</span>
            <b style={{background: C.danger, color: "#180806", borderRadius: 9, padding: "8px 11px", fontSize: 12}}>WRONG FILE</b>
          </div>
        </div>
      </div>
    </Shell>
  );
};
