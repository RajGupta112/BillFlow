import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import Features, { StatsStrip } from '../components/landing/Features'
import HowItWorks from '../components/landing/HowItWorks'
import Pricing, { Faq } from '../components/landing/Pricing'
import Footer, { CtaBand } from '../components/landing/Footer'

export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsStrip />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </>
  )
}