import test from 'node:test'
import assert from 'node:assert/strict'

test('planning lifecycle permits only canonical normal transitions', async () => {
  const { assertPlanningTransition }=await import('../../dist/packages/planning/src/index.js')
  assert.equal(assertPlanningTransition('PLANNING_REQUESTED','INPUTS_FROZEN'),'INPUTS_FROZEN')
  assert.equal(assertPlanningTransition('INPUTS_FROZEN','GCM_PLANNED'),'GCM_PLANNED')
  assert.equal(assertPlanningTransition('GCM_PLANNED','PLAN_ACCEPTED'),'PLAN_ACCEPTED')
  assert.equal(assertPlanningTransition('PLAN_ACCEPTED','COMPILED'),'COMPILED')
  assert.throws(()=>assertPlanningTransition('PLANNING_REQUESTED','PLAN_ACCEPTED'))
  assert.throws(()=>assertPlanningTransition('GCM_PLANNED','COMPILED'))
})

test('planning lifecycle never promotes directly to projection visibility', async () => {
  const { assertPlanningTransition }=await import('../../dist/packages/planning/src/index.js')
  assert.equal(assertPlanningTransition('PLAN_ACCEPTED','REPLAN_REQUIRED'),'REPLAN_REQUIRED')
  assert.equal(assertPlanningTransition('COMPILED','REPLAN_REQUIRED'),'REPLAN_REQUIRED')
  assert.throws(()=>assertPlanningTransition('PLAN_ACCEPTED','VISIBLE'))
  assert.throws(()=>assertPlanningTransition('COMPILED','VISIBLE'))
})

test('active planning states may fail closed to PLAN_REJECTED or ABORTED', async () => {
  const { assertPlanningTransition }=await import('../../dist/packages/planning/src/index.js')
  for(const from of ['PLANNING_REQUESTED','INPUTS_FROZEN','GCM_PLANNED','PLAN_ACCEPTED','COMPILED']){
    assert.equal(assertPlanningTransition(from,'PLAN_REJECTED'),'PLAN_REJECTED')
    assert.equal(assertPlanningTransition(from,'ABORTED'),'ABORTED')
  }
  assert.throws(()=>assertPlanningTransition('PLAN_REJECTED','COMPILED'))
})

test('PlanningError owns a deeply frozen planning failure envelope', async () => {
  const { PlanningError, planningFailure }=await import('../../dist/packages/planning/src/index.js')
  const failure=planningFailure({code:'GCM_UNAVAILABLE',stage:'GCM',recovery:'RETRY',source:'gcm-phase-b',message:'temporarily unavailable'})
  const error=new PlanningError(failure)
  assert.equal(error.failure.code,'GCM_UNAVAILABLE')
  assert.ok(Object.isFrozen(error.failure))
  assert.throws(()=>{ error.failure.message='changed' })
})
