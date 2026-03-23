import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Menu, UserCircle2, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";

const navigation = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/classrooms", label: "Classrooms" },
    { to: "/seating", label: "Seating" },
    { to: "/admin-management", label: "Admin Management", superAdminOnly: true },
];

export const DashboardLayout = () => {
    const { user, logout, isLoading } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const visibleNavigation = useMemo(
        () => navigation.filter((item) => !item.superAdminOnly || user?.role === "SUPER_ADMIN"),
        [user?.role],
    );

    const closeMenus = () => {
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="hidden border-b border-slate-800 bg-slate-900/70 p-5 backdrop-blur lg:block lg:border-b-0 lg:border-r">
                    <div className="mb-8">
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Dispositio</p>
                        <h1 className="mt-2 text-xl font-bold">Exam Seating Admin</h1>
                    </div>

                    <nav className="space-y-2">
                        {visibleNavigation.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                                        isActive
                                            ? "bg-cyan-500/20 text-cyan-200"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                                    }`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <div className="flex min-h-screen min-w-0 flex-col">
                    <header className="relative flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen((prev) => !prev);
                                    setIsProfileMenuOpen(false);
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-200 lg:hidden"
                                aria-label="Toggle navigation"
                            >
                                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Dispositio</p>
                                <p className="text-sm font-semibold text-slate-100">Exam Seating Admin</p>
                            </div>
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProfileMenuOpen((prev) => !prev);
                                    setIsMobileMenuOpen(false);
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-200"
                                aria-label="Open profile menu"
                            >
                                <UserCircle2 className="h-6 w-6" />
                            </button>

                            {isProfileMenuOpen ? (
                                <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur">
                                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Logged In As</p>
                                    <p className="mt-1 truncate text-sm font-semibold text-slate-100">{user?.email}</p>
                                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">Role</p>
                                    <p className="mt-1 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-200">
                                        {user?.role}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            void logout();
                                        }}
                                        disabled={isLoading}
                                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        {isLoading ? "Signing out..." : "Logout"}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </header>

                    {isMobileMenuOpen ? (
                        <div className="border-b border-slate-800 bg-slate-900/90 p-4 backdrop-blur lg:hidden">
                            <nav className="space-y-2">
                                {visibleNavigation.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={closeMenus}
                                        className={({ isActive }) =>
                                            `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                                                isActive
                                                    ? "bg-cyan-500/20 text-cyan-200"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                                            }`
                                        }
                                    >
                                        {item.label}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>
                    ) : null}

                    <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 lg:px-8">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};
