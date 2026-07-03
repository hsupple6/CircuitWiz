#!/usr/bin/env python3
"""Run all nodal solver validation tests against the CircuitWiz MNA engine."""

from __future__ import annotations

from harness import run_suite
from test_dynamic import TESTS as DYNAMIC_TESTS
from test_linear import TESTS as LINEAR_TESTS
from test_semiconductors import TESTS as SEMICONDUCTOR_TESTS


def main() -> int:
    print("CircuitWiz nodal solver validation")
    print("=" * 40)
    all_tests = [
        ("Linear", LINEAR_TESTS),
        ("Semiconductors", SEMICONDUCTOR_TESTS),
        ("Dynamic / Op-Amp", DYNAMIC_TESTS),
    ]

    exit_code = 0
    for section, tests in all_tests:
        print(f"\n[{section}]")
        code = run_suite(tests)
        if code != 0:
            exit_code = 1

    print()
    if exit_code == 0:
        print("All nodal solver tests passed.")
    else:
        print("Some nodal solver tests failed.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
