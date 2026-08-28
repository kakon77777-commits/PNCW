import type {
  AuthorityContextV1, MaterializationRefV1, PreparedSurfaceV1, ProjectionRequestV1, SourceIdentityV1, SurfaceCapabilitiesV1, SurfaceRefV1,
} from '../../core/src/index.js'
import type { AuthorityDecisionV1 } from './types.js'

export interface MrmicSurfacePort {
  getCapabilities(): Promise<SurfaceCapabilitiesV1>
  checkProjectionAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1>
  prepareSurface(request: ProjectionRequestV1, context: AuthorityContextV1): Promise<PreparedSurfaceV1>
  bindProjection(prepared: PreparedSurfaceV1, source: SourceIdentityV1, materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<SurfaceRefV1>
  surfaceState(surfaceId: string): Promise<SurfaceRefV1 | PreparedSurfaceV1>
}
