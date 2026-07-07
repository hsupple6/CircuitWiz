#!/usr/bin/env python3
"""Discover and run every test case under *_tests/ folders in the repo."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THIS_DIR = Path(__file__).resolve().parent

# Python modules that only shell out to a TS test (TS discovery runs those scripts).
PYTHON_TS_DELEGATES = frozenset({"test_regulators.py"})

# TypeScript utilities — not standalone test runners.
TS_EXCLUDE = frozenset({"solver_bridge.ts"})


def discover_test_directories() -> list[Path]:
    dirs = sorted(p for p in ROOT.glob("*_tests") if p.is_dir())
    if not dirs:
        dirs = [THIS_DIR]
    return dirs


def discover_python_modules(test_dir: Path) -> list[Path]:
    return sorted(
        p
        for p in test_dir.glob("test_*.py")
        if p.name not in PYTHON_TS_DELEGATES
    )


def discover_ts_scripts(test_dir: Path) -> list[Path]:
    return sorted(p for p in test_dir.glob("test_*.ts") if p.name not in TS_EXCLUDE)


def load_python_tests(test_dir: Path, module_path: Path) -> list[tuple[str, Callable[[], None]]]:
    module_name = f"_cw_test_{test_dir.name}_{module_path.stem}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {module_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    raw_tests = getattr(module, "TESTS", None)
    if not raw_tests:
        return []

    section = module_path.stem.removeprefix("test_")
    return [(f"{test_dir.name}/{section}: {name}", fn) for name, fn in raw_tests]


def run_ts_script(test_dir: Path, script_path: Path) -> tuple[str, str | None]:
    from harness import run_test

    label = f"{test_dir.name}/{script_path.stem}"

    def _run() -> None:
        proc = subprocess.run(
            ["npx", "tsx", str(script_path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise AssertionError(
                f"exit code {proc.returncode}\n"
                f"stdout:\n{proc.stdout}\n"
                f"stderr:\n{proc.stderr}"
            )

    _, error = run_test(label, _run)
    return label, error


def main() -> int:
    # Ensure nodal_solver_tests imports (harness, expected) resolve.
    if str(THIS_DIR) not in sys.path:
        sys.path.insert(0, str(THIS_DIR))

    from harness import SolverHarness, run_test

    test_dirs = discover_test_directories()

    print("CircuitWiz test suite")
    print("=" * 50)
    print("Test directories:")
    for directory in test_dirs:
        print(f"  - {directory.relative_to(ROOT)}/")
    print()

    python_tests: list[tuple[str, Callable[[], None]]] = []
    ts_scripts: list[tuple[Path, Path]] = []

    for test_dir in test_dirs:
        for module_path in discover_python_modules(test_dir):
            python_tests.extend(load_python_tests(test_dir, module_path))
        for script_path in discover_ts_scripts(test_dir):
            ts_scripts.append((test_dir, script_path))

    if not python_tests and not ts_scripts:
        print("No tests found (expected test_*.py with TESTS or test_*.ts scripts).")
        return 1

    failures: list[tuple[str, str]] = []
    passed = 0

    if python_tests:
        print(f"[Python — {len(python_tests)} case(s)]")
        SolverHarness().run_bridge()
        for label, fn in python_tests:
            _, error = run_test(label, fn)
            if error is None:
                passed += 1
                print(f"PASS  {label}")
            else:
                failures.append((label, error))
                print(f"FAIL  {label}\n      {error}")
        print()

    if ts_scripts:
        print(f"[TypeScript — {len(ts_scripts)} script(s)]")
        for test_dir, script_path in ts_scripts:
            label, error = run_ts_script(test_dir, script_path)
            if error is None:
                passed += 1
                print(f"PASS  {label}")
            else:
                failures.append((label, error))
                print(f"FAIL  {label}\n      {error}")
        print()

    total = passed + len(failures)
    print("=" * 50)
    print(f"RESULT: {passed} passed, {len(failures)} failed, {total} total")

    if failures:
        print("\nFailed tests:")
        for label, error in failures:
            print(f"  - {label}")
            for line in error.splitlines():
                print(f"      {line}")
        return 1

    print("\nAll tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
