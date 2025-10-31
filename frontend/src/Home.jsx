import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { FaProjectDiagram, FaUsers, FaTools } from "react-icons/fa";
import "./Home.css";
import { useAuth } from "./AuthContext";
import { API_URL } from "./apiConfig"; // Adjust the import based on your project structure

function Home() {
  const { user } = useAuth();

  // NEW JUMPSCARE
  const [showSurprise, setShowSurprise] = useState(false);
  const videoRef = useRef(null);

  // New JUMPSCARE
  const openSurprise = () => {
    setShowSurprise(true);

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        const p = videoRef.current.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }, 0);
  };

  const closeSurprise = () => {
    if (videoRef.current) videoRef.current.pause();
    setShowSurprise(false);
  };

  useEffect(() => {
    if (!showSurprise) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeSurprise();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSurprise]);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <header className="hero">
        <h1>Design • Simulate • Profit</h1>
      </header>

      <div className="container py-5">
        {/* ---------- quick links ---------- */}
        <motion.div
          className="row justify-content-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {[
            {
              title: "Projects",
              text: "Create, simulate and optimise PV systems with ease.",
              link: "/projects",
              color: "primary",
              icon: <FaProjectDiagram size={46} />,
              roles: ["admin", "manager", "design"],
            },
            {
              title: "Clients",
              text: "Keep all customer info and site details in one place.",
              link: "/clients",
              color: "success",
              icon: <FaUsers size={46} />,
              roles: ["admin", "manager", "sales", "design"],
            },
            {
              title: "Products",
              text: "Maintain your catalogue of panels, inverters & batteries.",
              link: "/products-admin",
              color: "warning",
              icon: <FaTools size={46} />,
              roles: ["admin", "manager", "sales"],
            },
            {
              title: "Job Cards (DO NOT USE)",
              text: "Create and track electrical jobs.",
              link: "/jobcards",
              color: "info",
              icon: <FaTools size={46} />,
              roles: ["admin", "manager", "team_leader", "technician"],
            },
          ]
            .filter((card) => {
              if (!user) return false; // no cards until auth resolved
              return card.roles.includes(user.role);
            })
            .map((card) => (
              <motion.div
                key={card.title}
                className="col-lg-3 col-md-4 col-sm-6 mb-4 d-flex"
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <div
                  className={`glass-card border-top border-3 border-${card.color} w-100`}
                >
                  <div className="text-center py-4 px-3 d-flex flex-column h-100">
                    <div className={`text-${card.color} mb-3`}>{card.icon}</div>
                    <h5 className="fw-semibold mb-2">{card.title}</h5>
                    <p className="flex-grow-1">{card.text}</p>
                    <Link
                      to={card.link}
                      className={`btn btn-outline-${card.color} mt-auto`}
                    >
                      Manage {card.title}
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
        </motion.div>
      </div>
      {/* ---------- Mysterious button ---------- */}
      <button
        className="mystery-btn"
        onClick={openSurprise}
        aria-haspopup="dialog"
        aria-controls="surprise-modal"
        title="Click me"
      >
        click me
      </button>
      {/* ---------- Fullscreen surprise overlay ---------- */}
      {showSurprise && (
        <div
          className="surprise-overlay"
          role="dialog"
          aria-modal="true"
          id="surprise-modal"
          onClick={closeSurprise}
        >
          <button
            className="surprise-close"
            onClick={(e) => {
              e.stopPropagation();
              closeSurprise();
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>

          <video
            ref={videoRef}
            className="surprise-video"
            src="/pranks/surprise.mp4" // place your video in: public/pranks/surprise.mp4
            controls
            playsInline
            preload="auto"
            onClick={(e) => e.stopPropagation()} // allow UI clicks without closing
          />
        </div>
      )}
    </>
  );
}

export default Home;
