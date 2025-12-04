import React, { useState } from "react";

export default function Form({ onResult }) {
  const [state, setState] = useState({
    age: "23",
    height_cm: "170",
    weight_kg: "70",
    activity_level: "1.55",
    goal: "loss",
    deficiency: "none",
    chronic: "none",
    cuisine_pref: "none",
    food_type: "none",
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const submit = async (e) => {
    e.preventDefault(); // Stop reload & double-submit

    // Input Validation Guard Clause
    if (!state.age || !state.height_cm || !state.weight_kg) {
      setErrorMessage("Please fill in Age, Height, and Weight.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const payload = {
      // Ensure all numbers are converted. parseFloat is safer for decimal inputs.
      age: Number(state.age),
      height_cm: Number(state.height_cm),
      weight_kg: Number(state.weight_kg),
      activity_level: Number(state.activity_level),
      
      // Strings
      goal: state.goal,
      deficiency: state.deficiency,
      chronic: state.chronic,
      cuisine_pref: state.cuisine_pref,
      food_type: state.food_type,
      
      // Explicitly null for the optional field
      calorie_target: null, 
    };

    console.log("PAYLOAD SENT:", payload);

    try {
      const resp = await fetch(
        "https://charm-care-health-ai-based-regimen.onrender.com/generate_plan",
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();
      console.log("RESPONSE RECEIVED:", data);

      if (!resp.ok) {
        // If the server returns 4xx or 5xx
        const errorDetail = data?.detail?.map(d => `${d.loc.join('.')}: ${d.msg}`).join('; ') || resp.statusText;
        throw new Error(`Backend Error (${resp.status}): ${errorDetail}`);
      }

      onResult(data);
    } catch (err) {
      console.error("❌ FETCH FAILED:", err);
      // Replace alert() with state-based message
      setErrorMessage(`⚠️ Failed to generate plan. Reason: ${err.message || 'Unknown network error.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setState({ ...state, [e.target.name]: e.target.value });
  };


  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Health Regimen Generator</h2>

      <form onSubmit={submit} className="space-y-4">
        
        {/* Row 1: Age, Height, Weight */}
        <div className="flex gap-4">
          <InputGroup label="Age" name="age" type="number" value={state.age} onChange={handleInputChange} />
          <InputGroup label="Height (cm)" name="height_cm" type="number" value={state.height_cm} onChange={handleInputChange} />
          <InputGroup label="Weight (kg)" name="weight_kg" type="number" value={state.weight_kg} onChange={handleInputChange} />
        </div>

        {/* Activity Level */}
        <InputGroup 
          label="Activity Level (e.g., 1.55)" 
          name="activity_level" 
          type="number" 
          step="0.01"
          value={state.activity_level} 
          onChange={handleInputChange} 
        />

        {/* Row 2: Goal, Deficiency, Chronic */}
        <div className="flex gap-4">
          <SelectGroup label="Goal" name="goal" value={state.goal} onChange={handleInputChange}>
            <option value="loss">Weight Loss</option>
            <option value="gain">Weight Gain</option>
            <option value="muscle">Muscle Gain</option>
          </SelectGroup>

          <SelectGroup label="Deficiency" name="deficiency" value={state.deficiency} onChange={handleInputChange}>
            <option value="none">None</option>
            <option value="iron">Iron</option>
            <option value="vitd">Vitamin D</option>
            <option value="protein">Protein</option>
          </SelectGroup>

          <SelectGroup label="Chronic" name="chronic" value={state.chronic} onChange={handleInputChange}>
            <option value="none">None</option>
            <option value="diabetes">Diabetes</option>
            <option value="hypertension">Hypertension</option>
          </SelectGroup>
        </div>

        {/* Cuisine and Food Type */}
        <InputGroup 
          label="Cuisine Preference (e.g., Indian)" 
          name="cuisine_pref" 
          value={state.cuisine_pref} 
          onChange={handleInputChange} 
        />

        <SelectGroup label="Food Type" name="food_type" value={state.food_type} onChange={handleInputChange}>
          <option value="none">No Preference</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="non-vegetarian">Non-Vegetarian</option>
        </SelectGroup>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {/* Submission Button */}
        <button 
          type="submit" 
          disabled={isLoading}
          className={`w-full py-3 mt-4 text-white font-semibold rounded-lg transition duration-300 shadow-md ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
          }`}
        >
          {isLoading ? 'Generating Plan...' : 'Generate 7-day Plan'}
        </button>
      </form>
    </div>
  );
}

// Helper Components for cleaner JSX
const InputGroup = ({ label, name, type = 'text', step, value, onChange }) => (
  <div className="flex-1">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      id={name}
      name={name}
      type={type}
      step={step}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      required
    />
  </div>
);

const SelectGroup = ({ label, name, value, onChange, children }) => (
  <div className="flex-1">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {children}
    </select>
  </div>
);
