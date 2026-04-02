import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import {
    formatDateTimeIst,
    toApiDateTimeIst,
    toDateTimeLocalValueFromApiIst,
} from "../utils/dateTime";

interface SeatingListResponse {
    seatingId: string;
    examName: string;
    examTime: string;
}

const DashboardPage = () => {
    const navigate = useNavigate();
    const [seatingPlans, setSeatingPlans] = useState<SeatingListResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState<SeatingListResponse | null>(null);
    const [editExamName, setEditExamName] = useState("");
    const [editExamTime, setEditExamTime] = useState("");
    const [deletingPlan, setDeletingPlan] = useState<SeatingListResponse | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isModalSubmitting, setIsModalSubmitting] = useState(false);

    const openEditModal = (plan: SeatingListResponse) => {
        setEditingPlan(plan);
        setEditExamName(plan.examName);
        setEditExamTime(toDateTimeLocalValueFromApiIst(plan.examTime));
        setModalError(null);
    };

    const closeEditModal = () => {
        setEditingPlan(null);
        setEditExamName("");
        setEditExamTime("");
        setModalError(null);
    };

    const saveEditModal = async () => {
        if (!editingPlan) {
            return;
        }

        if (!editExamName.trim()) {
            setModalError("Exam name is required.");
            return;
        }

        if (!editExamTime) {
            setModalError("Exam time is required.");
            return;
        }

        setIsModalSubmitting(true);

        try {
            const normalizedExamTime = toApiDateTimeIst(editExamTime);
            const parsedExamTime = new Date(normalizedExamTime);
            if (!normalizedExamTime || Number.isNaN(parsedExamTime.getTime())) {
                setModalError("Exam time is invalid.");
                return;
            }

            const nextExamTime = normalizedExamTime;

            await apiClient.put(`/seating/${editingPlan.seatingId}/info`, {
                examName: editExamName.trim(),
                examTime: nextExamTime,
            });

            setSeatingPlans((prev) =>
                prev.map((entry) =>
                    entry.seatingId === editingPlan.seatingId
                        ? {
                              ...entry,
                              examName: editExamName.trim(),
                              examTime: nextExamTime,
                          }
                        : entry,
                ),
            );

            closeEditModal();
        } catch {
            setModalError("Could not update seating plan info.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingPlan) {
            return;
        }

        setIsModalSubmitting(true);

        try {
            await apiClient.delete(`/seating/${deletingPlan.seatingId}`);
            setSeatingPlans((prev) => prev.filter((entry) => entry.seatingId !== deletingPlan.seatingId));
            setDeletingPlan(null);
        } catch {
            setModalError("Could not delete seating plan.");
        } finally {
            setIsModalSubmitting(false);
        }
    };

    useEffect(() => {
        const loadSeatingPlans = async () => {
            setError(null);
            setIsLoading(true);

            try {
                const response = await apiClient.get<SeatingListResponse[]>("/seating/list");
                console.log("Seating list response:", response.data);
                setSeatingPlans(response.data ?? []);
            } catch {
                setError("Could not load seating plans.");
            } finally {
                setIsLoading(false);
            }
        };

        loadSeatingPlans().catch(() => {
            setError("Could not load seating plans.");
            setIsLoading(false);
        });
    }, []);

    const hasRows = useMemo(() => seatingPlans.length > 0, [seatingPlans]);

    return (
        <section className="space-y-5">
            <div>
                <h2 className="text-2xl font-semibold text-slate-50">Seating Plans</h2>
                <p className="mt-1 text-sm text-slate-300">
                    Home page list from GET /seating/list.
                </p>
            </div>

            {isLoading ? <p className="text-sm text-slate-300">Loading seating plans...</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            {!isLoading && !error ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                        <thead className="bg-slate-900/85 text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Exam Name</th>
                                <th className="px-4 py-3 text-left font-medium">Exam Time</th>
                                <th className="px-4 py-3 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/55 text-slate-100">
                            {hasRows ? (
                                seatingPlans.map((plan) => {
                                    console.log(plan);

                                    return (
                                        <tr
                                            key={plan.seatingId}
                                            onClick={() => {
                                                navigate(`/seating/${plan.seatingId}`, {
                                                    state: {
                                                        examDetails: {
                                                            subject: plan.examName,
                                                            time: plan.examTime,
                                                        },
                                                    },
                                                });
                                            }}
                                            className="cursor-pointer transition hover:bg-slate-800/60"
                                        >
                                            <td className="px-4 py-3">{plan.examName}</td>
                                            <td className="px-4 py-3">{formatDateTimeIst(plan.examTime)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openEditModal(plan);
                                                        }}
                                                        className="rounded-md border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setModalError(null);
                                                            setDeletingPlan(plan);
                                                        }}
                                                        className="rounded-md border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                                        No seating plans returned by the backend.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {editingPlan ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Edit Seating Plan</h3>

                        <div className="mt-4 space-y-3">
                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Exam Name</span>
                                <input
                                    type="text"
                                    value={editExamName}
                                    onChange={(event) => setEditExamName(event.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                />
                            </label>

                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-300">Exam Time</span>
                                <input
                                    type="datetime-local"
                                    value={editExamTime}
                                    onChange={(event) => setEditExamTime(event.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                                />
                            </label>

                            {modalError ? <p className="text-sm text-rose-300">{modalError}</p> : null}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                disabled={isModalSubmitting}
                                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
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

            {deletingPlan ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
                    <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-50">Delete Seating Plan</h3>
                        <p className="mt-2 text-sm text-slate-300">
                            Are you sure you want to delete <span className="font-semibold">{deletingPlan.examName}</span>?
                        </p>
                        {modalError ? <p className="mt-2 text-sm text-rose-300">{modalError}</p> : null}

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeletingPlan(null)}
                                disabled={isModalSubmitting}
                                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void confirmDelete();
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

export default DashboardPage;
