import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {Shell} from "../Layout";
import {scenes} from "../data";
import {C, inStyle, mono} from "../theme";

export const EvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rows = [
    ["FEEDS", "source → command"],
    ["GENERATES", "command → artifact"],
    ["IMPORTS*1..4", "artifact ← consumers ← test"],
  ];

  return (
    <Shell eyebrow="Why HydraDB is load-bearing" caption={scenes[5].caption}>
      <div style={{display: "grid", gridTemplateColumns: ".82fr 1.18fr", gap: 54, alignItems: "center", height: "100%"}}>
        <div>
          <h1 style={{...inStyle(frame, fps), margin: "14px 0 22px", fontSize: 63, lineHeight: .94, letterSpacing: "-.06em"}}>
            One target.<br />The full chain<br /><span style={{color: C.acid}}>of custody.</span>
          </h1>
          <p style={{...inStyle(frame, fps, 15), color: C.muted, fontSize: 18, lineHeight: 1.6}}>
            Similarity can find code that looks related. It cannot prove ownership or directed test reachability.
          </p>
        </div>
        <div style={{...inStyle(frame, fps, 25), border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, background: C.panel}}>
          {rows.map(([type, path], index) => (
            <div key={type} style={{display: "grid", gridTemplateColumns: "155px 1fr", gap: 18, padding: "20px 16px", borderBottom: index < rows.length - 1 ? `1px solid ${C.line}` : "none"}}>
              <b style={{fontFamily: mono, color: C.acid, fontSize: 13}}>{type}</b>
              <span style={{fontFamily: mono, fontSize: 15}}>{path}</span>
            </div>
          ))}
          <div style={{marginTop: 20, display: "flex", justifyContent: "space-between", borderRadius: 12, padding: "14px 16px", background: C.panel2, fontSize: 13}}>
            <span>bounded directed traversal</span>
            <b style={{color: C.success}}>fail-closed to REVIEW</b>
          </div>
        </div>
      </div>
    </Shell>
  );
};
