from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import inspect
import json
from decimal import Decimal
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
from typing import Any

PROTOCOL = "pncw-gcm-phase-b-process/0.1"
PACKAGE_NAME = "gcm-reference-runtime"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _import_runtime():
    import gcm_runtime
    from gcm_runtime.model import WorldRef, FoundationRef
    return gcm_runtime, WorldRef, FoundationRef


def _symbol_map() -> dict[str, Any]:
    g, WorldRef, FoundationRef = _import_runtime()
    return {
        "ResourceRecord": g.ResourceRecord,
        "ResourceProvider": g.ResourceProvider,
        "StaticResourceProvider": g.StaticResourceProvider,
        "ResourceInventory": g.ResourceInventory,
        "ResourceInventory.capture": g.ResourceInventory.capture,
        "ResourceInventorySnapshot": g.ResourceInventorySnapshot,
        "resource_inventory_to_dict": g.resource_inventory_to_dict,
        "CapacityDimension": g.CapacityDimension,
        "DemandEstimate": g.DemandEstimate,
        "EstimateKind": g.EstimateKind,
        "ResourceDemand": g.ResourceDemand,
        "ResourceKind": g.ResourceKind,
        "ResourceAvailability": g.ResourceAvailability,
        "AllocationMode": g.AllocationMode,
        "AllocationTask": g.AllocationTask,
        "AllocationCandidate": g.AllocationCandidate,
        "AllocationRequest": g.AllocationRequest,
        "AllocationPlan": g.AllocationPlan,
        "AllocationSearchLimits": g.AllocationSearchLimits,
        "Allocator0.allocate": g.Allocator0.allocate,
        "build_allocation_candidates": g.build_allocation_candidates,
        "build_allocation_request": g.build_allocation_request,
        "validate_allocation_handoff": g.validate_allocation_handoff,
        "EnumerationLimits": g.EnumerationLimits,
        "FeasiblePlanEnumerator.enumerate": g.FeasiblePlanEnumerator.enumerate,
        "ObjectiveDefinition": g.ObjectiveDefinition,
        "ObjectiveDirection": g.ObjectiveDirection,
        "ObjectiveComparisonMode": g.ObjectiveComparisonMode,
        "ObjectiveEvaluationContext": g.ObjectiveEvaluationContext,
        "ObjectiveObservation": g.ObjectiveObservation,
        "ObjectiveObservationKind": g.ObjectiveObservationKind,
        "ObjectiveProfile": g.ObjectiveProfile,
        "ObjectiveVector": g.ObjectiveVector,
        "NormalizationProfile": g.NormalizationProfile,
        "FixedRangeNormalizer": g.FixedRangeNormalizer,
        "compute_pareto_frontier": g.compute_pareto_frontier,
        "select_from_frontier": g.select_from_frontier,
        "LexicographicPolicy": g.LexicographicPolicy,
        "WeightedLinearPolicy": g.WeightedLinearPolicy,
        "ReplanRequest": g.ReplanRequest,
        "ReplanningCoordinator.replan": g.ReplanningCoordinator.replan,
        "WorldRef": WorldRef,
        "FoundationRef": FoundationRef,
    }


def public_api_snapshot() -> dict[str, Any]:
    g, _, _ = _import_runtime()
    symbols: dict[str, Any] = {}
    for name, obj in _symbol_map().items():
        symbols[name] = {
            "visibility": "public",
            "module": getattr(obj, "__module__", ""),
            "signature": str(inspect.signature(obj)),
        }
    try:
        package_version = importlib.metadata.version(PACKAGE_NAME)
    except importlib.metadata.PackageNotFoundError:
        pyproject = Path(g.__file__).resolve().parents[2] / "pyproject.toml"
        if not pyproject.exists():
            raise
        package_version = str(tomllib.loads(pyproject.read_text(encoding="utf-8"))["project"]["version"])
    return {
        "packageName": PACKAGE_NAME,
        "packageVersion": package_version,
        "allocatorContractVersion": g.ALLOCATION_SCHEMA_VERSION,
        "importOrigin": str(Path(g.__file__).resolve()),
        "symbols": symbols,
    }


