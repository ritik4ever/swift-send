import { Suspense, lazy } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { ComplianceProvider } from "./contexts/ComplianceContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { NetworkProvider } from "./contexts/NetworkContext";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SendMoney = lazy(() => import("./pages/SendMoney"));
const AddFunds = lazy(() => import("./pages/AddFunds"));
const Withdraw = lazy(() => import("./pages/Withdraw"));
const RemittanceStatus = lazy(() => import("./pages/RemittanceStatus"));
const CashOutOptions = lazy(() => import("./pages/CashOutOptions"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ComplianceInfo = lazy(() => import("./pages/ComplianceInfo"));
const Refunds = lazy(() => import("./pages/Refunds"));
const VerificationFlow = lazy(() =>
  import("./components/VerificationFlow").then((module) => ({
    default: module.VerificationFlow,
  })),
);
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminErrorDashboard = lazy(() => import("./pages/AdminErrorDashboard"));
const AdminComplianceLogs = lazy(() => import("./pages/AdminComplianceLogs"));
const AdminDeadLetterQueue = lazy(() => import("./pages/AdminDeadLetterQueue"));
const AdminStellarMonitor = lazy(() => import("./pages/AdminStellarMonitor"));
const AdminSettlementAnalytics = lazy(() => import("./pages/AdminSettlementAnalytics"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/send"
          element={
            <ProtectedRoute>
              <SendMoney />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-funds"
          element={
            <ProtectedRoute>
              <AddFunds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/withdraw"
          element={
            <ProtectedRoute>
              <Withdraw />
            </ProtectedRoute>
          }
        />
        <Route
          path="/remittance"
          element={
            <ProtectedRoute>
              <RemittanceStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cash-out"
          element={
            <ProtectedRoute>
              <CashOutOptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <VerificationFlow />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compliance-info"
          element={
            <ProtectedRoute>
              <ComplianceInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/refunds"
          element={
            <ProtectedRoute>
              <Refunds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/errors"
          element={
            <ProtectedRoute>
              <AdminErrorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/compliance"
          element={
            <ProtectedRoute>
              <AdminComplianceLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dlq"
          element={
            <ProtectedRoute>
              <AdminDeadLetterQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stellar"
          element={
            <ProtectedRoute>
              <AdminStellarMonitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settlements"
          element={
            <ProtectedRoute>
              <AdminSettlementAnalytics />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <TooltipProvider>
          <AuthProvider>
            <WalletProvider>
              <ComplianceProvider>
                <NetworkProvider>
                  <SonnerToaster />
                  <BrowserRouter>
                    <AppRoutes />
                  </BrowserRouter>
                </NetworkProvider>
              </ComplianceProvider>
            </WalletProvider>
          </AuthProvider>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
