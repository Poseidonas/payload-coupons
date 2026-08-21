# Changelog

All notable changes to this package are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this package
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-08-21

### Changed

- Narrowed the `payload` peer dependency from `>=3.50 <4` to **`>=3.88 <4`**. The wider range
  covered 56 releases that were never tested; the package is verified against Payload 3.88.0 and
  now says so.

### Added

- **`@payloadcms/plugin-ecommerce` is declared as a peer dependency** (`>=3.88 <4`). The package
  always worked against the collections that plugin creates, but nothing in the metadata said so,
  which left tooling and directories unable to determine compatibility.
- Compatibility badge and an explicit requirements line in the README.

### Fixed

- `repository.url` normalised to the `git+https://…​.git` form, removing a warning on publish.

## [1.0.0] — 2026-08-19

### Added

- Initial release.
