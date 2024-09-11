'use strict'

module.exports = {
  ASM_ACTIVATION: 1n << 1n,
  ASM_IP_BLOCKING: 1n << 2n,
  ASM_DD_RULES: 1n << 3n,
  ASM_EXCLUSIONS: 1n << 4n,
  ASM_REQUEST_BLOCKING: 1n << 5n,
  ASM_RESPONSE_BLOCKING: 1n << 6n,
  ASM_USER_BLOCKING: 1n << 7n,
  ASM_CUSTOM_RULES: 1n << 8n,
  ASM_CUSTOM_BLOCKING_RESPONSE: 1n << 9n,
  ASM_TRUSTED_IPS: 1n << 10n,
  ASM_API_SECURITY_SAMPLE_RATE: 1n << 11n,
  APM_TRACING_SAMPLE_RATE: 1n << 12n,
  APM_TRACING_LOGS_INJECTION: 1n << 13n,
  APM_TRACING_HTTP_HEADER_TAGS: 1n << 14n,
  APM_TRACING_CUSTOM_TAGS: 1n << 15n,
  APM_TRACING_ENABLED: 1n << 19n,
  ASM_RASP_SQLI: 1n << 21n,
  ASM_RASP_SSRF: 1n << 23n,
  APM_TRACING_SAMPLE_RULES: 1n << 29n,
  ASM_AUTO_USER_INSTRUM_MODE: 1n << 31n
}
