'use strict'

module.exports = {
  SAMPLING_PRIORITY_KEY: '_sampling_priority_v1',
  ANALYTICS_KEY: '_dd1.sr.eausr',
  ORIGIN_KEY: '_dd.origin',
  HOSTNAME_KEY: '_dd.hostname',
  TOP_LEVEL_KEY: '_dd.top_level',
  SAMPLING_RULE_DECISION: '_dd.rule_psr',
  SAMPLING_LIMIT_DECISION: '_dd.limit_psr',
  SAMPLING_AGENT_DECISION: '_dd.agent_psr',
  SAMPLING_MECHANISM_DEFAULT: 0,
  SAMPLING_MECHANISM_AGENT: 1,
  SAMPLING_MECHANISM_RULE: 3,
  SAMPLING_MECHANISM_MANUAL: 4,
  SAMPLING_MECHANISM_APPSEC: 5,
  SAMPLING_MECHANISM_SPAN: 8,
  SAMPLING_MECHANISM_REMOTE_USER: 11,
  SAMPLING_MECHANISM_REMOTE_DYNAMIC: 12,
  SPAN_SAMPLING_MECHANISM: '_dd.span_sampling.mechanism',
  SPAN_SAMPLING_RULE_RATE: '_dd.span_sampling.rule_rate',
  SPAN_SAMPLING_MAX_PER_SECOND: '_dd.span_sampling.max_per_second',
  DATADOG_LAMBDA_EXTENSION_PATH: '/opt/extensions/datadog-agent',
  DECISION_MAKER_KEY: '_dd.p.dm',
  PROCESS_ID: 'process_id',
  ERROR_TYPE: 'error.type',
  ERROR_MESSAGE: 'error.message',
  ERROR_STACK: 'error.stack',
  COMPONENT: 'component',
  CLIENT_PORT_KEY: 'network.destination.port',
  PEER_SERVICE_KEY: 'peer.service',
  PEER_SERVICE_SOURCE_KEY: '_dd.peer.service.source',
  PEER_SERVICE_REMAP_KEY: '_dd.peer.service.remapped_from',
  SCI_REPOSITORY_URL: '_dd.git.repository_url',
  SCI_COMMIT_SHA: '_dd.git.commit.sha',
  APM_TRACING_ENABLED_KEY: '_dd.apm.enabled',
  APPSEC_PROPAGATION_KEY: '_dd.p.appsec',
  PAYLOAD_TAG_REQUEST_PREFIX: 'aws.request.body',
  PAYLOAD_TAG_RESPONSE_PREFIX: 'aws.response.body',
  PAYLOAD_TAGGING_MAX_TAGS: 758,
  SCHEMA_DEFINITION: 'schema.definition',
  SCHEMA_WEIGHT: 'schema.weight',
  SCHEMA_TYPE: 'schema.type',
  SCHEMA_ID: 'schema.id',
  SCHEMA_TOPIC: 'schema.topic',
  SCHEMA_OPERATION: 'schema.operation',
  SCHEMA_NAME: 'schema.name',
  GRPC_CLIENT_ERROR_STATUSES: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  GRPC_SERVER_ERROR_STATUSES: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  DYNAMODB_PTR_KIND: 'aws.dynamodb.item',
  S3_PTR_KIND: 'aws.s3.object',
  SPAN_POINTER_DIRECTION: Object.freeze({
    UPSTREAM: 'u',
    DOWNSTREAM: 'd'
  }),
  DD_EMPTY_USER_TAG: 'dd.empty.user.tag'
}
