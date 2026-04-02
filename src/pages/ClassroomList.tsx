import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";

interface ClassLayoutItem {
    columnName: string;
    columnCapacity: string | number;
    columnSet: string;
}

interface Classroom {
    classroomId?: string;
    id?: string;
    classroom_id?: string;
    classroomName: string;
    name?: string;
    classroom_name?: string;
    classLayout?: ClassLayoutItem[];
    class_layout?: ClassLayoutItem[];
    columnsCount?: number;
    columns_count?: number;
    maxRows?: number;
    max_rows?: number;
    totalCapacity?: number;
    total_capacity?: number;
    set1Capacity?: number;
    set2Capacity?: number;
    setOneCapacity?: number;
    setTwoCapacity?: number;
    set_1_capacity?: number;
    set_2_capacity?: number;
}

interface ClassroomEditForm {
    name: string;
    classLayoutJson: string;
    columnsCount: string;
    maxRows: string;
    totalCapacity: string;
    setOneCapacity: string;
    setTwoCapacity: string;
}

const emptyEditForm: ClassroomEditForm = {
    name: "",
    classLayoutJson: "[]",
    columnsCount: "",
    maxRows: "",
    totalCapacity: "",
    setOneCapacity: "",
    setTwoCapacity: "",
};

const normalizeClassroom = (classroom: Classroom): Classroom => ({
    ...classroom,
    classroomId: classroom.classroomId ?? classroom.id ?? classroom.classroom_id,
    classroomName: classroom.classroomName ?? classroom.name ?? classroom.classroom_name ?? "",
    classLayout: classroom.classLayout ?? classroom.class_layout ?? [],
    columnsCount: classroom.columnsCount ?? classroom.columns_count,
    maxRows: classroom.maxRows ?? classroom.max_rows,
    totalCapacity: classroom.totalCapacity ?? classroom.total_capacity,
    set1Capacity: classroom.set1Capacity ?? classroom.setOneCapacity ?? classroom.set_1_capacity,
    set2Capacity: classroom.set2Capacity ?? classroom.setTwoCapacity ?? classroom.set_2_capacity,
    setOneCapacity: classroom.setOneCapacity ?? classroom.set1Capacity ?? classroom.set_1_capacity,
    setTwoCapacity: classroom.setTwoCapacity ?? classroom.set2Capacity ?? classroom.set_2_capacity,
});

