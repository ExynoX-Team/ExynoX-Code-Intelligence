/**
 * Comprehensive Benchmark Dataset for General-Purpose Deterministic Intelligence Engine
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * 110 Diverse Natural Language Repository Queries across 11 Archetypes.
 * Designed to test generalization across repositories without any hardcoding.
 */

export interface BenchmarkQueryItem {
  id: string;
  query: string;
  category: 
    | 'architecture'
    | 'definition'
    | 'usage'
    | 'count'
    | 'call_chain'
    | 'asset'
    | 'documentation'
    | 'workflow'
    | 'caller_callee'
    | 'negation'
    | 'ambiguity';
  expectedIntent: string;
  expectedTarget: string;
  expectedEvidenceFiles: string[];
  expectedSymbols?: string[];
  expectedCount?: number;
  expectAmbiguous?: boolean;
  expectNegative?: boolean;
  repositoryId: string;
}

export const COMPREHENSIVE_DETERMINISTIC_BENCHMARK: BenchmarkQueryItem[] = [
  // =========================================================================
  // 1. ARCHITECTURE & COMPONENT LOCATION (10 Queries)
  // =========================================================================
  {
    id: 'arch_01',
    query: 'Where is telemetry data loaded?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'telemetry',
    expectedEvidenceFiles: ['data/loader.py'],
    expectedSymbols: ['load_dataset'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_02',
    query: 'Where is the data preprocessing implemented?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'data preprocessing',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['clean_telemetry_records'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_03',
    query: 'Where is user authentication located?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'user authentication',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['authenticate_user'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_04',
    query: 'Which file contains the tire degradation model?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'tire degradation',
    expectedEvidenceFiles: ['models/degradation.py'],
    expectedSymbols: ['calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_05',
    query: 'Where is the main application entrypoint?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'application',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_06',
    query: 'Where is the race prediction pipeline defined?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'race prediction pipeline',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_07',
    query: 'Where are driver domain models located?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'driver',
    expectedEvidenceFiles: ['models/driver.py'],
    expectedSymbols: ['Driver'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_08',
    query: 'Which file contains the configuration settings?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'configuration',
    expectedEvidenceFiles: ['config/settings.yaml'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_09',
    query: 'Where is the lap time predictor class defined?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'lap time predictor',
    expectedEvidenceFiles: ['models/predictor.py'],
    expectedSymbols: ['LapTimePredictor'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'arch_10',
    query: 'Where is the telemetry cleaning logic?',
    category: 'architecture',
    expectedIntent: 'location_search',
    expectedTarget: 'telemetry cleaning',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['clean_telemetry_records'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 2. SYMBOL & FUNCTION DEFINITIONS (12 Queries)
  // =========================================================================
  {
    id: 'def_01',
    query: 'Where is calculate_lap_time_degradation defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['models/degradation.py'],
    expectedSymbols: ['calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_02',
    query: 'Where is authenticate_user defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'authenticate_user',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['authenticate_user'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_03',
    query: 'Find definition of LapTimePredictor',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'LapTimePredictor',
    expectedEvidenceFiles: ['models/predictor.py'],
    expectedSymbols: ['LapTimePredictor'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_04',
    query: 'Where is load_dataset defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'load_dataset',
    expectedEvidenceFiles: ['data/loader.py'],
    expectedSymbols: ['load_dataset'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_05',
    query: 'Where is clean_telemetry_records implemented?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'clean_telemetry_records',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['clean_telemetry_records'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_06',
    query: 'Find function run_race_prediction_pipeline',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'run_race_prediction_pipeline',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_07',
    query: 'Where is get_driver_by_id defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'get_driver_by_id',
    expectedEvidenceFiles: ['models/driver.py'],
    expectedSymbols: ['get_driver_by_id'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_08',
    query: 'Where is validate_session_token defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'validate_session_token',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['validate_session_token'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_09',
    query: 'Where is normalize_lap_times defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'normalize_lap_times',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['normalize_lap_times'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_10',
    query: 'Find method evaluate_stint_strategy',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'evaluate_stint_strategy',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['evaluate_stint_strategy'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_11',
    query: 'Where is run_prediction_cli defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'run_prediction_cli',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['run_prediction_cli'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'def_12',
    query: 'Where is UserCredentials defined?',
    category: 'definition',
    expectedIntent: 'location_search',
    expectedTarget: 'UserCredentials',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['UserCredentials'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 3. USAGE & CALL SITES (12 Queries)
  // =========================================================================
  {
    id: 'use_01',
    query: 'Where is the prediction model used?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'prediction model',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline', 'predict'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_02',
    query: 'Where is calculate_lap_time_degradation called?',
    category: 'usage',
    expectedIntent: 'caller_callee',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_03',
    query: 'Where is load_dataset used in the project?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'load_dataset',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_04',
    query: 'Where is clean_telemetry_records invoked?',
    category: 'usage',
    expectedIntent: 'caller_callee',
    expectedTarget: 'clean_telemetry_records',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_05',
    query: 'Where is run_race_prediction_pipeline called?',
    category: 'usage',
    expectedIntent: 'caller_callee',
    expectedTarget: 'run_race_prediction_pipeline',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['run_prediction_cli'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_06',
    query: 'Where is get_driver_by_id used?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'get_driver_by_id',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['run_prediction_cli'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_07',
    query: 'Where is LapTimePredictor instantiated?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'LapTimePredictor',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_08',
    query: 'Where is tire compound used for degradation?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'compound',
    expectedEvidenceFiles: ['models/degradation.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_09',
    query: 'Where are F1_DRIVERS referenced?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'F1_DRIVERS',
    expectedEvidenceFiles: ['main.py', 'models/driver.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_10',
    query: 'Where is authenticate_user called in the code?',
    category: 'usage',
    expectedIntent: 'caller_callee',
    expectedTarget: 'authenticate_user',
    expectedEvidenceFiles: ['auth/login.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_11',
    query: 'Where is validate_session_token called?',
    category: 'usage',
    expectedIntent: 'caller_callee',
    expectedTarget: 'validate_session_token',
    expectedEvidenceFiles: ['auth/login.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'use_12',
    query: 'Where is the settings configuration read?',
    category: 'usage',
    expectedIntent: 'usage_reference',
    expectedTarget: 'settings',
    expectedEvidenceFiles: ['config/settings.yaml'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 4. COUNT & QUANTITY QUERIES (10 Queries)
  // =========================================================================
  {
    id: 'cnt_01',
    query: 'How many classes are defined in the repository?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'classes',
    expectedEvidenceFiles: ['models/driver.py', 'models/predictor.py', 'auth/login.py'],
    expectedCount: 3,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_02',
    query: 'How many Python files are in the repository?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'python files',
    expectedEvidenceFiles: ['main.py'],
    expectedCount: 6,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_03',
    query: 'Count the total number of files in the project',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'files',
    expectedEvidenceFiles: ['main.py'],
    expectedCount: 10,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_04',
    query: 'How many functions are in auth/login.py?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'functions',
    expectedEvidenceFiles: ['auth/login.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_05',
    query: 'How many functions are defined in data/preprocessing.py?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'functions',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedCount: 3,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_06',
    query: 'How many models files exist in the models directory?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'files',
    expectedEvidenceFiles: ['models/predictor.py', 'models/degradation.py', 'models/driver.py'],
    expectedCount: 3,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_07',
    query: 'Count how many functions are in data/loader.py',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'functions',
    expectedEvidenceFiles: ['data/loader.py'],
    expectedCount: 2,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_08',
    query: 'How many methods does LapTimePredictor have?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'methods',
    expectedEvidenceFiles: ['models/predictor.py'],
    expectedCount: 3,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_09',
    query: 'How many configuration files are present?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'files',
    expectedEvidenceFiles: ['config/settings.yaml'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'cnt_10',
    query: 'How many functions are in main.py?',
    category: 'count',
    expectedIntent: 'count_quantity',
    expectedTarget: 'functions',
    expectedEvidenceFiles: ['main.py'],
    expectedCount: 2,
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 5. CALL CHAINS & MULTI-HOP FLOWS (10 Queries)
  // =========================================================================
  {
    id: 'chain_01',
    query: 'Does run_prediction_cli call LapTimePredictor?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'LapTimePredictor',
    expectedEvidenceFiles: ['main.py', 'pipeline/predict.py'],
    expectedSymbols: ['run_prediction_cli', 'run_race_prediction_pipeline', 'LapTimePredictor'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_02',
    query: 'Does initialize_predictor_app call load_dataset?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'load_dataset',
    expectedEvidenceFiles: ['main.py', 'data/loader.py'],
    expectedSymbols: ['initialize_predictor_app', 'load_dataset'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_03',
    query: 'Trace the call path from run_prediction_cli to calculate_lap_time_degradation',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['main.py', 'pipeline/predict.py', 'models/degradation.py'],
    expectedSymbols: ['run_prediction_cli', 'run_race_prediction_pipeline', 'calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_04',
    query: 'Does run_race_prediction_pipeline call calculate_lap_time_degradation?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['pipeline/predict.py', 'models/degradation.py'],
    expectedSymbols: ['run_race_prediction_pipeline', 'calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_05',
    query: 'Does initialize_predictor_app call clean_telemetry_records?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'clean_telemetry_records',
    expectedEvidenceFiles: ['main.py', 'data/preprocessing.py'],
    expectedSymbols: ['initialize_predictor_app', 'clean_telemetry_records'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_06',
    query: 'Does run_prediction_cli call get_driver_by_id?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'get_driver_by_id',
    expectedEvidenceFiles: ['main.py', 'models/driver.py'],
    expectedSymbols: ['run_prediction_cli', 'get_driver_by_id'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_07',
    query: 'Does run_race_prediction_pipeline call LapTimePredictor?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'LapTimePredictor',
    expectedEvidenceFiles: ['pipeline/predict.py', 'models/predictor.py'],
    expectedSymbols: ['run_race_prediction_pipeline', 'LapTimePredictor'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_08',
    query: 'Does evaluate_stint_strategy call calculate_lap_time_degradation?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['pipeline/predict.py', 'models/degradation.py'],
    expectedSymbols: ['evaluate_stint_strategy', 'calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_09',
    query: 'Does login_user call authenticate_user?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'authenticate_user',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['login_user', 'authenticate_user'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'chain_10',
    query: 'Does authenticate_user call validate_session_token?',
    category: 'call_chain',
    expectedIntent: 'relationship_data_flow',
    expectedTarget: 'validate_session_token',
    expectedEvidenceFiles: ['auth/login.py'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 6. ASSET & RESOURCE DISCOVERY (10 Queries)
  // =========================================================================
  {
    id: 'asset_01',
    query: 'Where is the logo located?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'logo',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_02',
    query: 'Where is the brand logo file?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'brand logo',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_03',
    query: 'Where is the sample telemetry dataset stored?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'dataset',
    expectedEvidenceFiles: ['data/f1_telemetry_2024.csv'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_04',
    query: 'Where is the CSV data file located?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'CSV data file',
    expectedEvidenceFiles: ['data/f1_telemetry_2024.csv'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_05',
    query: 'Where are the images stored?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'images',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_06',
    query: 'Where is f1_logo.png?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'f1_logo.png',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_07',
    query: 'Where is the telemetry CSV located?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'telemetry CSV',
    expectedEvidenceFiles: ['data/f1_telemetry_2024.csv'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_08',
    query: 'Where is the YAML settings file stored?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'settings',
    expectedEvidenceFiles: ['config/settings.yaml'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_09',
    query: 'Where is the application icon or logo?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'logo',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'asset_10',
    query: 'Where are project static assets kept?',
    category: 'asset',
    expectedIntent: 'asset_resource',
    expectedTarget: 'static assets',
    expectedEvidenceFiles: ['assets/f1_logo.png'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 7. DOCUMENTATION & SETUP (10 Queries)
  // =========================================================================
  {
    id: 'doc_01',
    query: 'How do I install the dependencies for this project?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'install',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_02',
    query: 'Where is the setup guide in the documentation?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'setup guide',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_03',
    query: 'What are the quick start instructions?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'quick start',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_04',
    query: 'Where is the README file?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'README',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_05',
    query: 'How to run the application CLI according to docs?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'run',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_06',
    query: 'What does the project documentation say about the dataset?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'dataset',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_07',
    query: 'Where is the installation documentation?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'installation',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_08',
    query: 'What dependencies does the project need?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'dependencies',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_09',
    query: 'Where is project usage documented?',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'usage',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'doc_10',
    query: 'Show the project overview documentation',
    category: 'documentation',
    expectedIntent: 'documentation',
    expectedTarget: 'overview',
    expectedEvidenceFiles: ['README.md'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 8. BEHAVIORAL & WORKFLOW LOGIC (10 Queries)
  // =========================================================================
  {
    id: 'wf_01',
    query: 'How does user login work in this application?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'login',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['login_user', 'authenticate_user'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_02',
    query: 'How does authentication work step by step?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'authentication',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['authenticate_user', 'validate_session_token'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_03',
    query: 'How does the prediction pipeline execute?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'prediction pipeline',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_04',
    query: 'How does stint strategy evaluation work?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'stint strategy',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['evaluate_stint_strategy'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_05',
    query: 'How does telemetry data loading work?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'telemetry data loading',
    expectedEvidenceFiles: ['data/loader.py'],
    expectedSymbols: ['load_dataset'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_06',
    query: 'How is tire degradation calculated?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'tire degradation',
    expectedEvidenceFiles: ['models/degradation.py'],
    expectedSymbols: ['calculate_lap_time_degradation'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_07',
    query: 'How are telemetry outlier laps filtered?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'outlier laps',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['filter_outlier_laps'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_08',
    query: 'How does the app initialization workflow operate?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'initialization',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_09',
    query: 'How does token validation work?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'token validation',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['validate_session_token'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'wf_10',
    query: 'How does lap time normalization work?',
    category: 'workflow',
    expectedIntent: 'behavior_workflow',
    expectedTarget: 'normalization',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    expectedSymbols: ['normalize_lap_times'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 9. CALLER / CALLEE INSPECTION (10 Queries)
  // =========================================================================
  {
    id: 'call_01',
    query: 'Who calls calculate_lap_time_degradation?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'calculate_lap_time_degradation',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_02',
    query: 'What functions call load_dataset?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'load_dataset',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_03',
    query: 'Who calls run_race_prediction_pipeline?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'run_race_prediction_pipeline',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['run_prediction_cli'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_04',
    query: 'What calls get_driver_by_id?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'get_driver_by_id',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['run_prediction_cli'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_05',
    query: 'Who calls clean_telemetry_records?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'clean_telemetry_records',
    expectedEvidenceFiles: ['main.py'],
    expectedSymbols: ['initialize_predictor_app'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_06',
    query: 'Who calls validate_session_token?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'validate_session_token',
    expectedEvidenceFiles: ['auth/login.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_07',
    query: 'Who calls authenticate_user?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'authenticate_user',
    expectedEvidenceFiles: ['auth/login.py'],
    expectedSymbols: ['login_user'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_08',
    query: 'What calls initialize_predictor_app?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'initialize_predictor_app',
    expectedEvidenceFiles: ['main.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_09',
    query: 'What functions call predict on LapTimePredictor?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'predict',
    expectedEvidenceFiles: ['pipeline/predict.py'],
    expectedSymbols: ['run_race_prediction_pipeline'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'call_10',
    query: 'What calls filter_outlier_laps?',
    category: 'caller_callee',
    expectedIntent: 'caller_callee',
    expectedTarget: 'filter_outlier_laps',
    expectedEvidenceFiles: ['data/preprocessing.py'],
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 10. NEGATION & NON-EXISTENT ENTITIES (8 Queries)
  // =========================================================================
  {
    id: 'neg_01',
    query: 'Where is Dockerfile configured?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'Dockerfile',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_02',
    query: 'Where is Redis cache configured?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'Redis cache',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_03',
    query: 'Where is the PostgreSQL database connection string?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'PostgreSQL database',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_04',
    query: 'Where is the GraphQL schema defined?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'GraphQL schema',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_05',
    query: 'Where is the Kubernetes deployment manifest?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'Kubernetes deployment',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_06',
    query: 'Where is Stripe payment processing implemented?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'Stripe payment',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_07',
    query: 'Where is the WebSocket server handler?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'WebSocket server',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'neg_08',
    query: 'Where is Celery task queue configured?',
    category: 'negation',
    expectedIntent: 'location_search',
    expectedTarget: 'Celery task queue',
    expectedEvidenceFiles: [],
    expectNegative: true,
    repositoryId: 'f1-telemetry'
  },

  // =========================================================================
  // 11. AMBIGUITY HANDLING & RESOLUTION (8 Queries)
  // =========================================================================
  {
    id: 'amb_01',
    query: 'How many drivers are there?',
    category: 'ambiguity',
    expectedIntent: 'count_quantity',
    expectedTarget: 'drivers',
    expectedEvidenceFiles: ['models/driver.py'],
    expectAmbiguous: true,
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_02',
    query: 'Where is driver defined?',
    category: 'ambiguity',
    expectedIntent: 'location_search',
    expectedTarget: 'driver',
    expectedEvidenceFiles: ['models/driver.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_03',
    query: 'How many predictor items exist?',
    category: 'ambiguity',
    expectedIntent: 'count_quantity',
    expectedTarget: 'predictor',
    expectedEvidenceFiles: ['models/predictor.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_04',
    query: 'Where are drivers located in the code?',
    category: 'ambiguity',
    expectedIntent: 'location_search',
    expectedTarget: 'drivers',
    expectedEvidenceFiles: ['models/driver.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_05',
    query: 'Count the driver entities',
    category: 'ambiguity',
    expectedIntent: 'count_quantity',
    expectedTarget: 'driver entities',
    expectedEvidenceFiles: ['models/driver.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_06',
    query: 'Where is the driver roster defined?',
    category: 'ambiguity',
    expectedIntent: 'location_search',
    expectedTarget: 'driver roster',
    expectedEvidenceFiles: ['models/driver.py'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_07',
    query: 'Where is the Driver class?',
    category: 'ambiguity',
    expectedIntent: 'location_search',
    expectedTarget: 'Driver class',
    expectedEvidenceFiles: ['models/driver.py'],
    expectedSymbols: ['Driver'],
    repositoryId: 'f1-telemetry'
  },
  {
    id: 'amb_08',
    query: 'Where is the F1_DRIVERS list?',
    category: 'ambiguity',
    expectedIntent: 'location_search',
    expectedTarget: 'F1_DRIVERS',
    expectedEvidenceFiles: ['models/driver.py'],
    repositoryId: 'f1-telemetry'
  }
];
