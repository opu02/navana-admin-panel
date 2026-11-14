// Shared between the page and the server
export const ACTIONS = ["create", "update", "delete", "view", "export"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  view: "Only View",
  export: "Export",
};

/** A "role" = one segment of the panel (e.g. Drug) and the actions it supports */
export type Role = { id: string; name: string; actions: Action[] };

/** Per user: segmentId → which actions are ON */
export type Permissions = Record<string, Partial<Record<Action, boolean>>>;

export type UserOption = { id: string; name: string; email: string; type: string };
