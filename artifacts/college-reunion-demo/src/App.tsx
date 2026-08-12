import { useState, useEffect, useRef } from 'react';

function Hero() {
  const [isVisible, setIsVisible] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => setTextVisible(true), 400);
        }
      },
      { threshold: 0.1 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-8 overflow-hidden"
      aria-labelledby="hero-title"
    >
      <div
        className={`absolute inset-0 z-0 transition-opacity duration-1200 ${
          isVisible ? 'opacity-100' : 'opacity-0 scale-105'
        }`}
        aria-hidden="true"
      >
        <img
          src={`${import.meta.env.BASE_URL}hero.jpg`}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-warm-900/20 to-transparent" />
      </div>

      <div
        className={`relative z-10 text-center max-w-4xl mx-auto transition-all duration-1000 ${
          textVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-8'
        }`}
      >
        <p
          className="text-warm-100/90 text-sm sm:text-base tracking-widest uppercase mb-6 font-light letter-spacing-[0.3em]"
          style={{ animationDelay: '200ms' }}
        >
          College Reunion
        </p>

        <h1
          id="hero-title"
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-tight text-white mb-6 tracking-tight"
          style={{ fontFamily: 'var(--font-display)', animationDelay: '400ms' }}
        >
          Years passed.<br />
          <span className="font-light">The friendship didn&rsquo;t.</span>
        </h1>

        <p
          className="text-warm-100/80 text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-light"
          style={{ animationDelay: '600ms' }}
        >
          Some friendships pick up exactly where they left off.
        </p>

        <div
          className="mt-10 flex items-center justify-center gap-4 opacity-0 transition-all duration-1000 delay-800"
          style={{
            opacity: textVisible ? 1 : 0,
            transform: textVisible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <span className="h-px w-24 bg-warm-200/50" />
          <span className="relative px-4">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-warm-300/50 to-transparent animate-shimmer" />
            <span className="relative text-warm-200/70 text-xs tracking-wider uppercase font-light">
              Twenty years later
            </span>
          </span>
          <span className="h-px w-24 bg-warm-200/50" />
        </div>
      </div>

      <div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce"
        style={{ animationDelay: '1.5s' }}
        aria-hidden="true"
      >
        <svg
          className="w-6 h-6 text-white/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
    </section>
  );
}

function MemoryStrip() {
  const memories = [
    { year: '2004', label: 'Freshman Orientation' },
    { year: '2005', label: 'Late Night Study Sessions' },
    { year: '2006', label: 'Spring Break Road Trip' },
    { year: '2007', label: 'Graduation Day' },
    { year: '2024', label: 'The Reunion' },
  ];

  return (
    <section className="py-16 px-4 sm:px-8 bg-white border-y border-warm-100" aria-label="Timeline of memories">
      <div className="max-w-6xl mx-auto">
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-warm-200 -translate-x-1/2 hidden md:block" />
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0">
            {memories.map((memory, index) => (
              <div
                key={memory.year}
                className="relative flex flex-col items-center z-10 w-full md:w-1/5"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="relative mb-4">
                  <div
                    className={`w-4 h-4 rounded-full border-4 border-warm-200 bg-white transition-all duration-500 ${
                      index === memories.length - 1
                        ? 'bg-warm-500 border-warm-500 ring-4 ring-warm-100'
                        : 'bg-sage-500 border-sage-500'
                    }`}
                    aria-hidden="true"
                  />
                  {index < memories.length - 1 && (
                    <div className="absolute left-1/2 top-1/2 w-full h-px bg-warm-200 -translate-x-1/2 -translate-y-1/2 hidden md:block" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    index === memories.length - 1
                      ? 'text-warm-700'
                      : 'text-warm-600'
                  } mb-1`}
                >
                  {memory.year}
                </span>
                <span className="text-xs text-warm-500 text-center max-w-[80px]">
                  {memory.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Reflection() {
  return (
    <section className="py-20 px-4 sm:px-8 lg:px-16" aria-labelledby="reflection-title">
      <div className="max-w-3xl mx-auto text-center">
        <h2
          id="reflection-title"
          className="text-3xl sm:text-4xl font-normal text-warm-900 mb-8 tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          What Twenty Years Teaches You
        </h2>
        <div className="space-y-6 text-warm-700 leading-relaxed text-lg">
          <p>
            The inside jokes still land. The shorthand still works.
            You don&rsquo;t need to explain the reference &mdash; they
            <em className="font-normal not-italic">already know</em>.
          </p>
          <p>
            Life wrote different chapters for each of us. Careers, families,
            moves, losses, wins. But the foundation? That was poured in
            dorm rooms and dining halls, over bad coffee and big dreams.
          </p>
          <p className="font-medium text-warm-800">
            This isn&rsquo;t nostalgia. It&rsquo;s continuity.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-8 border-t border-warm-100 bg-warm-50/50" role="contentinfo">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-warm-500 text-sm mb-2">
          Made with warmth for the Class of &rsquo;07
        </p>
        <p className="text-warm-400 text-xs tracking-wider uppercase">
          Some bonds don&rsquo;t fade. They deepen.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Hero />
      <MemoryStrip />
      <Reflection />
      <Footer />
    </div>
  );
}