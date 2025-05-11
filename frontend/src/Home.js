import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { FaProjectDiagram, FaUsers, FaTools } from 'react-icons/fa';
import './Home.css';

function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/stats')
         .then(res => setStats(res.data))
         .catch(() => setStats(null));
  }, []);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <header
        className="hero"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1545209463-e2825498edbf?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
        >
        <h1>Design • Simulate • Profit</h1>
      </header>

      {/* fancy wave divider */}
      <svg className="wave" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path d="M0,0 C300,100 600,0 1440,100 L1440 0 L0 0 Z"
              fill="#ffffff" />
      </svg>

      <div className="container py-5">

        {/* ---------- stats ---------- */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="row text-center mb-5"
          >
            <div className="col-md-6 mb-4">
              <div className="card shadow-sm">
                <div className="card-body">
                  <FaUsers size={32} className="text-primary mb-2" />
                  <h5>Total Clients</h5>
                  <h2 className="display-6">
                    <CountUp end={stats.total_clients} duration={1.5} />
                  </h2>
                </div>
              </div>
            </div>
            <div className="col-md-6 mb-4">
              <div className="card shadow-sm">
                <div className="card-body">
                  <FaProjectDiagram size={32} className="text-success mb-2" />
                  <h5>Total Projects</h5>
                  <h2 className="display-6">
                    <CountUp end={stats.total_projects} duration={1.5} />
                  </h2>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
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
              title: 'Projects',
              text: 'Create, simulate and optimise PV systems with ease.',
              link: '/projects',
              color: 'primary',
              icon: <FaProjectDiagram size={46} />
            },
            {
              title: 'Clients',
              text: 'Keep all customer info and site details in one place.',
              link: '/clients',
              color: 'success',
              icon: <FaUsers size={46} />
            },
            {
              title: 'Products',
              text: 'Maintain your catalogue of panels, inverters & batteries.',
              link: '/products-admin',
              color: 'warning',
              icon: <FaTools size={46} />
            }
          ].map(card => (
            <motion.div
              key={card.title}
              className="col-md-4 mb-4 d-flex"
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className={`glass-card border-top border-3 border-${card.color} w-100`}>
                <div className="text-center py-4 px-3 d-flex flex-column h-100">
                  <div className={`text-${card.color} mb-3`}>{card.icon}</div>
                  <h5 className="fw-semibold mb-2">{card.title}</h5>
                  <p className="flex-grow-1">{card.text}</p>
                  <Link to={card.link} className={`btn btn-outline-${card.color} mt-auto`}>
                    Manage {card.title}
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </>
  );
}

export default Home;
