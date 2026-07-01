import { z } from "zod";

export const repoAISummarySchema = z.object({
  projectPurpose: z.string().min(1),
  techStack: z.array(z.string().min(1)).min(1),
  mainFeatures: z.array(z.string().min(1)).min(1),
  folderStructureOverview: z.array(z.string().min(1)).min(1),
  howToRun: z.array(z.string().min(1)).min(1),
  complexityLevel: z.enum(["Beginner", "Intermediate", "Advanced"]),
  idealUseCases: z.array(z.string().min(1)).min(1),
});

export type RepoAISummary = z.infer<typeof repoAISummarySchema>;
