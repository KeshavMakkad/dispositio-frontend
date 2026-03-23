import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
    ChevronDown,
    ChevronRight,
    Clock,
    DoorOpen,
    Monitor,
    Pencil,
    Download,
    Search,
    X,
} from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/useAuth";

type SeatValue = string;
type SeatMatrix = SeatValue[][];
type LegacyColumnData = [number, SeatMatrix];
type ClassroomColumns = Record<string, LegacyColumnData>;
type NormalizedClassrooms = Record<string, ClassroomColumns>;

interface ExamDetails {
    subject?: string;
    time?: string;
}

interface SearchBarProps {
    onSearch: (query: string) => void;
}

interface BreadcrumbsProps {
    examDetails?: ExamDetails;
    onNavigate: (path: string) => void;
}

interface ClassroomSelectorProps {
    classroomNames: string[];
    selectedClassroom: string;
    onChange: (value: string) => void;
}

interface SeatCardProps {
    email: string;
    isEmpty: boolean;
    isCurrentUser: boolean;
    isHighlighted: boolean;
    showSignatureSpace?: boolean;
    showEditButton?: boolean;
    isPdfMode?: boolean;
    isPdfLight?: boolean;
    onEdit: () => void;
}

interface ColumnSectionProps {
    columnName: string;
    columnData: LegacyColumnData;
    currentUserEmail: string;
    searchQuery: string;
    showSignatureSpace?: boolean;
    showEditButton?: boolean;
    isPdfMode?: boolean;
    isPdfLight?: boolean;
    onEditSeat: (columnName: string, rowIndex: number, seatIndex: number, currentValue: string) => void;
}

interface EditingSeat {
    classroomName: string;
    columnName: string;
    rowIndex: number;
    seatIndex: number;
    currentValue: string;
}

interface SeatingDetailLocationState {
    examDetails?: ExamDetails;
}

const SearchBar = ({ onSearch }: SearchBarProps) => (
    <div className="relative">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 w-full sm:w-80">
            <Search className="w-6 h-6 text-white/50" />
            <input
                type="text"
                placeholder="Search by roll number (e.g., 10209 or 23bcs10209)"
                className="bg-transparent border-none outline-none text-white/70 placeholder:text-white/30 flex-1"
                onChange={(event) => onSearch(event.target.value)}
            />
        </div>
    </div>
);

const Breadcrumbs = ({ examDetails, onNavigate }: BreadcrumbsProps) => (
    <nav className="flex items-center space-x-2 mb-6 text-sm">
        <button
            onClick={() => onNavigate("/dashboard")}
            className="text-white/70 hover:text-blue-400 transition-colors"
        >
            Dashboard
        </button>
        <ChevronRight className="w-4 h-4 text-white/40" />
        <button
            onClick={() => onNavigate("/seating")}
            className="text-white/70 hover:text-blue-400 transition-colors"
        >
            Seating
        </button>
        <ChevronRight className="w-4 h-4 text-white/40" />
        <span className="text-blue-400">{examDetails?.subject ?? "Seating Detail"}</span>
    </nav>
);

const ClassroomSelector = ({ classroomNames, selectedClassroom, onChange }: ClassroomSelectorProps) => (
    <div className="relative flex-none">
        <DoorOpen className="w-4 h-4 text-violet-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
            value={selectedClassroom}
            onChange={(event) => onChange(event.target.value)}
            className="appearance-none pl-9 pr-10 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300 min-w-[180px] backdrop-blur-lg outline-none focus:ring-2 focus:ring-violet-400/50"
        >
            {classroomNames.map((classroomName) => (
                <option key={classroomName} value={classroomName} className="bg-slate-900 text-white">
                    {classroomName}
                </option>
            ))}
        </select>
        <ChevronDown className="w-4 h-4 text-violet-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
);

