"""Semiconductor and nonlinear device tests (LED, Zener, NPN, rectifier)."""

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
    LED_VF,
    half_wave_rectifier_peak,
    led_with_resistor,
    nmos_switch,
    npn_switch,
    zener_clamp,
)

HARNESS = SolverHarness()


def test_led_resistor() -> None:
    result = HARNESS.circuit("led_resistor")
    assert_solver_works(result)
    expected = led_with_resistor(VCC, 220)

    r = resistor_at(result, 6, 12)
    assert_close(r.output_current, expected["current"], rel=0.03, label="LED branch current")
    assert_close(result.total_current, expected["current"], rel=0.03, label="LED total current")
    assert_close(
        resistor_lead_voltage(result, 6, 12, high_side=True),
        LED_VF,
        rel=0.03,
        label="LED anode voltage",
    )


def test_zener_clamp() -> None:
    result = HARNESS.circuit("zener_clamp")
    assert_solver_works(result)
    expected = zener_clamp(VCC, 1_000, vz=3.3)

    r = resistor_at(result, 6, 10)
    assert_close(r.output_current, expected["current"], rel=0.03, label="zener branch current")
    assert_close(result.total_current, expected["current"], rel=0.03, label="zener total current")
    assert_close(
        resistor_lead_voltage(result, 6, 10, high_side=True),
        expected["v_out"],
        rel=0.03,
        label="zener clamp voltage",
    )


def test_nmos_switch() -> None:
    result = HARNESS.circuit("nmos_switch")
    assert_solver_works(result)
    expected = nmos_switch(VCC, 1_000)

    r_load = resistor_at(result, 6, 8)
    assert_close(r_load.output_current, expected["load_current"], rel=0.03, label="NMOS load current")
    assert_close(result.total_current, expected["load_current"], rel=0.03, label="NMOS total current")
    assert_close(
        resistor_lead_voltage(result, 6, 8, high_side=True),
        expected["v_drain"],
        rel=0.1,
        label="NMOS drain voltage",
    )


def test_npn_switch() -> None:
    result = HARNESS.circuit("npn_switch")
    assert_solver_works(result)
    expected = npn_switch(VCC, 1_000)

    r_load = resistor_at(result, 6, 8)
    assert_close(r_load.output_current, expected["load_current"], rel=0.03, label="NPN load current")
    assert_close(result.total_current, expected["load_current"], rel=0.05, label="NPN total current")
    assert_close(
        resistor_lead_voltage(result, 6, 8, high_side=True),
        expected["v_collector"],
        rel=0.05,
        label="NPN collector voltage",
    )


def test_half_wave_rectifier() -> None:
    result = HARNESS.circuit("half_wave_rectifier")
    assert_solver_works(result)
    expected = half_wave_rectifier_peak(12, 1_000)

    r_load = resistor_at(result, 12, 10)
    assert_close(r_load.output_current, expected["current"], rel=0.05, label="rectifier load current")
    assert_close(result.total_current, expected["current"], rel=0.05, label="rectifier total current")
    assert_close(
        resistor_lead_voltage(result, 12, 10, high_side=False),
        expected["v_load"],
        rel=0.05,
        label="rectifier load voltage",
    )


TESTS = [
    ("LED + resistor", test_led_resistor),
    ("Zener clamp", test_zener_clamp),
    ("NMOS switch", test_nmos_switch),
    ("NPN switch", test_npn_switch),
    ("Half-wave rectifier", test_half_wave_rectifier),
]

if __name__ == "__main__":
    from harness import run_suite

    raise SystemExit(run_suite(TESTS))