const ClassroomListPage = () => {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [editForm, setEditForm] = useState<ClassroomEditForm>(emptyEditForm);
    const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isModalSubmitting, setIsModalSubmitting] = useState(false);

    const getClassroomIdentifier = (classroom: Classroom) => classroom.classroomId ?? classroom.id ?? classroom.classroom_id ?? classroom.classroomName;
    const getClassroomApiId = (classroom: Classroom) => classroom.classroomId ?? classroom.id ?? classroom.classroom_id;
    const getSetOneCapacity = (classroom: Classroom) => classroom.set1Capacity ?? classroom.setOneCapacity ?? 0;
    const getSetTwoCapacity = (classroom: Classroom) => classroom.set2Capacity ?? classroom.setTwoCapacity ?? 0;
    const getTotalCapacity = (classroom: Classroom) =>
        classroom.totalCapacity ?? getSetOneCapacity(classroom) + getSetTwoCapacity(classroom);

    useEffect(() => {
        const loadClassrooms = async () => {
            setError(null);
            setIsLoading(true);

            try {
                const response = await apiClient.get<Classroom[]>("/classroom/list");
                const normalized = (response.data ?? []).map((item) => normalizeClassroom(item));
                setClassrooms(normalized);
            } catch {
                setError("Could not fetch classrooms.");
            } finally {
                setIsLoading(false);
            }
        };

        loadClassrooms().catch(() => {
            setError("Could not fetch classrooms.");
            setIsLoading(false);
        });
    }, []);

    const openEditModal = (classroom: Classroom) => {
        setEditingClassroom(classroom);
        setEditForm({
            name: classroom.classroomName,
            classLayoutJson: JSON.stringify(classroom.classLayout ?? [], null, 2),
            columnsCount: classroom.columnsCount?.toString() ?? "",
            maxRows: classroom.maxRows?.toString() ?? "",
            totalCapacity: getTotalCapacity(classroom).toString(),
            setOneCapacity: getSetOneCapacity(classroom).toString(),
            setTwoCapacity: getSetTwoCapacity(classroom).toString(),
        });
        setModalError(null);
    };

    const closeEditModal = () => {
        setEditingClassroom(null);
        setEditForm(emptyEditForm);
        setModalError(null);
    };

    const saveEditModal = async () => {
        if (!editingClassroom) {
            return;
        }

        if (!editForm.name.trim()) {
            setModalError("Classroom name is required.");
            return;
        }

        if (
            !editForm.columnsCount ||
            !editForm.maxRows ||
            !editForm.totalCapacity ||
            !editForm.setOneCapacity ||
            !editForm.setTwoCapacity
        ) {
            setModalError("All classroom capacity fields are required.");
            return;
        }

        let parsedLayout: ClassLayoutItem[] = [];
        try {
            const value = JSON.parse(editForm.classLayoutJson);
            if (!Array.isArray(value)) {
                throw new Error("classLayout must be array");
            }
            parsedLayout = value as ClassLayoutItem[];
        } catch {
            setModalError("classLayout must be valid JSON array.");
            return;
        }

        setIsModalSubmitting(true);

        try {
            const classroomId = getClassroomApiId(editingClassroom);

            if (!classroomId) {
                setModalError("This classroom is missing an id and cannot be updated.");
                return;
            }

            await apiClient.put(`/classroom/${encodeURIComponent(classroomId)}`, {
                name: editForm.name.trim(),
                classLayout: parsedLayout,
                columnsCount: Number(editForm.columnsCount),
                maxRows: Number(editForm.maxRows),
                totalCapacity: Number(editForm.totalCapacity),
                set1Capacity: Number(editForm.setOneCapacity),
                set2Capacity: Number(editForm.setTwoCapacity),
                setOneCapacity: Number(editForm.setOneCapacity),
                setTwoCapacity: Number(editForm.setTwoCapacity),
            });

            setClassrooms((prev) =>
                prev.map((classroom) =>
                    getClassroomIdentifier(classroom) === getClassroomIdentifier(editingClassroom)
                        ? {
                              ...classroom,
                              classroomName: editForm.name.trim(),
                              name: editForm.name.trim(),
                              classLayout: parsedLayout,
                              columnsCount: Number(editForm.columnsCount),
                              maxRows: Number(editForm.maxRows),
                              totalCapacity: Number(editForm.totalCapacity),
                              set1Capacity: Number(editForm.setOneCapacity),
                              set2Capacity: Number(editForm.setTwoCapacity),
                              setOneCapacity: Number(editForm.setOneCapacity),
                              setTwoCapacity: Number(editForm.setTwoCapacity),
                          }
                        : classroom,
                ),
            );

            closeEditModal();
        } catch {
            setModalError("Could not update classroom.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const confirmDeleteModal = async () => {
        if (!deletingClassroom) {
            return;
        }

        setIsModalSubmitting(true);

        try {
            const classroomId = getClassroomApiId(deletingClassroom);

            if (!classroomId) {
                setModalError("This classroom is missing an id and cannot be deleted.");
                return;
            }

            await apiClient.delete(`/classroom/${encodeURIComponent(classroomId)}`);
            setClassrooms((prev) =>
                prev.filter((classroom) => getClassroomIdentifier(classroom) !== getClassroomIdentifier(deletingClassroom)),
            );
            setDeletingClassroom(null);
            setModalError(null);
        } catch {
            setModalError("Could not delete classroom.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const hasRows = useMemo(() => classrooms.length > 0, [classrooms]);

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-2xl font-semibold text-slate-50">Classrooms</h2>
                <p className="mt-1 text-sm text-slate-300">Live data from GET /classroom/list.</p>
            </div>

            {isLoading ? <p className="text-sm text-slate-300">Loading classrooms...</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            {!isLoading && !error ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                        <thead className="bg-slate-900/85 text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Classroom Name</th>
                                <th className="px-4 py-3 text-left font-medium">Set 1 Capacity</th>
                                <th className="px-4 py-3 text-left font-medium">Set 2 Capacity</th>
                                <th className="px-4 py-3 text-left font-medium">Total Capacity</th>
                                <th className="px-4 py-3 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/55 text-slate-100">
                            {hasRows ? (
                                classrooms.map((classroom) => (
                                    <tr key={getClassroomIdentifier(classroom)}>
                                        <td className="px-4 py-3">{classroom.classroomName}</td>
                                        <td className="px-4 py-3">{getSetOneCapacity(classroom)}</td>
                                        <td className="px-4 py-3">{getSetTwoCapacity(classroom)}</td>
                                        <td className="px-4 py-3">{getTotalCapacity(classroom)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(classroom)}
                                                    className="rounded-md border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDeletingClassroom(classroom);
                                                        setModalError(null);
                                                    }}
                                                    className="rounded-md border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                                        No classrooms returned by the backend.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {editingClassroom ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Edit Classroom</h3>

                        <div className="mt-4 space-y-3">
                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Classroom Name</span>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                />
                            </label>

                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Class Layout (JSON)</span>
                                <textarea
                                    value={editForm.classLayoutJson}
                                    onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, classLayoutJson: event.target.value }))
                                    }
                                    rows={5}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                                />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block space-y-1 text-sm">
                                    <span className="text-slate-300">Columns Count</span>
                                    <input
                                        type="number"
                                        value={editForm.columnsCount}
                                        onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, columnsCount: event.target.value }))
                                        }
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                    />
                                </label>
                                <label className="block space-y-1 text-sm">
                                    <span className="text-slate-300">Max Rows</span>
                                    <input
                                        type="number"
                                        value={editForm.maxRows}
                                        onChange={(event) => setEditForm((prev) => ({ ...prev, maxRows: event.target.value }))}
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                    />
                                </label>
                                <label className="block space-y-1 text-sm">
                                    <span className="text-slate-300">Total Capacity</span>
                                    <input
                                        type="number"
                                        value={editForm.totalCapacity}
                                        onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, totalCapacity: event.target.value }))
                                        }
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                    />
                                </label>
                                <label className="block space-y-1 text-sm">
                                    <span className="text-slate-300">Set One Capacity</span>
                                    <input
                                        type="number"
                                        value={editForm.setOneCapacity}
                                        onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, setOneCapacity: event.target.value }))
                                        }
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                    />
                                </label>
                                <label className="block space-y-1 text-sm sm:col-span-2">
                                    <span className="text-slate-300">Set Two Capacity</span>
                                    <input
                                        type="number"
                                        value={editForm.setTwoCapacity}
                                        onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, setTwoCapacity: event.target.value }))
                                        }
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                    />
                                </label>
                            </div>

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

            {deletingClassroom ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Delete Classroom</h3>
                        <p className="mt-2 text-sm text-slate-300">
                            Are you sure you want to delete <span className="font-semibold">{deletingClassroom.classroomName}</span>?
                        </p>
                        {modalError ? <p className="mt-2 text-sm text-rose-300">{modalError}</p> : null}

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeletingClassroom(null)}
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

export default ClassroomListPage;