const highlightStudent = (email: string, searchQuery: string) => {
    if (!searchQuery || !email) {
        return false;
    }

    const searchTerm = searchQuery.trim();
    if (!searchTerm) {
        return false;
    }

    if (searchTerm.length === 5) {
        if (!/^\d+$/.test(searchTerm)) {
            return false;
        }
    } else if (searchTerm.length >= 10) {
        if (!/^[a-zA-Z0-9]+$/.test(searchTerm)) {
            return false;
        }
    } else if (!/^\d+$/.test(searchTerm)) {
        return false;
    }

    if (searchTerm.length !== 5 && searchTerm.length < 10) {
        return false;
    }

    const localPart = email.split("@")[0] ?? "";
    const roll = localPart.split(".")[1] ?? "";
    if (!roll) {
        return false;
    }

    const rollLower = roll.toLowerCase();

    if (searchTerm.length === 5) {
        const rollNumberMatch = rollLower.match(/(\d{5})$/);
        if (rollNumberMatch) {
            return rollNumberMatch[1] === searchTerm;
        }
    }

    if (searchTerm.length >= 10) {
        return rollLower.includes(searchTerm.toLowerCase());
    }

    return false;
};

const isLegacyColumnData = (columnData: unknown): columnData is LegacyColumnData => {
    return (
        Array.isArray(columnData) &&
        columnData.length >= 2 &&
        typeof columnData[0] === "number" &&
        Array.isArray(columnData[1])
    );
};

const sanitizeSeatValue = (value: unknown): string => {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") {
        return "";
    }

    return trimmed;
};

const convertMatrixClassroomToColumns = (classroomMatrix: unknown[]): ClassroomColumns => {
    if (!Array.isArray(classroomMatrix) || classroomMatrix.length === 0) {
        return {};
    }

    const headerRow = Array.isArray(classroomMatrix[0]) ? classroomMatrix[0] : [];
    const columnIndexMap: Record<string, number[]> = {};

    for (let i = 1; i < headerRow.length; i += 1) {
        const rawColumnName = sanitizeSeatValue(headerRow[i]);
        if (!rawColumnName) {
            continue;
        }

        if (!columnIndexMap[rawColumnName]) {
            columnIndexMap[rawColumnName] = [];
        }
        columnIndexMap[rawColumnName].push(i);
    }

    const rows = classroomMatrix.slice(1);
    const normalizedColumns: ClassroomColumns = {};

    for (const [columnName, indices] of Object.entries(columnIndexMap)) {
        const seatMatrix: SeatMatrix = rows.map((row) => {
            const currentRow = Array.isArray(row) ? row : [];
            return indices.map((idx) => sanitizeSeatValue(currentRow[idx]));
        });

        normalizedColumns[columnName] = [indices.length, seatMatrix];
    }

    return normalizedColumns;
};

const normalizeClassrooms = (classroomsPayload: unknown): NormalizedClassrooms => {
    if (!classroomsPayload || typeof classroomsPayload !== "object") {
        return {};
    }

    const normalized: NormalizedClassrooms = {};

    for (const [className, classData] of Object.entries(classroomsPayload)) {
        if (Array.isArray(classData)) {
            normalized[className] = convertMatrixClassroomToColumns(classData);
            continue;
        }

        if (classData && typeof classData === "object") {
            const values = Object.values(classData);
            const hasLegacyShape = values.some((value) => isLegacyColumnData(value));

            if (hasLegacyShape) {
                normalized[className] = classData as ClassroomColumns;
            }
        }
    }

    return normalized;
};

const convertColumnsToMatrixClassroom = (columns: ClassroomColumns): string[][] => {
    const columnEntries = Object.entries(columns);
    if (columnEntries.length === 0) {
        return [[]];
    }

    const headerRow: string[] = [""];
    for (let i = 0; i < columnEntries.length; i += 1) {
        const [columnName, columnData] = columnEntries[i];
        const seatCount = Math.max(0, columnData[0]);

        for (let seatIdx = 0; seatIdx < seatCount; seatIdx += 1) {
            headerRow.push(columnName);
        }

        if (i < columnEntries.length - 1) {
            headerRow.push("-");
        }
    }

    const rowCount = columnEntries.reduce((maxRows, [, columnData]) => Math.max(maxRows, columnData[1].length), 0);
    const matrixRows: string[][] = [headerRow];

    for (let rowIdx = 0; rowIdx < rowCount; rowIdx += 1) {
        const row: string[] = [""];

        for (let colIdx = 0; colIdx < columnEntries.length; colIdx += 1) {
            const [, columnData] = columnEntries[colIdx];
            const seatCount = Math.max(0, columnData[0]);
            const seatRow = columnData[1][rowIdx] ?? [];

            for (let seatIdx = 0; seatIdx < seatCount; seatIdx += 1) {
                row.push(seatRow[seatIdx] ?? "");
            }

            if (colIdx < columnEntries.length - 1) {
                row.push("-");
            }
        }

        matrixRows.push(row);
    }

    return matrixRows;
};

