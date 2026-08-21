import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "../pages/Landing/Landing";
import Login from "../pages/Auth/Login";
import AuthCallback from "../pages/Auth/AuthCallback";
import ResetPassword from "../pages/Auth/ResetPassword";
import { Onboarding } from "../pages/Onboarding/Onboarding";
// @ts-expect-error: Dashboard is a JS file without declaration file
import Dashboard from "../pages/Dashboard/Dashboard";
import ProtectedRoute from "../components/ProtectedRoute";
import PersonalizedLanding from "../pages/PersonalizedLanding/PersonalizedLanding";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/personalized"
          element={
            <ProtectedRoute>
              <PersonalizedLanding />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}