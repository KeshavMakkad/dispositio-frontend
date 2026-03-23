export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "VIEWER";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
}
