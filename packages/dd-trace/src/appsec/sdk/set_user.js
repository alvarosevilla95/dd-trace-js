'use strict'

const { getRootSpan } = require('./utils')
const log = require('../../log')
const waf = require('../waf')
const addresses = require('../addresses')
const { reportMetrics } = require('../reporter')

function setUserTags (user, rootSpan) {
  for (const k of Object.keys(user)) {
    rootSpan.setTag(`usr.${k}`, '' + user[k])
  }
}

function setUser (tracer, user) {
  if (!user || !user.id) {
    log.warn('[ASM] Invalid user provided to setUser')
    return
  }

  const rootSpan = getRootSpan(tracer)
  if (!rootSpan) {
    log.warn('[ASM] Root span not available in setUser')
    return
  }

  setUserTags(user, rootSpan)
  rootSpan.setTag('_dd.appsec.user.collection_mode', 'sdk')

  const wafResults = waf.run({
    persistent: {
      [addresses.USER_ID]: '' + user.id
    }
  })

  if (!wafResults) return

  reportMetrics(wafResults.metrics, null)
}

module.exports = {
  setUserTags,
  setUser
}
