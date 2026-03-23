import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { DashboardLayout } from "./layout/DashboardLayout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ClassroomListPage from "./pages/ClassroomList.tsx";
import AdminManagementPage from "./pages/AdminManagement.tsx";
import SeatingGenerationPage from "./pages/SeatingGeneration";
import SeatingArrangementPage from "./pages/SeatingArrangement";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/classrooms" element={<ClassroomListPage />} />
                    <Route path="/seating" element={<SeatingGenerationPage />} />
                    <Route path="/seating/:seatingId" element={<SeatingArrangementPage />} />
                    <Route path="/admin-management" element={<AdminManagementPage />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

export default App;
