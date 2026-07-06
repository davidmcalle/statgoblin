import { LoadingDice } from "@/components/loading-dice";

export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <LoadingDice label="Fetching the campaign's rolls…" />
    </main>
  );
}
