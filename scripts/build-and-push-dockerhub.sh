#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  scripts/build-and-push-dockerhub.sh --username <dockerhub-user> [options]

Options:
  --username <name>       Docker Hub username or org. Can also use DOCKERHUB_USERNAME.
  --tag <tag>             Image tag to publish. Defaults to VERSION file contents.
  --repository <name>     Base repository name. Defaults to excalidash.
  --platforms <list>      buildx platforms. Defaults to linux/amd64,linux/arm64.
  --build-label <label>   Frontend build label. Defaults to production.
  --latest                Also push :latest for both images.
  --builder <name>        buildx builder name. Defaults to excalidash-builder.
  -h, --help              Show this help.

Examples:
  scripts/build-and-push-dockerhub.sh --username mydockeruser --tag 0.4.28 --latest
  DOCKERHUB_USERNAME=mydockeruser scripts/build-and-push-dockerhub.sh --tag custom-dev --build-label development
EOF
}

DOCKER_USERNAME="${DOCKERHUB_USERNAME:-}"
IMAGE_NAME="excalidash"
VERSION="$(tr -d '[:space:]' < VERSION)"
PLATFORMS="linux/amd64,linux/arm64"
BUILD_LABEL="production"
PUSH_LATEST="false"
BUILDER_NAME="excalidash-builder"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --username)
      DOCKER_USERNAME="${2:-}"
      shift 2
      ;;
    --tag)
      VERSION="${2:-}"
      shift 2
      ;;
    --repository)
      IMAGE_NAME="${2:-}"
      shift 2
      ;;
    --platforms)
      PLATFORMS="${2:-}"
      shift 2
      ;;
    --build-label)
      BUILD_LABEL="${2:-}"
      shift 2
      ;;
    --latest)
      PUSH_LATEST="true"
      shift
      ;;
    --builder)
      BUILDER_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DOCKER_USERNAME" ]]; then
  echo "ERROR: Docker Hub username is required." >&2
  usage
  exit 1
fi

if [[ -z "$VERSION" ]]; then
  echo "ERROR: Image tag cannot be empty." >&2
  exit 1
fi

echo "ExcaliDash Docker Hub Publisher"
echo "Username:    $DOCKER_USERNAME"
echo "Repository:  $IMAGE_NAME"
echo "Tag:         $VERSION"
echo "Platforms:   $PLATFORMS"
echo "Build label: $BUILD_LABEL"
echo "Push latest: $PUSH_LATEST"

echo "Checking Docker authentication..."
if ! docker info 2>/dev/null | grep -q '^ Username:'; then
  echo "Docker is not logged in. Running docker login..."
  docker login
fi

echo "Setting up buildx builder..."
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER_NAME" --use --bootstrap
else
  docker buildx use "$BUILDER_NAME"
  docker buildx inspect --bootstrap >/dev/null
fi

BACKEND_TAG_ARGS=(
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-backend:$VERSION"
)

FRONTEND_TAG_ARGS=(
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-frontend:$VERSION"
)

if [[ "$PUSH_LATEST" == "true" ]]; then
  BACKEND_TAG_ARGS+=(--tag "$DOCKER_USERNAME/$IMAGE_NAME-backend:latest")
  FRONTEND_TAG_ARGS+=(--tag "$DOCKER_USERNAME/$IMAGE_NAME-frontend:latest")
fi

echo "Building and pushing backend image..."
docker buildx build \
  --platform "$PLATFORMS" \
  "${BACKEND_TAG_ARGS[@]}" \
  --file backend/Dockerfile \
  --push \
  backend/

echo "Building and pushing frontend image..."
docker buildx build \
  --platform "$PLATFORMS" \
  "${FRONTEND_TAG_ARGS[@]}" \
  --build-arg VITE_APP_VERSION="$VERSION" \
  --build-arg VITE_APP_BUILD_LABEL="$BUILD_LABEL" \
  --file frontend/Dockerfile \
  --push \
  .

echo "Published images:"
echo "  $DOCKER_USERNAME/$IMAGE_NAME-backend:$VERSION"
echo "  $DOCKER_USERNAME/$IMAGE_NAME-frontend:$VERSION"

if [[ "$PUSH_LATEST" == "true" ]]; then
  echo "  $DOCKER_USERNAME/$IMAGE_NAME-backend:latest"
  echo "  $DOCKER_USERNAME/$IMAGE_NAME-frontend:latest"
fi
