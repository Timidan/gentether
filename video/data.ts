export const FPS = 24;

export const scenes = [
  {
    id: "problem",
    durationInFrames: 480,
    audio: "video/audio/scene-1.mp3",
    caption: "Generated code looks editable. GenTether makes the repository tell the agent where the real edit belongs.",
  },
  {
    id: "graph",
    durationInFrames: 564,
    audio: "video/audio/scene-2.mp3",
    caption: "Source → generator → artifact → consumers → test, stored as typed graph relationships.",
  },
  {
    id: "block",
    durationInFrames: 540,
    audio: "video/audio/scene-3.mp3",
    caption: "Generated file only: BLOCK. Edit the OpenAPI source and run the exact generation command instead.",
  },
  {
    id: "review",
    durationInFrames: 456,
    audio: "video/audio/scene-4.mp3",
    caption: "Source only: REVIEW. The generated client is now stale and must be regenerated.",
  },
  {
    id: "allow",
    durationInFrames: 420,
    audio: "video/audio/scene-5.mp3",
    caption: "Source plus generated output: ALLOW. The patch matches the repository's generation contract.",
  },
  {
    id: "evidence",
    durationInFrames: 612,
    audio: "video/audio/scene-6.mp3",
    caption: "HydraDB proves the chain of custody with typed relationships and bounded traversal.",
  },
  {
    id: "close",
    durationInFrames: 420,
    audio: "video/audio/scene-7.mp3",
    caption: "The same gate is available through MCP before a coding agent writes a file.",
  },
] as const;

export const TOTAL_FRAMES = scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
