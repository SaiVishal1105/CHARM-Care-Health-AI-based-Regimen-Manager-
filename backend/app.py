import os
import logging
from typing import Any, Dict, Optional, Union

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------
# Local imports
# ---------------------------
from data_processing import load_and_process
from model import RecipeRanker

# ---------------------------
# Logging
# ---------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diet_recommender")

# ---------------------------
# FastAPI + CORS
# ---------------------------
app = FastAPI(title="Diet Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Paths & Globals
# ---------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pt")

df_global = None
recipe_features = None
model = None

# ---------------------------
# Load Data
# ---------------------------
try:
    logger.info("Loading dataset…")
    df_global, enc_global, scaler_global, num_cols = load_and_process()
    recipe_features = df_global.filter(like="std_").values.astype("float32")
    logger.info("Data loaded. Recipes: %d | Feature dim: %d",
                len(df_global), recipe_features.shape[1])
except Exception as e:
    logger.exception("DATA LOAD ERROR: %s", e)
    df_global = None
    recipe_features = np.zeros((1, 5), dtype="float32")

# ---------------------------
# Load Model
# ---------------------------
try:
    user_dim = 4 + 3 + 4 + 3   # age,BMI,activity,calories + goal + deficiency + chronic
    recipe_dim = recipe_features.shape[1]

    logger.info("Initializing model architecture…")
    model = RecipeRanker(user_dim, recipe_dim)

    if os.path.exists(MODEL_PATH):
        logger.info("Loading weights from %s", MODEL_PATH)
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        model.eval()
        logger.info("Model loaded.")
    else:
        logger.warning("MODEL FILE NOT FOUND: %s", MODEL_PATH)
        model = None

except Exception as e:
    logger.exception("MODEL INIT ERROR: %s", e)
    model = None

# ---------------------------
# Pydantic Input
# ---------------------------
class UserInput(BaseModel):
    age: Union[int, float, str, None] = 23
    height_cm: Union[int, float, str, None] = 170
    weight_kg: Union[int, float, str, None] = 70
    activity_level: Union[int, float, str, None] = 1.55

    goal: str = "loss"
    deficiency: str = "none"
    chronic: str = "none"
    cuisine_pref: str = "none"
    food_type: str = "none"

    calorie_target: Union[int, float, str, None] = None

# ---------------------------
# Helper Coercion
# ---------------------------
def coerce_float(v: Any, default: float) -> float:
    try:
        if v is None:
            return default
        return float(str(v).strip())
    except:
        return default

def clean_user_input(raw: Dict[str, Any]) -> Dict[str, Any]:
    u = {}

    u["age"] = coerce_float(raw.get("age"), 23)
    u["height_cm"] = coerce_float(raw.get("height_cm"), 170)
    u["weight_kg"] = coerce_float(raw.get("weight_kg"), 70)
    u["activity_level"] = coerce_float(raw.get("activity_level"), 1.55)

    # Normalize strings
    def norm(k, default="none"):
        v = raw.get(k, default)
        if v is None:
            return default
        s = str(v).strip().lower()
        return s if s else default

    u["goal"] = norm("goal", "loss")
    u["deficiency"] = norm("deficiency", "none")
    u["chronic"] = norm("chronic", "none")
    u["cuisine_pref"] = norm("cuisine_pref", "none")
    u["food_type"] = norm("food_type", "none")

    u["calorie_target"] = None
    if raw.get("calorie_target"):
        u["calorie_target"] = coerce_float(raw.get("calorie_target"), None)

    return u

# ---------------------------
# Scoring Function (improved)
# ---------------------------
def score_recipes(user: Dict[str, Any]) -> np.ndarray:
    if recipe_features is None or recipe_features.size == 0:
        return np.zeros(1)

    bmi = user["weight_kg"] / ((user["height_cm"] / 100) ** 2 + 1e-6)

    user_vec = [
        user["age"] / 100,
        bmi / 50,
        user["activity_level"] / 2,
        (user["calorie_target"] or 1800) / 4000,
    ]

    goals = ["loss", "gain", "muscle"]
    defs_ = ["none", "iron", "vitd", "protein"]
    chs = ["none", "diabetes", "hypertension"]

    user_vec += [1.0 if user["goal"] == g else 0.0 for g in goals]
    user_vec += [1.0 if user["deficiency"] == d else 0.0 for d in defs_]
    user_vec += [1.0 if user["chronic"] == c else 0.0 for c in chs]

    uv = torch.tensor(user_vec, dtype=torch.float32).unsqueeze(0).repeat(len(recipe_features), 1)
    rx = torch.tensor(recipe_features, dtype=torch.float32)

    if model is None:
        return np.random.rand(len(recipe_features))

    try:
        with torch.no_grad():
            raw_scores = model(uv, rx).numpy().reshape(-1)
    except:
        raw_scores = np.random.rand(len(recipe_features))

    df = df_global.copy()
    scores = raw_scores.copy()

    # Cuisine penalty
    if user["cuisine_pref"] != "none":
        mismatch = df["cuisine"].str.lower() != user["cuisine_pref"]
        scores[mismatch] *= 0.75

    # Food type hard filter
    if user["food_type"] != "none":
        mismatch = df["food_type"].str.lower() != user["food_type"]
        scores[mismatch] *= 0.5

    # Deficiency bonus
    if user["deficiency"] == "iron":
        scores += df["iron_mg"].values * 0.02
    if user["deficiency"] == "protein":
        scores += df["protein_g"].values * 0.03

    # Chronic disease penalty
    if user["chronic"] == "diabetes":
        scores -= df["carbs_g"].values * 0.01

    return scores

# ---------------------------
# Weekly Plan Builder
# ---------------------------
def build_week_plan(user: Dict[str, Any]) -> Dict[str, Any]:
    if df_global is None:
        raise RuntimeError("Server data missing")

    df = df_global.copy()
    df["score"] = score_recipes(user)

    plan = {"days": []}
    used = set()

    for day in range(7):
        meals = {}
        for meal in ["Breakfast", "Lunch", "Dinner"]:
            subset = df[df["meal_type"].str.lower() == meal.lower()].sort_values("score", ascending=False)

            chosen = None
            for _, row in subset.iterrows():
                if row["recipe_name"] not in used:
                    chosen = row
                    break

            if chosen is None and not subset.empty:
                chosen = subset.iloc[0]

            if chosen is not None:
                used.add(chosen["recipe_name"])

            meals[meal] = {
                "recipe_name": chosen["recipe_name"] if chosen is not None else "",
                "ingredients": chosen["ingredients"] if chosen is not None else "",
                "instructions": chosen["instructions"] if chosen is not None else "",
                "preparation": chosen["preparation"] if chosen is not None else "",
                "calories": float(chosen["calories"]) if chosen is not None else 0,
                "protein_g": float(chosen["protein_g"]) if chosen is not None else 0,
                "carbs_g": float(chosen["carbs_g"]) if chosen is not None else 0,
                "fat_g": float(chosen["fat_g"]) if chosen is not None else 0,
                "iron_mg": float(chosen["iron_mg"]) if chosen is not None else 0,
                "suitable_for_diabetes": bool(chosen["suitable_for_diabetes"]) if chosen is not None else False,
            }

        plan["days"].append(meals)

    # Workouts
    workouts = {
        "loss": [
            "HIIT + Core (30–40 min)",
            "Brisk Walk/Cycling (45 min)",
            "Full Body Strength (40 min)",
            "Yoga + Mobility (30 min)",
            "Interval Running + Core (30 min)",
            "Bodyweight Strength (40 min)",
            "Light Walk + Stretch (20 min)",
        ],
        "muscle": [
            "Push Day: Chest/Shoulders/Triceps (60 min)",
            "Pull Day: Back/Biceps (60 min)",
            "Leg Day: Squats/Deadlifts (60 min)",
            "Core + Mobility (30 min)",
            "Upper Body Strength (50 min)",
            "Lower Body Strength (50 min)",
            "Active Rest + Stretch (20 min)",
        ],
        "gain": [
            "Heavy Full Body Strength (50 min)",
            "Moderate Full Body Strength (45 min)",
            "Core + Yoga (30 min)",
            "Upper Body Hypertrophy (50 min)",
            "Lower Body Hypertrophy (50 min)",
            "Light Cardio (20 min)",
            "Rest Day + Stretch (20 min)",
        ],
    }

    return {"plan": plan, "workout": workouts.get(user["goal"], workouts["loss"])}

# ---------------------------
# Endpoints
# ---------------------------
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "data_loaded": df_global is not None,
        "model_loaded": model is not None
    }

@app.post("/generate_plan")
def generate_plan(user_raw: UserInput):
    raw = user_raw.model_dump()
    user = clean_user_input(raw)
    logger.info("User cleaned: %s", user)

    try:
        return build_week_plan(user)
    except Exception as e:
        logger.exception("Plan build error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------
# Render Local Run
# ---------------------------
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))

