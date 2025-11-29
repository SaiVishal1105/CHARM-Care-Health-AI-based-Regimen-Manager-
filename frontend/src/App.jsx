import React, { useState, useEffect } from 'react'
import Form from './components/Form'
import Plan from './components/Plan'

export default function App() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState("light")

  // Restore theme on refresh
  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved) {
      setTheme(saved)
      document.body.setAttribute("data-theme", saved)
    }
  }, [])

  // Toggle light/dark mode
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    document.body.setAttribute("data-theme", newTheme)
  }

  // Handle form submission
  const handleGenerate = async (userData) => {
    setLoading(true)
    setError(null)
    setPlan(null)

    try {
      const res = await fetch("https://charm-care-health-ai-based-regimen.onrender.com/generate_plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      })

      if (!res.ok) throw new Error("Failed to fetch plan")

      const json = await res.json()
      setPlan(json)

    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="container">
      <div className="theme-row">
        <h1>AI Health-Based Diet / Nutrition Recommender</h1>

        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>
      </div>

      <Form onResult={handleGenerate} />

      {loading && <p className="loading">Generating your plan… please wait ⏳</p>}
      {error && <p className="error">⚠️ {error}</p>}

      {plan && !loading && <Plan data={plan} />}
    </div>
  )
}

