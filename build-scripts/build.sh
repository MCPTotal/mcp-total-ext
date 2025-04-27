#!/bin/bash
set -e

# Create directory structure
echo "Creating directory structure..."
mkdir -p ./src/background/generated

# Install dependencies
echo "Installing dependencies..."
cd build-scripts
npm install

# Build the browser-compatible version
echo "Building browser-compatible version..."
npx webpack --config webpack.mcp.config.js

echo "Build completed successfully."
echo "Browser-compatible version is available at dist/mcp-browser.js"

# Copy the output file to the extension's src directory
echo "Copying to extension src directory..."
cp ../dist/mcp-browser.js ../

echo "Done!" 