import React, { useState, useEffect } from 'react'

export default function Form({ onResult }) {
  const [state, setState] = useState({
    age: '',
    height_cm: '',
    weight_kg: '',
    activity_level: 1.55,
    goal: 'loss',
    deficiency: 'none',
    chronic: 'none',
    cuisine_pref: '',
    food_type: 'none'
  })

  const [loading, setLoading] = useState(false)
  const [bmi, setBmi] = useState(0)
  const [bmiCategory, setBmiCategory] = useState('')

  // Calculate BMI whenever height or weight changes
  useEffect(() => {
    if (state.height_cm && state.weight_kg) {
      const heightM = state.height_cm / 100
      const calculatedBmi = state.weight_kg / (heightM * heightM)
      setBmi(calculatedBmi.toFixed(1))

      // Determine BMI category
      if (calculatedBmi < 18.5) setBmiCategory('Underweight')
      else if (calculatedBmi < 25) setBmiCategory('Normal')
      else if (calculatedBmi < 30) setBmiCategory('Overweight')
      else setBmiCategory('Obese')
    } else {
      setBmi(0)
      setBmiCategory('')
    }
  }, [state.height_cm, state.weight_kg])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Use environment variable or fallback to Render URL
      const API_URL = process.env.REACT_APP_API_URL || 'https://charm-care-health-ai-based-regimen.onrender.com'
      
      const resp = await fetch(`${API_URL}/generate_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      })

      if (!resp.ok) {
        throw new Error('Failed to generate plan')
      }

      const data = await resp.json()
      onResult(data)
      
      // Smooth scroll to results
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('❌ Failed to generate plan. Please check if the backend is running and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Get goal emoji and description
  const getGoalInfo = (goal) => {
    const goals = {
      loss: { emoji: '🔥', text: 'Weight Loss', desc: 'Burn fat & get lean' },
      gain: { emoji: '📈', text: 'Weight Gain', desc: 'Healthy bulking' },
      muscle: { emoji: '💪', text: 'Muscle Gain', desc: 'Build strength & mass' }
    }
    return goals[goal] || goals.loss
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 10 }}>
          🏋️ AI Diet & Workout Planner
        </h1>
        <p style={{ opacity: 0.8, fontSize: '1.05rem', margin: 0 }}>
          Get your personalized 7-day meal plan & workout routine
        </p>
      </div>
      
      <form onSubmit={submit}>
        {/* Personal Info Section */}
        <div style={{ marginBottom: 25 }}>
          <h3 style={{ 
            color: 'var(--title-color)', 
            borderBottom: '2px solid var(--workout-accent)',
            paddingBottom: 8,
            marginBottom: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            👤 Personal Information
          </h3>
          
          <div className="row">
            <div className="col">
              <label>Age</label>
              <input
                type="number"
                min="10"
                max="100"
                placeholder="e.g., 25"
                value={state.age}
                onChange={e => setState({ ...state, age: e.target.value })}
                required
              />
            </div>

            <div className="col">
              <label>Height (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                placeholder="e.g., 170"
                value={state.height_cm}
                onChange={e => setState({ ...state, height_cm: e.target.value })}
                required
              />
            </div>

            <div className="col">
              <label>Weight (kg)</label>
              <input
                type="number"
                min="30"
                max="200"
                placeholder="e.g., 70"
                value={state.weight_kg}
                onChange={e => setState({ ...state, weight_kg: e.target.value })}
                required
              />
            </div>
          </div>

          {/* BMI Display */}
          {bmi > 0 && (
            <div style={{
              marginTop: 15,
              padding: 12,
              background: 'var(--workout-bg)',
              borderRadius: 10,
              border: '1px solid var(--workout-accent)',
              textAlign: 'center',
              backdropFilter: 'blur(5px)'
            }}>
              <strong style={{ color: 'var(--workout-text)' }}>
                📊 Your BMI: {bmi} - {bmiCategory}
              </strong>
            </div>
          )}
        </div>

        {/* Activity & Goals Section */}
        <div style={{ marginBottom: 25 }}>
          <h3 style={{ 
            color: 'var(--title-color)', 
            borderBottom: '2px solid var(--workout-accent)',
            paddingBottom: 8,
            marginBottom: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            🎯 Goals & Activity
          </h3>

          <label>Activity Level</label>
          <select
            value={state.activity_level}
            onChange={e => setState({ ...state, activity_level: parseFloat(e.target.value) })}
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

        {/* Health Info Section */}
        <div style={{ marginBottom: 25 }}>
          <h3 style={{ 
            color: 'var(--title-color)', 
            borderBottom: '2px solid var(--workout-accent)',
            paddingBottom: 8,
            marginBottom: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            ⚕️ Health Information
          </h3>

          <div className="row">
            <div className="col">
              <label>Nutrient Deficiency</label>
              <select
                value={state.deficiency}
                onChange={e => setState({ ...state, deficiency: e.target.value })}
              >
                <option value="none">✅ None</option>
                <option value="iron">🩸 Iron Deficiency</option>
                <option value="vitd">☀️ Vitamin D Deficiency</option>
                <option value="protein">🥩 Protein Deficiency</option>
              </select>
            </div>

            <div className="col">
              <label>Chronic Condition</label>
              <select
                value={state.chronic}
                onChange={e => setState({ ...state, chronic: e.target.value })}
              >
                <option value="none">✅ None</option>
                <option value="diabetes">🍬 Diabetes</option>
                <option value="hypertension">💊 Hypertension</option>
              </select>
            </div>
          </div>
        </div>

        {/* Food Preferences Section */}
        <div style={{ marginBottom: 25 }}>
          <h3 style={{ 
            color: 'var(--title-color)', 
            borderBottom: '2px solid var(--workout-accent)',
            paddingBottom: 8,
            marginBottom: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            🍽️ Food Preferences
          </h3>

          <label>Cuisine Preference</label>
          <input
            type="text"
            placeholder="e.g., Indian, Asian, European, Mexican, Mediterranean..."
            value={state.cuisine_pref}
            onChange={e => setState({ ...state, cuisine_pref: e.target.value })}
            style={{ marginBottom: 15 }}
          />

          <label>Dietary Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { value: 'none', emoji: '🍽️', label: 'Any' },
              { value: 'Vegetarian', emoji: '🥗', label: 'Vegetarian' },
              { value: 'Vegan', emoji: '🌱', label: 'Vegan' },
              { value: 'Non-Vegetarian', emoji: '🍗', label: 'Non-Veg' }
            ].map(type => (
              <div
                key={type.value}
                onClick={() => setState({ ...state, food_type: type.value })}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: state.food_type === type.value ? '3px solid var(--workout-accent)' : '2px solid var(--input-border)',
                  background: state.food_type === type.value ? 'var(--workout-bg)' : 'var(--input-bg)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(5px)',
                  transform: state.food_type === type.value ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: 3 }}>{type.emoji}</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{type.label}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={loading} style={{
          fontSize: '1.15rem',
          padding: '15px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}>
          {loading ? (
            <>
              <span style={{ 
                border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                width: 20,
                height: 20,
                animation: 'spin 0.6s linear infinite'
              }}></span>
              Generating Your Plan...
            </>
          ) : (
            <>
              🚀 Generate My 7-Day Plan
            </>
          )}
        </button>

        {/* Info Footer */}
        <div style={{
          marginTop: 20,
          padding: 15,
          background: 'var(--workout-bg)',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: '0.9rem',
          backdropFilter: 'blur(5px)'
        }}>
          <strong>💡 Pro Tip:</strong> For best results, be honest about your activity level and health conditions.
        </div>
      </form>
    </div>
  )
}
