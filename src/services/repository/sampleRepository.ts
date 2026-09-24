import type { RepositoryFile, IndexingProgress } from '../../types/index.js';
import { RepositoryWorkspace } from './repositoryWorkspace.js';
import type { ProgressCallback } from './zipIngestion.js';

const SAMPLE_PYTHON_FILES: Record<string, string> = {
  'main.py': `"""
Samsung PRISM Device Hub - Main Entrypoint
Agentic Code Intelligence Sample Python Repository
"""
import sys
from config.settings import DeviceHubConfig, get_database_url
from auth.login import authenticate_user, UserCredentials
from auth.middleware import AuthenticationMiddleware
from bluetooth.settings import BluetoothSettingsDeeplink, handle_bluetooth_deeplink
from services.audit import log_security_event

def initialize_device_hub() -> None:
    config = DeviceHubConfig(environment="production", debug=False)
    db_url = get_database_url()
    print(f"Initializing Samsung Device Hub connected to {db_url}")
    log_security_event("SYSTEM_INIT", user_id="system", metadata={"version": "3.0.1"})

def handle_incoming_deeplink(intent_uri: str) -> bool:
    """Processes incoming system deeplinks including Bluetooth settings"""
    if "settings/bluetooth" in intent_uri:
        return handle_bluetooth_deeplink(intent_uri)
    return False

if __name__ == "__main__":
    initialize_device_hub()
`,

  'auth/login.py': `"""
User Authentication Service
Handles credential validation, password verification, and JWT issuance.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
from utils.crypto import hash_password, verify_signature
from services.audit import log_security_event

@dataclass
class UserCredentials:
    username: str
    password_hash: str
    mfa_code: Optional[str] = None

def validate_token(token: str) -> bool:
    """
    Validates the cryptographic authenticity and expiration of an access token.
    Used by AuthenticationMiddleware before request dispatch.
    """
    if not token or len(token) < 16:
        return False
    return token.startswith("prism_sec_")

def authenticate_user(credentials: UserCredentials) -> Dict[str, Any]:
    """
    Authenticates a user against secure credentials and issues an active session token.
    """
    if not credentials.username or not credentials.password_hash:
        log_security_event("AUTH_FAILED", user_id=credentials.username, metadata={"reason": "empty_fields"})
        raise ValueError("Invalid user credentials provided")

    # In production, this validates against the hashed record
    token = issue_jwt(credentials.username, ["device:read", "device:write"])
    log_security_event("AUTH_SUCCESS", user_id=credentials.username)
    return {
        "user_id": credentials.username,
        "token": token,
        "status": "authenticated"
    }

def issue_jwt(user_id: str, scopes: list) -> str:
    """Generates an encrypted JWT token with specific scope permissions."""
    return f"prism_sec_{user_id}_{hash_password(user_id)[:8]}"
`,

  'auth/middleware.py': `"""
Request Authentication and Authorization Middleware
Enforces security pipeline validation before dispatching to handlers.
"""
from typing import Dict, Any, Optional
from auth.login import validate_token
from services.audit import log_security_event

class AuthenticationMiddleware:
    """
    Middleware pipeline intercepting incoming device and API requests.
    Enforces validate_token execution prior to process_request execution.
    """
    def __init__(self, app_handler):
        self.app_handler = app_handler

    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes an incoming request after verifying the bearer authorization header.
        Calls validate_token before process_request logic executes.
        """
        auth_header: Optional[str] = request.get("headers", {}).get("Authorization")
        if not auth_header:
            log_security_event("UNAUTHORIZED_ACCESS", user_id="anonymous", metadata={"path": request.get("path")})
            return {"status": 401, "error": "Missing Authorization header"}

        token = auth_header.replace("Bearer ", "").strip()
        
        # Security rule: validate_token must be evaluated before process_request continues
        if not validate_token(token):
            log_security_event("INVALID_TOKEN", user_id="unverified")
            return {"status": 403, "error": "Invalid or expired token"}

        return self.app_handler(request)

    def verify_permission(self, user_role: str, required_role: str) -> bool:
        """Determines if the given user role meets the required privilege level."""
        hierarchy = {"guest": 0, "operator": 1, "admin": 2}
        return hierarchy.get(user_role, 0) >= hierarchy.get(required_role, 0)
`,

  'bluetooth/settings.py': `"""
Bluetooth Settings & Deeplink Management
Handles peripheral device pairing and deep-link routing for Bluetooth configurations.
"""
from typing import Dict, List, Optional
from services.audit import log_security_event

class BluetoothSettingsDeeplink:
    """
    Deeplink router for Samsung Bluetooth Settings integrations.
    Supports routing to pairing screens, peripheral lists, and diagnostics.
    """
    SCHEME = "samsung-device://settings/bluetooth"

    def __init__(self, auto_pair: bool = False):
        self.auto_pair = auto_pair

    def matches(self, uri: str) -> bool:
        return uri.startswith(self.SCHEME)

def handle_bluetooth_deeplink(uri: str) -> bool:
    """
    Core deeplink handler routing Bluetooth settings requests.
    Parses intent parameters and navigates user to the target hardware screen.
    """
    deeplink_router = BluetoothSettingsDeeplink(auto_pair=True)
    if not deeplink_router.matches(uri):
        return False

    log_security_event("BLUETOOTH_DEEPLINK_TRIGGERED", user_id="system", metadata={"uri": uri})
    
    # Check for specific action query parameters
    if "action=pair" in uri:
        print("Redirecting to Bluetooth pairing wizard")
    elif "action=scan" in uri:
        scan_nearby_peripherals()
    return True

def pair_bluetooth_device(device_address: str) -> Dict[str, str]:
    """Initiates pairing handshake with a target Bluetooth peripheral address."""
    print(f"Initiating pairing with Bluetooth peripheral: {device_address}")
    return {"address": device_address, "status": "paired"}

def scan_nearby_peripherals() -> List[str]:
    """Scans local RF spectrum for discoverable Bluetooth devices."""
    return ["Galaxy Buds Pro - 4A:22", "Smart Monitor M8 - 8F:11"]
`,

  'models/user.py': `"""
User Domain Models and Data Structures
"""
from enum import Enum
from dataclasses import dataclass
from typing import Optional

class UserRole(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    GUEST = "guest"

@dataclass
class UserProfile:
    user_id: str
    username: str
    email: str
    role: UserRole
    is_active: bool = True
    mfa_enabled: bool = False

@dataclass
class SecurityAuditRecord:
    event_id: str
    timestamp: str
    event_type: str
    user_id: str
    details: Optional[dict] = None
`,

  'services/audit.py': `"""
Security Audit and Event Logging Service
"""
import datetime
from typing import Optional, Dict, Any

class AuditLogger:
    """Structured security logger recording authentication and device events."""
    _instance = None

    def __init__(self):
        self.log_entries = []

    def record(self, event_type: str, user_id: str, metadata: Optional[Dict[str, Any]] = None):
        entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "metadata": metadata or {}
        }
        self.log_entries.append(entry)
        return entry

_global_logger = AuditLogger()

def log_security_event(event_type: str, user_id: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """Records an immutable security event entry to the audit log."""
    _global_logger.record(event_type, user_id, metadata)
`,

  'config/settings.py': `"""
Device Hub Configuration Manager
"""
import os
from dataclasses import dataclass

@dataclass
class DeviceHubConfig:
    environment: str = "production"
    debug: bool = False
    api_prefix: str = "/api/v1"
    bluetooth_enabled: bool = True

def get_database_url() -> str:
    """Resolves database connection string for secure storage."""
    return os.getenv("DEVICE_HUB_DB_URL", "sqlite:///./device_hub.db")

def is_debug_mode() -> bool:
    """Determines whether verbose diagnostic logs are active."""
    return os.getenv("DEVICE_HUB_DEBUG", "0") == "1"
`,

  'utils/crypto.py': `"""
Cryptographic Utilities
Password hashing and signature verification helpers.
"""
import hashlib
import hmac

SECRET_SALT = b"prism_samsung_theme1_secure_salt"

def hash_password(password: str) -> str:
    """Generates a SHA-256 password hash using a secure salt."""
    return hashlib.sha256(SECRET_SALT + password.encode("utf-8")).hexdigest()

def verify_signature(payload: bytes, signature: str) -> bool:
    """Verifies HMAC signature of payload."""
    expected = hmac.new(SECRET_SALT, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
`
};

