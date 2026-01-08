import React, { useState } from 'react'

export default function Form({ onResult }) {
  const [state, setState] = useState({
    age: 23,
    height_cm: 170,
    weight_kg: 70,
    activity_level: 1.55,
    goal: 'loss',
    deficiency: 'none',
    chronic: 'none',
    cuisine_pref: '',
    food_type: 'none'   // added correctly
  })

  const submit = async (e) => {
    e.preventDefault()

    const resp = await fetch('http://localhost:8000/generate_plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    })

    const data = await resp.json()
    onResult(data)
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <div className="col">
          <label>Age</label>
          <input
            type="number"
            value={state.age}
            onChange={e => setState({ ...state, age: parseInt(e.target.value) })}
          />
        </div>

        <div className="col">
          <label>Height (cm)</label>
          <input
            type="number"
            value={state.height_cm}
            onChange={e => setState({ ...state, height_cm: parseFloat(e.target.value) })}
          />
        </div>

        <div className="col">
          <label>Weight (kg)</label>
          <input
            type="number"
            value={state.weight_kg}
            onChange={e => setState({ ...state, weight_kg: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <label>Activity Level</label>
      <input
        type="number"
        step="0.5"
        value={state.activity_level}
        onChange={e => setState({ ...state, activity_level: parseFloat(e.target.value) })}
      />

      <div className="row">
        <div className="col">
          <label>Goal</label>
          <select
            value={state.goal}
            onChange={e => setState({ ...state, goal: e.target.value })}
          >
            <option value={1.2}>🛋️ Sedentary - Little or no exercise</option>
            <option value={1.375}>🚶 Lightly Active - Exercise 1-3 days/week</option>
            <option value={1.55}>🏃 Moderately Active - Exercise 3-5 days/week</option>
            <option value={1.725}>🏋️ Very Active - Exercise 6-7 days/week</option>
            <option value={1.9}>🔥 Super Active - Athlete / Physical job</option>
          </select>

          <div style={{ marginTop: 15 }}>
            <label>Fitness Goal</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {['loss', 'gain', 'muscle'].map(goal => {
                const info = getGoalInfo(goal)
                return (
                  <div
                    key={goal}
                    onClick={() => setState({ ...state, goal })}
                    style={{
                      padding: 15,
                      borderRadius: 10,
                      border: state.goal === goal ? '3px solid var(--workout-accent)' : '2px solid var(--input-border)',
                      background: state.goal === goal ? 'var(--workout-bg)' : 'var(--input-bg)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(5px)',
                      transform: state.goal === goal ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: 5 }}>{info.emoji}</div>
                    <strong style={{ display: 'block', color: 'var(--text-main)' }}>{info.text}</strong>
                    <small style={{ color: 'var(--text-main)', opacity: 0.7 }}>{info.desc}</small>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="col">
          <label>Deficiency</label>
          <select
            value={state.deficiency}
            onChange={e => setState({ ...state, deficiency: e.target.value })}
          >
            <option value="none">None</option>
            <option value="iron">Iron</option>
            <option value="vitd">Vitamin D</option>
            <option value="protein">Protein</option>
          </select>
        </div>

        <div className="col">
          <label>Chronic</label>
          <select
            value={state.chronic}
            onChange={e => setState({ ...state, chronic: e.target.value })}
          >
            <option value="none">None</option>
            <option value="diabetes">Diabetes</option>
            <option value="hypertension">Hypertension</option>
          </select>
        </div>
      </div>

      <label>Cuisine Preference</label>
      <input
        value={state.cuisine_pref}
        onChange={e => setState({ ...state, cuisine_pref: e.target.value })}
      />

      <label>Food Type</label>
      <select
        value={state.food_type}
        onChange={(e) => setState({ ...state, food_type: e.target.value })}
      >
        <option value="None">No Preference</option>
        <option value="Vegetarian">Vegetarian</option>
        <option value="Vegan">Vegan</option>
        <option value="Non-Vegetarian">Non-Vegetarian</option>
      </select>

      <button type="submit">Generate 7-day Plan</button>
    </form>
  )
}