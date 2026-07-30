#!/usr/bin/env python3
"""Fix the broken Authorization header in patient-api.ts"""

path = "/home/ubuntu/concierge-website/artifacts/ags-fertility/src/lib/patient-api.ts"

with open(path, "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Authorization" in line and "***" in line:
        print(f"Before line {i+1}: {repr(line)}")
        lines[i] = line.replace("***", "Bearer")
        print(f"After  line {i+1}: {repr(lines[i])}")

with open(path, "w") as f:
    f.writelines(lines)

print("Done!")