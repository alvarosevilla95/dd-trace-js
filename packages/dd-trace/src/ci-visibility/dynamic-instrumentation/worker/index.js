const { parentPort } = require('worker_threads')
// TODO: move session to common place
const session = require('../../../debugger/devtools_client/session')
// TODO: move getLocalStateForCallFrame to common place
const { getLocalStateForCallFrame } = require('../../../debugger/devtools_client/snapshot')
// TODO: move findScriptFromPartialPath to common place
const { findScriptFromPartialPath, getScriptUrlFromId } = require('../../../debugger/devtools_client/state')

let sessionStarted = false
const breakpointIdToSnapshotId = new Map()
const breakpointIdToProbe = new Map()

session.on('Debugger.paused', async ({ params: { hitBreakpoints: [hitBreakpoint], callFrames } }) => {
  const probe = breakpointIdToProbe.get(hitBreakpoint)
  if (!probe) {
    return session.post('Debugger.resume')
  }

  const stack = callFrames.map((frame) => {
    let fileName = getScriptUrlFromId(frame.location.scriptId)
    if (fileName.startsWith('file://')) fileName = fileName.substr(7) // TODO: This might not be required
    return {
      fileName,
      function: frame.functionName,
      lineNumber: frame.location.lineNumber + 1, // Beware! lineNumber is zero-indexed
      columnNumber: frame.location.columnNumber + 1 // Beware! columnNumber is zero-indexed
    }
  })

  const getLocalState = await getLocalStateForCallFrame(callFrames[0])
  await session.post('Debugger.resume')

  const snapshotId = breakpointIdToSnapshotId.get(hitBreakpoint)

  const snapshot = {
    id: snapshotId,
    timestamp: Date.now(),
    probe: {
      id: probe.probeId,
      version: '0',
      location: probe.location
    },
    stack,
    language: 'javascript'
  }

  const state = getLocalState()
  if (state) {
    snapshot.captures = {
      lines: { [probe.location.lines[0]]: { locals: state } }
    }
  }

  parentPort.postMessage({ snapshot })
})

// TODO: add option to remove breakpoint
parentPort.on('message', async ({ snapshotId, probe: { id: probeId, file, line } }) => {
  await addBreakpoint(snapshotId, { probeId, file, line })
})

async function addBreakpoint (snapshotId, probe) {
  if (!sessionStarted) await start()
  const { file, line } = probe

  probe.location = { file, lines: [String(line)] }

  const script = findScriptFromPartialPath(file)
  if (!script) throw new Error(`No loaded script found for ${file}`)

  const [path, scriptId] = script

  console.log(`Adding breakpoint at ${path}:${line}`)

  const { breakpointId } = await session.post('Debugger.setBreakpoint', {
    location: {
      scriptId,
      lineNumber: line - 1
    }
  })

  breakpointIdToProbe.set(breakpointId, probe)
  breakpointIdToSnapshotId.set(breakpointId, snapshotId)
}

function start () {
  sessionStarted = true
  return session.post('Debugger.enable') // return instead of await to reduce number of promises created
}
