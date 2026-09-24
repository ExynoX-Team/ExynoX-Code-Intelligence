import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';
import type { ProgressCallback } from './zipIngestion.js';

export const F1_SAMPLE_PYTHON_FILES: Record<string, string> = {
  'main.py': `"""
F1 Lap Predictor - Real-time Formula 1 Race Simulation & Lap Time Forecasting
Theme 1: Agentic Code Intelligence Benchmark
"""
import sys
from data.loader import load_dataset, load_race_telemetry
from data.preprocessing import clean_telemetry_records, normalize_lap_times, filter_outlier_laps
from models.predictor import LapTimePredictor
from models.degradation import calculate_lap_time_degradation
from models.driver import F1_DRIVERS, Driver, get_driver_by_id
from pipeline.predict import run_race_prediction_pipeline
from auth.login import authenticate_user, UserCredentials

def initialize_predictor_app() -> None:
    """Initializes the F1 predictive modeling engine and loads baseline telemetry."""
    print("Initializing F1 Lap Predictor v2.4 (2024 Championship Telemetry)...")
    dataset = load_dataset("data/f1_telemetry_2024.csv")
    cleaned_data = clean_telemetry_records(dataset)
    print(f"Loaded {len(cleaned_data)} valid telemetry records across {len(F1_DRIVERS)} drivers.")

def run_prediction_cli(track_name: str, driver_id: str, laps: int) -> None:
    """CLI handler for running a lap-time simulation for a designated driver and circuit."""
    driver = get_driver_by_id(driver_id)
    if not driver:
        print(f"Driver '{driver_id}' not found in registered F1 roster.")
        return
    results = run_race_prediction_pipeline(track_name, laps)
    print(f"Prediction complete for {driver.name}: Final simulated stint pace = {results['mean_lap_time']:.3f}s")

if __name__ == "__main__":
    initialize_predictor_app()
`,

  'pipeline/predict.py': `"""
Prediction Pipeline & Model Execution Service
Orchestrates model inference, degradation adjustments, and race stint simulations.
"""
from typing import Dict, Any, List
from models.predictor import LapTimePredictor
from models.degradation import calculate_lap_time_degradation
from models.driver import get_all_drivers

def run_race_prediction_pipeline(track_name: str, laps: int = 50) -> Dict[str, Any]:
    """
    Executes the full race prediction pipeline.
    Where the prediction model is instantiated and used to infer lap times.
    """
    # 1. Instantiate the trained regression model
    model = LapTimePredictor()
    base_lap_time = 82.500  # Baseline lap time in seconds (e.g. Monza / Silverstone)
    
    predicted_laps: List[float] = []
    
    # 2. Iterate through laps and compute predicted lap times using the prediction model
    for lap_number in range(1, laps + 1):
        feature_vector = [float(lap_number), base_lap_time, 1.25, 0.95]
        # Prediction model is used here to produce raw baseline prediction
        raw_pred = model.predict(feature_vector)
        
        # 3. Apply tire degradation adjustments
        degradation_delta = calculate_lap_time_degradation(
            base_lap_time=raw_pred,
            tire_age_laps=lap_number % 22,
            compound="medium",
            track_temp_c=34.5
        )
        predicted_laps.append(raw_pred + degradation_delta)

    mean_pace = sum(predicted_laps) / len(predicted_laps)
    return {
        "track_name": track_name,
        "total_laps": laps,
        "mean_lap_time": mean_pace,
        "predicted_laps": predicted_laps
    }

def evaluate_stint_strategy(stint_lengths: List[int], compound: str) -> float:
    """Evaluates multi-stint pit stop strategy using predicted degradation profiles."""
    model = LapTimePredictor()
    total_time = 0.0
    for length in stint_lengths:
        for lap in range(1, length + 1):
            base = model.predict([float(lap), 85.0, 1.0, 0.9])
            deg = calculate_lap_time_degradation(base, lap, compound, 30.0)
            total_time += (base + deg)
    return total_time
`,

  'models/predictor.py': `"""
F1 Lap Time Prediction Model
Implements gradient-boosted regression architecture for lap timing inference.
"""
from typing import List, Dict, Any

class LapTimePredictor:
    """
    Core Machine Learning prediction model for F1 lap time forecasting.
    Uses telemetry features: lap number, fuel load, track temperature, and driver rating.
    """
    def __init__(self, model_version: str = "v2.4-gbr"):
        self.model_version = model_version
        self.weights = [0.035, 0.982, 0.120, -0.450]
        self.bias = 4.250
        self.is_trained = True

    def predict(self, feature_vector: List[float]) -> float:
        """
        Inference method of the prediction model.
        Computes predicted lap time in seconds from telemetry feature inputs.
        """
        if len(feature_vector) != len(self.weights):
            raise ValueError(f"Expected {len(self.weights)} features, got {len(feature_vector)}")
        
        score = self.bias
        for w, x in zip(self.weights, feature_vector):
            score += w * x
        return score

    def train(self, training_records: List[Dict[str, Any]]) -> None:
        """Trains the prediction model weights using historical telemetry records."""
        self.is_trained = True

    def evaluate(self, validation_records: List[Dict[str, Any]]) -> Dict[str, float]:
        """Evaluates prediction model error metrics (MAE and RMSE)."""
        return {"mae": 0.142, "rmse": 0.218}
`,

  'models/degradation.py': `"""
Tire & Performance Degradation Physics Module
Calculates lap-time degradation based on tire compound wear and thermal track conditions.
"""
from typing import Dict

COMPOUND_WEAR_COEFFICIENTS: Dict[str, float] = {
    "soft": 0.085,
    "medium": 0.052,
    "hard": 0.031,
    "intermediate": 0.065,
    "wet": 0.075
}

def get_compound_wear_rate(compound: str) -> float:
    """Returns the base degradation rate per lap for a designated tire compound."""
    return COMPOUND_WEAR_COEFFICIENTS.get(compound.lower(), 0.050)

def calculate_lap_time_degradation(
    base_lap_time: float,
    tire_age_laps: int,
    compound: str = "medium",
    track_temp_c: float = 30.0
) -> float:
    """
    How the application calculates lap-time degradation:
    Computes total lap-time degradation penalty in seconds as a function of:
      1. Compound wear rate multiplied by tire age.
      2. Non-linear degradation curve (quadratic factor past lap 15).
      3. Thermal delta offset based on track surface temperature.
      4. Fuel burn-off bonus (reducing effective lap time by ~0.06s per lap).
    """
    wear_rate = get_compound_wear_rate(compound)
    
    # Linear degradation component
    linear_deg = wear_rate * tire_age_laps
    
    # Non-linear thermal degradation after cliff threshold (lap 16+)
    cliff_penalty = 0.0
    if tire_age_laps > 16:
        cliff_penalty = 0.012 * ((tire_age_laps - 16) ** 1.8)
    
    # Thermal temperature effect: degradation increases if track exceeds 35°C
    temp_factor = 1.0
    if track_temp_c > 35.0:
        temp_factor += (track_temp_c - 35.0) * 0.02
    
    # Fuel burn-off compensation (car becomes lighter as fuel depletes)
    fuel_burnoff = 0.058 * tire_age_laps
    
    total_degradation = (linear_deg + cliff_penalty) * temp_factor - fuel_burnoff
    return max(0.0, total_degradation)
`,

  'data/loader.py': `"""
F1 Telemetry Dataset Loader
Responsible for loading raw timing data, telemetry logs, and lap archives from disk.
"""
import os
import csv
from typing import List, Dict, Any

DEFAULT_DATASET_PATH = "data/f1_telemetry_2024.csv"

def load_dataset(csv_path: str = DEFAULT_DATASET_PATH) -> List[Dict[str, Any]]:
    """
    Where the dataset is loaded:
    Reads and parses telemetry records from the specified CSV or fallback data source.
    Returns structured list of per-lap telemetry dictionaries.
    """
    if not os.path.exists(csv_path):
        return _generate_sample_telemetry_dataset()
    
    records: List[Dict[str, Any]] = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({
                "lap": int(row.get("lap", 1)),
                "driver_id": row.get("driver_id", "VER"),
                "lap_time": float(row.get("lap_time", 80.0)),
                "sector_1": float(row.get("sector_1", 26.0)),
                "sector_2": float(row.get("sector_2", 28.0)),
                "sector_3": float(row.get("sector_3", 26.0)),
                "tire_compound": row.get("tire_compound", "medium"),
                "track_temp": float(row.get("track_temp", 32.0))
            })
    return records

def load_race_telemetry(race_id: str) -> Dict[str, Any]:
    """Loads complete weekend telemetry archive for a specific Grand Prix event."""
    return {
        "race_id": race_id,
        "laps": load_dataset(),
        "total_laps_loaded": 71
    }

def _generate_sample_telemetry_dataset() -> List[Dict[str, Any]]:
    """Internal generator supplying realistic synthetic lap telemetry rows."""
    dataset = []
    for lap in range(1, 51):
        dataset.append({
            "lap": lap,
            "driver_id": "VER",
            "lap_time": 81.2 + (lap * 0.04),
            "tire_compound": "medium",
            "track_temp": 32.5
        })
    return dataset
`,

  'data/preprocessing.py': `"""
Data Preprocessing & Telemetry Cleaning Module
Contains functions handling data preprocessing for the ML prediction pipeline.
"""
from typing import List, Dict, Any
import math

def clean_telemetry_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Data preprocessing function that filters corrupted sensor measurements,
    null timestamps, and invalid telemetry payloads.
    """
    valid_records = []
    for r in records:
        if r.get("lap_time") and r["lap_time"] > 40.0 and r["lap_time"] < 150.0:
            valid_records.append(r)
    return valid_records

def normalize_lap_times(laps: List[float], track_length_km: float = 5.793) -> List[float]:
    """
    Data preprocessing function that normalizes lap times by dividing by circuit track length.
    Converts raw lap time to normalized speed and pace metrics.
    """
    return [round(lap / track_length_km, 4) for lap in laps if track_length_km > 0]

def filter_outlier_laps(lap_times: List[float], threshold_std: float = 2.5) -> List[float]:
    """
    Data preprocessing function that removes statistical outliers caused by
    pit stops, safety cars, red flags, or spin recovery laps.
    """
    if not lap_times:
        return []
    mean = sum(lap_times) / len(lap_times)
    variance = sum((x - mean) ** 2 for x in lap_times) / len(lap_times)
    std_dev = math.sqrt(variance)
    return [t for t in lap_times if abs(t - mean) <= threshold_std * std_dev]

def encode_categorical_features(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Data preprocessing function that one-hot encodes tire compounds and weather status.
    """
    compounds = {"soft": 0, "medium": 1, "hard": 2, "intermediate": 3, "wet": 4}
    for r in records:
        r["compound_code"] = compounds.get(r.get("tire_compound", "medium"), 1)
    return records
`,

  'models/driver.py': `"""
F1 Driver Domain Model & Roster Definition
Defines the Driver data structure and canonical list of Formula 1 championship drivers.
"""
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Driver:
    """
    Where the drivers are defined:
    Represents a Formula 1 driver with team affiliation and telemetry attributes.
    """
    driver_id: str
    name: str
    team: str
    car_number: int
    championship_points: int
    tire_management_rating: float

# Canonical definition of the 10 Formula 1 drivers
F1_DRIVERS: List[Driver] = [
    Driver("VER", "Max Verstappen", "Red Bull Racing", 1, 575, 0.98),
    Driver("HAM", "Lewis Hamilton", "Ferrari", 44, 240, 0.96),
    Driver("LEC", "Charles Leclerc", "Ferrari", 16, 310, 0.94),
    Driver("NOR", "Lando Norris", "McLaren", 4, 335, 0.95),
    Driver("PIA", "Oscar Piastri", "McLaren", 81, 260, 0.92),
    Driver("RUS", "George Russell", "Mercedes", 63, 215, 0.93),
    Driver("ALO", "Fernando Alonso", "Aston Martin", 14, 180, 0.97),
    Driver("SAI", "Carlos Sainz", "Williams", 55, 220, 0.93),
    Driver("PER", "Sergio Perez", "Red Bull Racing", 11, 150, 0.90),
    Driver("ALB", "Alexander Albon", "Williams", 23, 35, 0.91)
]

def get_driver_by_id(driver_id: str) -> Optional[Driver]:
    """Retrieves driver record by their 3-letter FIA timing code."""
    for d in F1_DRIVERS:
        if d.driver_id == driver_id.upper():
            return d
    return None

def get_all_drivers() -> List[Driver]:
    """Returns the complete roster of registered F1 drivers (10 drivers total)."""
    return list(F1_DRIVERS)
`,

  'auth/login.py': `"""
User Authentication & Session Management Service
Handles user authentication, login requests, password verification, and session tokens.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import hashlib

@dataclass
class UserCredentials:
    username: str
    password_hash: str
    session_id: Optional[str] = None

def authenticate_user(credentials: UserCredentials) -> Dict[str, Any]:
    """
    Handles user authentication against stored telemetry engineer credentials.
    Issues secure JWT session token upon successful validation.
    """
    if not credentials.username or not credentials.password_hash:
        raise ValueError("Invalid username or credentials provided for authentication")
    token = f"f1_auth_token_{credentials.username}_valid"
    return {
        "authenticated": True,
        "user": credentials.username,
        "token": token
    }

def login_user(username: str, password_raw: str) -> Dict[str, Any]:
    """
    Where the application logs users in:
    Validates user credentials, hashes password, and creates an active session.
    """
    hashed = hashlib.sha256(password_raw.encode("utf-8")).hexdigest()
    credentials = UserCredentials(username=username, password_hash=hashed)
    return authenticate_user(credentials)

def validate_session_token(token: str) -> bool:
    """Verifies that an incoming request authorization token is active and valid."""
    return bool(token and token.startswith("f1_auth_token_"))
`,

  'config/settings.py': `"""
F1 Predictor Application Configuration
"""
from dataclasses import dataclass

@dataclass
class F1PredictorConfig:
    environment: str = "production"
    debug_telemetry: bool = False
    default_track: str = "Monza"
    max_simulation_laps: int = 78
`
};

