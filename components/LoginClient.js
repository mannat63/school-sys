"use client";

import { useState, useEffect } from "react";
import { SignInButton } from "@clerk/nextjs";

const roles = [
  {
    label: "Student",
    avatar: "/avatar-student.png",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    desc: "Access your classes, mock tests, and performance analytics.",
  },
  {
    label: "Teacher",
    avatar: "/avatar-teacher.png",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    desc: "Manage study materials, track section progress, and analyze results.",
  },
  {
    label: "Administrator",
    avatar: "/avatar-admin.png",
    gradient: "linear-gradient(135deg, #d97706, #b45309)",
    desc: "Complete institutional oversight, fees, and operational reports.",
  },
];

const features = [
  { text: "Real-time Analytics & Insights" },
  { text: "AI-Powered Performance Tracking" },
  { text: "Secure & FERPA Compliant" },
  { text: "24/7 Cloud Infrastructure" },
];

/* Google "G" logo — official colors */
function GoogleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

/* Floating particles — rendered only on client to avoid hydration mismatch */
function FloatingParticles() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${(i * 7.3 + 5) % 100}%`,
      top: `${(i * 11.7 + 10) % 100}%`,
      width: `${(i % 4) + 2}px`,
      height: `${(i % 4) + 2}px`,
      delay: `${(i * 0.6) % 8}s`,
      duration: `${(i % 5) + 10}s`,
    }));
    setParticles(items);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="login-particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="login-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.width,
            height: p.height,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginClient() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setRoleIndex((prev) => (prev + 1) % roles.length);
        setFade(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const current = roles[roleIndex];

  return (
    <div className="login-page">
      {/* ─── Left Panel: Luxury Gradient ─── */}
      <div className="login-left">
        <FloatingParticles />

        {/* Static gradient orbs */}
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />

        {/* Brand */}
        <div className="login-left-brand">
          <div className="login-left-logo">
            <img src="/logo.png" alt="Intellogy Coachings" />
          </div>
          <div className="login-left-text">
            <div className="login-left-name">Intellogy Coachings</div>
            <div className="login-left-sub">Academic Excellence</div>
          </div>
        </div>

        {/* Hero content */}
        <div className="login-hero-content">
          <div className="login-hero-badge">
            <span className="login-badge-dot" />
            Welcome to the Future of Education
          </div>

          <h1 className="login-hero-title">
            Where <span className="login-hero-highlight">Excellence</span> Meets Innovation
          </h1>

          <p className="login-hero-subtitle">
            A world-class management platform powering academic success for students, educators, and administrators.
          </p>

          {/* Feature list */}
          <div className="login-features-list">
            {features.map((f, i) => (
              <div key={i} className="login-feature-item" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="login-feature-icon">&#10022;</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Panel ─── */}
      <div className="login-right">
        {/* Decorative background shapes */}
        <div className="login-right-decor login-right-decor-1" />
        <div className="login-right-decor login-right-decor-2" />

        {/* Mobile top branding — only visible on mobile */}
        <div className="login-mobile-top-brand">
          <div className="login-mobile-top-logo">
            <img src="/logo.png" alt="Intellogy Coachings" />
          </div>
          <div>
            <div className="login-mobile-top-name">Intellogy Coachings</div>
            <div className="login-mobile-top-sub">Academic Excellence</div>
          </div>
        </div>

        <div className="login-card">
          {/* Welcome text */}
          <div className="login-welcome-tag">
            School Management Portal
          </div>

          {/* ── Rotating Avatar + Role ── */}
          <div className="login-avatar-section">
            <div
              className="login-avatar-ring"
              style={{
                background: fade ? current.gradient : "linear-gradient(135deg, #4B3D6020, #DA70D620)",
              }}
            >
              <div className="login-avatar-ring-inner">
                <div
                  className="login-avatar-inner"
                  style={{
                    opacity: fade ? 1 : 0,
                    transform: fade ? "scale(1) translateY(0)" : "scale(0.85) translateY(6px)",
                  }}
                >
                  <img src={current.avatar} alt={current.label} className="login-avatar-img" />
                </div>
              </div>
            </div>

            <div
              className="login-role-name"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? "translateY(0)" : "translateY(10px)",
              }}
            >
              {current.label}
            </div>

            <p
              className="login-role-desc"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? "translateY(0)" : "translateY(6px)",
              }}
            >
              {current.desc}
            </p>

            {/* Role indicator dots */}
            <div className="login-role-dots">
              {roles.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setFade(false);
                    setTimeout(() => { setRoleIndex(i); setFade(true); }, 250);
                  }}
                  className={`login-role-dot ${i === roleIndex ? "login-role-dot-active" : ""}`}
                  aria-label={`Select ${r.label} role`}
                />
              ))}
            </div>
          </div>

          {/* ── Sign In Section ── */}
          <div className="login-signin-section">
            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">Official Access</span>
              <div className="login-divider-line" />
            </div>

            {/* Google Button */}
            <SignInButton mode="modal">
              <button className="login-google-btn" id="login-google-signin">
                <GoogleLogo size={22} />
                <span>Continue with Google</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-google-arrow">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </SignInButton>

            {/* Trust indicators */}
            <div className="login-trust">
              <div className="login-trust-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>256-bit SSL</span>
              </div>
              <div className="login-trust-divider-dot" />
              <div className="login-trust-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>FERPA Compliant</span>
              </div>
              <div className="login-trust-divider-dot" />
              <div className="login-trust-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>SOC 2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <span>&copy; {new Date().getFullYear()} Intellogy Coachings</span>
          <span className="login-footer-dot">&middot;</span>
          <span>Privacy Policy</span>
          <span className="login-footer-dot">&middot;</span>
          <span>Terms of Service</span>
        </div>
      </div>

    </div>
  );
}
