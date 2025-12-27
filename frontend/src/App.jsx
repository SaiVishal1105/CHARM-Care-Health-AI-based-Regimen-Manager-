import React, { useState } from 'react'
import Form from './components/Form'
import Plan from './components/Plan'

export default function App() {
  const [plan, setPlan] = useState(null)
  const [theme, setTheme] = useState("light")

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    document.body.setAttribute("data-theme", newTheme)
  }

  return (
    <div className="container">
      <div className="theme-row">
        <h1>
          ✨ CHARM – Care, Health & AI-based Regimen Manager 🧠🥗🏃
        </h1>
        <p className="dev-names">Developed by Nisha & Sai Vishal</p>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>
      </div>

      <Form onResult={setPlan} />
      {plan && <Plan data={plan} />}
    </div>
  )
}


