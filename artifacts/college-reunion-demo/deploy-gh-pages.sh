#!/bin/bash
set -e

REPO_URL="https://github.com/kumarlogan/concierge-website.git"
DIST_DIR="/home/ubuntu/concierge-website/artifacts/college-reunion-demo/dist"
TEMP_DIR="/tmp/gh-pages-deploy"

# Clean and clone gh-pages branch
rm -rf "$TEMP_DIR"
git clone --branch gh-pages --single-branch "$REPO_URL" "$TEMP_DIR" 2>/dev/null || {
  # If gh-pages doesn't exist, create it
  git clone "$REPO_URL" "$TEMP_DIR"
  cd "$TEMP_DIR"
  git checkout --orphan gh-pages
  git rm -rf . 2>/dev/null || true
  echo "GitHub Pages" > index.html
  git add index.html
  git commit -m "Initial gh-pages commit"
  git push origin gh-pages
}

# Copy built files to gh-pages
cd "$TEMP_DIR"
cp -r "$DIST_DIR"/* .
git add -A
git commit -m "Deploy college reunion demo $(date)" || echo "No changes"
git push origin gh-pages

echo "Deployed to https://kumarlogan.github.io/concierge-website/"
echo "For demo at /reunion-demo/, access: https://kumarlogan.github.io/concierge-website/reunion-demo/"
