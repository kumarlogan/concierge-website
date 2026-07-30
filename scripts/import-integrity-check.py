#!/usr/bin/env python3
"""
Import Integrity Validation — P0 Deployment Gate

Scans every TypeScript/JavaScript file tracked by Git and verifies that
every import statement references a file that:

  1. Exists on disk
  2. Is tracked by Git
  3. Resolves correctly (relative paths, path aliases)
  4. Is not ignored by .gitignore

Fails fast with actionable error messages before the build starts.

Usage:
  python3 scripts/import-integrity-check.py [--tsconfig <path>]
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


# Regexes for CommonJS and ESM import syntax
IMPORT_RE = re.compile(
    r'(?:'
    r'import\s+(?:[\w*\s{},]*)\s+from\s+[\'"]([^\'"]+)[\'"]'  # ESM named/default
    r'|'
    r'import\s+[\'"]([^\'"]+)[\'"]'  # ESM side-effect
    r'|'
    r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'  # CJS require
    r')',
    re.MULTILINE,
)

# Bare specifier patterns (not relative or path aliased)
NODE_MODULES_PREFIXES = re.compile(
    r'^(?:@[a-z0-9_-]+/)?[a-z@]'  # starts with letter or @scope letter
)


def run_git(args: List[str], cwd: Optional[str] = None) -> str:
    """Run a git command and return stdout."""
    result = subprocess.run(
        ["git"] + args,
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    if result.returncode != 0:
        print(f"::error::git {' '.join(args)} failed: {result.stderr.strip()}")
        sys.exit(1)
    return result.stdout.strip()


def get_tracked_files(project_root: str) -> Set[str]:
    """Get all files tracked by git, normalised to absolute paths."""
    raw = run_git(["ls-files"], cwd=project_root)
    tracked = set()
    for line in raw.splitlines():
        line = line.strip()
        if line:
            tracked.add(os.path.normpath(os.path.join(project_root, line)))
    return tracked


def is_tracked(filepath: str, tracked_files: Set[str]) -> bool:
    """Check if a file is tracked by Git."""
    return os.path.normpath(filepath) in tracked_files


def is_gitignored(filepath: str, project_root: str) -> bool:
    """Check if a file is gitignored."""
    result = subprocess.run(
        ["git", "check-ignore", "-q", filepath],
        cwd=project_root,
        capture_output=True,
    )
    return result.returncode == 0


def should_exclude(rel_path: str, exclude_patterns: List[str]) -> bool:
    """Check if a file path matches any exclusion pattern.
    
    Supports:
      - Directory prefix: 'artifacts/' matches 'artifacts/api-server/app.ts'
      - Segment pattern: '__tests__' matches 'hermes/services/__tests__/foo.ts'
      - Exact match: 'tsconfig.json' matches 'tsconfig.json'
    """
    for pattern in exclude_patterns:
        pattern = pattern.rstrip("/")
        # Exact match
        if rel_path == pattern:
            return True
        # Directory prefix match
        if rel_path.startswith(pattern + "/") or rel_path.startswith(pattern + os.sep):
            return True
        # Segment pattern match (matches any path segment)
        if pattern.startswith("**/") or (not pattern.startswith(".") and "/" not in pattern):
            # Bare segment name matches anywhere in path
            if f"/{pattern}/" in f"/{rel_path}/":
                return True
    return False


def resolve_tsconfig_paths(
    project_root: str,
    import_path: str,
    importing_file: str,
    tsconfig_paths: Dict[str, List[str]],
    tsconfig_base_url: str,
    wrangler_aliases: Dict[str, str],
) -> Optional[str]:
    """
    Resolve an import using TypeScript path aliases and Wrangler aliases.
    
    Handles:
      - tsconfig paths like "@hermes/*" -> ["../hermes/*"]
      - Wrangler aliases like "@hermes/identity/principal.js" -> "../hermes/identity/principal.ts"
      - Cloudflare .js -> .ts extension replacement
    """
    # First try Wrangler aliases (more specific, no wildcard)
    for alias_pattern, alias_target in wrangler_aliases.items():
        # Replace .js with .ts or .tsx for resolution
        ts_variants = [alias_target]
        if alias_target.endswith(".js"):
            ts_variants.append(alias_target[:-3] + ".ts")
            ts_variants.append(alias_target[:-3] + ".tsx")
        
        # Check exact match
        for variant in ts_variants:
            resolved = os.path.normpath(os.path.join(project_root, variant))
            if os.path.exists(resolved):
                return resolved

    # Try tsconfig paths (wildcard pattern matching)
    if tsconfig_paths:
        base_url_path = os.path.normpath(os.path.join(project_root, tsconfig_base_url or "."))
        
        for pattern, targets in tsconfig_paths.items():
            if pattern.endswith("/*"):
                prefix = pattern[:-2]  # "@hermes/" from "@hermes/*"
                if import_path.startswith(prefix):
                    suffix = import_path[len(prefix):]
                    if suffix.startswith("/"):
                        suffix = suffix[1:]
                    for target in targets:
                        if target.endswith("/*"):
                            resolved_base = target[:-2]
                            candidate = os.path.normpath(
                                os.path.join(base_url_path, resolved_base, suffix)
                            )
                            resolved = _try_resolve_file(candidate)
                            if resolved:
                                return resolved
            else:
                # Exact match
                if import_path == pattern:
                    for target in targets:
                        candidate = os.path.normpath(os.path.join(base_url_path, target))
                        resolved = _try_resolve_file(candidate)
                        if resolved:
                            return resolved

    return None


def _try_resolve_file(candidate: str) -> Optional[str]:
    """Try various resolution strategies for a candidate file path,
    including extension replacement (.js->.ts) and index file detection."""
    # Exact match
    if os.path.exists(candidate) and not os.path.isdir(candidate):
        return candidate
    if os.path.isdir(candidate):
        for idx in ["index.ts", "index.tsx", "index.js", "index.mjs"]:
            idx_path = os.path.join(candidate, idx)
            if os.path.exists(idx_path):
                return idx_path

    # Try replacing .js/.jsx with .ts/.tsx
    base, ext = os.path.splitext(candidate)
    if ext == ".js":
        for ts_ext in [".ts", ".tsx"]:
            if os.path.exists(base + ts_ext):
                return base + ts_ext
    elif ext == ".jsx":
        for ts_ext in [".tsx", ".ts"]:
            if os.path.exists(base + ts_ext):
                return base + ts_ext

    # Try appending extensions
    for ext in [".ts", ".tsx", ".js", ".jsx", ".mjs"]:
        if os.path.exists(candidate + ext):
            return candidate + ext

    # Try as directory with index
    for idx in ["index.ts", "index.tsx", "index.mjs", "index.js"]:
        idx_path = os.path.join(candidate, idx)
        if os.path.exists(idx_path):
            return idx_path

    return None


def resolve_relative_import(
    import_path: str,
    importing_file: str,
) -> Optional[str]:
    """Resolve a relative import path to an actual file.

    Handles the Cloudflare Workers pattern where .js imports resolve to
    .ts source files.
    """
    import_dir = os.path.dirname(importing_file)
    candidate = os.path.normpath(os.path.join(import_dir, import_path))
    
    # ── 1. Exact path match ───────────────────────────────────────────
    if os.path.exists(candidate):
        if os.path.isdir(candidate):
            for idx in ["index.ts", "index.tsx", "index.js", "index.jsx"]:
                idx_path = os.path.join(candidate, idx)
                if os.path.exists(idx_path):
                    return idx_path
        return candidate
    
    # ── 2. Try replacing .js/.jsx with .ts/.tsx (Cloudflare pattern) ──
    base, ext = os.path.splitext(candidate)
    if ext == ".js":
        for ts_ext in [".ts", ".tsx"]:
            ts_candidate = base + ts_ext
            if os.path.exists(ts_candidate):
                return ts_candidate
    elif ext == ".jsx":
        for ts_ext in [".tsx", ".ts"]:
            ts_candidate = base + ts_ext
            if os.path.exists(ts_candidate):
                return ts_candidate
    
    # ── 3. Try appending standard extensions ──────────────────────────
    for ext in [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]:
        appended = candidate + ext
        if os.path.exists(appended):
            return appended
    
    # ── 4. Try as directory with index files ──────────────────────────
    for idx in ["index.ts", "index.tsx", "index.mjs", "index.js", "index.jsx"]:
        idx_path = os.path.join(candidate, idx)
        if os.path.exists(idx_path):
            return idx_path
    
    return None


def resolve_bare_import(import_path: str, project_root: str) -> Optional[str]:
    """
    Check if a bare import resolves to a node_modules package or is a built-in.
    Returns the actual file path if resolved, or a special string for:
      - 'builtin' for Node.js builtins and node: protocol
      - 'external' for node_modules packages
    """
    # node: protocol — always a built-in
    if import_path.startswith("node:"):
        return "builtin"

    # Node.js builtins
    NODE_BUILTINS = {
        "assert", "buffer", "child_process", "cluster", "console", "constants",
        "crypto", "dgram", "dns", "domain", "events", "fs", "http", "https",
        "module", "net", "os", "path", "perf_hooks", "process", "punycode",
        "querystring", "readline", "repl", "stream", "string_decoder", "timers",
        "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zones",
        "zlib",
    }
    if import_path in NODE_BUILTINS:
        return "builtin"

    # Cloudflare Workers built-ins
    CF_BUILTINS = {
        "cloudflare:workers", "cloudflare:kv", "cloudflare:r2",
        "cloudflare:d1", "cloudflare:queues", "cloudflare:durable-objects",
        "cloudflare:secrets", "cloudflare:email",
    }
    if import_path in CF_BUILTINS:
        return "builtin"

    # Check node_modules (walk up from project_root, checking all nested
    # node_modules directories that pnpm hoisting may create)
    parts = import_path.split("/")
    # Extract package name (handles @scoped/packages)
    if import_path.startswith("@"):
        pkg_name = "/".join(parts[:2])
    else:
        pkg_name = parts[0]

    # Walk up directory tree looking for node_modules/<pkg>
    search_dir = project_root
    while True:
        pkg_main = os.path.join(search_dir, "node_modules", pkg_name, "package.json")
        if os.path.exists(pkg_main):
            return "external"  # node_modules package — assumed valid
        parent = os.path.dirname(search_dir)
        if parent == search_dir:
            break
        search_dir = parent

    # Also search one level deep (workers/node_modules, artifacts/.../node_modules)
    for sub_project in ["workers", "artifacts/ags-fertility"]:
        sub_dir = os.path.join(project_root, sub_project)
        pkg_main = os.path.join(sub_dir, "node_modules", pkg_name, "package.json")
        if os.path.exists(pkg_main):
            return "external"

    return None


def parse_tsconfig(project_root: str, tsconfig_path: str) -> tuple:
    """Parse a tsconfig.json and extract paths and baseUrl, following extends chain."""
    configs_to_check = [tsconfig_path]
    checked = set()
    tsconfig_paths = {}
    base_url = "."

    while configs_to_check:
        current = configs_to_check.pop(0)
        if current in checked:
            continue
        checked.add(current)

        full_path = os.path.normpath(os.path.join(project_root, current))
        if not os.path.exists(full_path):
            continue

        try:
            with open(full_path) as f:
                content = f.read()
            # JSONC cleanup: strip comments AND trailing commas
            content = re.sub(r',(\s*[}\]])', r'\1', content)
            config = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            print(f"::warning::Could not parse {full_path}")
            return tsconfig_paths, base_url

        extends = config.get("extends")
        if isinstance(extends, str) and not extends.startswith("@"):
            extends_full = os.path.normpath(os.path.join(os.path.dirname(full_path), extends))
            if os.path.exists(extends_full):
                try:
                    rel = os.path.relpath(extends_full, project_root)
                    if rel not in checked:
                        configs_to_check.append(rel)
                except ValueError:
                    pass

        compiler_opts = config.get("compilerOptions", {})
        raw_base_url = compiler_opts.get("baseUrl", None)

        # Normalize baseUrl: tsconfig baseUrl is relative to the tsconfig file.
        # Convert to be relative to the project root.
        tsconfig_dir = os.path.relpath(os.path.dirname(full_path) or ".", project_root)
        if raw_base_url and raw_base_url != ".":
            normalized_base = os.path.normpath(os.path.join(tsconfig_dir, raw_base_url))
        else:
            normalized_base = tsconfig_dir

        # Set base_url from the first tsconfig that defines it (child overrides
        # parent, but we process child first in the extends chain)
        if not base_url or base_url == ".":
            base_url = normalized_base

        paths = compiler_opts.get("paths", {})
        # Child paths override parent
        for k, v in paths.items():
            tsconfig_paths[k] = v

    return tsconfig_paths, base_url


def parse_wrangler_aliases(project_root: str, wrangler_config: str) -> Dict[str, str]:
    """Parse wrangler.jsonc's alias section."""
    wrangler_file = os.path.join(project_root, wrangler_config)
    aliases = {}
    
    if not os.path.exists(wrangler_file):
        return aliases
    
    with open(wrangler_file) as f:
        content = f.read()
        # Strip JSONC comments
        content = re.sub(r'(?:(?:^|\s)//.*$)', '', content, flags=re.MULTILINE)
        try:
            config = json.loads(content)
        except json.JSONDecodeError:
            return aliases
    
    raw_aliases = config.get("alias", {})
    for k, v in raw_aliases.items():
        aliases[k] = v
    
    return aliases


