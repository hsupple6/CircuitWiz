"""Dynamic and op-amp circuit tests."""

from __future__ import annotations

from harness import (
    SolverHarness,
    assert_close,
    assert_solver_works,
    resistor_at,
    resistor_lead_voltage,
)
from expected import (
    VCC,
    op_amp_inverting_rail_limited,
    op_amp_open_loop_positive_rail,
    rc_capacitor_voltage,
    voltage_divider,
)

HARNESS = SolverHarness()


def test_rc_charging() -> None:
    """Cap charges toward Vin through R; current falls as Vc rises."""
    result = HARNESS.circuit("rc_circuit")
    assert_solver_works(result)

    expected_vc = rc_capacitor_voltage(VCC, 1_000, 0.0001)
    expected_current = (VCC - expected_vc) / 1_000

    cap_states = [c for c in result.components if c.component_type == "Capacitor"]
    assert cap_states, "expected capacitor component states"
    assert_close(cap_states[0].capacitor_voltage or 0, expected_vc, rel=0.05, label="RC cap voltage")
    assert_close(result.total_current, expected_current, rel=0.05, label="RC charge current")
    assert expected_vc > 3.0, "cap should be substantially charged after solver steps"


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


def test_op_amp_inverting() -> None:
    result = HARNESS.circuit("op_amp_inverting")
    assert_solver_works(result)

    vin = resistor_lead_voltage(result, 8, 14, high_side=False)
    expected_vout = op_amp_inverting_rail_limited(vin, rf=10_000, rin=1_000)

    assert vin > 0.1, "divider should provide positive input voltage"
    assert_close(
        resistor_lead_voltage(result, 20, 10, high_side=False),
        expected_vout,
        rel=0.05,
        label="inverting amp output (rail-limited)",
    )


TESTS = [
    ("RC charging", test_rc_charging),
    ("op-amp open loop saturation", test_op_amp_open_loop),
    ("op-amp inverting amplifier", test_op_amp_inverting),
]

if __name__ == "__main__":
    from harness import run_suite

    raise SystemExit(run_suite(TESTS))
