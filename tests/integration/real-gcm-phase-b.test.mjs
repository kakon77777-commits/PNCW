import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PROTOCOL='pncw-gcm-phase-b-process/0.1'

async function imports(){
  return import('../../dist/adapters/real-gcm-phase-b/src/index.js')
}

async function fakeJsonlHost(source){
  const dir=await mkdtemp(join(tmpdir(),'pncw-gcm-jsonl-'))
  const path=join(dir,'host.mjs')
  await writeFile(path,source,'utf8')
  return path
}

test('JSONL process client round-trips versioned requests and keeps transport IDs non-semantic', async () => {
  const { GcmPhaseBProcessClient }=await imports()
  const host=await fakeJsonlHost(`
    import readline from 'node:readline'
    const rl=readline.createInterface({input:process.stdin})
    rl.on('line',line=>{
      const req=JSON.parse(line)
      process.stdout.write(JSON.stringify({protocol:req.protocol,requestId:req.requestId,ok:true,result:{method:req.method,params:req.params}})+'\\n')
    })
  `)
  const client=await GcmPhaseBProcessClient.open({executable:process.execPath,args:[host],timeoutMs:2000})
  const first=await client.request('initialize',{profile:'R0-M4'})
  const second=await client.request('capabilities',{})
  assert.equal(first.method,'initialize')
  assert.equal(second.method,'capabilities')
  assert.deepEqual(first.params,{profile:'R0-M4'})
  assert.equal(client.protocol,PROTOCOL)
  assert.notEqual(client.lastTransportRequestId,null)
  assert.match(client.lastTransportRequestId,/^transport:[0-9]+$/)
  await client.close()
})

test('JSONL process client rejects protocol drift and malformed responses', async () => {
  const { GcmPhaseBProcessClient }=await imports()
  const badProtocol=await fakeJsonlHost(`
    import readline from 'node:readline'
    readline.createInterface({input:process.stdin}).on('line',line=>{
      const req=JSON.parse(line)
      process.stdout.write(JSON.stringify({protocol:'wrong/v9',requestId:req.requestId,ok:true,result:{}})+'\\n')
    })
  `)
  const client=await GcmPhaseBProcessClient.open({executable:process.execPath,args:[badProtocol],timeoutMs:2000})
  await assert.rejects(()=>client.request('initialize',{}),/protocol/i)
  await client.close()

  const malformed=await fakeJsonlHost(`
    import readline from 'node:readline'
    readline.createInterface({input:process.stdin}).on('line',()=>process.stdout.write('{not json}\\n'))
  `)
  const client2=await GcmPhaseBProcessClient.open({executable:process.execPath,args:[malformed],timeoutMs:2000})
  await assert.rejects(()=>client2.request('initialize',{}),/JSON|response/i)
  await client2.close()
})

test('real GCM support profile is explicit, public-only and tied to the sealed Phase-B baseline', async () => {
  const profile=JSON.parse(await readFile('docs/evidence/gcm-phase-b-public-api-profile-v0.4.json','utf8'))
  assert.equal(profile.schema,'pncw-gcm-phase-b-public-api-profile/v1')
  assert.equal(profile.packageName,'gcm-reference-runtime')
  assert.equal(profile.packageVersion,'0.4.0')
  assert.equal(profile.allocatorContractVersion,'gcm-allocation-v0.1')
  assert.equal(profile.conformanceProfile,'GCM-ALLOC-R0-M4')
  assert.equal(profile.requiredConformanceCases,80)
  assert.equal(profile.sealedPhaseBBaseline.sha256,'6d2c392ecc87a3ffee8e668f0777245184803814f4fab2017808c1014a9351ce')
  assert.equal(profile.observedArtifact.kind,'phase-c-c1-descendant-of-sealed-phase-b')
  assert.equal(profile.b2PublicSnapshotReconstruction.supported,true)
  for(const name of ['ResourceRecord','StaticResourceProvider','ResourceInventory','ResourceInventory.capture','ResourceInventorySnapshot','AllocationTask','AllocationCandidate','AllocationRequest','AllocationPlan','AllocationSearchLimits','Allocator0.allocate','FeasiblePlanEnumerator.enumerate','compute_pareto_frontier','select_from_frontier','LexicographicPolicy','WeightedLinearPolicy','ReplanRequest','ReplanningCoordinator.replan']){
    assert.ok(profile.symbols[name],name)
    assert.equal(profile.symbols[name].visibility,'public')
  }
  assert.equal(JSON.stringify(profile).includes('private'),false)
})

test('real sealed GCM environment is explicit and never replaced by fake planning', async t => {
  const { RealGcmPhaseBAdapter }=await imports()
  if(process.env.PNCW_REAL_GCM!=='1'){
    t.skip('real sealed GCM Phase-B environment not provided')
    return
  }
  assert.ok(process.env.PNCW_GCM_PYTHON,'PNCW_GCM_PYTHON is required')
  assert.ok(process.env.PNCW_GCM_SNAPSHOT_REGISTRY,'PNCW_GCM_SNAPSHOT_REGISTRY is required')
  const adapter=await RealGcmPhaseBAdapter.open({
    pythonExecutable:process.env.PNCW_GCM_PYTHON,
    snapshotRegistryPath:process.env.PNCW_GCM_SNAPSHOT_REGISTRY,
    expectedPackageVersion:'0.4.0',
    expectedAllocatorContractVersion:'gcm-allocation-v0.1',
    conformanceProfile:'R0-M4',
    routeProfiles:{},
  })
  const identity=await adapter.conformanceIdentity()
  assert.equal(identity.claim,'CONFORMANT')
  assert.equal(identity.profileId,'GCM-ALLOC-R0-M4')
  const api=await adapter.publicApiSnapshot()
  assert.equal(api.accepted,true)
  assert.match(api.importOrigin,/site-packages|dist-packages/)
  await adapter.close()
})