def parse_vite_aliases(project_root: str) -> Dict[str, str]:
    """Parse Vite resolve.alias from vite.config.ts.

    Handles the common pattern:
      '@': path.resolve(import.meta.dirname, 'src'),
    where import.meta.dirname == dirname(vite.config.ts).
    """
    aliases = {}
    vite_files = [
        os.path.join(project_root, "artifacts/ags-fertility/vite.config.ts"),
        os.path.join(project_root, "vite.config.ts"),
    ]
    
    for vite_file in vite_files:
        if not os.path.exists(vite_file):
            continue
        
        vite_dir = os.path.dirname(vite_file)
        
        with open(vite_file) as f:
            content = f.read()
        
        # Match alias entries like: '@': path.resolve(import.meta.dirname, 'src'),
        alias_pattern = re.compile(
            r"['\"](\S+)['\"]\s*:\s*path\.resolve\s*\(\s*import\.meta\.dirname\s*,?\s*(.*?)\)",
            re.DOTALL,
        )
        
        for match in alias_pattern.finditer(content):
            alias_name = match.group(1)
            args_str = match.group(2).strip()
            # Parse comma-separated string arguments
            args = []
            for arg in re.findall(r"['\"]([^'\"]+)['\"]", args_str):
                args.append(arg)
            
            if args:
                resolved = os.path.normpath(os.path.join(vite_dir, *args))
                aliases[alias_name] = resolved
            else:
                # Handle non-literal args (e.g., process.cwd())
                aliases[alias_name] = os.path.join(vite_dir, args_str.strip("'\""))
        
        # Also try matching the simpler resolve.alias object pattern
        simple_pattern = re.compile(
            r"['\"](\S+)['\"]\s*:\s*['\"]([^'\"]+)['\"]",
        )
        for match in simple_pattern.finditer(content):
            alias_name, alias_target = match.groups()
            if alias_name not in aliases:
                resolved = os.path.normpath(os.path.join(vite_dir, alias_target))
                aliases[alias_name] = resolved
    
    return aliases


