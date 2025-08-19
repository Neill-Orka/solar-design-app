import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import logo from './assets/orka_logo_transparent_background.png';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, canModifyProjects, canModifyProducts } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
      // Close mobile menu when clicking outside navbar
      if (!event.target.closest('.navbar')) {
        closeMobileMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getNavLinks = () => {
    const baseLinks = [
      { to: '/', label: 'Home', exact: true },
      { to: '/clients', label: 'Clients' },
    ];

    // Only show Projects if user can modify them (design team or admin)
    if (canModifyProjects()) {
      baseLinks.push({ to: '/projects', label: 'Projects' });
    }

    // Only show Products if user can modify them (sales team or admin)
    if (canModifyProducts()) {
      baseLinks.push({ to: '/products-admin', label: 'Products' });
    }

    // Add other links that everyone can access
    baseLinks.push(
      { to: '/system-builder', label: 'System Builder' },
      { to: '/load-profile-manager', label: 'Load Profile Manager' },
      { to: '/tariffs', label: 'Tariff Manager' }
    );

    // Only show admin features to admins
    if (user?.role === 'admin') {
      baseLinks.push(
        { to: '/rules', label: 'Engine Rules' },
        { to: '/admin', label: 'Admin' }
      );
    }

    return baseLinks;
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light navbar-glass fixed-top">
      <div className="container-fluid">
        <Link to="/" className="navbar-brand-group text-decoration-none">
          <img src={logo} alt="Orka Logo" className="navbar-logo" />
          <span>Orka Solar</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          onClick={toggleMobileMenu}
          aria-controls="navbarNav"
          aria-expanded={isMobileMenuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`navbar-collapse justify-content-center ${isMobileMenuOpen ? 'show' : 'collapse'}`} id="navbarNav">
          <div className="position-absolute top-1 start-50 translate-middle-x">
            <ul className="navbar-nav">
              {getNavLinks().map(link => (
                <li className="nav-item" key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.exact}
                    className={({ isActive }) =>
                      `nav-link navbar-link ${isActive ? 'active' : ''}`
                    }
                    onClick={closeMobileMenu}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {user && (
            <div className="navbar-nav ms-auto">
              <div className="nav-item dropdown" ref={dropdownRef}>
                <button
                  className="nav-link dropdown-toggle d-flex align-items-center btn btn-link"
                  type="button"
                  onClick={toggleDropdown}
                  style={{ border: 'none', padding: '0.5rem 0.75rem' }}
                >
                  <span className="user-avatar me-2">
                    {user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className={`role-badge ms-2 role-${user.role}`}>
                    {user.role}
                  </span>
                </button>
                <ul className={`dropdown-menu dropdown-menu-end ${isDropdownOpen ? 'show' : ''}`}>
                  <li>
                    <span className="dropdown-item-text">
                      <small>{user.email}</small>
                    </span>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item" onClick={() => { handleLogout(); closeDropdown(); }}>
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