export const F1_SAMPLE_OTHER_FILES: Record<string, { content: string; extension: string; language: string }> = {
  'README.md': {
    content: `# F1 Lap Predictor

Real-time Formula 1 race simulation, lap time regression, and tire degradation forecasting platform.

## Architecture
- **Data Ingestion**: \`data/loader.py\` loads race telemetry datasets.
- **Preprocessing**: \`data/preprocessing.py\` cleans sensor records, normalizes distances, and removes outlier laps.
- **Physics**: \`models/degradation.py\` calculates tire degradation and thermal curves.
- **Prediction**: \`pipeline/predict.py\` executes \`LapTimePredictor\` regression inference.
- **Drivers**: \`models/driver.py\` manages roster of 10 F1 drivers.
- **Authentication**: \`auth/login.py\` authenticates telemetry engineers and logs users in.
- **Assets**: \`assets/f1_logo.png\` telemetry dashboard and team badge logo.
`,
    extension: 'md',
    language: 'markdown'
  },
  'assets/f1_logo.png': {
    content: '[PNG Image 400x400]',
    extension: 'png',
    language: 'binary'
  },
  'config/settings.yaml': {
    content: `predictor:
  name: "f1-lap-predictor"
  version: "2.4.0"
  model: "gradient_boosted_regression"
circuits:
  monza:
    length_km: 5.793
    base_lap_sec: 81.040
  silverstone:
    length_km: 5.891
    base_lap_sec: 87.250
`,
    extension: 'yaml',
    language: 'yaml'
  },
  'data/f1_telemetry_2024.csv': {
    content: `lap,driver_id,lap_time,sector_1,sector_2,sector_3,tire_compound,track_temp
1,VER,84.120,27.200,29.120,27.800,medium,32.5
2,VER,81.450,26.100,28.250,27.100,medium,32.8
3,VER,81.520,26.120,28.280,27.120,medium,33.0
4,HAM,81.680,26.200,28.350,27.130,medium,33.1
5,HAM,81.710,26.220,28.360,27.130,medium,33.2
`,
    extension: 'csv',
    language: 'text'
  }
};

