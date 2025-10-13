import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import { NotificationProvider } from "./NotificationContext";
import { AuthProvider, useAuth } from "./AuthContext";
import { API_URL } from "./apiConfig";
import { io } from "socket.io-client";
import { useEffect } from "react";
import { SOCKET_URL, SOCKET_ENABLED } from "./apiConfig";
import ToastNotification from "./ToastNotification";
import ProtectedRoute from "./ProtectedRoute";
import Navbar from "./Navbar";
import Login from "./Login";
import Registration from "./Registration";
import AdminDashboard from "./AdminDashboard";
import Home from "./Home";
import Clients from "./Clients";
import ClientForm from "./ClientForm";
import Projects from "./Projects";
import ProjectDashboard from "./ProjectDashboard";
import EditClient from "./EditClient";
import AddProject from "./AddProject";
import EditProject from "./EditProject";
import SystemDesign from "./SystemDesign";
import FinancialModeling from "./FinancialModeling";
import ProductsAdmin from "./ProductsAdmin";
import Optimize from "./Optimize";
import SystemBuilder from "./SystemBuilder";
import ProposalPage from "./ProposalPage";
import LoadProfileManager from "./LoadProfileManager";
import TariffManager from "./TariffManager";
import RuleEditor from "./RuleEditor";
import PrintableBOM from "./PrintableBOM";
import JobCardsPage from "./features/jobcards/pages/JobCardsPage";
import JobCardCreatePage from "./features/jobcards/pages/JobCardCreatePage";
import JobCardDetailPage from "./features/jobcards/pages/JobCardDetailPage";
import JobCardEditPage from "./features/jobcards/pages/JobCardEditPage";
import PageTransition from "./features/jobcards/components/PageTransition";
import RecycleBin from "./RecycleBin";
import ProjectRecycleBin from "./ProjectRecycleBin";
import PrintableInvoice from "./features/invoices/PrintableInvoice";

import axios from "axios";

function LiveBus({ projectId }) {
  useEffect(() => {
    if (!SOCKET_ENABLED || !SOCKET_URL) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      const rooms = ["products", "projects", "clients"];
      if (projectId) rooms.push(`project:${projectId}`); // NOTE the colon
      socket.emit("join", { rooms }); // NOTE the event name
    });

    // Products — keep existing behavior
    socket.on("product:updated", () => {
      window.dispatchEvent(new Event("refresh-products"));
    });

    // Projects — refresh single project views AND the projects list
    socket.on("project:updated", (msg) => {
      if (!projectId || msg?.id === projectId) {
        window.dispatchEvent(new Event("refresh-project"));
      }
      window.dispatchEvent(new Event("refresh-projects"));
    });
    socket.on("projects:updated", () => {
      window.dispatchEvent(new Event("refresh-projects"));
    });

    // Clients
    socket.on("clients:updated", () => {
      window.dispatchEvent(new Event("refresh-clients"));
    });

    return () => socket.disconnect();
  }, [projectId]);

  return null;
}

// ------ tiny wrappers to inject :id into the components -----------
function SystemDesignWrapper() {
  const { id } = useParams();
  const pid = parseInt(id, 10);
  return (
    <>
      <LiveBus projectId={pid} />
      <SystemDesign projectId={pid} />
    </>
  );
}

function FinancialModelWrapper() {
  const { id } = useParams();
  const pid = parseInt(id, 10);
  return (
    <>
      <LiveBus projectId={pid} />
      <FinancialModeling projectId={pid} />
    </>
  );
}

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let pending = [];

function onRefreshed(newToken) {
  pending.forEach((cb) => cb(newToken));
  pending = [];
}

axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (!response) return Promise.reject(error); // network error

    const url = config?.url || "";
    const isAuthEndpoint =
      url.includes("/api/auth/login") || url.includes("/api/auth/refresh");

    if (response.status === 401 && isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pending.push((newToken) => {
            if (newToken)
              config.headers["Authorization"] = `Bearer ${newToken}`;
            resolve(axios(config));
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refresh_token: localStorage.getItem("refresh_token"),
          }),
        });
        if (!refreshRes.ok) throw new Error("refresh failed");

        const data = await refreshRes.json();
        const newToken = data.access_token;

        localStorage.setItem("access_token", newToken);
        axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

        // if backend returns rotated refresh token, also store it
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }

        isRefreshing = false;
        onRefreshed(newToken);

        config.headers["Authorization"] = `Bearer ${newToken}`;
        return axios(config);
      } catch (e) {
        isRefreshing = false;
        onRefreshed(null);
        // hard logout on refresh failure
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <ToastNotification />
      <ProtectedRoute>
        <Navbar />
        <div style={{ paddingTop: "72px" }}>
          <LiveBus />
          <Routes>
            <Route path="/" element={<Home />} />

            {/* Client routes - accessible to all authenticated users */}
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/add" element={<ClientForm />} />
            <Route path="/clients/edit/:id" element={<EditClient />} />

            {/* Project routes - only for design team and admin */}
            <Route
              path="/projects"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/add"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <AddProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/edit/:id"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <EditProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <ProjectDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/system-design"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <SystemDesignWrapper />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/financial-model"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <FinancialModelWrapper />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/optimize"
              element={
                <ProtectedRoute requiredRole={["design", "manager"]}>
                  <Optimize />
                </ProtectedRoute>
              }
            />

            {/* Product routes - only for sales team and admin */}
            <Route
              path="/products-admin"
              element={
                <ProtectedRoute requiredRole={["sales", "manager"]}>
                  <ProductsAdmin />
                </ProtectedRoute>
              }
            />

            <Route
              path="/recycle-bin"
              element={
                <PageTransition>
                  <ProtectedRoute requiredRole={["admin", "sales"]}>
                    <RecycleBin />
                  </ProtectedRoute>
                </PageTransition>
              }
            />

            <Route
              path="/projects/recycle-bin"
              element={
                <PageTransition>
                  <ProtectedRoute requiredRole={["admin", "manager", "design"]}>
                    <ProjectRecycleBin />
                  </ProtectedRoute>
                </PageTransition>
              }
            />

            {/* System builder and other tools - accessible to all */}
            <Route path="/system-builder" element={<SystemBuilder />} />
            <Route
              path="/load-profile-manager"
              element={<LoadProfileManager />}
            />
            <Route path="/tariffs" element={<TariffManager />} />
            <Route path="/proposal/:id" element={<ProposalPage />} />
            <Route
              path="/printable-bom/:projectId"
              element={<PrintableBOM />}
            />
            <Route
              path="/projects/:projectId/printable-bom/:docId"
              element={<PrintableBOM />}
            />
            <Route
              path="/projects/:projectId/quotes/:docId"
              element={<PrintableBOM />}
            />

            {/* Pages with animations */}
            <Route
              path="/jobcards"
              element={
                <PageTransition>
                  <ProtectedRoute
                    requiredRole={[
                      "admin",
                      "team_leader",
                      "technician",
                      "sales",
                    ]}
                  >
                    <JobCardsPage />
                  </ProtectedRoute>
                </PageTransition>
              }
            />

            <Route
              path="/jobcards/new"
              element={
                <PageTransition>
                  <ProtectedRoute requiredRole={["admin", "team_leader"]}>
                    <JobCardCreatePage />
                  </ProtectedRoute>
                </PageTransition>
              }
            />

            <Route
              path="/jobcards/:id"
              element={
                <PageTransition>
                  <ProtectedRoute
                    requiredRole={[
                      "admin",
                      "team_leader",
                      "technician",
                      "sales",
                    ]}
                  >
                    <JobCardDetailPage />
                  </ProtectedRoute>
                </PageTransition>
              }
            />

            <Route
              path="/jobcards/:id/edit"
              element={
                <ProtectedRoute
                  requiredRole={["admin", "manager", "team_leader"]}
                >
                  <JobCardEditPage />
                </ProtectedRoute>
              }
            />

            {/* Admin only routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rules"
              element={
                <ProtectedRoute requiredRole="admin">
                  <RuleEditor />
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId/invoices/:invoiceId/print"
              element={
                <PageTransition>
                  <PrintableInvoice />
                </PageTransition>
              }
            />

            <Route
              path="/invoices/:invoiceId/print"
              element={
                <PageTransition>
                  <PrintableInvoice />
                </PageTransition>
              }
            />
          </Routes>
        </div>
      </ProtectedRoute>
    </>
  );
}

export default App;
