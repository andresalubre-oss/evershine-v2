
const developers = [
  {
    name: "John Andre S. Salubre",
    role: "FRONTEND DEVELOPER",
    description:
      "Responsible for the website interface, visual design, responsive layouts, and user experience.",
    skills: ["React", "Tailwind CSS", "UI/UX"],
    image: "/john-andre.jpg",
  },
  {
    name: "Jhane S. Padecio",
    role: "BACKEND DEVELOPER",
    description:
      "Responsible for application logic, API integration, database operations, and system functionality.",
    skills: ["JavaScript", "API", "Database"],
    image: "jhane.jpg",
  },
  {
    name: "Janna R. Olojan",
    role: "SYSTEMS DEVELOPER",
    description:
      "Contributes to system architecture, technical implementation, testing, and overall reliability.",
    skills: ["Systems", "Testing", "Networking"],
    image: "/janna.jpg",
  },
];

export default function DevelopersPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-7 sm:py-12 lg:px-12">

      {/* HEADER */}
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-gray-200 pb-8 sm:flex-row sm:items-end lg:mb-10">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-700">
            EVERSHINE / THE PEOPLE BEHIND THE PROJECT
          </p>

          <h1 className="text-5xl font-semibold leading-none tracking-[-0.065em] sm:text-7xl lg:text-8xl">
          DEVELOPERS<span className="text-emerald-700">.</span>
          </h1>
        </div>

        <p className="max-w-xs text-xs leading-relaxed text-slate-500 sm:text-sm">
          Meet the people behind Evershine Booking System. A team dedicated to
          designing and developing a better island travel experience.
        </p>
      </header>

    
      <section
        aria-label="Meet the developers"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {developers.map((developer) => (
          <article
            key={developer.number}
            className="group overflow-hidden rounded-sm border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-emerald-700/50 hover:shadow-xl hover:shadow-emerald-950/5"
          >
            {/* PORTRAIT */}
            <div className="relative aspect-[4/4.5] overflow-hidden bg-emerald-700">
              <img
                src={developer.image}
                alt={`Portrait of ${developer.name}`}
                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-emerald-950/10" />

              <span className="absolute bottom-4 left-4 text-[10px] font-bold tracking-[0.2em] text-emerald-200">
                {developer.role}
              </span>
            </div>

        
            <div className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {developer.name}
              </h2>

              <div className="mt-3 h-1 w-10" />

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {developer.description}
              </p>

            
              <div className="mt-5 flex flex-wrap gap-2">
                {developer.skills.map((skill) => (
                  <span
                    key={skill}
                    className="border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

   
      <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-gray-200 pt-6 text-[10px] text-slate-500 sm:flex-row">
        <p>
          © 2026 <span className="font-bold text-emerald-800">EVERSHINE BOOKING SYSTEM</span>
        </p>

        <p className="font-medium tracking-wider">
         In Requirement for Capstone 2.
        </p>
      </footer>
    </main>
  );
}
