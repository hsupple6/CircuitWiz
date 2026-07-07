"""LM317 adjustable regulator with potentiometer feedback."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEST_SCRIPT = ROOT / "nodal_solver_tests" / "test_lm317_pot.ts"


def test_lm317_pot_sweep() -> None:
    proc = subprocess.run(
        ["npx", "tsx", str(TEST_SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            "LM317 pot sweep failed\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}"
        )


TESTS = [
    ("LM317M + pot varying Vout", test_lm317_pot_sweep),
]

if __name__ == "__main__":
    from harness import run_suite

    raise SystemExit(run_suite(TESTS))
