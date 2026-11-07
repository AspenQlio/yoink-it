#!/bin/bash
set -e

cd /home/aspen/workspace/yoink-it

# Ensure clean state
git checkout master

# Function to build and release
build_and_release() {
    local hash=$1
    local tag=$2
    local title=$3
    local notes=$4

    echo "===> Checking out $tag ($hash)"
    git checkout $hash

    echo "===> Building APK for $tag"
    cd android
    ./gradlew assembleRelease
    cd ..

    echo "===> Creating GitHub Release for $tag"
    gh release create $tag android/app/build/outputs/apk/release/app-release.apk --title "$title" --notes "$notes"
}

build_and_release "ee108cc" "v2.0.0" "YoinkIt v2.0.0: Image Extraction" "- Added support for downloading images from Instagram, Reels, X, and TikTok links."
build_and_release "ee0b914" "v3.0.0" "YoinkIt v3.0.0: Selective Image Resolution" "- Implemented the ability to pick specific images and resolutions to save."
build_and_release "14e0ddc" "v4.0.0" "YoinkIt v4.0.0: Universal Auto-Scan" "- Implemented V4 universal auto-scan.\n- Added video slide selection.\n- Terminal-style progress bar and Yoink button."
build_and_release "f905eda" "v5.0.0" "YoinkIt v5.0.0: Spotify Search & Azure Theme" "- Universal Spotify search integration.\n- New Pale Azure monochromatic theme.\n- Android 11 permission fixes."

echo "===> Restoring master"
git checkout master
echo "===> Done!"
