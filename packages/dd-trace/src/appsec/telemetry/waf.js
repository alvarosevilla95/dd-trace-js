'use strict'

const telemetryMetrics = require('../../telemetry/metrics')
const { tags, getVersionsTags, DD_TELEMETRY_REQUEST_METRICS } = require('./common')

const appsecMetrics = telemetryMetrics.manager.namespace('appsec')

const DD_TELEMETRY_WAF_RESULT_TAGS = Symbol('_dd.appsec.telemetry.waf.result.tags')

const TRUNCATION_FLAGS = {
  LONG_STRING: 1,
  LARGE_CONTAINER: 2,
  DEEP_CONTAINER: 4
}

function addWafRequestMetrics (store, { duration, durationExt, wafTimeout, errorCode }) {
  store[DD_TELEMETRY_REQUEST_METRICS].duration += duration || 0
  store[DD_TELEMETRY_REQUEST_METRICS].durationExt += durationExt || 0

  if (wafTimeout) {
    store[DD_TELEMETRY_REQUEST_METRICS].wafTimeouts++
  }

  if (errorCode) {
    store[DD_TELEMETRY_REQUEST_METRICS].wafErrorCode = Math.max(
      errorCode,
      store[DD_TELEMETRY_REQUEST_METRICS].wafErrorCode ?? errorCode
    )
  }
}

function trackWafDurations ({ duration, durationExt }, versionsTags) {
  if (duration) {
    appsecMetrics.distribution('waf.duration', versionsTags).track(duration)
  }

  if (durationExt) {
    appsecMetrics.distribution('waf.duration_ext', versionsTags).track(durationExt)
  }
}

function trackWafMetrics (store, metrics) {
  const versionsTags = getVersionsTags(metrics.wafVersion, metrics.rulesVersion)

  trackWafDurations(metrics, versionsTags)

  const metricTags = getOrCreateMetricTags(store, versionsTags)

  if (metrics.blockTriggered) {
    metricTags[tags.REQUEST_BLOCKED] = true
  }

  if (metrics.ruleTriggered) {
    metricTags[tags.RULE_TRIGGERED] = true
  }

  if (metrics.wafTimeout) {
    metricTags[tags.WAF_TIMEOUT] = true
  }

  if (metrics.errorCode) {
    metricTags[tags.WAF_ERROR] = true
  }

  if (metrics.blockFailed) {
    metricTags[tags.BLOCK_FAILURE] = true
  }

  const truncationReason = getTruncationReason(metrics)
  if (truncationReason > 0) {
    metricTags[tags.INPUT_TRUNCATED] = true

    incrementTruncatedMetrics(truncationReason)
  }

  return metricTags
}

function incrementTruncatedMetrics (truncationReason) {
  const truncationTags = { truncation_reason: truncationReason }
  appsecMetrics.count('appsec.waf.input_truncated', truncationTags).inc(1)
}

function getTruncationReason ({ maxTruncatedString, maxTruncatedContainerSize, maxTruncatedContainerDepth }) {
  let reason = 0

  if (maxTruncatedString) reason |= TRUNCATION_FLAGS.LONG_STRING
  if (maxTruncatedContainerSize) reason |= TRUNCATION_FLAGS.LARGE_CONTAINER
  if (maxTruncatedContainerDepth) reason |= TRUNCATION_FLAGS.DEEP_CONTAINER

  return reason
}

function getOrCreateMetricTags (store, versionsTags) {
  let metricTags = store[DD_TELEMETRY_WAF_RESULT_TAGS]

  if (!metricTags) {
    metricTags = {
      [tags.REQUEST_BLOCKED]: false,
      [tags.RULE_TRIGGERED]: false,
      [tags.WAF_TIMEOUT]: false,
      [tags.WAF_ERROR]: false,
      [tags.BLOCK_FAILURE]: false,
      [tags.INPUT_TRUNCATED]: false,

      ...versionsTags
    }
    store[DD_TELEMETRY_WAF_RESULT_TAGS] = metricTags
  }

  return metricTags
}

function incrementWafInit (wafVersion, rulesVersion) {
  const versionsTags = getVersionsTags(wafVersion, rulesVersion)

  appsecMetrics.count('waf.init', versionsTags).inc()
}

function incrementWafUpdates (wafVersion, rulesVersion) {
  const versionsTags = getVersionsTags(wafVersion, rulesVersion)

  appsecMetrics.count('waf.updates', versionsTags).inc()
}

function incrementWafRequests (store) {
  const metricTags = store[DD_TELEMETRY_WAF_RESULT_TAGS]

  if (metricTags) {
    appsecMetrics.count('waf.requests', metricTags).inc()
  }
}

module.exports = {
  addWafRequestMetrics,
  trackWafMetrics,
  incrementWafInit,
  incrementWafUpdates,
  incrementWafRequests
}