const SAMPLE_OTHER_FILES: Record<string, { content: string; extension: string; language: string }> = {
  'README.md': {
    content: `# Samsung PRISM Device Hub

Autonomous edge management service and peripheral device orchestrator for Samsung Smart Things and connected appliances.

## Architecture
- **Authentication**: JWT token validation, role-based authorization, and HMAC verification.
- **Peripherals**: Bluetooth LE scanning, automated device pairing, and deeplink resolution.
- **Audit**: Immutable security event logs and structured diagnostic streams.

## Quick Start
\`\`\`bash
python main.py
\`\`\`
`,
    extension: 'md',
    language: 'markdown'
  },
  'config/settings.yaml': {
    content: `hub:
  name: "samsung-prism-device-hub"
  version: "3.0.1"
  environment: "production"
bluetooth:
  enabled: true
  auto_scan_interval_sec: 30
  pairing_timeout_sec: 15
security:
  token_algorithm: "HS256"
  min_token_length: 16
  audit_retention_days: 90
`,
    extension: 'yaml',
    language: 'yaml'
  },
  'scripts/bootstrap.sh': {
    content: `#!/usr/bin/env bash
# Samsung PRISM Device Hub Bootstrap Script
set -e

echo "Starting Samsung PRISM Device Hub setup..."
python -m pip install -r requirements.txt
python main.py --init-db
echo "Hub bootstrap completed successfully."
`,
    extension: 'sh',
    language: 'shell'
  }
};

