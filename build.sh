#!/bin/bash

set -e

echo "Preparing files for deployment on AWS LAMBDA"

INSTALL_DIR="$(pwd)/build"

echo "Cleaning up previows build..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo "Installing dependencies..."
npm install --silent

CURRENT_DIR="$(pwd)"

echo -n "Preparing tapioca:"
TAPIOCA_INSTALL_DIR="$INSTALL_DIR/tapioca"
mkdir "$TAPIOCA_INSTALL_DIR"
cp -R "./node_modules" "$TAPIOCA_INSTALL_DIR"
cp "./tapiocaLambda.js" "$TAPIOCA_INSTALL_DIR"
cd "$TAPIOCA_INSTALL_DIR" || exit
zip -qr "../tapioca.zip" "tapiocaLambda.js" "node_modules"
cd "$CURRENT_DIR" || exit
rm -rf "$TAPIOCA_INSTALL_DIR"
echo " DONE."

echo -n "Preparing oauth:"
OAUTH_INSTALL_DIR="$INSTALL_DIR/oauth"
mkdir "$OAUTH_INSTALL_DIR"
cp -R "./node_modules" "$OAUTH_INSTALL_DIR"
cp "./oauthLambda.js" "$OAUTH_INSTALL_DIR"
cd "$OAUTH_INSTALL_DIR" || exit
zip -qr "../oauth.zip" "oauthLambda.js" "node_modules"
cd "$CURRENT_DIR" || exit
rm -rf "$OAUTH_INSTALL_DIR"
echo " DONE."

echo "Build complete. ZIP files are in $INSTALL_DIR"
