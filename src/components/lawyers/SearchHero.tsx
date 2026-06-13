import { Search, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function SearchHero() {
  const [practiceArea, setPracticeArea] = useState("");
  const [location, setLocation] = useState("Lagos, Nigeria");
  const [experience, setExperience] = useState("Any Years");

  return (
    <section className="relative w-full h-[500px] md:h-[600px] rounded-none md:rounded-2xl overflow-hidden mb-8 md:mb-12">
      {/* Background Image */}
      <img
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMbE_TccafyQoHcYrOphPfhXS3zEz564m7gHB9xwRiMNbRC79yxHEZuyKq3zALGe1crt0IpsTzCvAqtNQzvv4HVOPWZs6l6zEO3Aowdky4BBb64gWMCf04SCSV4rqonWNHp1zhrTYfEHSF3HUXLW-_dSAh-lNqTxXCDsJglNbCyREYeANi5rlUr8TGnA92AXAcELMKpKljtWxEQUfdfn3-KeVUnQA41Asng63F_7IIx-HfQLASJ6ZRuIfWqUjBFVCTVdHR7URVw6jt"
        alt="Premium legal office with city skyline view"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center text-center px-4 md:px-6">
        <h1 className="text-white text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Find Top Legal Counsel
        </h1>
        <p className="text-[#a3a3a3] text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
          Access the world's most elite legal minds. Precision, power, and professional excellence at your fingertips.
        </p>

        {/* Search Box */}
        <div className="w-full max-w-3xl bg-[#1a1a1a]/80 backdrop-blur-md border border-[#333333] rounded-xl p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Practice Area Input */}
            <div className="md:col-span-5">
              <label className="block text-[#737373] text-[11px] uppercase tracking-wider font-medium mb-2 text-left">
                Practice Area or Lawyer Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type="text"
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  placeholder="Corporate Law, Intellectual Property..."
                  className="w-full bg-[#0a0a0a]/60 border border-[#262626] rounded-lg h-11 pl-10 pr-4 text-white text-sm placeholder:text-[#737373] focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]/20 transition-all"
                />
              </div>
            </div>

            {/* Location Dropdown */}
            <div className="md:col-span-3">
              <label className="block text-[#737373] text-[11px] uppercase tracking-wider font-medium mb-2 text-left">
                Location
              </label>
              <div className="relative">
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#0a0a0a]/60 border border-[#262626] rounded-lg h-11 pl-4 pr-10 text-white text-sm appearance-none focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]/20 transition-all cursor-pointer"
                >
                  <option>Lagos, Nigeria</option>
                  <option>Abuja, Nigeria</option>
                  <option>Port Harcourt, Nigeria</option>
                  <option>London, UK</option>
                  <option>New York, USA</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none" />
              </div>
            </div>

            {/* Experience Dropdown */}
            <div className="md:col-span-2">
              <label className="block text-[#737373] text-[11px] uppercase tracking-wider font-medium mb-2 text-left">
                Experience
              </label>
              <div className="relative">
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-[#0a0a0a]/60 border border-[#262626] rounded-lg h-11 pl-4 pr-10 text-white text-sm appearance-none focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]/20 transition-all cursor-pointer"
                >
                  <option>Any Years</option>
                  <option>5+ Years</option>
                  <option>10+ Years</option>
                  <option>15+ Years</option>
                  <option>20+ Years</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none" />
              </div>
            </div>

            {/* Search Button */}
            <div className="md:col-span-2 flex items-end">
              <button className="w-full bg-[#d4a843] text-black font-semibold h-11 rounded-lg text-sm hover:bg-[#e8c566] active:scale-[0.98] transition-all">
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
