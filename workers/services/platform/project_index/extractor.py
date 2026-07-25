"""
Project Knowledge Index — Extractor

Reads repository metadata from the filesystem: git state, documentation
files, and project configuration. Used to build or refresh index entries.

Compliant with Constitution §1.8 (Incremental Context) — only reads the
specific files needed, never entire repositories.
"""

import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from platform.shared import TelemetryEnvelope, Outcome, ProjectIndexConfig


# Documentation files looked up by convention when PKI has no explicit paths
DOCUMENTATION_BY_CONVENTION: dict[str, list[str]] = {
    "roadmap": ["ROADMAP.md", "roadmap.md", "ROADMAP"],
    "architecture": ["ARCHITECTURE.md", "architecture.md", "docs/ARCHITECTURE.md"],
    "operations": ["DEPLOYMENT.md", "deployment.md", "docs/DEPLOYMENT.md",
                    "docs/operations/DEPLOYMENT.md"],
    "security": ["SECURITY.md", "security.md"],
    "database": ["DATABASE.md", "database.md", "docs/DATABASE.md"],
    "api": ["API.md", "api.md", "docs/API.md"],
}


class MetadataExtractor:
    """Extracts metadata from a repository on disk.

    Reads git state, checks for documentation files, and validates
    project configuration. All reads are targeted and incremental.
    """

    def __init__(self, config: ProjectIndexConfig | None = None):
        self.config = config or ProjectIndexConfig()

    def extract_git_state(self, repo_path: str) -> dict[str, Any]:
        """Extract git state for a repository.

        Returns:
            Dict with 'active_branch', 'head_hash', 'last_commit_date'.
            Returns empty dict if repo is not a git repo.
        """
        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            return {}

        result: dict[str, Any] = {}

        try:
            # Get active branch
            branch = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True, text=True, cwd=repo_path, timeout=5,
            )
            if branch.returncode == 0:
                result["active_branch"] = branch.stdout.strip()

            # Get HEAD hash
            head = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True, text=True, cwd=repo_path, timeout=5,
            )
            if head.returncode == 0:
                result["head_hash"] = head.stdout.strip()

            # Get last commit date
            date = subprocess.run(
                ["git", "log", "-1", "--format=%cI"],
                capture_output=True, text=True, cwd=repo_path, timeout=5,
            )
            if date.returncode == 0 and date.stdout.strip():
                result["last_commit_date"] = date.stdout.strip()
        except (subprocess.TimeoutExpired, OSError):
            pass

        return result

    def find_documentation(
        self, repo_path: str, explicit_paths: dict[str, str | None] | None = None
    ) -> dict[str, str | None]:
        """Find documentation files in a repository.

        Checks explicit paths first (from PKI), then falls back to
        convention-based discovery.

        Args:
            repo_path: Root path of the repository.
            explicit_paths: Dict of doc_type -> explicit path, or None.

        Returns:
            Dict of doc_type -> absolute path (or None if not found).
        """
        repo = Path(repo_path)
        found: dict[str, str | None] = {}

        for doc_type, conventions in DOCUMENTATION_BY_CONVENTION.items():
            # Check explicit path first
            if explicit_paths and explicit_paths.get(doc_type):
                explicit = repo / explicit_paths[doc_type]  # type: ignore
                if explicit.exists():
                    found[doc_type] = str(explicit)
                    continue

            # Fall back to convention
            for convention in conventions:
                candidate = repo / convention
                if candidate.exists():
                    found[doc_type] = str(candidate)
                    break
            else:
                found[doc_type] = None

        return found

    def detect_technology(self, repo_path: str) -> dict[str, str | None]:
        """Detect technology stack from repo inspection.

        Checks for common configuration files to determine framework,
        language, runtime, and package manager.

        All reads are targeted — only checks 3-4 files.
        """
        repo = Path(repo_path)
        result: dict[str, str | None] = {
            "framework": None,
            "language": None,
            "runtime": None,
            "package_manager": None,
        }

        # Check for package.json (Node/TypeScript)
        pkg_json = repo / "package.json"
        if pkg_json.exists():
            result["language"] = "typescript"
            result["package_manager"] = self._detect_package_manager(repo)
            # Framework detection
            if (repo / "wrangler.jsonc").exists() or (repo / "wrangler.toml").exists():
                result["runtime"] = "cloudflare-workers"
            elif (repo / "next.config.js").exists() or (repo / "next.config.ts").exists():
                result["runtime"] = "node"
                result["framework"] = "next"
            else:
                result["runtime"] = "node"

        # Check for pyproject.toml (Python)
        if repo / "pyproject.toml":
            result["language"] = "python"
            result["runtime"] = "python"

        # Check for go.mod (Go)
        if repo / "go.mod":
            result["language"] = "go"
            result["runtime"] = "go"

        return result

    def _detect_package_manager(self, repo: Path) -> str:
        """Detect package manager from lock files."""
        if (repo / "pnpm-lock.yaml").exists():
            return "pnpm"
        if (repo / "yarn.lock").exists():
            return "yarn"
        if (repo / "package-lock.json").exists():
            return "npm"
        return "npm"  # Default


# Convenience function
def extract_git_state(
    repo_path: str, config: ProjectIndexConfig | None = None
) -> dict[str, Any]:
    return MetadataExtractor(config).extract_git_state(repo_path)