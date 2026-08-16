import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Panel, EmptyText } from "@/components/Panel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — WaterWatch" },
      { name: "description", content: "Administrator area for the WaterWatch surveillance platform." },
      { property: "og:title", content: "Admin — WaterWatch" },
      { property: "og:description", content: "Administrator area for the WaterWatch surveillance platform." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { ready, token } = useAuth();
  if (!ready || !token) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header notifications={[]} unreadCount={0} onRefresh={() => {}} />
      <main className="mx-auto max-w-6xl px-4 py-4">
        <Panel title="Administrator" icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}>
          <EmptyText>
            Admin tooling is not part of this build. Patient and clinician dashboards are available
            with their respective accounts.
          </EmptyText>
        </Panel>
      </main>
    </div>
  );
}
