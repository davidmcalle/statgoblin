import { sessions } from "@/lib/stats";
import { authorizeCampaignKey } from "@/lib/api-auth";

// Read API: play sessions (one per distinct date), numbered oldest-first.
export async function GET(request: Request) {
  const campaignId = await authorizeCampaignKey(request);
  if (!campaignId) {
    return Response.json({ error: "invalid campaign id or api key" }, { status: 401 });
  }
  return Response.json({ sessions: await sessions(campaignId) });
}
