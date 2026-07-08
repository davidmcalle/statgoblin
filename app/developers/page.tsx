import { ApiConsole } from "./api-console";

// Developer reference + live console for the read API. Auth mirrors Foundry
// ingest: the campaign UUID identifies, an admin API key authorizes.
export default function DevelopersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Developer API</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Read your campaign&apos;s derived roll data over HTTPS and do whatever you like with
          it. Responses are JSON. Fill in your credentials, set filters, and send requests
          against this deployment right from this page.
        </p>
      </div>

      <ApiConsole />

      <section className="space-y-2 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Your data export</h2>
        <p className="text-sm text-muted-foreground">
          Separate from the campaign API: signed-in users can download everything linked to
          their account — memberships, assigned characters, and those characters&apos; rolls —
          as one JSON file from the My characters page.
        </p>
      </section>
    </main>
  );
}
