"""
Project Knowledge Index — Platform Service

Provides lightweight, cached repository metadata for fast context resolution.
See docs/platform/PROJECT_KNOWLEDGE_INDEX.md for full specification.
"""

from platform.project_index.builder import IndexBuilder, build_all
from platform.project_index.extractor import MetadataExtractor, extract_git_state
from platform.project_index.lookup import RepositoryLookup, resolve
from platform.project_index.cache import CacheManager
from platform.project_index.refresh import IncrementalRefresh

__all__ = [
    "IndexBuilder", "build_all",
    "MetadataExtractor", "extract_git_state",
    "RepositoryLookup", "resolve",
    "CacheManager",
    "IncrementalRefresh",
]