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

Defmt-parser omits its parent repository's license files from the crate.
Those files were obtained from the Git revision recorded in its original
.cargo_vcs_info.json. Both r-efi crates omit standalone license files.
Their original README and AUTHORS files are preserved, together with the
standard Apache-2.0 text as a reference for that declared licensing option.

The build copies this directory into its dependency license bundle.
[Tokenizers 0.23.3 source files](https://pypi.org/project/tokenizers/0.23.3/#files)