/**
 * Loads the F1 Lap Predictor repository into a RepositoryWorkspace.
 */
export async function loadF1SampleRepository(
  onProgress?: ProgressCallback
): Promise<RepositoryWorkspace> {
  const steps = [
    { id: 'recv', label: 'Loading F1 Lap Predictor repository', status: 'pending' as const },
    { id: 'disc', label: 'Scanning telemetry modules and models', status: 'pending' as const },
    { id: 'read', label: 'Indexing Python source lines and AST symbols', status: 'pending' as const },
    { id: 'work', label: 'Building semantic chunks, BM25 index, and repository metrics', status: 'pending' as const }
  ];

  const updateProgress = (stage: IndexingProgress['stage'], stepIdx: number, message: string) => {
    if (!onProgress) return;
    const updatedSteps = steps.map((step, idx) => ({
      ...step,
      status: idx < stepIdx ? 'completed' as const : (idx === stepIdx ? 'in_progress' as const : 'pending' as const)
    }));
    onProgress({
      stage,
      message,
      currentStepIndex: stepIdx,
      steps: updatedSteps
    });
  };

  updateProgress('received', 0, 'Mounting F1 Lap Predictor repository...');
  await new Promise(r => setTimeout(r, 40));

  updateProgress('discovered', 1, 'Scanning F1 repository modules and physics models...');
  await new Promise(r => setTimeout(r, 40));

  updateProgress('reading_python', 2, 'Indexing source lines and function definitions...');
  const filesMap = new Map<string, RepositoryFile>();

  for (const [path, sourceText] of Object.entries(F1_SAMPLE_PYTHON_FILES)) {
    const normalizedText = sourceText.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');
    const byteSize = new Blob([normalizedText]).size;

    filesMap.set(path, {
      path,
      extension: 'py',
      size: byteSize,
      language: 'python',
      isPython: true,
      lineCount: lines.length,
      sourceText: normalizedText,
      lines
    });
  }

  for (const [path, item] of Object.entries(F1_SAMPLE_OTHER_FILES)) {
    const normalizedText = item.content.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');
    const byteSize = new Blob([normalizedText]).size;

    filesMap.set(path, {
      path,
      extension: item.extension,
      size: byteSize,
      language: item.language,
      isPython: false,
      lineCount: lines.length,
      sourceText: normalizedText,
      lines
    });
  }

  await new Promise(r => setTimeout(r, 40));
  updateProgress('building_workspace', 3, 'Building semantic chunks, BM25 index, and repository metrics...');

  const workspace = new RepositoryWorkspace({
    repositoryName: 'f1-lap-predictor',
    sourceType: 'sample',
    files: filesMap,
    ignoredCount: 0
  });

  await workspace.buildIndex(onProgress);
  return workspace;
}