/**
 * Loads the built-in deterministic Python sample repository.
 */
export async function loadSampleRepository(
  onProgress?: ProgressCallback
): Promise<RepositoryWorkspace> {
  const steps = [
    { id: 'recv', label: 'Loading sample Python repository', status: 'pending' as const },
    { id: 'disc', label: 'Reading structured module tree', status: 'pending' as const },
    { id: 'read', label: 'Normalizing Python source lines', status: 'pending' as const },
    { id: 'work', label: 'Building repository workspace and semantic index', status: 'pending' as const }
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

  updateProgress('received', 0, 'Mounting Samsung Device Hub sample repository...');
  await new Promise(r => setTimeout(r, 60));

  updateProgress('discovered', 1, 'Scanning repository source modules and documentation...');
  await new Promise(r => setTimeout(r, 60));

  updateProgress('reading_python', 2, 'Indexing source lines and function definitions...');
  const filesMap = new Map<string, RepositoryFile>();

  for (const [path, sourceText] of Object.entries(SAMPLE_PYTHON_FILES)) {
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

  for (const [path, item] of Object.entries(SAMPLE_OTHER_FILES)) {
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

  await new Promise(r => setTimeout(r, 60));
  updateProgress('building_workspace', 3, 'Building semantic chunks, BM25 index, and repository metrics...');

  const workspace = new RepositoryWorkspace({
    repositoryName: 'samsung-prism-device-hub',
    sourceType: 'sample',
    files: filesMap,
    ignoredCount: 0
  });

  // Build repository-wide index (stats, chunks, lexical, semantic, structural)
  await workspace.buildIndex(onProgress);

  return workspace;
}
