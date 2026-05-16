import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    fornecedorId?: string;
    fornecedorNome?: string;
  }
  interface Session {
    user: User & {
      role: string;
      fornecedorId?: string;
      fornecedorNome?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    fornecedorId?: string;
    fornecedorNome?: string;
  }
}
