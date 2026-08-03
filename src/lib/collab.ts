/* Collaboration: who can do what on a shared book.
     owner    — everything, including sharing and deletion
     letterer — full editing (save over the book), comments, request review
     editor   — review access: read, comment, approve / request changes */
import { prisma } from "./db";

export type ProjectRole = "owner" | "letterer" | "editor";

export async function projectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!p) return null;
  if (p.userId === userId) return "owner";
  const share = await prisma.projectShare.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!share) return null;
  return share.role === "letterer" ? "letterer" : "editor";
}

export const canEdit = (r: ProjectRole | null) => r === "owner" || r === "letterer";
