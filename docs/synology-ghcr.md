# Synology deployment from GHCR

The production image is `ghcr.io/azimul-kabir/dockge-v2:latest`. It contains a
multi-platform manifest for `linux/amd64` and `linux/arm64`; Docker selects the
DS220+ compatible `amd64` image automatically.

## One-time GitHub package setup

Run the **Publish Dockge V2 image** workflow once. After its first successful
publish, open the GitHub package page, choose **Package settings**, scroll to
**Danger Zone**, select **Change visibility**, choose **Public**, and confirm.
Public visibility allows the NAS to pull without a GHCR login. The publishing
workflow uses the repository `GITHUB_TOKEN`; no PAT, Docker Hub credentials, or
additional repository secret is required.

## Production `compose.yaml`

```yaml
services:
  dockge:
    image: ghcr.io/azimul-kabir/dockge-v2:latest
    container_name: dockge
    restart: unless-stopped

    ports:
      - "5050:5001"

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /volume1/docker/dockge/data:/app/data
      - /volume1/docker/stacks:/volume1/docker/stacks

    environment:
      - DOCKGE_STACKS_DIR=/volume1/docker/stacks
      - DOCKER_API_VERSION=1.43
      - TZ=Asia/Dhaka
```

`DOCKER_API_VERSION=1.43` is a compatibility setting for this Synology deployment,
not a requirement for every Docker host. The Docker CLI bundled in the current
image may use a newer API, while the Synology Docker daemon used here supports
Docker API versions only up to 1.43. Without the override, Dockge may start
successfully, but Docker operations, stack discovery, and container statistics
can fail with the observed runtime error: `client version 1.53 is too new. Maximum
supported API version is 1.43`.

Keep any additional environment values already present in the production stack.
In particular, do not change the `/app/data` host path or either side of the
stacks-directory mount.

## Routine update

No Node.js, Git, npm, or source checkout is needed on the NAS:

```sh
cd /volume1/docker/stacks/dockge
docker compose pull
docker compose up -d
docker compose images
docker inspect dockge --format '{{.Config.Image}}'
```

Old, unused image layers can optionally be removed after verification:

```sh
docker image prune -f
```

## First migration from a local/test image

1. Publish the GHCR image and make its package public.
2. Back up the current `compose.yaml`, then run `docker compose pull` after
   changing only a test copy's image reference to the GHCR image.
3. Optionally test the GHCR image on host port `5051` with a distinct Compose
   project and container name. Do not run two Dockge containers concurrently
   against the same `/app/data` directory. Stop the current test container for
   this check, retain its Compose configuration and data, and start it again if
   rollback is needed.
4. Verify login, existing stacks, container access, and the reported image. Keep
   the current test image/container configuration available until these checks
   pass.
5. In the production stack on port `5050`, replace only `image:` with
   `ghcr.io/azimul-kabir/dockge-v2:latest` and preserve all volumes and
   environment values.
6. Run `docker compose up -d` to recreate the production container, then run the
   verification commands above.

This is an image-source change only: do not reset or migrate the database, delete
Dockge data, or change the stack-directory mount.
