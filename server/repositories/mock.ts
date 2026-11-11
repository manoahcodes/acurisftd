import type { SessionProvider } from "./types";

export const mockSessionProvider: SessionProvider = {
  async getCurrentUser() {
    return {
      id: "dev-user",
      name: "User",
      tenant: {
        tenantId: "lusaka-hills",
        tenantName: "Lusaka Hills Academy",
        campus: "Main Campus",
        institutionType: "high_school",
      },
    };
  },
};
