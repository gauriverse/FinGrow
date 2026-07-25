import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from '../pages/Landing/Landing';
import Login from '../pages/Auth/Login';
import AuthCallback from '../pages/Auth/AuthCallback';
import { Onboarding } from '../pages/Onboarding/Onboarding';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </BrowserRouter>
  );
}