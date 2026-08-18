import React from "react";
import {AbsoluteFill, Audio, Sequence, staticFile} from "remotion";
import {scenes} from "./data";
import {DecisionScene} from "./scenes/Decision";
import {CloseScene} from "./scenes/Close";
import {EvidenceScene} from "./scenes/Evidence";
import {GraphScene} from "./scenes/Graph";
import {ProblemScene} from "./scenes/Problem";
import {C} from "./theme";

const SceneAudio: React.FC<{src: string}> = ({src}) => <Audio src={staticFile(src)} volume={0.92} />;

export const GenTetherDemo: React.FC = () => {
  let offset = 0;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {scenes.map((scene, index) => {
        const from = offset;
        offset += scene.durationInFrames;
        const visual =
          index === 0 ? <ProblemScene /> :
          index === 1 ? <GraphScene /> :
          index === 2 ? <DecisionScene kind="BLOCK" caption={scene.caption} /> :
          index === 3 ? <DecisionScene kind="REVIEW" caption={scene.caption} /> :
          index === 4 ? <DecisionScene kind="ALLOW" caption={scene.caption} /> :
          index === 5 ? <EvidenceScene /> :
          <CloseScene />;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames} name={scene.id}>
            {visual}
            <Sequence from={8}>
              <SceneAudio src={scene.audio} />
            </Sequence>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
