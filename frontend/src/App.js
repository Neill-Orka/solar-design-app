import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, NavLink } from 'react-router-dom';
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
import logo from './assets/orka_logo_transparent_background.png';
import './Navbar.css';
import 'bootstrap/dist/css/bootstrap.min.css'; // Your existing Bootstrap CSS
import 'bootstrap-icons/font/bootstrap-icons.css'; // Add this
import './index.css'; // Your custom CSS if any

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
    <Router>
      <nav className="navbar navbar-expand-lg navbar-light navbar-glass fixed-top">
        <div className="container-fluid">
          {/*  brand logo + text */}
          <Link to="/" className="navbar-brand-group text-decoration-none">
            <img src={logo} alt="Orka Logo" className="navbar-logo" />
            <span>Orka Solar</span>
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
            >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse justify-content-center" id="navbarNav">
            <div className='position-absolute top-1 start-50 translate-middle-x'>
              <ul className="navbar-nav">
                {[
                  { to: '/', label: 'Home', exact: true },
                  { to: '/clients', label: 'Clients' },
                  { to: '/projects', label: 'Projects' },
                  { to: '/products-admin', label: 'Products' },
                  { to: '/system-builder', label: 'System Builder' }
                ].map(link => (
                  <li className="nav-item" key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.exact}
                      className={({ isActive }) =>
                        `nav-link navbar-link ${isActive ? 'active' : ''}`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div> 
        </div>
      </nav>

      <div style={{ paddingTop: '72px'}}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/add" element={<ClientForm />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDashboard />} />
          <Route path="/projects/:id/system-design" element={<SystemDesignWrapper />} />
          <Route path="/projects/:id/financial-model" element={<FinancialModelWrapper />} />
          <Route path="/clients/edit/:id" element={<EditClient />} />
          <Route path="/projects/add" element={<AddProject />} />
          <Route path="/projects/edit/:id" element={<EditProject />} />
          <Route path="/products-admin" element={<ProductsAdmin />} />
          <Route path="/system-builder" element={<SystemBuilder />} />
          <Route path="/projects/:id/optimize" element={<Optimize />} />
        </Routes>
        </div>
    </Router>
  );
}

export default App;


