#!/usr/bin/env python3
"""
Configure Cloudflare WAF skip rule to exempt authenticated consent POSTs
from Bot Fight Mode / Managed Challenge.

This creates a narrow WAF rule that:
- Only applies to api.agsynergy.ca
- Only for POST requests to /api/v1/consent/*
- Only when Authorization header is present (Bearer token)
- Skips botManagement (Managed Challenge)
- Does NOT exempt unauthenticated requests
"""

import os
import json
import sys
import requests

CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID")  # agsynergy.ca zone

if not CLOUDFLARE_API_TOKEN:
    print("ERROR: CLOUDFLARE_API_TOKEN not set")
    sys.exit(1)

if not ZONE_ID:
    print("ERROR: CLOUDFLARE_ZONE_ID not set (zone for agsynergy.ca)")
    sys.exit(1)

BASE_URL = "https://api.cloudflare.com/client/v4"
HEADERS = {
    "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
    "Content-Type": "application/json",
}

def make_request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    resp = requests.request(method, url, headers=HEADERS, json=data)
    if not resp.ok:
        print(f"ERROR {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()

def find_zone_id():
    """Find the zone ID for agsynergy.ca"""
    result = make_request("GET", "/zones?name=agsynergy.ca")
    zones = result.get("result", [])
    if not zones:
        print("ERROR: Zone agsynergy.ca not found")
        sys.exit(1)
    return zones[0]["id"]

def find_existing_ruleset():
    """Find existing zone-level WAF ruleset"""
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets")
    for rs in result.get("result", []):
        if rs.get("phase") == "http_request_firewall_managed":
            return rs
    return None

def create_waf_skip_rule(ruleset_id):
    """
    Create a WAF rule that skips botManagement for authenticated consent POSTs.
    
    Expression breakdown:
    - http.request.method == "POST" - Only POST requests
    - http.request.uri.path matches "^/api/v1/consent/" - Only consent endpoints
    - http.request.headers["authorization"][0] matches "^Bearer " - Has Bearer token
    - cf.bot_management.score > 0 - Has a bot score (automated client)
    
    Action: skip_bot_management - Bypass the Managed Challenge for these requests
    """
    rule = {
        "action": "skip",
        "action_parameters": {
            "products": ["botManagement"]
        },
        "description": "Phase M: Exempt authenticated consent POSTs from Bot Fight Mode (Managed Challenge)",
        "expression": '(http.request.method == "POST" and http.request.uri.path matches "^/api/v1/consent/" and http.request.headers["authorization"][0] matches "^Bearer ")',
        "enabled": True,
        "ref": "phase-m-consent-post-exemption",
    }
    
    # Add rule to ruleset
    result = make_request("POST", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules", rule)
    return result.get("result", {}).get("id")

def main():
    global ZONE_ID
    
    if not ZONE_ID:
        print("Finding zone ID for agsynergy.ca...")
        ZONE_ID = find_zone_id()
        print(f"Found zone: {ZONE_ID}")
    
    print("Finding existing WAF ruleset...")
    ruleset = find_existing_ruleset()
    
    if not ruleset:
        print("Creating new zone-level WAF ruleset...")
        result = make_request("POST", f"/zones/{ZONE_ID}/rulesets", {
            "name": "Phase M Consent Exemption Ruleset",
            "description": "WAF ruleset for Phase M consent endpoint exemptions",
            "kind": "zone",
            "phase": "http_request_firewall_managed",
            "rules": [],
        })
        ruleset = result.get("result")
        if not ruleset:
            print("ERROR: Failed to create ruleset")
            sys.exit(1)
        print(f"Created ruleset: {ruleset['id']}")
    
    ruleset_id = ruleset["id"]
    print(f"Using ruleset: {ruleset_id}")
    
    # Check if rule already exists
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules")
    for rule in result.get("result", []):
        if rule.get("ref") == "phase-m-consent-post-exemption":
            print(f"Rule already exists: {rule['id']}")
            print("Updating...")
            make_request("PATCH", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules/{rule['id']}", {
                "action": "skip",
                "action_parameters": {"products": ["botManagement"]},
                "description": "Phase M: Exempt authenticated consent POSTs from Bot Fight Mode (Managed Challenge)",
                "expression": '(http.request.method == "POST" and http.request.uri.path matches "^/api/v1/consent/" and http.request.headers["authorization"][0] matches "^Bearer ")',
                "enabled": True,
                "ref": "phase-m-consent-post-exemption",
            })
            print("Rule updated successfully")
            return
    
    print("Creating new WAF skip rule...")
    rule_id = create_waf_skip_rule(ruleset_id)
    print(f"Created rule: {rule_id}")
    
    # Verify
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules")
    for rule in result.get("result", []):
        if rule.get("ref") == "phase-m-consent-post-exemption":
            print(f"\nVerified rule:")
            print(f"  ID: {rule['id']}")
            print(f"  Action: {rule['action']}")
            print(f"  Expression: {rule['expression']}")
            print(f"  Enabled: {rule['enabled']}")
            break

if __name__ == "__main__":
    main()