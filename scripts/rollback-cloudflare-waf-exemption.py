#!/usr/bin/env python3
"""
Rollback Cloudflare WAF skip rule for Phase M consent exemption.

This restores the original Bot Fight Mode behavior by removing the exemption rule.
"""

import os
import json
import sys
import requests

CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID")  # agsynergy.ca zone

if not CLOUDFLARE_API_TOKEN:
    print("ERROR: CLOUDFLARE_API_TOKEN not set")
    sys.exit(1)

if not ZONE_ID:
    print("ERROR: CLOUDFLARE_ZONE_ID not set")
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
    result = make_request("GET", "/zones?name=agsynergy.ca")
    zones = result.get("result", [])
    if not zones:
        print("ERROR: Zone agsynergy.ca not found")
        sys.exit(1)
    return zones[0]["id"]

def find_ruleset():
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets")
    for rs in result.get("result", []):
        if rs.get("phase") == "http_request_firewall_managed":
            return rs
    return None

def main():
    global ZONE_ID
    
    if not ZONE_ID:
        print("Finding zone ID for agsynergy.ca...")
        ZONE_ID = find_zone_id()
        print(f"Found zone: {ZONE_ID}")
    
    print("Finding WAF ruleset...")
    ruleset = find_ruleset()
    
    if not ruleset:
        print("No WAF ruleset found - nothing to rollback")
        return
    
    ruleset_id = ruleset["id"]
    print(f"Using ruleset: {ruleset_id}")
    
    # Find the Phase M rule
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules")
    rule_id = None
    for rule in result.get("result", []):
        if rule.get("ref") == "phase-m-consent-post-exemption":
            rule_id = rule["id"]
            break
    
    if not rule_id:
        print("Phase M exemption rule not found - nothing to rollback")
        return
    
    print(f"Found rule to remove: {rule_id}")
    
    # Delete the rule
    result = make_request("DELETE", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules/{rule_id}")
    print(f"Rollback complete. Rule {rule_id} removed.")
    
    # Verify
    result = make_request("GET", f"/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules")
    for rule in result.get("result", []):
        if rule.get("ref") == "phase-m-consent-post-exemption":
            print("WARNING: Rule still exists after deletion attempt!")
            sys.exit(1)
    
    print("Verified: Phase M exemption rule successfully removed.")
    print("Bot Fight Mode behavior restored for all requests.")

if __name__ == "__main__":
    main()