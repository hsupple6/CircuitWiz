"""Dynamic and op-amp circuit tests."""

from __future__ import annotations

from harness import (
    SolverHarness,
    assert_close,
    assert_solver_works,
    resistor_at,
    resistor_lead_voltage,
)
from expected import VCC, op_amp_open_loop_positive_rail, voltage_divider

HARNESS = SolverHarness()


def test_rc_initial_inrush() -> None:
    """A discharged capacitor is modeled as a 0 V source, so the first solve looks like a short."""
    result = HARNESS.circuit("rc_circuit")
    assert_solver_works(result)

    expected_current = VCC / 1_000
    r = resistor_at(result, 6, 10)

    assert_close(r.output_current, expected_current, label="RC inrush current")
    assert_close(result.total_current, expected_current, label="RC total inrush current")
    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=True),
        0.0,
        abs_tol=1e-3,
        label="RC node held at ground while cap is discharged",
    )


def test_op_amp_open_loop() -> None:
    result = HARNESS.circuit("op_amp_open_loop")
    assert_solver_works(result)

    divider = voltage_divider(VCC, 10_000, 10_000)
    expected_vout = op_amp_open_loop_positive_rail(divider["v_mid"])
    r_out = resistor_at(result, 16, 10)

    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=True),
        divider["v_mid"],
        label="op-amp non-inverting input voltage",
    )
    assert_close(r_out.output_current, expected_vout / 10_000, rel=0.05, label="op-amp output load current")
    assert_close(
        resistor_lead_voltage(result, 16, 10, high_side=False),
        expected_vout,
        rel=0.03,
        label="op-amp saturated output voltage",
    )


TESTS = [
    ("RC initial inrush", test_rc_initial_inrush),
    ("op-amp open loop saturation", test_op_amp_open_loop),
]

if __name__ == "__main__":
    from harness import run_suite

    raise SystemExit(run_suite(TESTS))
