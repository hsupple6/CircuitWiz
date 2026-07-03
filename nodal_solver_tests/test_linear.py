"""Linear DC circuit tests: resistors in series, parallel, and divider topologies."""

from __future__ import annotations

from harness import (
    SolverHarness,
    assert_close,
    assert_solver_works,
    resistor_at,
    resistor_lead_voltage,
)
from expected import VCC, parallel_resistors, series_resistors, voltage_divider

HARNESS = SolverHarness()


def test_voltage_divider() -> None:
    result = HARNESS.circuit("voltage_divider")
    assert_solver_works(result)
    expected = voltage_divider(VCC, 10_000, 10_000)

    r_top = resistor_at(result, 6, 10)
    r_bottom = resistor_at(result, 6, 14)

    assert_close(r_top.output_current, expected["current"], label="divider branch current")
    assert_close(r_bottom.output_current, expected["current"], label="divider branch current (R2)")
    assert_close(result.total_current, expected["current"], label="divider total current")
    assert_close(result.total_resistance, expected["r_eq"], label="divider total resistance")
    assert_close(result.total_power, expected["power"], label="divider total power")
    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=True),
        expected["v_mid"],
        label="divider junction voltage",
    )
    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=False),
        VCC,
        label="divider top at 5V",
    )
    assert_close(
        resistor_lead_voltage(result, 6, 14, high_side=True),
        0.0,
        abs_tol=1e-6,
        label="divider bottom at GND",
    )


def test_series_resistors() -> None:
    result = HARNESS.circuit("series_resistors")
    assert_solver_works(result)
    expected = series_resistors(VCC, 3_000, 2_000)

    r1 = resistor_at(result, 6, 10)
    r2 = resistor_at(result, 10, 10)

    assert_close(r1.output_current, expected["current"], label="series current through R1")
    assert_close(r2.output_current, expected["current"], label="series current through R2")
    assert_close(result.total_current, expected["current"], label="series total current")
    assert_close(result.total_resistance, expected["r_eq"], label="series total resistance")
    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=True),
        expected["v_mid"],
        label="series midpoint voltage",
    )


def test_single_resistor_load() -> None:
    result = HARNESS.circuit("single_resistor")
    assert_solver_works(result)
    expected_current = VCC / 1_000

    r = resistor_at(result, 6, 10)
    assert_close(r.output_current, expected_current, label="single resistor current")
    assert_close(result.total_current, expected_current, label="single resistor total current")
    assert_close(result.total_resistance, 1_000, label="single resistor total resistance")
    assert_close(result.total_power, VCC * expected_current, label="single resistor power")


def test_parallel_resistors() -> None:
    result = HARNESS.circuit("parallel_resistors")
    assert_solver_works(result)
    expected = parallel_resistors(VCC, 1_000, 2_000)

    r1 = resistor_at(result, 6, 8)
    r2 = resistor_at(result, 6, 12)

    assert_close(r1.output_current, expected["i_r1"], label="parallel R1 current")
    assert_close(r2.output_current, expected["i_r2"], label="parallel R2 current")
    assert_close(result.total_current, expected["i_total"], label="parallel total current")
    assert_close(result.total_resistance, expected["r_eq"], label="parallel equivalent resistance")
    assert_close(result.total_power, expected["power"], label="parallel total power")
    assert_close(resistor_lead_voltage(result, 6, 8, high_side=False), VCC, label="parallel top rail R1")
    assert_close(resistor_lead_voltage(result, 6, 12, high_side=False), VCC, label="parallel top rail R2")


TESTS = [
    ("voltage divider", test_voltage_divider),
    ("series resistors", test_series_resistors),
    ("single resistor load", test_single_resistor_load),
    ("parallel resistors", test_parallel_resistors),
]

if __name__ == "__main__":
    from harness import run_suite

    raise SystemExit(run_suite(TESTS))
