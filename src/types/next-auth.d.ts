import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "STAFF";
    tenantId: number;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "ADMIN" | "STAFF";
      tenantId: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "STAFF";
    tenantId?: number;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: "ADMIN" | "STAFF";
    tenantId: number;
  }
}
