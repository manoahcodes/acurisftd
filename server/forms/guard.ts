import { session } from "../repositories";

/**
 * Every form action calls this first. SWAP POINT: the mock session has no
 * roles, so this only confirms there is a signed-in user. A real session
 * provider must verify the user is a Platform Admin here, because the form
 * actions write across schools, and must fail closed.
 */
export async function requirePlatformAdmin(): Promise<void> {
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
}
