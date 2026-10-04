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
import StockDetails from "../pages/StockDetails/StockDetails";
import Learn from "../pages/Learn/Learn";
import Lesson from "../pages/Learn/Lesson";
import Watchlist from "../pages/Watchlist/watchlist";

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
          path="/watchlist"
          element={
            <ProtectedRoute>
              <Watchlist />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stock/:symbol"
          element={
            <ProtectedRoute>
              <StockDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
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

        <Route
          path="/ai-picks"
          element={
            <ProtectedRoute>
              <AIPicks />
            </ProtectedRoute>
          }
        />

        {/* Learn */}
        <Route
          path="/learn"
          element={
            <ProtectedRoute>
              <Learn />
            </ProtectedRoute>
          }
        />

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
