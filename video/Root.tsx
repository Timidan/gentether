import React from "react";
import {Composition} from "remotion";
import {FPS, TOTAL_FRAMES} from "./data";
import {GenTetherDemo} from "./GenTetherDemo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GenTetherDemo"
    component={GenTetherDemo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1280}
    height={720}
  />
);
