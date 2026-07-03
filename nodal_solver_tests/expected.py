"""Analytical expected values matching CircuitWiz's MNA device models."""

from __future__ import annotations

import math

VCC = 5.0
LED_VF = 2.0
LED_SERIES_R = 10.0
ZENER_VZ = 3.3
ZENER_SERIES_R = 0.5
DIODE_VF = 0.7
DIODE_SERIES_R = 0.5
NPN_VCE_SAT = 0.2
NPN_CE_R = 0.5
CAP_CHARGE_DT = 0.05
CAP_ITERATIONS = 12


def voltage_divider(vin: float, r1: float, r2: float) -> dict[str, float]:
    v_mid = vin * r2 / (r1 + r2)
    current = vin / (r1 + r2)
    return {
        "v_mid": v_mid,
        "current": current,
        "r_eq": r1 + r2,
        "power": vin * current,
    }


def series_resistors(vin: float, r1: float, r2: float) -> dict[str, float]:
    r_eq = r1 + r2
    current = vin / r_eq
    v_mid = vin * r2 / r_eq
    return {
        "current": current,
        "v_mid": v_mid,
        "r_eq": r_eq,
        "power": vin * current,
    }


def parallel_resistors(vin: float, r1: float, r2: float) -> dict[str, float]:
    r_eq = r1 * r2 / (r1 + r2)
    i_total = vin / r_eq
    i_r1 = vin / r1
    i_r2 = vin / r2
    return {
        "r_eq": r_eq,
        "i_total": i_total,
        "i_r1": i_r1,
        "i_r2": i_r2,
        "power": vin * i_total,
    }


def led_with_resistor(vcc: float, r: float, vf: float = LED_VF, r_led: float = LED_SERIES_R) -> dict[str, float]:
    current = (vcc - vf) / (r + r_led)
    return {
        "current": current,
        "power": vcc * current,
        "r_eq": (r + r_led),
    }


def rc_capacitor_voltage(
    vin: float,
    r: float,
    c: float,
    *,
    dt: float = CAP_CHARGE_DT,
    iterations: int = CAP_ITERATIONS,
) -> float:
    tau = r * c * 1000  # matches CircuitSolver.ts: tau = cap.capacitance * 1000
    alpha = 1.0 - math.exp(-dt / tau) if tau > 0 else 1.0
    stored = 0.0
    target = vin
    for _ in range(iterations):
        stored += (target - stored) * alpha
    return stored


def npn_switch(
    vcc: float,
    r_load: float,
    *,
    vce_sat: float = NPN_VCE_SAT,
    ce_r: float = NPN_CE_R,
) -> dict[str, float]:
    current = (vcc - vce_sat) / (r_load + ce_r)
    v_collector = vce_sat + current * ce_r
    return {
        "load_current": current,
        "v_collector": v_collector,
        "power": vcc * current,
    }


def zener_clamp(
    vin: float,
    r: float,
    vz: float = ZENER_VZ,
    zener_r: float = ZENER_SERIES_R,
) -> dict[str, float]:
    v_out = vz
    current = (vin - vz) / (r + zener_r)
    return {
        "v_out": v_out,
        "current": current,
        "power": vin * current,
    }


def half_wave_rectifier_peak(
    vrms: float,
    r_load: float,
    *,
    diode_vf: float = DIODE_VF,
    diode_r: float = DIODE_SERIES_R,
) -> dict[str, float]:
    v_peak = vrms * math.sqrt(2)
    current = (v_peak - diode_vf) / (r_load + diode_r)
    v_load = current * r_load
    return {
        "v_peak": v_peak,
        "v_load": v_load,
        "current": current,
        "power": v_peak * current,
    }


def op_amp_open_loop_positive_rail(v_non_inv: float, *, vcc: float = VCC, vee: float = 0.0) -> float:
    return max(vee, min(vcc, vcc))
