import About from "@/components/About";
import Contact from "@/components/Contact";
import ExperienceUI from "@/components/ExperienceUI";
import Hero from "@/components/Hero";
import Work from "@/components/Work";

export default function Home() {
  return (
    <>
      <ExperienceUI />
      <main className="site-main">
        <Hero />
        <About />
        <Work />
        <Contact />
      </main>
    </>
  );
}
