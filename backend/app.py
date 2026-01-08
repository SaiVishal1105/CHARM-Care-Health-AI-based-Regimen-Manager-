import os
import logging
from typing import Optional, Union, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import torch
import numpy as np
import uvicorn

# local modules
from data_processing import load_and_process
from model import RecipeRanker

# -----------------------
# Logging
# -----------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diet_recommender")

# -----------------------
# FastAPI App
# -----------------------
app = FastAPI(title="Diet Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Allow all for now
        "https://charm-care-health-ai-based-regimen.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Load data & model
# -------------------------------------------------
DATA_PATH = "/mnt/data/healthy_recipes_augmented.xlsx"
MODEL_PATH = "model.pt"
df_global, enc_global, scaler_global, num_cols = load_and_process()

recipe_features = df_global[
    [c for c in df_global.columns if c.startswith('std_')]
].values.astype('float32')

# Input vector dims
user_dim = 3 + 3 + 4 + 3
recipe_dim = recipe_features.shape[1]

model = RecipeRanker(user_dim, recipe_dim)

try:
    model.load_state_dict(torch.load('model.pt', map_location='cpu'))
    model.eval()
    print("Model loaded successfully.")
except Exception as e:
    print("Model load warning:", e)


# -----------------------
# Pydantic Input
# -----------------------
class UserInput(BaseModel):
    age: Optional[Union[int, float, str]] = 23
    height_cm: Optional[Union[int, float, str]] = 170
    weight_kg: Optional[Union[int, float, str]] = 70
    activity_level: Optional[Union[int, float, str]] = 1.55
    goal: Optional[str] = "loss"
    deficiency: Optional[str] = "none"
    chronic: Optional[str] = "none"
    cuisine_pref: Optional[str] = "none"
    food_type: Optional[str] = "none"
    calorie_target: Optional[Union[int, float, str]] = None

# -----------------------
# Startup: Load Data + Model
# -----------------------
@app.on_event("startup")
def startup():
    global df_global, recipe_features, model

    # Load data
    try:
        logger.info("Loading data...")
        df_global, enc_global, scaler_global, num_cols = load_and_process()
        feat_cols = [c for c in df_global.columns if c.startswith("std_")]
        recipe_features = df_global[feat_cols].values.astype("float32")
        logger.info("Data loaded: %d recipes, %d features", len(df_global), recipe_features.shape[1])
    except Exception as e:
        logger.exception("Data load failed: %s", e)
        df_global = None
        recipe_features = None

    # Model
    try:
        recipe_dim = recipe_features.shape[1]
        model = RecipeRanker(user_dim, recipe_dim)
        if os.path.exists(MODEL_PATH):
            logger.info("Loading model from %s", MODEL_PATH)
            model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
            model.eval()
            logger.info("Model loaded successfully")
        else:
            logger.error("Model file missing: %s", MODEL_PATH)
            model = None
    except Exception as e:
        logger.exception("Model init failed: %s", e)
        model = None

# -----------------------
# Build Correct User Vector (13 dims)
# -----------------------
def make_user_vector(user: Dict[str, Any]) -> np.ndarray:
    age_norm = user["age"] / 100.0
    bmi = user["weight_kg"] / ((user["height_cm"] / 100.0) ** 2 + 1e-6)
    bmi_norm = bmi / 50.0
    act_norm = user["activity_level"] / 2.0

    goals = ["loss", "gain", "muscle"]
    defs_ = ["none", "iron", "vitd", "protein"]
    chs = ["none", "diabetes", "hypertension"]

    vec = [
        age_norm,
        bmi_norm,
        act_norm,
        *[1.0 if user["goal"] == g else 0.0 for g in goals],
        *[1.0 if user["deficiency"] == d else 0.0 for d in defs_],
        *[1.0 if user["chronic"] == c else 0.0 for c in chs],
    ]

    vec = np.asarray(vec, dtype="float32")
    if vec.shape[0] != user_dim:
        raise RuntimeError(f"User vector dim {vec.shape[0]} != expected {user_dim}")

    return vec

# -----------------------
# Scoring
# -----------------------
def score_recipes(user):
    bmi = user['weight_kg'] / ((user['height_cm'] / 100) ** 2 + 1e-6)

    user_vec = [
        user['age'] / 100.0,
        bmi / 50.0,
        user['activity_level'] / 2.0
    ]

    goals = ['loss', 'gain', 'muscle']
    defs_ = ['none', 'iron', 'vitd', 'protein']
    chs = ['none', 'diabetes', 'hypertension']

    user_vec += [1.0 if user['goal'] == g else 0.0 for g in goals]
    user_vec += [1.0 if user['deficiency'] == d else 0.0 for d in defs_]
    user_vec += [1.0 if user['chronic'] == c else 0.0 for c in chs]

    uv = torch.tensor(user_vec, dtype=torch.float32).unsqueeze(0).repeat(len(recipe_features), 1)
    rx = torch.tensor(recipe_features, dtype=torch.float32)

    with torch.no_grad():
        try:
            scores = model(uv, rx).numpy()
        except:
            scores = np.random.rand(len(rx))

    return scores


# -------------------------------------------------
# WEEK PLAN GENERATOR
# -------------------------------------------------
def build_week_plan(user_input):
    user = dict(user_input)
    scores = score_recipes(user)

    df = df_global.copy()
    safe_assign_scores(df, scores)

    # Filter by veg / non-veg / vegan
    if user['food_type'] and user['food_type'].lower() != "none":
        df = df[df['food_type'].str.lower() == user['food_type'].lower()]

    # Cuisine scoring
    if user["cuisine_pref"]:
        df.loc[df["cuisine"] != user["cuisine_pref"], "score"] *= 0.8

    plan = {"days": []}
    used = set()

    for _ in range(7):
        day_meals = {}
        for meal in ["Breakfast", "Lunch", "Dinner"]:
            sub = df[df["meal_type"].str.lower() == meal.lower()].sort_values("score", ascending=False)
            chosen = None

            for _, row in sub.iterrows():
                rn = row["recipe_name"]
                if rn not in used:
                    chosen = row
                    break
            if chosen is None and not sub.empty:
                chosen = sub.iloc[0]

            if chosen is None:
                chosen = candidates.iloc[0]

            day_meals[meal] = {
                "recipe_name": chosen["recipe_name"],
                "ingredients": chosen.get("ingredients", ""),
                "instructions": chosen.get("instructions", ""),
                "preparation": chosen.get("preparation", ""),
                "calories": float(chosen.get("calories", 0)),
                "protein_g": float(chosen.get("protein_g", 0)),
                "carbs_g": float(chosen.get("carbs_g", 0)),
                "fat_g": float(chosen.get("fat_g", 0)),
                "iron_mg": float(chosen.get("iron_mg", 0)),
                "suitable_for_diabetes": bool(chosen.get("suitable_for_diabetes", False)),
            }

            used.add(chosen["recipe_name"])
            if len(used) > 12:
                used = set(list(used)[-12:])

        plan["days"].append(day_meals)

    # -------------------------------------------------
    # UNIQUE WORKOUT PLAN PER DAY
    # -------------------------------------------------
    workouts_loss = [
        "HIIT + Core (30–40 min)",
        "Brisk Walk/Cycling (45 min)",
        "Full Body Strength (40 min)",
        "Yoga + Mobility (30 min)",
        "Interval Running + Core (30 min)",
        "Bodyweight Strength (40 min)",
        "Light Walk + Stretch (20 min)"
    ]

    workouts_muscle = [
        "Push Day: Chest/Shoulders/Triceps (60 min)",
        "Pull Day: Back/Biceps (60 min)",
        "Leg Day: Squats/Deadlifts (60 min)",
        "Core + Mobility (30 min)",
        "Upper Body Strength (50 min)",
        "Lower Body Strength (50 min)",
        "Active Rest + Stretching (20 min)"
    ]

    workouts_gain = [
        "Heavy Full Body Strength (50 min)",
        "Cardio 20 min + Shoulders (40 min)",
        "Moderate Full Body Strength (45 min)",
        "Core + Yoga (30 min)",
        "Upper Body Hypertrophy (50 min)",
        "Lower Body Hypertrophy (50 min)",
        "Rest Day + Stretch (20 min)"
    ]

    if user["goal"] == "muscle":
        workout = workouts_muscle
    elif user["goal"] == "gain":
        workout = workouts_gain
    else:
        workout = workouts_loss

    return {"plan": plan, "workout": workout}


# -----------------------
# Endpoints
# -----------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "data_loaded": df_global is not None,
        "model_loaded": model is not None,
        "recipes": len(df_global) if df_global is not None else 0,
        "recipe_dim": recipe_features.shape[1] if recipe_features is not None else 0,
    }

@app.post("/generate_plan")
def generate_plan(inp: UserInput):
    return build_week_plan(inp.dict())


# -----------------------
# Local Run
# -----------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

