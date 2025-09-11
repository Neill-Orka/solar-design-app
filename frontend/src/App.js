import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { NotificationProvider } from './NotificationContext';
import { AuthProvider, useAuth } from './AuthContext';
import ToastNotification from './ToastNotification';
import ProtectedRoute from './ProtectedRoute';
import Navbar from './Navbar';
import Login from './Login';
import Registration from './Registration';
import AdminDashboard from './AdminDashboard';
import Home from './Home';
import Clients from './Clients';
import ClientForm from './ClientForm';
import Projects from './Projects';
import ProjectDashboard from './ProjectDashboard';
import EditClient from './EditClient';
import AddProject from './AddProject';
import EditProject from './EditProject';
import SystemDesign from './SystemDesign';
import FinancialModeling from './FinancialModeling';
import ProductsAdmin from './ProductsAdmin';
import Optimize from './Optimize';
import SystemBuilder from './SystemBuilder';
import ProposalPage from './ProposalPage';
import LoadProfileManager from './LoadProfileManager';
import TariffManager from './TariffManager';
import RuleEditor from './RuleEditor';
import PrintableBOM from './PrintableBOM';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css'; 

// ------ tiny wrappers to inject :id into the components -----------
function SystemDesignWrapper() {
  const { id } = useParams();
  return <SystemDesign projectId={parseInt(id, 10)} />;
}

function FinancialModelWrapper() {
  const { id } = useParams();
  return <FinancialModeling projectId={parseInt(id, 10)} />;
}


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
        <div style={{ paddingTop: '72px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            
            {/* Client routes - accessible to all authenticated users */}
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/add" element={<ClientForm />} />
            <Route path="/clients/edit/:id" element={<EditClient />} />
            
            {/* Project routes - only for design team and admin */}
            <Route path="/projects" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <Projects />
              </ProtectedRoute>
            } />
            <Route path="/projects/add" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <AddProject />
              </ProtectedRoute>
            } />
            <Route path="/projects/edit/:id" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <EditProject />
              </ProtectedRoute>
            } />
            <Route path="/projects/:id" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <ProjectDashboard />
              </ProtectedRoute>
            } />
            <Route path="/projects/:id/system-design" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <SystemDesignWrapper />
              </ProtectedRoute>
            } />
            <Route path="/projects/:id/financial-model" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <FinancialModelWrapper />
              </ProtectedRoute>
            } />
            <Route path="/projects/:id/optimize" element={
              <ProtectedRoute requiredRole={["design", "manager"]}>
                <Optimize />
              </ProtectedRoute>
            } />
            
            {/* Product routes - only for sales team and admin */}
            <Route path="/products-admin" element={
              <ProtectedRoute requiredRole={["sales", "manager"]}>
                <ProductsAdmin />
              </ProtectedRoute>
            } />
            
            {/* System builder and other tools - accessible to all */}
            <Route path="/system-builder" element={<SystemBuilder />} />
            <Route path="/load-profile-manager" element={<LoadProfileManager />} />
            <Route path="/tariffs" element={<TariffManager />} />
            <Route path="/proposal/:id" element={<ProposalPage />} />
            <Route path="/printable-bom/:projectId" element={<PrintableBOM />} />
            <Route path="/projects/:projectId/printable-bom/:docId" element={<PrintableBOM />} />
            <Route path="/projects/:projectId/quotes/:docId" element={<PrintableBOM />} />

            {/* Admin only routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/rules" element={
              <ProtectedRoute requiredRole="admin">
                <RuleEditor />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </ProtectedRoute>
    </>
  );
}

export default App;


