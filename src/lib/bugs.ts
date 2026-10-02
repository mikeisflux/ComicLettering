/* Sentinel vocabulary shared by the APIs, the console and the forms. */
export const BUG_STATUSES = ["open", "triaged", "in_progress", "fixed", "closed", "wontfix"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];
export const BUG_SEVERITIES = ["low", "normal", "high", "critical"] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
export const STATUS_LABEL: Record<BugStatus, string> = {
  open: "Open", triaged: "Triaged", in_progress: "In progress", fixed: "Fixed", closed: "Closed", wontfix: "Won't fix",
};
export const ACTIVE_STATUSES: BugStatus[] = ["open", "triaged", "in_progress"];