const denormalizeClassroomsToBackendPayload = (classrooms: NormalizedClassrooms): Record<string, string[][]> => {
    return Object.fromEntries(
        Object.entries(classrooms).map(([classroomName, columns]) => [
            classroomName,
            convertColumnsToMatrixClassroom(columns),
        ]),
    );
};

const findClassroomBySearchQuery = (classrooms: NormalizedClassrooms, searchQuery: string) => {
    if (!searchQuery.trim()) {
        return null;
    }

    for (const [className, columns] of Object.entries(classrooms)) {
        const hasMatch = Object.values(columns).some((columnData) => {
            if (!isLegacyColumnData(columnData)) {
                return false;
            }

            const matrix = columnData[1] ?? [];
            return matrix.some((row) => row.some((seatValue) => highlightStudent(seatValue, searchQuery)));
        });

        if (hasMatch) {
            return className;
        }
    }

    return null;
};

const SeatCard = ({
    email,
    isEmpty,
    isCurrentUser,
    isHighlighted,
    showSignatureSpace = false,
    showEditButton = true,
    isPdfMode = false,
    isPdfLight = false,
    onEdit,
}: SeatCardProps) => {
    const seatRef = useRef<HTMLDivElement | null>(null);
    const normalizedEmpty = isEmpty || email === "N/A" || email === "";
    const isLightPdf = isPdfMode && isPdfLight;

    useEffect(() => {
        if (isHighlighted && seatRef.current) {
            seatRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
            });
        }
    }, [isHighlighted]);

    if (normalizedEmpty) {
        return (
            <div
                ref={seatRef}
                className={`group flex items-center justify-center ${isPdfMode ? "w-full h-[72px]" : "w-[110px] h-[82px] lg:w-[170px] lg:h-[112px]"}`}
            >
                <div
                    className={`relative w-full h-full rounded-2xl border shadow-md ${
                        isLightPdf ? "bg-white border-slate-300" : "bg-white/5 border-white/20"
                    } ${
                        isPdfMode
                            ? "px-2 pt-1.5 pb-4"
                            : "p-4 backdrop-blur-xl transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                    }`}
                >
                    {showEditButton ? (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-500/20 border border-blue-400/30 text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Pencil className="w-3 h-3" />
                            Edit
                        </button>
                    ) : null}
                    <div
                        className={`absolute inset-0 rounded-2xl pointer-events-none ${
                            isLightPdf ? "bg-gradient-to-t from-slate-100 to-transparent opacity-60" : "bg-gradient-to-t from-white/30 to-transparent opacity-30"
                        }`}
                    />
                    <div className="relative z-10 flex flex-col items-center justify-center">
                        <X className={`${isPdfMode ? "w-4 h-4" : "w-6 h-6"} ${isLightPdf ? "text-slate-400" : "text-white/50"}`} />
                        <p
                            className={`${isPdfMode ? "text-[10px]" : "text-xs"} uppercase tracking-wider font-medium ${
                                isLightPdf ? "text-slate-500" : "text-white/50"
                            }`}
                        >
                            Empty
                        </p>
                    </div>
                    {showSignatureSpace ? (
                        <div
                            className={`absolute left-2 right-2 border-t ${isLightPdf ? "border-slate-500 text-slate-700" : "border-slate-300/80 text-slate-200"} ${
                                isPdfMode ? "bottom-1 text-[8px] pt-0.5" : "bottom-4 text-[10px] pt-1"
                            }`}
                        >
                            Signature
                        </div>
                    ) : null}
                    {isPdfMode ? null : (
                        <div className="absolute -bottom-2 left-1/2 w-12 h-2 bg-white/20 rounded-full transform -translate-x-1/2 shadow-inner" />
                    )}
                </div>
            </div>
        );
    }

    const localPart = email.split("@")[0] ?? "";
    const userName = localPart.split(".")[0] ?? "";
    const roll = localPart.split(".")[1] ?? "";

    return (
        <div
            ref={seatRef}
            className={`group flex items-center justify-center ${
                isPdfMode ? "w-full h-[72px]" : "w-[110px] h-[82px] lg:w-[170px] lg:h-[112px] perspective-1000"
            }`}
            data-highlighted={isHighlighted}
        >
            <div
                className={`
                    relative w-full h-full rounded-2xl
                    ${
                        isLightPdf
                            ? "bg-white border-slate-300"
                            : isHighlighted
                            ? "bg-blue-500/10 backdrop-blur-xl border-blue-400/50"
                            : "bg-white/5 backdrop-blur-md border-white/20"
                    }
                    border shadow-md ${isPdfMode ? "px-2 pt-1.5 pb-4" : "p-4 transition-all duration-300"}
                    ${
                        isPdfMode
                            ? ""
                            : isHighlighted
                              ? "scale-105 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                              : "hover:scale-105"
                    }
                    ${isCurrentUser ? "border-blue-400 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.35)]" : ""}
                `}
            >
                {showEditButton ? (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-500/20 border border-blue-400/30 text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Pencil className="w-3 h-3" />
                        Edit
                    </button>
                ) : null}
                {isHighlighted ? (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-blue-500/20 via-transparent to-blue-500/10 animate-pulse pointer-events-none" />
                ) : null}
                <div
                    className={`absolute inset-0 rounded-2xl ${
                        isLightPdf ? "bg-gradient-to-t from-slate-100 to-transparent opacity-60" : "bg-gradient-to-t from-white/30 to-transparent opacity-20"
                    }`}
                />
                <div className="relative z-10 flex flex-col items-center justify-center">
                    <Monitor
                        className={`${isPdfMode ? "w-4.5 h-4.5" : "w-6 h-6 sm:w-8 sm:h-8"} ${
                            isLightPdf ? (isCurrentUser ? "text-blue-600" : "text-slate-600") : isCurrentUser ? "text-blue-400" : "text-white/80"
                        }`}
                    />
                    <p
                        className={`${isPdfMode ? "mt-1 text-[10px]" : "mt-1 text-[11px] sm:mt-2 sm:text-base"} font-bold text-center leading-tight ${
                            isLightPdf ? "text-slate-900" : "text-white drop-shadow-lg"
                        }`}
                    >
                        {userName.charAt(0).toUpperCase() + userName.slice(1)}
                    </p>
                    <div
                        className={`${isPdfMode ? "mt-0.5 text-[9px]" : "mt-0.5 text-[10px] sm:mt-1 sm:text-xs"} font-medium italic ${
                            isLightPdf ? "text-slate-600" : "text-white/80"
                        }`}
                    >
                        {roll}
                    </div>
                </div>
                {showSignatureSpace ? (
                    <div
                        className={`absolute left-2 right-2 border-t ${isLightPdf ? "border-slate-500 text-slate-700" : "border-slate-300/80 text-slate-200"} ${
                            isPdfMode ? "bottom-1 text-[8px] pt-0.5" : "bottom-4 text-[10px] pt-1"
                        }`}
                    >
                        Signature
                    </div>
                ) : null}
                {isPdfMode ? null : (
                    <div className="absolute -bottom-2 left-1/2 w-12 h-2 bg-white/20 rounded-full transform -translate-x-1/2 shadow-inner" />
                )}
            </div>
        </div>
    );
};