def extract_imports(file_path: str) -> List[Tuple[str, int]]:
    """Extract all import paths from a file, returning (import_path, line_number) tuples."""
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except (IOError, OSError) as e:
        print(f"::error::Cannot read {file_path}: {e}")
        return imports
    lines = content.split("\n")
    for match in IMPORT_RE.finditer(content):
        line_num = content[: match.start()].count("\n") + 1
        import_path = match.group(1) or match.group(2) or match.group(3)
        if not import_path:
            continue
        # Skip imports inside single-line comments
        if line_num - 1 < len(lines):
            stripped = lines[line_num - 1].strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
        imports.append((import_path.strip(), line_num))
    return imports


def is_bare_import(import_path: str) -> bool:
    """Check if an import is a bare specifier (not relative or absolute)."""
    if import_path.startswith(".") or import_path.startswith("/"):
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Import Integrity Check")
    parser.add_argument("--tsconfig", default="tsconfig.json",
                        help="Path to tsconfig.json (relative to project root)")
    parser.add_argument("--wrangler", default="workers/wrangler.jsonc",
                        help="Path to wrangler.jsonc (relative to project root)")
    parser.add_argument("--project-root", default=".",
                        help="Project root directory")
    parser.add_argument("--allow-external", action="store_true",
                        help="Allow external (node_modules) import references")
    parser.add_argument("--exclude", nargs="*", default=[],
                        help="Additional directory patterns to exclude (e.g., artifacts/ lib/ hermes-website/)")
    args = parser.parse_args()
    
    project_root = os.path.abspath(args.project_root)
    
    # ── Resolve config files via extends chain ─────────────────────────
    # Start with the root tsconfig, then auto-discover all tsconfig files
    # that define path mappings (e.g. workers/tsconfig.json, hermes/tsconfig.json)
    tsconfig_paths, tsconfig_base_url = parse_tsconfig(project_root, args.tsconfig)
    wrangler_aliases = parse_wrangler_aliases(project_root, args.wrangler)
    vite_aliases = parse_vite_aliases(project_root)

    # Auto-discover tsconfigs in subdirectories and merge their path mappings
    for root, dirs, files in os.walk(project_root):
        if "node_modules" in root.split(os.sep):
            continue
        if ".git" in root.split(os.sep):
            continue
        if "tsconfig.json" in files:
            rel_path = os.path.relpath(os.path.join(root, "tsconfig.json"), project_root)
            if rel_path != args.tsconfig:
                sub_paths, sub_base = parse_tsconfig(project_root, rel_path)
                if sub_paths:
                    print(f"::debug::Loaded tsconfig paths from {rel_path}: {sub_paths}")
                    tsconfig_paths.update(sub_paths)
                    if sub_base and (not tsconfig_base_url or tsconfig_base_url == "."):
                        tsconfig_base_url = sub_base

    # Also parse workers/tsconfig.json for workers-specific paths
    workers_tsconfig = os.path.join(project_root, "workers", "tsconfig.json")
    if os.path.exists(workers_tsconfig):
        w_paths, w_base = parse_tsconfig(project_root, "workers/tsconfig.json")
        tsconfig_paths.update(w_paths)

    # Combine all alias sources into a single resolver dict
    # Vite aliases are absolute paths (e.g., '@/artifacts/ags-fertility/src')
    path_aliases = {}
    for k, v in wrangler_aliases.items():
        path_aliases[k] = os.path.normpath(os.path.join(project_root, v))
    for k, v in vite_aliases.items():
        path_aliases[k] = v

    print(f"::debug::Loaded tsconfig paths: {list(tsconfig_paths.keys())}")
    print(f"::debug::Loaded Wrangler aliases: {list(wrangler_aliases.keys())}")
    print(f"::debug::Loaded Vite aliases: {list(vite_aliases.keys())}")
    
    # ── Get tracked files ──────────────────────────────────────────────
    tracked_files = get_tracked_files(project_root)
    
    # ── Find all tracked TypeScript/JS files ───────────────────────────
    source_extensions = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
    source_files = []
    exclude_patterns = args.exclude
    for f in tracked_files:
        ext = os.path.splitext(f)[1]
        if ext in source_extensions:
            rel = os.path.relpath(f, project_root)
            if should_exclude(rel, exclude_patterns):
                continue
            source_files.append(f)
    
    print(f"::debug::Scanning {len(source_files)} tracked source files for imports")
    
    # ── Scan each file for imports ─────────────────────────────────────
    errors = []
    warnings = []
    
    for source_file in sorted(source_files):
        imports = extract_imports(source_file)
        rel_path = os.path.relpath(source_file, project_root)
        
        for import_path, line_num in imports:
            # Skip inline data / CSS module imports
            if import_path.startswith("data:") or import_path.startswith("virtual:"):
                continue
            
            # Skip CSS/SASS/less imports
            if any(import_path.endswith(ext) for ext in
                   [".css", ".scss", ".sass", ".less", ".styl"]):
                continue
            
            # Skip asset imports
            if any(import_path.endswith(ext) for ext in
                   [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp",
                    ".woff", ".woff2", ".eot", ".ttf", ".otf"]):
                continue
            
            # ── Bare import ────────────────────────────────────
            if is_bare_import(import_path):
                resolved = resolve_bare_import(import_path, project_root)
                if resolved == "builtin":
                    continue
                elif resolved == "external":
                    if not args.allow_external:
                        continue  # node_modules, assumed valid
                    continue
                else:
                    # Try as a path alias via tsconfig, wrangler, or vite
                    resolved_alias = resolve_tsconfig_paths(
                        project_root, import_path, source_file,
                        tsconfig_paths, tsconfig_base_url,
                        wrangler_aliases,
                    )
                    if not resolved_alias:
                        # Try Vite/combined path aliases (prefix-based)
                        for alias_prefix, alias_target in path_aliases.items():
                            if import_path.startswith(alias_prefix):
                                suffix = import_path[len(alias_prefix):]
                                if suffix.startswith("/"):
                                    suffix = suffix[1:]
                                candidate = os.path.normpath(
                                    os.path.join(alias_target, suffix)
                                )
                                # Try the resolved path + extensions
                                if os.path.exists(candidate) and not os.path.isdir(candidate):
                                    resolved_alias = candidate
                                    break
                                for ext in ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts",
                                             "/index.tsx", "/index.js", "/index.jsx"]:
                                    full = candidate + ext
                                    if os.path.exists(full) and not os.path.isdir(full):
                                        resolved_alias = full
                                        break
                                if resolved_alias:
                                    break
                    if resolved_alias:
                        if not is_tracked(resolved_alias, tracked_files):
                            errors.append(
                                f"{rel_path}:{line_num}: Import '{import_path}' resolves to "
                                f"'{os.path.relpath(resolved_alias, project_root)}' which is "
                                f"not tracked by Git"
                            )
                        continue
                    
                    # Unresolved bare import
                    errors.append(
                        f"{rel_path}:{line_num}: Bare import '{import_path}' "
                        f"does not resolve to any known package, path alias, or built-in"
                    )
                continue
            
            # ── Relative import ─────────────────────────────────
            resolved = resolve_relative_import(import_path, source_file)
            
            if resolved is None:
                errors.append(
                    f"{rel_path}:{line_num}: Import '{import_path}' does not resolve to "
                    f"an existing file"
                )
                continue
            
            if not is_tracked(resolved, tracked_files):
                errors.append(
                    f"{rel_path}:{line_num}: Import '{import_path}' resolves to "
                    f"'{os.path.relpath(resolved, project_root)}' which exists but is "
                    f"not tracked by Git. Run: git add {os.path.relpath(resolved, project_root)}"
                )
                continue
            
            if is_gitignored(resolved, project_root):
                warnings.append(
                    f"{rel_path}:{line_num}: Import '{import_path}' resolves to "
                    f"'{os.path.relpath(resolved, project_root)}' which is gitignored"
                )

    # ── CLI entry point ─────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"IMPORT INTEGRITY CHECK")
    print(f"{'='*60}")
    print(f"Files scanned:      {len(source_files)}")
    print(f"Errors:            {len(errors)}")
    print(f"Warnings:          {len(warnings)}")
    print()
    
    for err in errors:
        print(f"  🔴 {err}")
    
    for warn in warnings:
        print(f"  🟡 {warn}")
    
    if errors:
        print(f"\n⛔ IMPORT INTEGRITY CHECK FAILED — {len(errors)} error(s) must be resolved.")
        print("   Run: git status, git add <missing-file>, then recheck.")
        sys.exit(1)
    
    if warnings:
        print(f"\n⚠️  IMPORT INTEGRITY CHECK PASSED with {len(warnings)} warning(s)")
    else:
        print(f"\n✅ IMPORT INTEGRITY CHECK PASSED — all imports verified.")
    sys.exit(0)


if __name__ == "__main__":
    main()