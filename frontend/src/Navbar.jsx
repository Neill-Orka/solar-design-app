import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import logo from "./assets/orka_logo_transparent_background.png";
import "./Navbar.css";

const Navbar = () => {
  const { user, logout, canModifyProjects, canModifyProducts } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, clear local state and redirect
      navigate("/login", { replace: true });
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
      if (!event.target.closest(".navbar")) {
        closeMobileMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getNavLinks = () => {
    const baseLinks = [
      { to: "/", label: "Home", exact: true },
      { to: "/clients", label: "Clients" },
    ];

    // Only show Projects if user can modify them (design team, manager, or admin)
    if (
      user &&
      (user.role === "admin" ||
        user.role === "design" ||
        user.role === "manager")
    ) {
      baseLinks.push({ to: "/projects", label: "Projects" });
    }

    // Only show Products if user can modify them (sales team, manager, or admin)
    if (
      user &&
      (user.role === "admin" ||
        user.role === "sales" ||
        user.role === "manager")
    ) {
      baseLinks.push({ to: "/products-admin", label: "Products" });
    }

    // Update System Builder access (everyone except sales)
    if (user && user.role !== "sales") {
      baseLinks.push(
        { to: "/system-builder", label: "System Builder" },
        { to: "/invoices", label: "Invoices" }
      );
    }

    // Update Load Profile Manager access (everyone except sales)
    if (user && user.role !== "sales") {
      baseLinks.push({
        to: "/load-profile-manager",
        label: "Load Profile Manager",
      });
    }

    // Tariff Manager is still accessible to all
    baseLinks.push({ to: "/tariffs", label: "Tariff Manager" });

    // Only show admin features to admins
    if (user?.role === "admin") {
      baseLinks.push(
        // { to: '/rules', label: 'Engine Rules' },
        { to: "/admin", label: "Admin" }
      );
    }

    return baseLinks;
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light navbar-glass fixed-top">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand-group text-decoration-none">
            <img src={logo} alt="Orka Logo" className="navbar-logo" />
            <span>Orka Solar</span>
          </Link>

          {/* --- DESKTOP NAVIGATION (CENTERED) --- */}
          <div className="collapse navbar-collapse" id="desktopNav">
            <ul className="navbar-nav mx-auto">
              {getNavLinks().map((link) => (
                <li className="nav-item" key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.exact}
                    className="nav-link navbar-link"
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* --- RIGHT-ALIGNED CONTROLS (FOR MOBILE AND DESKTOP) --- */}
          <div className="navbar-controls-right">
            {/* --- USER PROFILE --- */}
            {user && (
              <div className="navbar-user-profile" ref={dropdownRef}>
                <button
                  className="nav-link dropdown-toggle d-flex align-items-center btn btn-link"
                  type="button"
                  onClick={toggleDropdown}
                >
                  <span className="user-avatar">
                    {user.first_name
                      ? user.first_name.charAt(0).toUpperCase()
                      : "U"}
                  </span>
                  <span className="d-none d-lg-inline ms-2">
                    {user.first_name}
                  </span>
                </button>
                <ul
                  className={`dropdown-menu dropdown-menu-end ${
                    isDropdownOpen ? "show" : ""
                  }`}
                >
                  <li>
                    <span className="dropdown-item-text">
                      Signed in as <strong>{user.full_name}</strong>
                      <br />
                      <small className="text-muted">{user.email}</small>
                    </span>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        handleLogout();
                        closeDropdown();
                      }}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            )}

            {/* --- MOBILE MENU TOGGLER (BURGER) --- */}
            <button
              className={`navbar-toggler-modern ${
                isMobileMenuOpen ? "is-active" : ""
              }`}
              type="button"
              onClick={toggleMobileMenu}
              aria-controls="mobileNav"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* --- MOBILE MENU OVERLAY (MOVED OUTSIDE OF NAV) --- */}
      <div
        className={`mobile-menu-overlay ${isMobileMenuOpen ? "is-open" : ""}`}
        id="mobileNav"
      >
        <div className="mobile-menu-content">
          <ul className="mobile-nav-links">
            {getNavLinks().map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.exact}
                  className="mobile-nav-link"
                  onClick={closeMobileMenu}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default Navbar;
