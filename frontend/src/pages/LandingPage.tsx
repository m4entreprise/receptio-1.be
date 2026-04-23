import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useAuth } from '../contexts/AuthContext';

import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustBar from '../components/landing/TrustBar';
import HowItWorks from '../components/landing/HowItWorks';
import LiveDemo from '../components/landing/LiveDemo';
import Features from '../components/landing/Features';
import ROISimulator from '../components/landing/ROISimulator';
import Pricing from '../components/landing/Pricing';
import Testimonials from '../components/landing/Testimonials';
import OurStory from '../components/landing/OurStory';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.25,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-[#0B1520] overflow-x-hidden">
      <Navbar isAuthenticated={isAuthenticated} />
      <Hero isAuthenticated={isAuthenticated} />
      <TrustBar />
      <HowItWorks />
      <LiveDemo />
      <Features />
      <ROISimulator />
      <Pricing />
      <Testimonials />
      <OurStory />
      <FinalCTA isAuthenticated={isAuthenticated} />
      <Footer />
    </div>
  );
}
