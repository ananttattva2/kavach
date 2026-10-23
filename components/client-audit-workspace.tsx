"use client";
import { useState } from "react";
import type { ClientData } from "@/lib/schema";
import { DashboardWorkspace } from "./dashboard-workspace";
import { PreAuditWorkspace } from "./pre-audit-workspace";
import "./client-audit-workspace.css";

export function ClientAuditWorkspace({
  client,
  name,
  email,
  role,
}: {
  client: ClientData;
  name: string;
  email: string;
  role: string;
}) {
  const [dirty, setDirty] = useState(false);
  return (
    <DashboardWorkspace
      name={name}
      email={email}
      role={role}
      workspaceTitle="Pre-audit check"
      externalDirty={dirty}
    >
      <PreAuditWorkspace client={client} embedded onDirtyChange={setDirty} />
    </DashboardWorkspace>
  );
}