def run_conformance(profile: str) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="pncw-gcm-conformance-") as td:
        proc = subprocess.run(
            [sys.executable, "-m", "gcm_runtime.cli", "allocator-conformance", "--profile", profile, "--output", td],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        result_path = Path(td) / "allocator_conformance_result.json"
        if not result_path.exists():
            raise RuntimeError(f"allocator conformance produced no result.json; exit={proc.returncode}")
        data = json.loads(result_path.read_text(encoding="utf-8"))
        if proc.returncode != 0:
            raise RuntimeError(f"allocator conformance failed with exit {proc.returncode}: {data.get('claim')}")
        return data


def _parse_versioned_ref(value: str, label: str) -> tuple[str, int]:
    if not isinstance(value, str) or "@" not in value:
        raise ValueError(f"{label} must use <id>@<integer-version>")
    ident, raw = value.rsplit("@", 1)
    if not ident or not raw.isdigit():
        raise ValueError(f"invalid {label}")
    return ident, int(raw)


def _load_registry(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schema") != "pncw-real-gcm-snapshot-registry/v1" or not isinstance(data.get("snapshots"), dict):
        raise ValueError("invalid GCM snapshot registry")
    return data


def _resource_record(g: Any, row: dict[str, Any]):
    allowed = {
        "resource_id", "provider_id", "kind", "availability", "capabilities", "capacities",
        "configuration_estimates", "configuration_quality", "locality", "metadata",
    }
    unknown = set(row) - allowed
    if unknown:
        raise ValueError(f"unknown ResourceRecord fields: {sorted(unknown)}")
    return g.ResourceRecord(
        resource_id=str(row["resource_id"]),
        provider_id=str(row["provider_id"]),
        kind=g.ResourceKind(str(row["kind"])),
        availability=g.ResourceAvailability(str(row["availability"])),
        capabilities=frozenset(str(x) for x in row.get("capabilities", [])),
        capacities={str(k): float(v) for k, v in row.get("capacities", {}).items()},
        configuration_estimates={
            str(cfg): {str(k): float(v) for k, v in estimates.items()}
            for cfg, estimates in row.get("configuration_estimates", {}).items()
        },
        configuration_quality={str(k): float(v) for k, v in row.get("configuration_quality", {}).items()},
        locality=str(row.get("locality", "local")),
        metadata=dict(row.get("metadata", {})),
    )


def _snapshot(config: dict[str, Any], frozen: dict[str, Any]):
    g, WorldRef, FoundationRef = _import_runtime()
    registry = _load_registry(config["snapshotRegistryPath"])
    ref = frozen["snapshotRef"]
    row = registry["snapshots"].get(ref)
    if not isinstance(row, dict):
        raise ValueError("frozen snapshotRef not found in configured registry")
    required = {"worldRef", "foundationRef", "gcmAuthorityRef", "resourceSnapshotId", "resourceSnapshotDigest", "resources"}
    if set(row) != required:
        raise ValueError("snapshot registry entry is not closed")
    world_id, world_rev = _parse_versioned_ref(row["worldRef"], "worldRef")
    foundation_id, foundation_ver = _parse_versioned_ref(row["foundationRef"], "foundationRef")
    records = tuple(_resource_record(g, item) for item in row["resources"])
    by_provider: dict[str, list[Any]] = {}
    for record in records:
        by_provider.setdefault(record.provider_id, []).append(record)
    providers = tuple(
        g.StaticResourceProvider(pid, tuple(sorted(items, key=lambda r: r.resource_id)))
        for pid, items in sorted(by_provider.items())
    )
    snapshot = g.ResourceInventory(providers).capture(tick=1)
    expected_id = str(row["resourceSnapshotId"])
    expected_digest = str(row["resourceSnapshotDigest"])
    actual_digest = "sha256:" + snapshot.snapshot_id.removeprefix("resource-snapshot:")
    if snapshot.snapshot_id != expected_id or actual_digest != expected_digest:
        raise ValueError("reconstructed B2 resource snapshot identity mismatch")
    return g, WorldRef(world_id, world_rev), FoundationRef(foundation_id, foundation_ver), str(row["gcmAuthorityRef"]), snapshot


def _integer_decimal(value: str, label: str) -> int:
    if not isinstance(value, str) or not value.isdigit():
        raise ValueError(f"{label} must be a non-negative canonical integer for GCM v0.4")
    return int(value)


def _demand_estimate(g: Any, estimate: dict[str, Any], unit: str):
    kind = estimate.get("kind")
    if kind == "KNOWN":
        return g.DemandEstimate(g.EstimateKind.KNOWN, unit, value=_integer_decimal(estimate["value"], "KNOWN demand"))
    if kind == "BOUNDED":
        return g.DemandEstimate(
            g.EstimateKind.BOUNDED, unit,
            lower=_integer_decimal(estimate["lower"], "BOUNDED lower"),
            upper=_integer_decimal(estimate["upper"], "BOUNDED upper"),
        )
    if kind == "ESTIMATED":
        if not estimate.get("hardSafe"):
            raise ValueError("ESTIMATED hard demand is not hard-safe")
        return g.DemandEstimate(
            g.EstimateKind.ESTIMATED, unit,
            value=_integer_decimal(estimate["value"], "ESTIMATED demand"),
            estimator_id=str(estimate.get("provenance") or "pncw"),
            hard_safe=True,
            evidence={"source": "pncw"},
        )
    raise ValueError("UNKNOWN hard demand cannot enter real GCM allocation")


def _expand_candidates(config: dict[str, Any], request: dict[str, Any], world: Any, foundation: Any, authority_ref: str, snapshot: Any):
    g, _, _ = _import_runtime()
    route_profiles = config.get("routeProfiles", {})
    dimensions: dict[str, Any] = {}
    bound: list[Any] = []
    binding_to_cid: dict[str, str] = {}
    rejected: dict[str, str] = {}
    task_id = "task:pncw-projection"

    for candidate in sorted(request["candidates"], key=lambda x: x["candidateId"]):
        cid = candidate["candidateId"]
        rp = route_profiles.get(candidate["planningClass"])
        if not isinstance(rp, dict):
            rejected[cid] = "UNSUPPORTED_PLANNING_CLASS"
            continue
        executor_id = str(rp.get("executorId", ""))
        configuration_id = str(rp.get("configurationId", ""))
        required_caps = frozenset(str(x) for x in rp.get("requiredCapabilities", []))
        if not executor_id or not configuration_id:
            rejected[cid] = "INVALID_ROUTE_PROFILE"
            continue
        demands: dict[str, Any] = {}
        for item in candidate.get("demandProfile", {}).get("demands", []):
            dim = str(item["dimensionId"])
            unit = str(item["unit"])
            existing = dimensions.get(dim)
            if existing is not None and existing.unit != unit:
                raise ValueError(f"dimension unit mismatch for {dim}")
            dimensions[dim] = g.CapacityDimension(dim, unit)
            demands[dim] = _demand_estimate(g, item["estimate"], unit)

        compatible = 0
        for resource in snapshot.resources:
            if resource.availability is not g.ResourceAvailability.AVAILABLE:
                continue
            if not required_caps.issubset(resource.capabilities):
                continue
            if configuration_id not in resource.configuration_estimates:
                continue
            binding_id = f"binding:{hashlib.sha256((cid + chr(0) + resource.resource_id).encode()).hexdigest()}"
            demand = g.ResourceDemand(task_id, binding_id, demands, {"source": "pncw"})
            bound.append(g.AllocationCandidate(
                task_id=task_id,
                candidate_id=binding_id,
                executor_id=executor_id,
                configuration_id=configuration_id,
                resource_id=resource.resource_id,
                demand=demand,
                planning_candidate_ref=cid,
                resource_binding_ref=f"{snapshot.snapshot_id}:{resource.resource_id}",
                world_ref=world,
                foundation_ref=foundation,
                authority_ref=authority_ref,
                resource_snapshot_id=snapshot.snapshot_id,
                required_capabilities=required_caps,
                safe=True,
                evidence={"adapter": "pncw-real-gcm-phase-b/v0.2", "planning_class": candidate["planningClass"]},
            ))
            binding_to_cid[binding_id] = cid
            compatible += 1
        if compatible == 0:
            rejected[cid] = "NO_COMPATIBLE_RESOURCE_BINDING"
    if not bound:
        raise RuntimeError("NO_FEASIBLE_PLAN:no compatible public resource bindings")
    return dimensions, tuple(sorted(bound, key=lambda c: c.candidate_id)), binding_to_cid, rejected


def _known_objectives(g: Any, request: dict[str, Any], plans: tuple[Any, ...], binding_to_cid: dict[str, str], world: Any, foundation: Any, authority_ref: str, snapshot: Any):
    candidates = {row["candidateId"]: row for row in request["candidates"]}
    objective_ids: set[str] = set()
    by_candidate: dict[str, dict[str, dict[str, Any]]] = {}
    definitions: dict[str, tuple[str, str]] = {}
    for cid, candidate in candidates.items():
        obs_map: dict[str, dict[str, Any]] = {}
        for obs in candidate.get("objectiveObservations", []):
            if obs.get("observation", {}).get("kind") != "KNOWN":
                raise RuntimeError("POLICY_INDETERMINATE:real bridge v0.4 supports KNOWN objectives only")
            oid = str(obs["objectiveId"])
            direction = str(obs["direction"])
            unit = str(obs["unit"])
            if oid in definitions and definitions[oid] != (direction, unit):
                raise RuntimeError(f"POLICY_INDETERMINATE:objective {oid} direction/unit mismatch")
            definitions[oid] = (direction, unit)
            objective_ids.add(oid)
            obs_map[oid] = obs
        by_candidate[cid] = obs_map
    if not objective_ids:
        raise RuntimeError("POLICY_INDETERMINATE:no objective observations")
    for cid in candidates:
        if set(by_candidate[cid]) != objective_ids:
            raise RuntimeError("POLICY_INDETERMINATE:objective coverage differs across candidates")

    definitions_out = []
    for oid in sorted(objective_ids):
        direction, unit = definitions[oid]
        definitions_out.append(g.ObjectiveDefinition(
            oid,
            g.ObjectiveDirection.MINIMIZE if direction == "MINIMIZE" else g.ObjectiveDirection.MAXIMIZE,
            unit,
            f"pncw:{oid}",
            "1",
            g.ObjectiveComparisonMode.EXACT_ONLY,
            True,
        ))
    profile = g.ObjectiveProfile("profile:pncw-projection", "1", tuple(definitions_out))
    context = g.ObjectiveEvaluationContext(
        "context:pncw-projection",
        profile.profile_id,
        world,
        foundation,
        authority_ref,
        snapshot.snapshot_id,
        {oid: "1" for oid in sorted(objective_ids)},
    )
    vectors: dict[str, Any] = {}
    for plan in plans:
        if len(plan.assignments) != 1:
            raise RuntimeError("PLAN_INTEGRITY_FAILURE:PNCW projection plan must contain exactly one assignment")
        binding_id = plan.assignments[0].candidate_id
        cid = binding_to_cid[binding_id]
        source: dict[str, Any] = {}
        values: dict[str, Any] = {}
        for oid in sorted(objective_ids):
            row = by_candidate[cid][oid]
            value = Decimal(str(row["observation"]["value"]))
            source[oid] = g.ObjectiveObservation(
                oid,
                g.ObjectiveObservationKind.KNOWN,
                row["unit"],
                value=value,
                provenance={"source": "pncw"},
            )
            values[oid] = value
        vectors[plan.allocation_plan_id] = g.ObjectiveVector(
            plan.allocation_plan_id,
            profile.profile_id,
            context.context_id,
            values,
            source,
        )
    return profile, vectors


def _plan(config: dict[str, Any], request: dict[str, Any], *, replan_parent: str | None = None) -> dict[str, Any]:
    g, world, foundation, authority_ref, snapshot = _snapshot(config, request["frozenInputRef"])
    dimensions, bound, binding_to_cid, rejected = _expand_candidates(config, request, world, foundation, authority_ref, snapshot)
    task = g.AllocationTask("task:pncw-projection", tuple(c.candidate_id for c in bound), True)
    alloc_request = g.AllocationRequest(
        request["planningRequestId"],
        f"intent:{request['planningRequestId']}",
        (task,),
        world,
        foundation,
        authority_ref,
        snapshot.snapshot_id,
        request["budget"]["budgetId"],
        g.AllocationMode.ALL_REQUIRED,
        g.ALLOCATION_SCHEMA_VERSION,
        g.AllocationSearchLimits(10000, 10000),
    )
    plan_set = g.FeasiblePlanEnumerator(dimensions).enumerate(
        alloc_request,
        bound,
        snapshot,
        g.EnumerationLimits(10000, 10000, 512),
    )
    plans = tuple(plan_set.plans)
    if not plans:
        raise RuntimeError("NO_FEASIBLE_PLAN:GCM B3 enumerated no feasible allocation plan")
    profile, vectors = _known_objectives(g, request, plans, binding_to_cid, world, foundation, authority_ref, snapshot)
    frontier_result = g.compute_pareto_frontier(plan_set, vectors, profile)
    frontier = getattr(frontier_result, "frontier", None)
    if frontier is None:
        raise RuntimeError("POLICY_INDETERMINATE:GCM B4 frontier is incomplete/rejected")
    policy_input = request["selectionPolicy"]
    policy_digest = request["frozenInputRef"]["policyDigest"]
    normalization = None
    if policy_input["kind"] == "LEXICOGRAPHIC":
        policy = g.LexicographicPolicy(
            f"policy:{policy_digest}",
            "1",
            profile.profile_id,
            tuple(policy_input["objectiveOrder"]),
            True,
        )
    elif policy_input["kind"] == "WEIGHTED":
        if policy_input.get("normalizationProfile") != "pncw:unit-interval/v1":
            raise RuntimeError("POLICY_INDETERMINATE:unsupported weighted normalization profile")
        policy = g.WeightedLinearPolicy(
            f"policy:{policy_digest}",
            "1",
            profile.profile_id,
            {key: Decimal(str(value)) for key, value in policy_input["weights"].items()},
            True,
        )
        first_vector = vectors[next(iter(vectors))]
        normalization = g.NormalizationProfile(
            "norm:pncw-unit-interval",
            "1",
            {
                oid: g.FixedRangeNormalizer(oid, Decimal("0"), Decimal("1"))
                for oid in sorted(first_vector.comparison_values)
            },
        )
    else:
        raise RuntimeError("POLICY_INDETERMINATE:unknown policy kind")
    selection_result = g.select_from_frontier(frontier, policy, profile, normalization)
    selection = getattr(selection_result, "selection", None)
    if selection is None:
        raise RuntimeError("POLICY_INDETERMINATE:GCM B4 policy selection rejected")
    selected_plan = next((plan for plan in plans if plan.allocation_plan_id == selection.selected_plan_id), None)
    if selected_plan is None or len(selected_plan.assignments) != 1:
        raise RuntimeError("PLAN_INTEGRITY_FAILURE:selected allocation plan is missing or ambiguous")
    selected_binding = selected_plan.assignments[0].candidate_id
    selected_cid = binding_to_cid[selected_binding]
    feasible_cids = sorted({
        binding_to_cid[plan.assignments[0].candidate_id]
        for plan in plans
        if len(plan.assignments) == 1
    })
    all_cids = {row["candidateId"] for row in request["candidates"]}
    for cid in sorted(all_cids - set(feasible_cids)):
        rejected.setdefault(cid, "GCM_B3_INFEASIBLE")
    candidate_by_id = {row["candidateId"]: row for row in request["candidates"]}
    result = {
        "planningRequestId": request["planningRequestId"],
        "candidateSetDigest": request["frozenInputRef"]["candidateSetDigest"],
        "budgetDigest": request["frozenInputRef"]["budgetDigest"],
        "policyDigest": request["frozenInputRef"]["policyDigest"],
        "frozenInputDigest": request["frozenInputRef"]["frozenInputDigest"],
        "selectedCandidateId": selected_cid,
        "selectedCandidate": candidate_by_id[selected_cid],
        "feasibleCandidateIds": feasible_cids,
        "rejectedCandidates": [
            {"candidateId": cid, "reasonCode": rejected[cid]}
            for cid in sorted(rejected)
        ],
        "allocationPlanRef": selected_plan.allocation_plan_id,
        "allocationPlanDigest": selected_plan.plan_digest,
        "policySelectionRef": selection.selection_id,
        "policySelectionDigest": selection.selection_digest,
        "allocatorContractVersion": g.ALLOCATION_SCHEMA_VERSION,
    }
    if replan_parent is not None:
        result["replanLineageRef"] = "pncw-gcm-adapter:pre-admission-replan:" + hashlib.sha256(
            canonical_json({
                "parentPlanningId": replan_parent,
                "frozenInputDigest": result["frozenInputDigest"],
                "allocationPlanDigest": result["allocationPlanDigest"],
            }).encode("utf-8")
        ).hexdigest()
    return result


class Host:
    def __init__(self) -> None:
        self.config: dict[str, Any] | None = None
        self.api: dict[str, Any] | None = None
        self.conformance: dict[str, Any] | None = None

    def initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        api = public_api_snapshot()
        expected_version = str(params.get("expectedPackageVersion", ""))
        expected_contract = str(params.get("expectedAllocatorContractVersion", ""))
        if api["packageVersion"] != expected_version:
            raise RuntimeError("GCM package version mismatch")
        if api["allocatorContractVersion"] != expected_contract:
            raise RuntimeError("GCM allocator contract version mismatch")
        if params.get("requireInstalled", True):
            origin = api["importOrigin"].replace("\\", "/")
            if "/site-packages/" not in origin and "/dist-packages/" not in origin:
                raise RuntimeError("GCM import origin is not an installed package")
        profile = str(params.get("conformanceProfile", "R0-M4"))
        conformance = run_conformance(profile)
        if not (
            conformance.get("claim") == "CONFORMANT"
            and conformance.get("required_total") == 80
            and conformance.get("required_passed") == 80
            and conformance.get("required_failed") == 0
            and conformance.get("required_indeterminate") == 0
        ):
            raise RuntimeError("GCM allocator conformance gate is not 80/80 CONFORMANT")
        self.config = {
            "snapshotRegistryPath": str(params.get("snapshotRegistryPath", "")),
            "routeProfiles": dict(params.get("routeProfiles", {})),
        }
        self.api = api
        self.conformance = conformance
        return {
            "api": api,
            "conformance": conformance,
            "capabilities": self.capabilities({}),
        }

    def capabilities(self, _params: dict[str, Any]) -> dict[str, Any]:
        api = self.api or public_api_snapshot()
        return {
            "provider": "gcm-phase-b",
            "adapterVersion": "0.2.0",
            "providerContractVersions": [api["allocatorContractVersion"]],
            "conformanceProfiles": ["GCM-ALLOC-R0-M4"],
            "supportsReplan": True,
            "policyKinds": ["LEXICOGRAPHIC", "WEIGHTED"],
            "normalizationProfiles": ["pncw:unit-interval/v1"],
            "preAdmissionReplan": "fresh-B2/B3/B4-selection-plus-PNCW-lineage",
        }

    def conformance_method(self, _params: dict[str, Any]) -> dict[str, Any]:
        if self.conformance is None:
            raise RuntimeError("host is not initialized")
        return self.conformance

    def public_api_snapshot_method(self, _params: dict[str, Any]) -> dict[str, Any]:
        return self.api or public_api_snapshot()

    def plan(self, params: dict[str, Any]) -> dict[str, Any]:
        if self.config is None:
            raise RuntimeError("host is not initialized")
        return _plan(self.config, params)

    def replan(self, params: dict[str, Any]) -> dict[str, Any]:
        if self.config is None:
            raise RuntimeError("host is not initialized")
        replan = params.get("replanRequest")
        if not isinstance(replan, dict) or not replan.get("parentPlanningId"):
            raise ValueError("replanRequest.parentPlanningId is required")
        request = dict(params)
        request.pop("replanRequest", None)
        return _plan(self.config, request, replan_parent=str(replan["parentPlanningId"]))


def _error_code(exc: Exception) -> str:
    text = str(exc)
    for code in ("NO_FEASIBLE_PLAN", "POLICY_INDETERMINATE", "PLAN_INTEGRITY_FAILURE"):
        if text.startswith(code + ":"):
            return code
    if "snapshot" in text.lower():
        return "FROZEN_INPUT_MISMATCH"
    return "GCM_UNAVAILABLE" if isinstance(exc, OSError) else "PLAN_INTEGRITY_FAILURE"


def run_jsonl() -> int:
    host = Host()
    dispatch = {
        "initialize": host.initialize,
        "capabilities": host.capabilities,
        "conformance": host.conformance_method,
        "public_api_snapshot": host.public_api_snapshot_method,
        "plan": host.plan,
        "replan": host.replan,
    }
    for line in sys.stdin:
        request: dict[str, Any] | None = None
        try:
            request = json.loads(line)
            if request.get("protocol") != PROTOCOL:
                raise ValueError("unsupported process protocol")
            request_id = request.get("requestId")
            method = request.get("method")
            if method == "shutdown":
                response = {
                    "protocol": PROTOCOL,
                    "requestId": request_id,
                    "ok": True,
                    "result": {"closed": True},
                }
                print(json.dumps(response, separators=(",", ":")), flush=True)
                return 0
            fn = dispatch.get(str(method))
            if fn is None:
                raise ValueError("unsupported method")
            result = fn(request.get("params") or {})
            response = {
                "protocol": PROTOCOL,
                "requestId": request_id,
                "ok": True,
                "result": result,
            }
        except Exception as exc:
            response = {
                "protocol": PROTOCOL,
                "requestId": request.get("requestId") if isinstance(request, dict) else None,
                "ok": False,
                "error": {
                    "code": _error_code(exc),
                    "message": str(exc)[:500],
                },
            }
        print(json.dumps(response, separators=(",", ":"), ensure_ascii=False), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print-public-api-snapshot", action="store_true")
    args = parser.parse_args()
    if args.print_public_api_snapshot:
        print(json.dumps(public_api_snapshot(), indent=2, sort_keys=True, ensure_ascii=False))
        return 0
    return run_jsonl()


if __name__ == "__main__":
    raise SystemExit(main())
