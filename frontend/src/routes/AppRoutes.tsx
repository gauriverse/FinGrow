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
import Settings from "../pages/Settings/Settings";
import AIPicks from "../pages/AIPicks/AIPicks";

import Portfolio from "../pages/Portfolio/Portfolio";

import Learn from "../pages/Learn/Learn";
import Lesson from "../pages/Learn/Lesson";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/" element={<Landing />} />

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Login />} />

        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        <Route
          path="/auth/reset-password"
          element={<ResetPassword />}
        />

        {/* ONBOARDING */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* SETTINGS */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* PERSONALIZED LANDING */}
        <Route
          path="/personalized"
          element={
            <ProtectedRoute>
              <PersonalizedLanding />
            </ProtectedRoute>
          }
        />

        {/* AI PICKS */}
        <Route
          path="/ai-picks"
          element={
            <ProtectedRoute>
              <AIPicks />
            </ProtectedRoute>
          }
        />

        {/* PORTFOLIO */}
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          }
        />

        {/* LEARN */}
        <Route
          path="/learn"
          element={
            <ProtectedRoute>
              <Learn />
            </ProtectedRoute>
          }
        />

        {/* INDIVIDUAL LESSON */}
        <Route
          path="/learn/:slug"
          element={
            <ProtectedRoute>
              <Lesson />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}