# Python standalone runtime notices

These notices cover three libraries in the Windows speech worker built from
Astral's CPython 3.12.12 distribution with `BUILD` set to `20260127`.
The package map for `0.3.10-dev.7` matched the installed Python distribution
and packaged copies byte for byte. The Windows recipe and its download table
identify the dependency sources.
[Windows build recipe](https://github.com/astral-sh/python-build-standalone/blob/20260127/cpython-windows/build.py)
· [Pinned dependencies](https://github.com/astral-sh/python-build-standalone/blob/20260127/pythonbuild/downloads.py)

| Packaged library | Version or source | Notice |
| --- | --- | --- |
| `libcrypto-3-x64.dll`, `libssl-3-x64.dll` | OpenSSL 3.5.5, confirmed by file version and Python's `ssl.OPENSSL_VERSION` | [Apache 2.0 text](LICENSE.openssl-3.txt), identical to the [OpenSSL release license](https://github.com/openssl/openssl/blob/openssl-3.5.5/LICENSE.txt) |
| `sqlite3.dll` | SQLite 3.50.4, confirmed by file version and `sqlite3.sqlite_version` | [Supplier notice](LICENSE.sqlite.txt) and [SQLite public-domain statement](https://sqlite.org/copyright.html) |
| `libffi-8.dll` | `cpython-source-deps` commit `16fad4855b3d8c03b5910e405ff3a04395b39a98`, selected by Astral's Windows recipe | [Exact source notice](LICENSE.libffi-source.txt) from the [pinned libffi source](https://github.com/python/cpython-source-deps/blob/16fad4855b3d8c03b5910e405ff3a04395b39a98/LICENSE). It carries a 2021 copyright date, while Astral's generic notice carries 2019. |

| Notice file | SHA-256 |
| --- | --- |
| `LICENSE.openssl-3.txt` | `7d5450cb2d142651b8afa315b5f238efc805dad827d91ba367d8516bc9d49e7a` |
| `LICENSE.sqlite.txt` | `38bef3d28b24f145ea293bd3b6eb4b20396982abc8303128fb493986ea5bc719` |
| `LICENSE.libffi-source.txt` | `a61d06e8f7be57928e71e800eb9273b05cb8868c484108afe41e4305bb320dde` |

Future builds copy this directory into `resources/licenses/dependencies/native`.
Review these notices again when changing the Python distribution. Microsoft
runtime files and statically linked dependencies remain separate review items.
