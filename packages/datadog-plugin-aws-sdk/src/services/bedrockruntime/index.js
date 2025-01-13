const CompositePlugin = require('../../../../dd-trace/src/plugins/composite')
const BedrockRuntimeTracing = require('./tracing')
const BedrockLLMObsPlugin = require('../../../../dd-trace/src/llmobs/plugins/bedrock')

class BedrockPlugin extends CompositePlugin {
  static get id () {
    return 'bedrock'
  }

  static get plugins () {
    return {
      llmobs: BedrockLLMObsPlugin,
      tracing: BedrockRuntimeTracing
    }
  }
}

module.exports = BedrockPlugin