const ColumnSection = ({
    columnName,
    columnData,
    currentUserEmail,
    searchQuery,
    showSignatureSpace = false,
    showEditButton = true,
    isPdfMode = false,
    isPdfLight = false,
    onEditSeat,
}: ColumnSectionProps) => {
    const [seats, seatMatrix] = columnData;
    const isLightPdf = isPdfMode && isPdfLight;

    return (
        <div
            className={`rounded-2xl border ${
                isLightPdf ? "border-slate-300 bg-white" : "border-white/20 bg-white/5"
            } ${
                isPdfMode ? "w-full p-2" : "w-max p-3 sm:p-6 lg:p-7 backdrop-blur-xl transition-transform duration-300"
            }`}
        >
            <div className={`flex items-center justify-between ${isPdfMode ? "mb-2" : "mb-4"}`}>
                <h3
                    className={`${isPdfMode ? "text-sm" : "text-lg"} font-bold ${
                        isLightPdf ? "text-slate-800" : "bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent"
                    }`}
                >
                    {columnName}
                </h3>
                <div className={`${isPdfMode ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"} rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400`}>
                    {seats} seats
                </div>
            </div>
            <div className={isPdfMode ? "space-y-1.5" : "space-y-4 lg:space-y-5"}>
                {seatMatrix.map((row, rowIndex) => (
                    <div key={rowIndex} className={`flex items-center ${isPdfMode ? "gap-1.5" : "gap-4 lg:gap-5"}`}>
                        <div
                            className={`${isPdfMode ? "w-5 h-5 text-[9px]" : "h-10 w-10 shrink-0 text-base"} flex items-center justify-center rounded-full border font-bold ${
                                isLightPdf ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white/10 border-white/10 text-white/70"
                            }`}
                        >
                            {rowIndex + 1}
                        </div>
                        <div
                            className={`grid ${isPdfMode ? "gap-1" : "gap-2.5 lg:gap-4 [--seat-card-width:110px] lg:[--seat-card-width:170px]"}`}
                            style={{
                                gridTemplateColumns: isPdfMode
                                    ? `repeat(${seats}, minmax(0, 1fr))`
                                    : `repeat(${seats}, minmax(var(--seat-card-width), var(--seat-card-width)))`,
                            }}
                        >
                            {row.map((email, seatIndex) => (
                                <div key={`${rowIndex}-${seatIndex}`} className={isPdfMode ? "w-full" : "flex justify-center"}>
                                    <SeatCard
                                        email={email}
                                        isEmpty={email === ""}
                                        isCurrentUser={email.toLowerCase() === currentUserEmail.toLowerCase()}
                                        isHighlighted={highlightStudent(email, searchQuery)}
                                        showSignatureSpace={showSignatureSpace}
                                        showEditButton={showEditButton}
                                        isPdfMode={isPdfMode}
                                        isPdfLight={isPdfLight}
                                        onEdit={() => onEditSeat(columnName, rowIndex, seatIndex, email)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const formatTime = (isoDateTime?: string) => {
    if (!isoDateTime) {
        return "-";
    }

    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) {
        return isoDateTime;
    }

    return parsed.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    });
};

const formatDateTimeForPrint = (isoDateTime?: string) => {
    if (!isoDateTime) {
        return "-";
    }

    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) {
        return isoDateTime;
    }

    return parsed.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
};

const getSeatCompactDisplay = (seatValue: string) => {
    const value = seatValue.trim();
    if (!value) {
        return { name: "Empty", roll: "" };
    }

    const localPart = value.split("@")[0] ?? "";
    const [rawName, rawRoll] = localPart.split(".");

    const name = rawName
        ? `${rawName.charAt(0).toUpperCase()}${rawName.slice(1)}`
        : "Student";

    return {
        name,
        roll: rawRoll ?? "",
    };
};

const findUserSeat = (columns: ClassroomColumns, userEmail: string) => {
    const normalizedUserEmail = userEmail.toLowerCase();
    if (!normalizedUserEmail) {
        return null;
    }

    for (const [colName, colData] of Object.entries(columns)) {
        const matrix = colData[1];

        for (let i = 0; i < matrix.length; i += 1) {
            const row = matrix[i] ?? [];
            const colIndex = row.findIndex((email) => (email || "").toLowerCase() === normalizedUserEmail);

            if (colIndex !== -1) {
                return { row: i + 1, column: colName };
            }
        }
    }

    return null;
};

const SeatingArrangementPage = () => {
    const { seatingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const state = location.state as SeatingDetailLocationState | null;
    const examDetails = state?.examDetails;

    const [searchQuery, setSearchQuery] = useState("");
    const [classrooms, setClassrooms] = useState<NormalizedClassrooms>({});
    const [selectedClassroom, setSelectedClassroom] = useState("");
    const [editingSeat, setEditingSeat] = useState<EditingSeat | null>(null);
    const [seatEditValue, setSeatEditValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingSeat, setIsSavingSeat] = useState(false);
    const [seatModalError, setSeatModalError] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const pdfContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!seatingId) {
            setError("Missing seating id.");
            setIsLoading(false);
            return;
        }

        const loadSeatingArrangement = async () => {
            setError(null);
            setIsLoading(true);

            try {
                const response = await apiClient.get<unknown>(`/seating/${seatingId}`);
                console.log("Seating detail response:", response.data);

                const payload = response.data as Record<string, unknown>;
                const classroomsPayload =
                    (payload?.data as Record<string, unknown> | undefined)?.data ??
                    (payload?.data as Record<string, unknown> | undefined)?.classrooms ??
                    payload?.classrooms ??
                    payload;

                const normalized = normalizeClassrooms(classroomsPayload);
                const classroomNames = Object.keys(normalized);

                if (classroomNames.length === 0) {
                    setError("No seating arrangement found for this exam.");
                    return;
                }

                setClassrooms(normalized);
                setSelectedClassroom(classroomNames[0]);
            } catch (fetchError) {
                console.error("Error fetching seating data:", fetchError);
                setError("Failed to load seating arrangement.");
            } finally {
                setIsLoading(false);
            }
        };

        loadSeatingArrangement().catch(() => {
            setError("Failed to load seating arrangement.");
            setIsLoading(false);
        });
    }, [seatingId]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            return;
        }

        const matchedClassroom = findClassroomBySearchQuery(classrooms, searchQuery);
        if (matchedClassroom) {
            setSelectedClassroom(matchedClassroom);
        }
    }, [searchQuery, classrooms]);

    const arrangement = classrooms[selectedClassroom];

    const openSeatEditor = (columnName: string, rowIndex: number, seatIndex: number, currentValue: string) => {
        setEditingSeat({
            classroomName: selectedClassroom,
            columnName,
            rowIndex,
            seatIndex,
            currentValue,
        });
        setSeatEditValue(currentValue);
        setSeatModalError(null);
    };

    const closeSeatEditor = () => {
        if (isSavingSeat) {
            return;
        }

        setEditingSeat(null);
        setSeatEditValue("");
        setSeatModalError(null);
    };

    const saveSeatValue = async () => {
        if (!editingSeat || !seatingId) {
            return;
        }

        const normalizedValue = seatEditValue.trim();
        const updatedClassrooms = structuredClone(classrooms) as NormalizedClassrooms;
        const targetClassroom = updatedClassrooms[editingSeat.classroomName];
        const targetColumn = targetClassroom?.[editingSeat.columnName];

        if (!targetClassroom || !targetColumn) {
            setSeatModalError("Could not find the selected seat in current arrangement.");
            return;
        }

        const [seatCount, matrix] = targetColumn;
        const updatedMatrix = matrix.map((row, rowIdx) => {
            if (rowIdx !== editingSeat.rowIndex) {
                return row;
            }

            return row.map((cell, seatIdx) => {
                if (seatIdx !== editingSeat.seatIndex) {
                    return cell;
                }

                return normalizedValue;
            });
        });

        updatedClassrooms[editingSeat.classroomName] = {
            ...targetClassroom,
            [editingSeat.columnName]: [seatCount, updatedMatrix],
        };

        setIsSavingSeat(true);
        setSeatModalError(null);

        try {
            const payload = {
                seatingPlan: denormalizeClassroomsToBackendPayload(updatedClassrooms),
            };

            await apiClient.put(`/seating/${seatingId}/plan`, payload);

            setClassrooms(updatedClassrooms);
            setEditingSeat(null);
            setSeatEditValue("");
        } catch (saveError) {
            console.error("Failed to persist seat update", saveError);
            setSeatModalError("Could not save seat update to backend.");
        } finally {
            setIsSavingSeat(false);
        }
    };

    const columnPages = useMemo(() => {
        return Object.entries(classrooms).flatMap(([classroomName, columns]) =>
            Object.entries(columns).map(([columnName, columnData]) => ({
                classroomName,
                columnName,
                seatCount: columnData[0],
                matrix: columnData[1],
            })),
        );
    }, [classrooms]);

    const handleDownloadPdf = async () => {
        if (!pdfContainerRef.current || !seatingId) {
            return;
        }

        setIsGeneratingPdf(true);
        setPdfError(null);

        try {
            const pages = Array.from(pdfContainerRef.current.querySelectorAll<HTMLElement>("[data-pdf-page='true']"));
            if (pages.length === 0) {
                throw new Error("No seating pages available to export.");
            }

            const pdf = new jsPDF("l", "mm", "a4");
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 6;

            for (let i = 0; i < pages.length; i += 1) {
                if (i > 0) {
                    pdf.addPage();
                }

                const imageData = await toPng(pages[i], {
                    cacheBust: true,
                    pixelRatio: 2,
                    skipFonts: true,
                    backgroundColor: "#ffffff",
                });
                const pageWidthPx = pages[i].scrollWidth;
                const pageHeightPx = pages[i].scrollHeight;

                if (pageWidthPx <= 0 || pageHeightPx <= 0) {
                    throw new Error("Unable to capture seating page for PDF.");
                }
                const imageWidth = pageWidth;
                const imageHeight = (pageHeightPx * imageWidth) / pageWidthPx;

                if (!Number.isFinite(imageHeight) || imageHeight <= 0) {
                    throw new Error("Captured seating page has invalid dimensions.");
                }

                const maxWidth = pageWidth - margin * 2;
                const maxHeight = pageHeight - margin * 2;

                const renderWidth = maxWidth;
                const renderHeight = maxHeight;

                pdf.addImage(imageData, "PNG", margin, margin, renderWidth, renderHeight, undefined, "FAST");
            }

            const pdfBlob = pdf.output("blob");
            const blobUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement("a");
            downloadLink.href = blobUrl;
            downloadLink.download = `seating-plan-${seatingId}.pdf`;
            downloadLink.style.display = "none";

            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 1000);
        } catch (downloadError) {
            console.error("Failed to generate seating PDF", downloadError);
            const message = downloadError instanceof Error ? downloadError.message : "Unknown PDF generation error";
            setPdfError(`Could not generate PDF: ${message}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const userSeat = useMemo(() => {
        if (!arrangement || !user?.email) {
            return null;
        }

        return findUserSeat(arrangement, user.email);
    }, [arrangement, user?.email]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                Loading seating arrangement...
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-white">{error}</p>
                <button onClick={() => navigate("/dashboard")} className="ml-4 text-blue-400">
                    Go Back
                </button>
            </div>
        );
    }

    if (!arrangement) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                No arrangement for selected classroom.
            </div>
        );
    }

    return (
        <div className="relative overflow-x-hidden">
            <div className="screen-only min-h-screen max-w-full overflow-x-hidden pt-16 sm:pt-20 px-3 sm:px-6 lg:px-8">

                <div className="mb-8 space-y-6">
                    <Breadcrumbs examDetails={examDetails} onNavigate={(path) => navigate(path)} />

                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-4 w-fit">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                                    {examDetails?.subject ?? "Seating Arrangement"}
                                </h1>
                                <p className="text-white/70 mt-2">Room seating arrangement</p>
                            </div>

                            {userSeat ? (
                                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 backdrop-blur-lg">
                                    <Monitor className="w-5 h-5 text-blue-400" />
                                    <div>
                                        <p className="text-sm text-white/70">Your Seat</p>
                                        <p className="text-blue-400 font-medium">
                                            {userSeat.column}, Row {userSeat.row}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full pb-2">
                            <SearchBar onSearch={setSearchQuery} />
                            <div className="flex-none flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <Clock className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-400 whitespace-nowrap">
                                    {formatTime(examDetails?.time)}
                                </span>
                            </div>
                            <ClassroomSelector
                                classroomNames={Object.keys(classrooms)}
                                selectedClassroom={selectedClassroom}
                                onChange={setSelectedClassroom}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    void handleDownloadPdf();
                                }}
                                disabled={isGeneratingPdf}
                                className="flex-none inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300 hover:bg-blue-500/20 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                {isGeneratingPdf ? "Generating PDF..." : "Download PDF (All Classrooms)"}
                            </button>
                        </div>
                    </div>

                    {pdfError ? <p className="text-sm text-rose-300">{pdfError}</p> : null}
                </div>

                <div className="max-w-full overflow-x-auto overflow-y-hidden pb-8 hide-scrollbar">
                    <div className="flex w-max min-w-full flex-nowrap gap-6 sm:gap-8">
                    {Object.entries(arrangement).map(([columnName, columnData]) => (
                        <div key={columnName} className="flex-none w-max min-w-max">
                            <ColumnSection
                                columnName={columnName}
                                columnData={columnData}
                                currentUserEmail={user?.email ?? ""}
                                searchQuery={searchQuery}
                                onEditSeat={openSeatEditor}
                            />
                        </div>
                    ))}
                    </div>
                </div>
            </div>

            <div
                ref={pdfContainerRef}
                className="fixed left-0 top-0 -z-10 opacity-0 pointer-events-none overflow-hidden"
                style={{ width: 0, height: 0 }}
                aria-hidden="true"
            >
                {columnPages.map((page) => (
                    <section
                        key={`${page.classroomName}-${page.columnName}`}
                        data-pdf-page="true"
                        className="w-[1123px] min-h-[794px] bg-white px-5 py-4"
                    >
                        <div className="space-y-2 text-slate-900 h-full w-full">
                            <div className="flex items-end justify-between border-b border-slate-300 pb-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">
                                        {examDetails?.subject ?? "Seating Arrangement"}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-600">{formatDateTimeForPrint(examDetails?.time)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-semibold text-slate-800">{page.classroomName}</p>
                                    <p className="text-xs text-slate-600">{page.columnName}</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full border-collapse table-fixed text-[9px] text-slate-900">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="w-8 border border-slate-300 px-0.5 py-1 text-center font-semibold">Row</th>
                                            {Array.from({ length: page.seatCount }).map((_, seatIndex) => (
                                                <th
                                                    key={seatIndex}
                                                    className="border border-slate-300 px-1 py-1 text-left font-semibold"
                                                >
                                                    S{seatIndex + 1}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {page.matrix.map((row, rowIndex) => (
                                            <tr key={rowIndex} className="bg-white align-top">
                                                <td className="w-8 border border-slate-300 px-0.5 py-1 text-center font-medium">{rowIndex + 1}</td>
                                                {Array.from({ length: page.seatCount }).map((_, seatIndex) => {
                                                    const seatValue = row[seatIndex] ?? "";
                                                    const compact = getSeatCompactDisplay(seatValue);

                                                    return (
                                                        <td key={seatIndex} className="border border-slate-300 px-1 py-1 align-top">
                                                            <div className="min-h-3 text-[8px] font-medium leading-tight truncate">
                                                                {compact.name}
                                                            </div>
                                                            <div className="text-[7px] leading-tight text-slate-600 truncate">
                                                                {compact.roll || "-"}
                                                            </div>
                                                            <div className="mt-0.5 h-3 border-b border-slate-500" />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                ))}
            </div>

            {editingSeat ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Edit Seat</h2>
                                <p className="mt-1 text-sm text-white/60">
                                    {editingSeat.classroomName} / {editingSeat.columnName} / Row {editingSeat.rowIndex + 1}
                                    , Seat {editingSeat.seatIndex + 1}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSeatEditor}
                                className="rounded-md border border-white/15 p-1 text-white/70 transition-colors hover:text-white"
                                aria-label="Close seat editor"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <label className="mt-5 block text-sm text-white/70" htmlFor="seat-edit-value">
                            Student email (leave empty to clear this seat)
                        </label>
                        <input
                            id="seat-edit-value"
                            type="text"
                            value={seatEditValue}
                            onChange={(event) => setSeatEditValue(event.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400/60"
                            placeholder="student.name.23bcs12345@example.com"
                        />

                        <div className="mt-6 flex justify-end gap-3">
                            {seatModalError ? <p className="mr-auto text-sm text-rose-300">{seatModalError}</p> : null}
                            <button
                                type="button"
                                onClick={closeSeatEditor}
                                disabled={isSavingSeat}
                                className="rounded-lg border border-white/15 px-4 py-2 text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void saveSeatValue();
                                }}
                                disabled={isSavingSeat}
                                className="rounded-lg border border-blue-400/40 bg-blue-500/20 px-4 py-2 text-blue-200 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isSavingSeat ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default SeatingArrangementPage;
