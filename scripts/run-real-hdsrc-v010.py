#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def materialization_identity(*, state_digest: str, state_revision: int, workload_digest: str,
                             logical_scale: int, spatialization_id: str, materialization_digest: str) -> str:
    payload = '|'.join((
        state_digest,
        str(state_revision),
        workload_digest,
        str(logical_scale),
        spatialization_id,
        materialization_digest,
    )).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--release-zip', required=True)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    release_zip = Path(args.release_zip).resolve()
    src = root / 'src'
    import sys
    sys.path.insert(0, str(src))

    from hdsrc_exp.codec import decode_hds1
    from hdsrc_exp.materialization_features import extract_candidate_features
    from hdsrc_exp.multiscale_block_tiff_carrier import decode_hmbt1, read_hmbt1_relation_block_row
    from hdsrc_exp.multiscale_relation_router import (
        MultiScaleRelationWorkload,
        evaluate_workload_on_materialized_bank,
        materialize_multiscale_view_bank,
    )
    from hdsrc_exp.multiscale_spatializer import compile_multiscale_spatialization
    from hdsrc_exp.predictive_cost_model import PredictiveCostModel
    from hdsrc_exp.predictive_uncertainty import (
        EmpiricalUncertaintyCalibrator,
        MarginConfidencePolicy,
        select_uncertainty_aware_view,
    )

    state_path = root / 'artifacts' / 'codes' / 'dim_4096.hds1'
    state_bytes = state_path.read_bytes()
    state = decode_hds1(state_bytes)
    state_digest = sha256_bytes(state_bytes)
    release_digest = hashlib.sha256(release_zip.read_bytes()).hexdigest()

    profile_root = root / 'artifacts_image_v010'
    model = PredictiveCostModel.from_json((profile_root / 'predictive_cost_model_v0.10.json').read_text(encoding='utf-8'))
    calibrator = EmpiricalUncertaintyCalibrator.from_json(
        (profile_root / 'predictive_uncertainty_calibrator_v0.10.json').read_text(encoding='utf-8')
    )
    confidence = MarginConfidencePolicy.from_json_dict(json.loads(
        (profile_root / 'predictive_confidence_policy_v0.10.json').read_text(encoding='utf-8')
    ))

    workload_payload = {
        'schema': 'hdsrc-workload-hint/v1',
        'goalClass': 'pncw_projection',
        'observationMode': 'machine_carrier',
        'queryDirection': 'block',
        'expectedSpan': 8,
        'expectedReuse': 16,
        'latencyClass': 'interactive',
    }
    workload_digest = sha256_bytes(canonical_json(workload_payload))
    runtime_workload = MultiScaleRelationWorkload(query_span=8, expected_reuse=16)
    spatialization_plan = compile_multiscale_spatialization(state)
    candidates = extract_candidate_features(state, runtime_workload, spatialization_plan)
    selected = select_uncertainty_aware_view(
        candidates,
        expected_reuse=16,
        model=model,
        calibrator=calibrator,
        confidence_policy=confidence,
    )
    decision = {
        'schema': 'hdsrc-materialization-decision/v1',
        'decision': 'oracle_fallback' if selected.requires_oracle else 'fast_path',
        'confidence': {
            'mode': 'empirical',
            'requiresOracle': bool(selected.requires_oracle),
            **({'reason': 'outside_current_trust_region'} if selected.requires_oracle else {}),
        },
    }

    with tempfile.TemporaryDirectory(prefix='pncw-real-hdsrc-') as temp_dir:
        bank = materialize_multiscale_view_bank(state, temp_dir)
        if selected.requires_oracle:
            oracle = evaluate_workload_on_materialized_bank(state, runtime_workload, bank)
            block_size = int(oracle.selected_block_size)
            algorithm = str(oracle.selected_algorithm)
            oracle_used = True
        else:
            block_size = int(selected.selected_block_size)
            algorithm = str(selected.selected_algorithm)
            oracle_used = False
        view = bank.view_for(block_size)
        carrier = view.path.read_bytes()
        decoded = decode_hmbt1(carrier)
        if decoded.state != state:
            raise RuntimeError('fresh HMBT1 decoded state mismatch')
        if int(decoded.block_size) != block_size:
            raise RuntimeError('fresh HMBT1 block size mismatch')
        if str(decoded.relation_spatialization_id) != algorithm:
            raise RuntimeError('fresh HMBT1 spatialization mismatch')
        partial = read_hmbt1_relation_block_row(view.path, 0)

    materialization_digest = sha256_bytes(carrier)
    identity = materialization_identity(
        state_digest=state_digest,
        state_revision=10,
        workload_digest=workload_digest,
        logical_scale=block_size,
        spatialization_id=algorithm,
        materialization_digest=materialization_digest,
    )
    materialization_id = f'mat:{identity}'
    resource_root = f'hdsrc://state/state:4096/materializations/{materialization_id}'
    materialization = {
        'schema': 'hdsrc-materialization/v1',
        'materializationId': materialization_id,
        'stateId': 'state:4096',
        'stateRevision': 10,
        'stateDigest': state_digest,
        'materializationDigest': materialization_digest,
        'carrierProfile': 'HMBT1',
        'spatializationId': algorithm,
        'logicalScale': block_size,
        'workloadDigest': workload_digest,
        'machineResourceUri': f'{resource_root}/machine',
        'previewResourceUri': f'{resource_root}/preview',
    }
    result = {
        'schema': 'pncw-fresh-hdsrc-v010-run/v0.1',
        'releaseZipSha256': release_digest,
        'source': {
            'schema': 'hdsrc-state-ref/v1',
            'stateId': 'state:4096',
            'stateRevision': 10,
            'stateDigest': state_digest,
            'dimension': int(state.dimension),
            'nodeCount': len(state.vector_ids),
            'relationCount': len(state.relations),
            'authority': 'hdsrc',
        },
        'workload': workload_payload,
        'decision': decision,
        'materializationRef': resource_root,
        'materialization': materialization,
        'oracleUsed': oracle_used,
        'partial': {
            'blockRow': int(partial.block_row),
            'srcStart': int(partial.src_start),
            'srcLength': int(partial.src_length),
            'relations': [
                {'src': int(r.src), 'dst': int(r.dst), 'kind': str(r.kind), 'qsim': int(r.qsim)}
                for r in partial.relations
            ],
            'compressedBytesRead': int(partial.compressed_bytes_read),
            'carrierBytes': int(partial.carrier_bytes),
        },
        'testStubRuntimeUsed': False,
    }
    print(json.dumps(result, sort_keys=True, separators=(',', ':'), ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
