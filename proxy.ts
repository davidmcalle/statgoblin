import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 proxy (né middleware): Clerk session handling + route protection.
// /api/ingest stays public — the Foundry module authenticates with the
// campaign UUID + admin API key inside the route itself, not via Clerk.
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/ingest",
  // Read API authenticates itself with the campaign key pair, not Clerk.
  "/api/v1/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join/(.*)",
  // Fixture sandbox; the page itself 404s outside development.
  "/dev/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
