import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

export const GCM_PHASE_B_PROCESS_PROTOCOL = 'pncw-gcm-phase-b-process/0.1' as const

export interface GcmPhaseBProcessClientConfig {
  executable: string
  args?: string[]
  cwd?: string
  env?: Record<string, string | undefined>
  timeoutMs?: number
  maxMessageBytes?: number
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface ErrorWithCode extends Error { code?: string }

function errorWithCode(message:string,code?:string):ErrorWithCode{
  const error=new Error(message) as ErrorWithCode
  if(code) error.code=code
  return error
}

export class GcmPhaseBProcessClient {
  readonly protocol = GCM_PHASE_B_PROCESS_PROTOCOL
  readonly #child: ChildProcessWithoutNullStreams
  readonly #timeoutMs: number
  readonly #maxMessageBytes: number
  readonly #pending = new Map<string, PendingRequest>()
  readonly #seenResponseIds = new Set<string>()
  #counter = 0
  #closed = false
  #stderr = ''
  #lastTransportRequestId: string | null = null

  private constructor(child:ChildProcessWithoutNullStreams,config:GcmPhaseBProcessClientConfig){
    this.#child=child
    this.#timeoutMs=config.timeoutMs ?? 30_000
    this.#maxMessageBytes=config.maxMessageBytes ?? 4*1024*1024
    const lines=createInterface({input:child.stdout})
    lines.on('line',line=>this.#handleLine(line))
    child.stderr.on('data',chunk=>{
      this.#stderr=(this.#stderr+String(chunk)).slice(-16_384)
    })
    child.on('error',error=>this.#rejectAll(error instanceof Error?error:new Error(String(error))))
    child.on('exit',(code,signal)=>{
      if(!this.#closed && this.#pending.size>0){
        const detail=this.#stderr.trim()
        this.#rejectAll(new Error(`GCM process exited before response (code=${String(code)}, signal=${String(signal)})${detail?`: ${detail}`:''}`))
      }
    })
  }

  static async open(config:GcmPhaseBProcessClientConfig):Promise<GcmPhaseBProcessClient>{
    if(!config.executable) throw new Error('process executable is required')
    const child=spawn(config.executable,config.args ?? [],{
      cwd:config.cwd,
      env:config.env === undefined ? process.env : {...process.env,...config.env},
      stdio:['pipe','pipe','pipe'],
    }) as ChildProcessWithoutNullStreams
    return new GcmPhaseBProcessClient(child,config)
  }

  get lastTransportRequestId():string|null { return this.#lastTransportRequestId }

  async request(method:string,params:unknown):Promise<any>{
    if(this.#closed) throw new Error('GCM process client is closed')
    if(!method) throw new Error('GCM process method is required')
    const requestId=`transport:${++this.#counter}`
    this.#lastTransportRequestId=requestId
    const payload={protocol:this.protocol,requestId,method,params}
    const line=JSON.stringify(payload)
    if(Buffer.byteLength(line,'utf8')>this.#maxMessageBytes) throw new Error('GCM process request exceeds maximum message size')
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        this.#pending.delete(requestId)
        reject(new Error(`GCM process request timed out: ${method}`))
      },this.#timeoutMs)
      this.#pending.set(requestId,{resolve,reject,timer})
      this.#child.stdin.write(`${line}\n`,error=>{
        if(!error) return
        const pending=this.#pending.get(requestId)
        if(!pending) return
        clearTimeout(pending.timer)
        this.#pending.delete(requestId)
        reject(error)
      })
    })
  }

  async close():Promise<void>{
    if(this.#closed) return
    this.#closed=true
    this.#rejectAll(new Error('GCM process client closed'))
    if(this.#child.exitCode !== null || this.#child.signalCode !== null) return
    await new Promise<void>(resolve=>{
      const timer=setTimeout(()=>{
        this.#child.kill('SIGKILL')
        resolve()
      },1000)
      this.#child.once('exit',()=>{ clearTimeout(timer); resolve() })
      this.#child.kill('SIGTERM')
    })
  }

  #handleLine(line:string):void{
    if(Buffer.byteLength(line,'utf8')>this.#maxMessageBytes){
      this.#rejectAll(new Error('GCM process response exceeds maximum message size'))
      return
    }
    let response:any
    try { response=JSON.parse(line) }
    catch { this.#rejectAll(new Error('GCM process response is not valid JSON')); return }
    if(!response || typeof response!=='object'){
      this.#rejectAll(new Error('GCM process response must be an object')); return
    }
    if(response.protocol!==this.protocol){
      this.#rejectAll(new Error(`GCM process protocol mismatch: ${String(response.protocol)}`)); return
    }
    if(typeof response.requestId!=='string'){
      this.#rejectAll(new Error('GCM process response is missing requestId')); return
    }
    if(this.#seenResponseIds.has(response.requestId)){
      this.#rejectAll(new Error(`duplicate GCM process response id ${response.requestId}`)); return
    }
    this.#seenResponseIds.add(response.requestId)
    const pending=this.#pending.get(response.requestId)
    if(!pending){
      this.#rejectAll(new Error(`unexpected GCM process response id ${response.requestId}`)); return
    }
    clearTimeout(pending.timer)
    this.#pending.delete(response.requestId)
    if(response.ok===true){ pending.resolve(response.result); return }
    const code=typeof response.error?.code==='string'?response.error.code:undefined
    const message=typeof response.error?.message==='string'?response.error.message:'GCM process request failed'
    pending.reject(errorWithCode(message,code))
  }

  #rejectAll(error:Error):void{
    for(const [requestId,pending] of this.#pending){
      clearTimeout(pending.timer)
      pending.reject(error)
      this.#pending.delete(requestId)
    }
  }
}
