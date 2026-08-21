# Changelog

All notable changes to this fork are documented here.

## [2.0.0] - 2026-08-22

Dockge V2 is modified and maintained by [Azimul Kabir](https://github.com/azimul-kabir), based on the original [Dockge](https://github.com/louislam/dockge) project.

### Added

- Configurable periodic Docker image update checks with bulk-update controls and progress feedback.
- Stack configuration history, automatic pre-save snapshots, and readable change summaries.
- Compose override file support and editing.
- Fullscreen compose and environment editors.
- Environment-variable usage intelligence.
- GitHub Container Registry publishing for `linux/amd64` and `linux/arm64`.
- Synology deployment and Docker API compatibility documentation.

### Changed

- Redesigned the responsive dashboard, stack workspace, editors, navigation, terminal, and container actions.
- Improved image-update indicators and mobile update actions.
- Improved light-mode contrast and editor theming.
- Updated the runtime requirement to Node.js 22.14 or later.

### Fixed

- Preserved empty compose override files in the editor.
- Restored environment-file persistence while saving stacks.
- Corrected configuration-history socket events and compose-page state handling.
- Fixed mobile editor spacing, scrolling, action placement, and routing behavior.

[2.0.0]: https://github.com/azimul-kabir/dockge/releases/tag/v2.0.0
