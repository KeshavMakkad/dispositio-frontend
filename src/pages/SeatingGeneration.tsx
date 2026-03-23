import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiClient } from "../api/client";

interface SeatingResponse {
    [key: string]: unknown;
}

interface ClassroomItem {
    classroomName: string;
    totalCapacity?: number;
    set1Capacity?: number;
    set2Capacity?: number;
    setOneCapacity?: number;
    setTwoCapacity?: number;
}

const countStudentsInCsvFile = async (file: File): Promise<number> => {
    const content = await file.text();
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        return 0;
    }

    const headerCandidate = lines[0].toLowerCase();
    const looksLikeHeader =
        headerCandidate.includes("name") ||
        headerCandidate.includes("email") ||
        headerCandidate.includes("roll") ||
        headerCandidate.includes("registration");

    return looksLikeHeader ? Math.max(lines.length - 1, 0) : lines.length;
};

const getSetOneCapacity = (classroom: ClassroomItem) => classroom.set1Capacity ?? classroom.setOneCapacity ?? 0;
const getSetTwoCapacity = (classroom: ClassroomItem) => classroom.set2Capacity ?? classroom.setTwoCapacity ?? 0;
const getTotalCapacity = (classroom: ClassroomItem) =>
    classroom.totalCapacity ?? getSetOneCapacity(classroom) + getSetTwoCapacity(classroom);

