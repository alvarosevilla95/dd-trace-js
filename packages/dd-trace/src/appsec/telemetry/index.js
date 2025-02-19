'use strict'

const { addRaspRequestMetrics, trackRaspMetrics } = require('./rasp')
const { incrementMissingUserId, incrementMissingUserLogin } = require('./user')
const {
  addWafRequestMetrics,
  trackWafMetrics,
  incrementWafInit,
  incrementWafUpdates,
  incrementWafRequests
} = require('./waf')

const DD_TELEMETRY_REQUEST_METRICS = Symbol('_dd.appsec.telemetry.request.metrics')

const metricsStoreMap = new WeakMap()

let enabled = false

function enable (telemetryConfig) {
  enabled = telemetryConfig?.enabled && telemetryConfig.metrics
}

function disable () {
  enabled = false
}

function newStore () {
  return {
    [DD_TELEMETRY_REQUEST_METRICS]: {
      duration: 0,
      durationExt: 0,
      raspDuration: 0,
      raspDurationExt: 0,
      raspEvalCount: 0,
      raspErrorCode: null,
      raspTimeouts: 0,
      wafErrorCode: null,
      wafTimeouts: 0
    }
  }
}

function getStore (req) {
  let store = metricsStoreMap.get(req)
  if (!store) {
    store = newStore()
    metricsStoreMap.set(req, store)
  }
  return store
}

function updateRaspRequestsMetricTags (metrics, req, raspRule) {
  if (!req) return

  const store = getStore(req)

  // it does not depend on whether telemetry is enabled or not
  addRaspRequestMetrics(store, metrics)

  if (!enabled) return

  const ruleTags = { rule_type: raspRule.type }

  if (raspRule.variant) {
    ruleTags.rule_variant = raspRule.variant
  }

  trackRaspMetrics(store, metrics, ruleTags)
}

function updateWafRequestsMetricTags (metrics, req) {
  if (!req) return

  const store = getStore(req)

  // it does not depend on whether telemetry is enabled or not
  addWafRequestMetrics(store, metrics)

  if (!enabled) return

  trackWafMetrics(store, metrics)
}

function incrementWafInitMetric (wafVersion, rulesVersion, success) {
  if (!enabled) return

  incrementWafInit(wafVersion, rulesVersion, success)
}

function incrementWafUpdatesMetric (wafVersion, rulesVersion, success) {
  if (!enabled) return

  incrementWafUpdates(wafVersion, rulesVersion, success)
}

function incrementWafRequestsMetric (req) {
  if (!req || !enabled) return

  const store = getStore(req)
  incrementWafRequests(store)

  metricsStoreMap.delete(req)
}

function incrementMissingUserLoginMetric (framework, eventType) {
  if (!enabled) return

  incrementMissingUserLogin(framework, eventType)
}

function incrementMissingUserIdMetric (framework, eventType) {
  if (!enabled) return

  incrementMissingUserId(framework, eventType)
}

function getRequestMetrics (req) {
  if (req) {
    const store = getStore(req)
    return store?.[DD_TELEMETRY_REQUEST_METRICS]
  }
}

module.exports = {
  enable,
  disable,

  updateWafRequestsMetricTags,
  updateRaspRequestsMetricTags,
  incrementWafInitMetric,
  incrementWafUpdatesMetric,
  incrementWafRequestsMetric,
  incrementMissingUserLoginMetric,
  incrementMissingUserIdMetric,

  getRequestMetrics
}
