# Tokenizers source dependency notices

This directory preserves the notices of all 151 registry packages listed in
the Cargo.lock file from Tokenizers 0.23.3's published Python source archive.
Each crate archive matched its Cargo.lock SHA-256 before its notices were
copied. URLs, hashes, declared license expressions and notice paths are in
provenance.json.

The lockfile includes optional dependencies, platform dependencies and
build-time dependencies. Collection covers this complete source set.
The supplier Windows wheel's exact feature selection and static composition
remain to be verified.

The packaged `tokenizers.pyd` in dev.15 matched the official cp310-abi3
Windows x64 wheel byte for byte. PyPI's publish attestation for that wheel
passed cryptographic verification with pypi-attestations 0.0.31 against the
expected repository identity, huggingface/tokenizers. Its publisher
certificate names revision `301277072263fb3830eb66eec7e47adadf76f1dc`.
The Cargo.lock file at that revision matches the collected source archive's
lockfile byte for byte. The release recipe invokes maturin with `--locked`.
The retained attestation and measured hashes are described in wheel-origin.json.
[Publisher release recipe](https://github.com/huggingface/tokenizers/blob/301277072263fb3830eb66eec7e47adadf76f1dc/.github/workflows/python-release.yml)

Defmt-parser omits its parent repository's license files from the crate.
Those files were obtained from the Git revision recorded in its original
.cargo_vcs_info.json. Both r-efi crates omit standalone license files.
Their original README and AUTHORS files are preserved, together with the
standard Apache-2.0 text as a reference for that declared licensing option.

The build copies this directory into its dependency license bundle.
[Tokenizers 0.23.3 source files](https://pypi.org/project/tokenizers/0.23.3/#files)