const SeatingGenerationPage = () => {
    const [fileOne, setFileOne] = useState<File | null>(null);
    const [fileTwo, setFileTwo] = useState<File | null>(null);
    const [examName, setExamName] = useState("");
    const [examTime, setExamTime] = useState("");
    const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
    const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
    const [isClassroomDropdownOpen, setIsClassroomDropdownOpen] = useState(false);
    const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SeatingResponse | null>(null);
    const [setOneStudents, setSetOneStudents] = useState(0);
    const [setTwoStudents, setSetTwoStudents] = useState(0);
    const [csvCountError, setCsvCountError] = useState<string | null>(null);

    useEffect(() => {
        const loadClassrooms = async () => {
            setIsLoadingClassrooms(true);

            try {
                const response = await apiClient.get<ClassroomItem[]>("/classroom/list");
                setClassrooms(response.data ?? []);
            } catch {
                setError("Could not load classrooms for seating generation.");
            } finally {
                setIsLoadingClassrooms(false);
            }
        };

        loadClassrooms().catch(() => {
            setError("Could not load classrooms for seating generation.");
            setIsLoadingClassrooms(false);
        });
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (!fileOne) {
            setSetOneStudents(0);
            return;
        }

        countStudentsInCsvFile(fileOne)
            .then((count) => {
                if (!cancelled) {
                    setSetOneStudents(count);
                    setCsvCountError(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setSetOneStudents(0);
                    setCsvCountError("Could not read student_list_one.csv. Please verify the file format.");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [fileOne]);

    useEffect(() => {
        let cancelled = false;

        if (!fileTwo) {
            setSetTwoStudents(0);
            return;
        }

        countStudentsInCsvFile(fileTwo)
            .then((count) => {
                if (!cancelled) {
                    setSetTwoStudents(count);
                    setCsvCountError(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setSetTwoStudents(0);
                    setCsvCountError("Could not read student_list_two.csv. Please verify the file format.");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [fileTwo]);

    const hasSelectedClassrooms = useMemo(() => selectedClassrooms.length > 0, [selectedClassrooms]);

    const selectedClassroomDetails = useMemo(
        () => classrooms.filter((classroom) => selectedClassrooms.includes(classroom.classroomName)),
        [classrooms, selectedClassrooms],
    );

    const setOneCapacityUsed = useMemo(
        () => selectedClassroomDetails.reduce((sum, classroom) => sum + getSetOneCapacity(classroom), 0),
        [selectedClassroomDetails],
    );
    const setTwoCapacityUsed = useMemo(
        () => selectedClassroomDetails.reduce((sum, classroom) => sum + getSetTwoCapacity(classroom), 0),
        [selectedClassroomDetails],
    );
    const totalCapacityUsed = useMemo(
        () => selectedClassroomDetails.reduce((sum, classroom) => sum + getTotalCapacity(classroom), 0),
        [selectedClassroomDetails],
    );

    const totalStudents = setOneStudents + setTwoStudents;
    const isSetOneOverflow = setOneStudents > setOneCapacityUsed;
    const isSetTwoOverflow = setTwoStudents > setTwoCapacityUsed;
    const isTotalOverflow = totalStudents > totalCapacityUsed;
    const isOverflowing = isSetOneOverflow || isSetTwoOverflow || isTotalOverflow;

    const toggleClassroomSelection = (classroomName: string) => {
        setSelectedClassrooms((prev) => {
            if (prev.includes(classroomName)) {
                return prev.filter((name) => name !== classroomName);
            }

            return [...prev, classroomName];
        });
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setResult(null);

        if (!examName.trim()) {
            setError("Please provide exam name.");
            return;
        }

        if (!examTime) {
            setError("Please provide exam time.");
            return;
        }

        if (!hasSelectedClassrooms) {
            setError("Please select at least one classroom.");
            return;
        }

        if (!fileOne) {
            setError("Please upload student_list_one.csv.");
            return;
        }

        if (isOverflowing) {
            setError("Selected classrooms are not enough for uploaded students. Please select more classrooms.");
            return;
        }

        const formData = new FormData();
        formData.append("examName", examName.trim());
        const parsedExamTime = new Date(examTime);
        if (Number.isNaN(parsedExamTime.getTime())) {
            setError("Please provide a valid exam time.");
            return;
        }

        formData.append("examTime", parsedExamTime.toISOString());
        formData.append("classroomList", JSON.stringify(selectedClassrooms));
        formData.append("student_list_one", fileOne);
        if (fileTwo) {
            formData.append("student_list_two", fileTwo);
        }

        setIsSubmitting(true);
        try {
            const response = await apiClient.post<SeatingResponse>("/seating/create", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            setResult(response.data);
        } catch {
            setError("Seating generation failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="space-y-5">
            <div>
                <h2 className="text-2xl font-semibold text-slate-50">Generate Seating</h2>
                <p className="mt-1 text-sm text-slate-300">
                    Provide exam details and student lists, then submit POST /seating/create.
                </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <label className="block space-y-2 text-sm">
                    <span className="text-slate-200">Exam Name</span>
                    <input
                        type="text"
                        required
                        value={examName}
                        onChange={(event) => setExamName(event.target.value)}
                        placeholder="Midterm Mathematics"
                        className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                </label>

                <label className="block space-y-2 text-sm">
                    <span className="text-slate-200">Exam Time</span>
                    <input
                        type="datetime-local"
                        required
                        value={examTime}
                        onChange={(event) => setExamTime(event.target.value)}
                        className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                </label>

                <fieldset className="space-y-2 text-sm">
                    <legend className="text-slate-200">Classrooms</legend>
                    {isLoadingClassrooms ? (
                        <p className="text-slate-300">Loading classrooms...</p>
                    ) : classrooms.length > 0 ? (
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setIsClassroomDropdownOpen((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-left text-slate-100"
                            >
                                <span>
                                    {hasSelectedClassrooms
                                        ? `${selectedClassrooms.length} classroom(s) selected`
                                        : "Select classrooms"}
                                </span>
                                <span className="text-slate-400">{isClassroomDropdownOpen ? "-" : "+"}</span>
                            </button>

                            {isClassroomDropdownOpen ? (
                                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-900/95 p-2">
                                    {classrooms.map((classroom) => (
                                        <label
                                            key={classroom.classroomName}
                                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-slate-200 hover:bg-slate-800"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedClassrooms.includes(classroom.classroomName)}
                                                onChange={() => toggleClassroomSelection(classroom.classroomName)}
                                                className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                                            />
                                            <span>{classroom.classroomName}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : null}

                            <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-300">
                                    Selected Classrooms
                                </p>
                                {hasSelectedClassrooms ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedClassrooms.map((classroomName) => (
                                            <span
                                                key={classroomName}
                                                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                                            >
                                                {classroomName}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-slate-400">No classrooms selected yet.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-300">No classrooms available.</p>
                    )}
                </fieldset>

                <label className="block space-y-2 text-sm">
                    <span className="text-slate-200">student_list_one.csv (required)</span>
                    <input
                        type="file"
                        accept=".csv"
                        required
                        onChange={(event) => setFileOne(event.target.files?.[0] ?? null)}
                        className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                </label>

                <label className="block space-y-2 text-sm">
                    <span className="text-slate-200">student_list_two.csv (optional)</span>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(event) => setFileTwo(event.target.files?.[0] ?? null)}
                        className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                </label>

                <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-300">Capacity Usage</p>

                    <div className="mt-2 space-y-1.5 text-sm">
                        <p className={isSetOneOverflow ? "font-bold text-rose-300" : "text-slate-200"}>
                            Set 1: {setOneStudents}/{setOneCapacityUsed} seats used
                        </p>
                        <p className={isSetTwoOverflow ? "font-bold text-rose-300" : "text-slate-200"}>
                            Set 2: {setTwoStudents}/{setTwoCapacityUsed} seats used
                        </p>
                        <p className={isTotalOverflow ? "font-bold text-rose-300" : "text-slate-200"}>
                            Total: {totalStudents}/{totalCapacityUsed} seats used
                        </p>
                    </div>

                    {isOverflowing ? (
                        <p className="mt-2 text-sm font-semibold text-rose-300">
                            Overflow detected. Please select more classrooms.
                        </p>
                    ) : null}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isSubmitting ? "Generating..." : "Generate Seating"}
                </button>
            </form>

            {csvCountError ? <p className="text-sm text-rose-300">{csvCountError}</p> : null}

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            {result ? (
                <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
                    {JSON.stringify(result, null, 2)}
                </pre>
            ) : null}
        </section>
    );
};

export default SeatingGenerationPage;
