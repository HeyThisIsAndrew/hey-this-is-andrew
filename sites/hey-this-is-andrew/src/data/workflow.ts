// The current production pipeline (WorkflowStrip.astro): one honest strip
// showing shoot-to-publish and the tools at each stage.

export interface WorkflowStep {
  stage: string;
  detail: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { stage: 'Shoot', detail: 'Sony a7IV / a7CR' },
  { stage: 'Edit', detail: 'DaVinci Resolve, Lightroom, Photoshop' },
  { stage: 'Grade', detail: 'DaVinci Resolve' },
  { stage: 'Publish', detail: 'YouTube, Instagram, Foto, TikTok' },
];
