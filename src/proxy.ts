import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Runs before each request (Next.js 16 calls middleware "proxy"). Clerk reads the sign-in cookie here so server
 * code can call auth(). Static files are skipped by the matcher below.
 */

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
