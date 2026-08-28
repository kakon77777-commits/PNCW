import type {
  AuthorityContextV1, MaterializationRefV1, ProjectionRequestV1, SourceCapabilitiesV1, SourceIdentityV1,
} from '../../core/src/index.js'
import type { AuthorityDecisionV1, FreshnessResultV1, RegionReadResultV1, StructuralVerificationV1 } from './types.js'

export interface HdsrcSourcePort {
  getCapabilities(): Promise<SourceCapabilitiesV1>
  checkAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1>
  resolveSource(sourceRef: string, context: AuthorityContextV1): Promise<SourceIdentityV1>
  resolveMaterialization(request: ProjectionRequestV1, source: SourceIdentityV1, context: AuthorityContextV1): Promise<MaterializationRefV1>
  checkFreshness(source: SourceIdentityV1, materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<FreshnessResultV1>
  verifyMaterialization(materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<StructuralVerificationV1>
  readSelectedRegion(materialization: MaterializationRefV1, regionRef: string, context: AuthorityContextV1): Promise<RegionReadResultV1>
}
