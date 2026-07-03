"""Utilities for running the CircuitWiz nodal solver and comparing results."""

from __future__ import annotations

import json
import math
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable

ROOT = Path(__file__).resolve().parent.parent
BRIDGE = ROOT / "nodal_solver_tests" / "solver_bridge.ts"


@dataclass(frozen=True)
class Component:
    component_id: str
    component_type: str
    x: int
    y: int
    output_voltage: float
    output_current: float
    voltage_drop: float | None = None
    power: float | None = None
    capacitor_voltage: float | None = None
    is_on: bool | None = None
    status: str | None = None


@dataclass(frozen=True)
class CircuitResult:
    id: str
    name: str
    works: bool
    reason: str | None
    errors: list[str]
    total_voltage: float
    total_current: float
    total_resistance: float
    total_power: float
    components: list[Component]


class SolverHarness:
    def __init__(self) -> None:
        self._cache: dict[str, CircuitResult] | None = None

    def run_bridge(self) -> dict[str, CircuitResult]:
        if self._cache is not None:
            return self._cache

        proc = subprocess.run(
            ["npx", "tsx", str(BRIDGE)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                "solver_bridge.ts failed\n"
                f"stdout:\n{proc.stdout}\n"
                f"stderr:\n{proc.stderr}"
            )

        payload = json.loads(proc.stdout)
        results: dict[str, CircuitResult] = {}
        for entry in payload["circuits"]:
            components = [
                Component(
                    component_id=c["componentId"],
                    component_type=c["componentType"],
                    x=c["position"]["x"],
                    y=c["position"]["y"],
                    output_voltage=float(c["outputVoltage"]),
                    output_current=float(c["outputCurrent"]),
                    voltage_drop=_optional_float(c.get("voltageDrop")),
                    power=_optional_float(c.get("power")),
                    capacitor_voltage=_optional_float(c.get("capacitorVoltage")),
                    is_on=c.get("isOn"),
                    status=c.get("status"),
                )
                for c in entry["components"]
            ]
            results[entry["id"]] = CircuitResult(
                id=entry["id"],
                name=entry["name"],
                works=bool(entry["works"]),
                reason=entry.get("reason"),
                errors=list(entry.get("errors") or []),
                total_voltage=float(entry["totalVoltage"]),
                total_current=float(entry["totalCurrent"]),
                total_resistance=float(entry["totalResistance"]),
                total_power=float(entry["totalPower"]),
                components=components,
            )

        self._cache = results
        return results

    def circuit(self, circuit_id: str) -> CircuitResult:
        return self.run_bridge()[circuit_id]


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def assert_close(
    actual: float,
    expected: float,
    *,
    rel: float = 0.02,
    abs_tol: float = 1e-3,
    label: str = "value",
) -> None:
    tolerance = max(abs_tol, abs(expected) * rel)
    if not math.isclose(actual, expected, rel_tol=0, abs_tol=tolerance):
        raise AssertionError(
            f"{label}: expected {expected:.6g}, got {actual:.6g} "
            f"(tolerance ±{tolerance:.6g})"
        )


def assert_solver_works(result: CircuitResult) -> None:
    if not result.works:
        raise AssertionError(
            f"Circuit '{result.name}' did not solve: {result.reason or 'unknown reason'}"
        )


def resistors(result: CircuitResult) -> list[Component]:
    return [c for c in result.components if c.component_type == "Resistor"]


def resistor_at(result: CircuitResult, x: int, y: int) -> Component:
    for component in resistors(result):
        if component.x == x and component.y == y:
            return component
    raise KeyError(f"No resistor at ({x}, {y}) in {result.name}")


def components_of_type(result: CircuitResult, component_type: str) -> list[Component]:
    return [c for c in result.components if c.component_type == component_type]


def first_component(result: CircuitResult, component_type: str) -> Component:
    matches = components_of_type(result, component_type)
    if not matches:
        raise KeyError(f"No component of type {component_type} in {result.name}")
    return matches[0]


def resistor_lead_voltage(result: CircuitResult, origin_x: int, origin_y: int, *, high_side: bool) -> float:
    lead_x = origin_x if not high_side else origin_x + 2
    for component in resistors(result):
        if component.x == lead_x and component.y == origin_y:
            return component.output_voltage
    raise KeyError(f"No resistor lead at ({lead_x}, {origin_y}) in {result.name}")


def run_test(name: str, fn: Callable[[], None]) -> tuple[str, str | None]:
    try:
        fn()
        return name, None
    except AssertionError as exc:
        return name, str(exc)
    except Exception as exc:  # pragma: no cover - unexpected failures
        return name, f"{type(exc).__name__}: {exc}"


def run_suite(tests: Iterable[tuple[str, Callable[[], None]]]) -> int:
    harness = SolverHarness()
    # Warm cache once so individual tests share solver output.
    harness.run_bridge()

    failures: list[tuple[str, str]] = []
    passed = 0
    for name, fn in tests:
        label, error = run_test(name, fn)
        if error is None:
            passed += 1
            print(f"PASS  {label}")
        else:
            failures.append((label, error))
            print(f"FAIL  {label}\n      {error}")

    print()
    print(f"{passed} passed, {len(failures)} failed, {passed + len(failures)} total")
    if failures:
        print("\nFailures:")
        for label, error in failures:
            print(f"  - {label}: {error}")
        return 1
    return 0
