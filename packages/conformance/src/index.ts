import { assertReadOnlyPortSurface, type HdsrcSourcePort, type MrmicSurfacePort } from '../../adapters/src/index.js'
import { sha256Digest, type CheckResultV1, type MaterializationRefV1, type ProjectionRequestV1, type SourceIdentityV1 } from '../../core/src/index.js'

function check(name: string, passed: boolean, detail?: string): CheckResultV1 {
  return { name, passed, ...(detail ? { detail } : {}) }
}

export async function runHdsrcPortConformance(port: HdsrcSourcePort, request: ProjectionRequestV1): Promise<CheckResultV1[]> {
  const checks: CheckResultV1[]=[]
  assertReadOnlyPortSurface(port as unknown as object)
  checks.push(check('port-read-only-surface',true))
  const caps=await port.getCapabilities()
  checks.push(check('canonical-mutation-disabled',caps.canonicalMutation===false))
  checks.push(check('requested-observation-supported',caps.observationModes.includes(request.requestedMode)))
  const auth=await port.checkAuthority(request.authorityContext)
  checks.push(check('source-authority',auth.authorized,auth.reason))
  if (!auth.authorized) return checks
  const source=await port.resolveSource(request.sourceRef,request.authorityContext)
  checks.push(check('source-resolves',!!source.sourceId))
  const materialization=await port.resolveMaterialization(request,source,request.authorityContext)
  checks.push(check('materialization-resolves',materialization.sourceId===source.sourceId))
  const freshness=await port.checkFreshness(source,materialization,request.authorityContext)
  checks.push(check('materialization-fresh',freshness.fresh,freshness.reason))
  const structural=await port.verifyMaterialization(materialization,request.authorityContext)
  checks.push(check('structural-verification',structural.verified,structural.reason))
  if (caps.partialRead && request.scope.regionRefs[0]) {
    const region=await port.readSelectedRegion(materialization,request.scope.regionRefs[0],request.authorityContext)
    checks.push(check('partial-read-bounded',region.bytesRead>0 && region.bytesRead<region.totalCarrierBytes,`${region.bytesRead}/${region.totalCarrierBytes}`))
  }
  return checks
}

export async function runMrmicPortConformance(port: MrmicSurfacePort, request: ProjectionRequestV1): Promise<CheckResultV1[]> {
  const checks: CheckResultV1[]=[]
  assertReadOnlyPortSurface(port as unknown as object)
  checks.push(check('port-read-only-surface',true))
  const caps=await port.getCapabilities()
  checks.push(check('canonical-mutation-disabled',caps.canonicalMutation===false))
  checks.push(check('read-only-projection-capability',caps.readOnlyProjection===true))
  const auth=await port.checkProjectionAuthority(request.authorityContext)
  checks.push(check('surface-authority',auth.authorized,auth.reason))
  if (!auth.authorized) return checks
  const prepared=await port.prepareSurface(request,request.authorityContext)
  checks.push(check('prepared-surface-non-visible',prepared.visible===false))
  const source: SourceIdentityV1={authority:'conformance',sourceId:'state:conformance',revision:1,digest:`sha256:${'1'.repeat(64)}`}
  const materialization: MaterializationRefV1={provider:'conformance',materializationId:'mat:conformance',sourceId:source.sourceId,sourceRevision:source.revision,sourceDigest:source.digest,carrierProfile:'HMBT1',materializationDigest:`sha256:${'2'.repeat(64)}`,machineResourceUri:'conformance://machine',previewResourceUri:'conformance://preview',partialRead:true}
  const bound=await port.bindProjection(prepared,source,materialization,request.authorityContext)
  checks.push(check('bound-surface-non-visible',bound.visible===false))
  const current=await port.surfaceState(bound.surfaceId)
  checks.push(check('surface-state-roundtrip',sha256Digest(current)===sha256Digest(bound)))
  return checks
}
