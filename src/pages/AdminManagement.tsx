import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { AdminRole } from "../types/auth";

interface ManagedUser {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface UserForm {
    name: string;
    email: string;
    role: AdminRole;
}

const roleOptions: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "VIEWER"];

const emptyForm: UserForm = {
    name: "",
    email: "",
    role: "VIEWER",
};

const AdminManagementPage = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [createForm, setCreateForm] = useState<UserForm>(emptyForm);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [editForm, setEditForm] = useState<UserForm>(emptyForm);
    const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isModalSubmitting, setIsModalSubmitting] = useState(false);

    const loadUsers = async () => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await apiClient.get<ManagedUser[]>("/users/list");
            setUsers(response.data ?? []);
        } catch {
            setError("Could not load users.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers().catch(() => {
            setError("Could not load users.");
            setIsLoading(false);
        });
    }, []);

    const onCreateUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCreateError(null);
        setIsCreating(true);

        try {
            const response = await apiClient.post<ManagedUser>("/users/create", {
                name: createForm.name.trim(),
                email: createForm.email.trim().toLowerCase(),
                role: createForm.role,
            });

            setUsers((prev) => [response.data, ...prev]);
            setCreateForm(emptyForm);
        } catch {
            setCreateError("Could not create user. Ensure name/email are unique.");
        } finally {
            setIsCreating(false);
        }
    };

    const openEditModal = (target: ManagedUser) => {
        setEditingUser(target);
        setEditForm({
            name: target.name,
            email: target.email,
            role: target.role,
        });
        setModalError(null);
    };

    const closeEditModal = () => {
        setEditingUser(null);
        setEditForm(emptyForm);
        setModalError(null);
    };

    const saveEditModal = async () => {
        if (!editingUser) {
            return;
        }

        if (!editForm.name.trim() || !editForm.email.trim()) {
            setModalError("Name and email are required.");
            return;
        }

        setIsModalSubmitting(true);

        try {
            const response = await apiClient.put<ManagedUser>(`/users/${editingUser.id}`, {
                name: editForm.name.trim(),
                email: editForm.email.trim().toLowerCase(),
                role: editForm.role,
            });

            setUsers((prev) => prev.map((entry) => (entry.id === editingUser.id ? response.data : entry)));
            closeEditModal();
        } catch {
            setModalError("Could not update user.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const confirmDeleteModal = async () => {
        if (!deletingUser) {
            return;
        }

        setIsModalSubmitting(true);

        try {
            await apiClient.delete(`/users/${deletingUser.id}`);
            setUsers((prev) => prev.filter((entry) => entry.id !== deletingUser.id));
            setDeletingUser(null);
            setModalError(null);
        } catch {
            setModalError("Could not delete user.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const hasUsers = useMemo(() => users.length > 0, [users]);

    if (user?.role !== "SUPER_ADMIN") {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <section className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold text-slate-50">User Management</h2>
                <p className="mt-1 text-sm text-slate-300">
                    Super admin controls for creating users, updating users, and deleting users.
                </p>
            </div>

            <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-300">Create User</h3>

                <form onSubmit={onCreateUser} className="mt-4 grid gap-3 md:grid-cols-4">
                    <input
                        type="text"
                        required
                        value={createForm.name}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Name"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="Email"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <select
                        value={createForm.role}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as AdminRole }))}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    >
                        {roleOptions.map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={isCreating}
                        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isCreating ? "Creating..." : "Create User"}
                    </button>
                </form>

                {createError ? <p className="mt-3 text-sm text-rose-300">{createError}</p> : null}
            </article>

            <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-300">Users</h3>
                    <button
                        type="button"
                        onClick={() => {
                            loadUsers().catch(() => {
                                setError("Could not load users.");
                            });
                        }}
                        disabled={isLoading}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        Refresh
                    </button>
                </div>

                {isLoading ? <p className="text-sm text-slate-300">Loading users...</p> : null}
                {error ? <p className="text-sm text-rose-300">{error}</p> : null}

                {!isLoading && !error ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="min-w-full divide-y divide-slate-800 text-sm">
                            <thead className="bg-slate-900/85 text-slate-300">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Name</th>
                                    <th className="px-4 py-3 text-left font-medium">Email</th>
                                    <th className="px-4 py-3 text-left font-medium">Role</th>
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                    <th className="px-4 py-3 text-left font-medium">Created</th>
                                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/55 text-slate-100">
                                {hasUsers ? (
                                    users.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="px-4 py-3">{entry.name}</td>
                                            <td className="px-4 py-3">{entry.email}</td>
                                            <td className="px-4 py-3">{entry.role}</td>
                                            <td className="px-4 py-3">
                                                {entry.isActive ? (
                                                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(entry)}
                                                        disabled={!entry.isActive}
                                                        className="rounded-md border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDeletingUser(entry);
                                                            setModalError(null);
                                                        }}
                                                        disabled={!entry.isActive}
                                                        className="rounded-md border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                                            No users returned by the backend.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </article>

            {editingUser ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Edit User</h3>
                        <p className="mt-1 text-xs text-slate-400">{editingUser.id}</p>

                        <div className="mt-4 space-y-3">
                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Name</span>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                />
                            </label>

                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Email</span>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                />
                            </label>

                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Role</span>
                                <select
                                    value={editForm.role}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as AdminRole }))}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                >
                                    {roleOptions.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {modalError ? <p className="text-sm text-rose-300">{modalError}</p> : null}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                disabled={isModalSubmitting}
                                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void saveEditModal();
                                }}
                                disabled={isModalSubmitting}
                                className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isModalSubmitting ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {deletingUser ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Delete User</h3>
                        <p className="mt-2 text-sm text-slate-300">
                            Are you sure you want to delete <span className="font-semibold">{deletingUser.name}</span>?
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{deletingUser.email}</p>
                        {modalError ? <p className="mt-2 text-sm text-rose-300">{modalError}</p> : null}

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeletingUser(null)}
                                disabled={isModalSubmitting}
                                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void confirmDeleteModal();
                                }}
                                disabled={isModalSubmitting}
                                className="rounded-md border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isModalSubmitting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default AdminManagementPage;
