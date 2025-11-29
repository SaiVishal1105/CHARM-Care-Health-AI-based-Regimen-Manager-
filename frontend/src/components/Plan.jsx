import React from 'react'

export default function Plan({ data }) {
  if (!data || !data.plan || !data.plan.days) {
    return <div style={{ marginTop: 20 }}>No plan generated yet.</div>
  }

  const { plan, workout } = data

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Weekly Diet Plan</h2>

      {plan.days.map((day, i) => (
        <div key={i} style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 8 }}>
          <h3>Day {i + 1}</h3>

          {["Breakfast", "Lunch", "Dinner"].map((meal) => {
            const mealData = day[meal]

            if (!mealData) return <p key={meal}>No data for {meal}</p>

            return (
              <div key={meal} style={{ marginBottom: 10 }}>
                <strong>{meal}</strong>: {mealData.recipe_name}  
                — {mealData.calories} kcal  
                — P:{mealData.protein_g}g  
                — C:{mealData.carbs_g}g  
                — F:{mealData.fat_g}g

                <p><strong>Ingredients:</strong> {mealData.ingredients}</p>
                <p><strong>Preparation:</strong> {mealData.preparation}</p>
              </div>
            )
          })}

          <div style={{ fontStyle: "italic", marginTop: 10 }}>
            Workout: {workout && workout[i] ? workout[i] : "No workout assigned"}
          </div>
        </div>
      ))}
    </div>
  )
}
