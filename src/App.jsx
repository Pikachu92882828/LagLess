import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LagLess />} />
      <Route path="/download" element={<Download />} />
    </Routes>
  );
}

function LagLess() {
  const navigate = useNavigate();
  const [fromTZ, setFromTZ] = useState("Asia/Bangkok");
  const [toTZ, setToTZ] = useState("Europe/London");
  const [age, setAge] = useState("teen");

  const [tripDays, setTripDays] = useState(5);
  const [flightClass, setFlightClass] = useState("economy");
  const [nowAdvice, setNowAdvice] = useState("");
  const [aiSchedule, setAiSchedule] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [showAdminInput, setShowAdminInput] = useState(false);

  const effectiveDays = Math.min(tripDays, 3);

  const tzList = (() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [
        "Asia/Bangkok",
        "Asia/Tokyo",
        "Europe/London",
        "America/New_York",
        "America/Los_Angeles",
        "Australia/Sydney"
      ];
    }
  })();

  const diffHours = (() => {
    try {
      const now = new Date();
      const from = new Date(
        now.toLocaleString("en-US", { timeZone: fromTZ })
      );
      const to = new Date(
        now.toLocaleString("en-US", { timeZone: toTZ })
      );
      return Math.round((to - from) / 36e5);
    } catch {
      return 0;
    }
  })();

  const direction =
    diffHours > 0 ? "Eastbound ✈️" : diffHours < 0 ? "Westbound ✈️" : "No shift";

  const advice = {
    kid: "Gentle adjustment. Outdoor light, early meals, naps OK.",
    teen: "Short naps (20 min), avoid screens at night.",
    adult: "Strict light control. Optional low-dose melatonin."
  };

  function localHourInTZ(tz) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit"
    }).formatToParts(new Date());
    return Number(parts.find(p => p.type === "hour")?.value ?? 12);
  }

  function getNowAdvice({ hour, direction, age, flightClass }) {
    if (hour >= 6 && hour < 10) return "☀️ Get morning sunlight. Light breakfast. No naps.";
    if (hour >= 10 && hour < 14) return "🚶 Stay active. Hydrate. Avoid heavy caffeine.";
    if (hour >= 14 && hour < 17) return age === "kid" ? "😴 Short nap OK (20 min)." : "😴 Optional 20-min nap only.";
    if (hour >= 17 && hour < 20) return "🌆 Dim lights. Eat earlier. Screens down.";
    return flightClass !== "economy" ? "🌙 Sleep window. You should fall asleep easier." : "🌙 Sleep window. Cool room, no screens.";
  }

  function buildAIPrompt() {
    return `
You are a jet lag assistant.

STRICT RULES (MANDATORY):
- Day 0 = flight day ONLY (exactly one day).
- Days 1 through Day ${effectiveDays} = destination days.
- You MUST output EXACTLY ${effectiveDays + 1} sections.
- Each day MUST be labeled explicitly as "Day X".
- If ANY day is missing, the answer is invalid.
- NEVER invent cabins, lounges, hotels, entertainment, sightseeing, or events.
- ONLY give advice about sleep, naps, light exposure, hydration, caffeine, meals, and movement.

Residence rule:
- The user currently lives in ${fromTZ} and has NOT departed yet.
- The destination is ${toTZ}.

Flight behavior by class:
- Economy: limited sleep, hydration reminders.
- Premium economy: slightly better rest.
- Business/First: proper sleep blocks, still realistic.

Trip details:
- Trip length: ${effectiveDays} days
- Age group: ${age}
- Flight class: ${flightClass}

Admin mode: ${isAdmin}

Tone rules:
${isAdmin
  ? "- Be mildly sassy ONLY on Day 0. Never insult the user."
  : "- Calm, neutral, supportive."}

Output format:
Day X:
- Short, practical coping advice only
- Focus on how to manage fatigue and sleep timing
- No locations, no activities, no travel narrative
`;
  }

  function buildDayPrompt(dayIndex) {
    return `
You are a jet lag recovery assistant.

ABSOLUTE RULES:
- Neutral, clinical, supportive tone ONLY.
- No humor, slang, sarcasm, or narrative.
- No cities, hotels, food, activities, or sightseeing.
- ONLY give advice about sleep, naps, light exposure, hydration, caffeine, meals, and movement.

Day rules:
- If Day 0: FLIGHT DAY ONLY.
- If Day ${dayIndex}: destination day (no flight).

Context:
- User lives in ${fromTZ} and has not departed yet.
- Destination is ${toTZ}.
- Age group: ${age}
- Flight class: ${flightClass}

Variables snapshot (DO NOT ignore):
- From timezone: ${fromTZ}
- To timezone: ${toTZ}
- Day index: ${dayIndex}
- Total recovery days: ${effectiveDays}
- Age group: ${age}
- Flight class: ${flightClass}

TASK:
Generate advice for **Day ${dayIndex} only**.
Output EXACTLY this format:

Day ${dayIndex}:
- 3 to 6 short bullet points focused on coping with jet lag.
`;
  }

  function enforceAllDays(rawText, effectiveDays) {
    let result = rawText.trim();

    for (let d = 1; d <= effectiveDays; d++) {
      if (!result.includes(`Day ${d}:`)) {
        result += `

Day ${d}:
- Wake up at local morning time even if tired.
- Get natural light exposure within 1 hour of waking.
- Keep naps short (20–30 minutes) before mid-afternoon.
- Avoid caffeine after early afternoon.
- Go to bed at local night time.
`;
      }
    }

    return result;
  }

  async function generateAISchedule() {
    setAiLoading(true);
    try {
      if (!window.ollama || typeof window.ollama.chat !== "function") {
        throw new Error(
          "AI not avaliable. This may be because you are using the website client or Ollama is not installed."
        );
      }

      let fullPlan = "";

      for (let d = 0; d <= effectiveDays; d++) {
        const prompt = buildDayPrompt(d);

        console.log("Generating AI block", {
          day: d,
          fromTZ,
          toTZ,
          age,
          flightClass,
          effectiveDays
        });

        const block = await window.ollama.chat(prompt);

        if (!block || !block.includes(`Day ${d}:`)) {
          fullPlan += `

Day ${d}:
- Wake up at local morning time even if tired.
- Get natural light exposure within 1 hour of waking.
- Keep naps short (20–30 minutes) before mid-afternoon.
- Avoid caffeine after early afternoon.
- Go to bed at local night time.
`;
        } else {
          fullPlan += `\n\n${block.trim()}`;
        }
      }

      setAiSchedule(fullPlan.trim());
    } catch (e) {
      setAiSchedule("AI error: " + String(e.message || e));
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    const hour = localHourInTZ(toTZ);
    setNowAdvice(getNowAdvice({ hour, direction, age, flightClass }));
  }, [toTZ, direction, age, flightClass]);

  useEffect(() => {
    if (age !== "kid" && isAdmin) {
      setIsAdmin(false);
    }
  }, [age, isAdmin]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#f8fafc,#eef2f7)",
        padding: 24,
        display: "flex",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fbfbfd",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.08)"
        }}
      >
        {isAdmin && (
          <div style={{ textAlign: "center", marginBottom: 12, fontWeight: 700, color: "#1f2937" }}>
            Welcome Back, Caviar 👑
          </div>
        )}
        <h1 style={{ textAlign: "center", marginBottom: 4, color: "#1f2937" }}>LagLess ✈️</h1>
        <p style={{ textAlign: "center", color: "#374151", marginBottom: 24 }}>
          Jet lag help — calm, pastel & simple
        </p>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <button
            onClick={() => setShowAdminInput(!showAdminInput)}
            style={{
              padding: "8px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f1f5ff",
              cursor: "pointer",
              color: "#374151"
            }}
          >
            Admin
          </button>

          {showAdminInput && (
            <div style={{ marginTop: 10 }}>
              <input
                placeholder="Enter admin code"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginBottom: 8,
                  color: "#374151",
                  background: "#ffffff"
                }}
              />
              <button
                onClick={() => {
                  // Admin unlock rules:
                  // - Age must be "kid"
                  // - Code must be empty
                  if (age === "kid" && adminCode === "") {
                    setIsAdmin(true);
                  } else {
                    setIsAdmin(false);
                  }
                  setAdminCode("");
                  setShowAdminInput(false);
                }}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "none",
                  background: "#c7d2fe",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#374151"
                }}
              >
                Enter
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, color: "#1f2937" }}>From</label>
          <select
            value={fromTZ}
            onChange={e => setFromTZ(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              borderRadius: 12,
              border: "1px solid #ddd",
              color: "#374151",
              background: "#ffffff",
              appearance: "none",
              WebkitAppearance: "none"
            }}
          >
            {tzList.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, color: "#1f2937" }}>To</label>
          <select
            value={toTZ}
            onChange={e => setToTZ(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              borderRadius: 12,
              border: "1px solid #ddd",
              color: "#374151",
              background: "#ffffff",
              appearance: "none",
              WebkitAppearance: "none"
            }}
          >
            {tzList.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600, color: "#1f2937" }}>Age Group</label>
          <select
            value={age}
            onChange={e => setAge(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              borderRadius: 12,
              border: "1px solid #ddd",
              color: "#374151",
              background: "#ffffff",
              appearance: "none",
              WebkitAppearance: "none"
            }}
          >
            <option value="kid">Kid</option>
            <option value="teen">Teen</option>
            <option value="adult">Adult</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, color: "#1f2937" }}>Trip length (days)</label>
          <input
            type="number"
            min={1}
            value={tripDays}
            onChange={e => setTripDays(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              borderRadius: 12,
              border: "1px solid #ddd",
              color: "#374151",
              background: "#ffffff"
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600, color: "#1f2937" }}>Flight class</label>
          <select
            value={flightClass}
            onChange={e => setFlightClass(e.target.value)}
            style={{ 
              width: "100%", 
              padding: 12, 
              marginTop: 6, 
              borderRadius: 12, 
              border: "1px solid #ddd", 
              color: "#374151", 
              background: "#ffffff",
              appearance: "none",
              WebkitAppearance: "none"
            }}
          >
            {!isAdmin && <option value="economy">Economy</option>}
            {!isAdmin && <option value="premium">Premium Economy</option>}
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg,#e0e7ff,#f5f3ff)",
            borderRadius: 18,
            padding: 18
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#1f2937" }}>
            ⏰ Time difference
          </div>
          <div style={{ color: "#374151" }}>{diffHours} hours</div>

          <div style={{ fontWeight: 600, marginTop: 12, color: "#1f2937" }}>
            ✈️ Direction
          </div>
          <div style={{ color: "#374151" }}>{direction}</div>

          <div style={{ fontWeight: 600, marginTop: 12, color: "#1f2937" }}>
            💡 Advice
          </div>
          <div style={{ color: "#374151" }}>{advice[age]}</div>
        </div>

        <div style={{ background: "linear-gradient(135deg,#dcfce7,#f5f3ff)", borderRadius: 18, padding: 18, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#1f2937" }}>🧭 What should I do right now?</div>
          <div style={{ color: "#374151" }
        }>{nowAdvice}</div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Plan focuses on the first 3 days (typical jet lag recovery window).
          </div>
          <button
            onClick={generateAISchedule}
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              border: "none",
              background: isAdmin
                ? "linear-gradient(135deg,#fb7185,#a78bfa)"
                : "linear-gradient(135deg,#60a5fa,#a5b4fc)",
              fontWeight: 700,
              cursor: "pointer",
              color: "#374151"
            }}
          >
            {aiLoading ? "Thinking…" : "✨ Generate Jet Lag Recovery Plan"}
          </button>
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
            onClick={() => navigate('/download')}
              style={{
                padding: "10px 16px",
                borderRadius: 14,
                border: "1px solid #ddd",
                background: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
                color: "#374151"
              }}
            >
              ⬇️ Download & Setup (iOS · macOS · Windows · Linux)
            </button>
          </div>
        </div>
        {aiSchedule && (
          <div style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
            <div
              style={{
                marginTop: 16,
                whiteSpace: "pre-wrap",
                background: "#ffffff",
                borderRadius: 18,
                padding: 18,
                fontSize: 14,
                color: "#111827",
                border: "1px solid #e5e7eb",
                lineHeight: 1.5
              }}
            >
              {aiSchedule}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



function Download() {
  const navigate = useNavigate();
  // Pastel button style for all platform action buttons
  const pastelButtonStyle = {
    background: "linear-gradient(135deg,#e0e7ff,#f5f3ff)",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    color: "#1f2937",
    marginBottom: "10px",
    width: "100%"
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#f8fafc,#eef2f7)",
        padding: 24,
        fontFamily: "system-ui, -apple-system"
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.08)"
        }}
      >
        <h1 style={{ textAlign: "center", color: "#1f2937" }}>
          Download LagLess
        </h1>

        <p style={{ textAlign: "center", color: "#374151", marginBottom: 24 }}>
          Choose your platform and follow the steps below.
        </p>

        <div style={{ margin: "0 auto", maxWidth: 400 }}>
          <h3 style={{ marginBottom: 8 }}>📱 iOS (iPhone / iPad)</h3>
          <ol style={{ marginBottom: 24 }}>
            <li>Open LagLess in Safari</li>
            <li>Tap Share → Add to Home Screen</li>
          </ol>

          <hr style={{ margin: "24px 0" }} />

          <h3 style={{ marginBottom: 8 }}>💻 macOS (Apple Silicon)</h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <button
              style={pastelButtonStyle}
              onClick={() => window.location.href = "/LagLess-0.0.0-arm64.dmg"}
            >
              ⬇️ Download LagLess for macOS
            </button>
            <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16, textAlign: "center", width: "100%" }}>
              Universal DMG for Apple Silicon (arm64).
            </div>
            <button
              style={pastelButtonStyle}
              onClick={() => window.open("https://ollama.com", "_blank")}
            >
              🦙 Install Ollama
            </button>
            <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16, textAlign: "center", width: "100%" }}>
              Required for local AI. Download from the official Ollama website.
            </div>
          </div>
          <ol style={{ marginBottom: 24 }}>
            <li>Run <code>ollama run gemma:2b</code></li>
            <li>Launch LagLess</li>
          </ol>

          <hr style={{ margin: "24px 0" }} />

          <h3 style={{ marginBottom: 8 }}>🪟 Windows</h3>
          <button
            style={pastelButtonStyle}
            disabled
          >
            Coming soon for Windows
          </button>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16, textAlign: "center", width: "100%" }}>
            Ollama required for local AI.
          </div>

          <hr style={{ margin: "24px 0" }} />

          <h3 style={{ marginBottom: 8 }}>🐧 Linux</h3>
          <button
            style={pastelButtonStyle}
            disabled
          >
            Coming soon for Linux
          </button>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16, textAlign: "center", width: "100%" }}>
            Ollama required for local AI.
          </div>

          <hr style={{ margin: "24px 0" }} />

          <h3 style={{ marginBottom: 8 }}>🤖 AI Requirements</h3>
          <ul style={{ marginBottom: 0 }}>
            <li>Local AI only (Ollama)</li>
            <li>Model: <code>gemma:2b</code></li>
            <li>No cloud processing</li>
            <li>No API keys</li>
          </ul>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "10px 16px",
              borderRadius: 14,
              border: "1px solid #ddd",
              background: "#f1f5ff",
              fontWeight: 600,
              cursor: "pointer",
              color: "#374151"
            }}
          >
            ← Back to App
          </button>
        </div>
      </div>
    </div>
  );
}
