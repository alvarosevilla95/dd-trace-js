'use strict'

const CompositePlugin = require('../../dd-trace/src/plugins/composite')
const LangChainTracingPlugin = require('./tracing')
const LangChainLLMObsPlugin = require('../../dd-trace/src/llmobs/plugins/langchain')

class LangChainPlugin extends CompositePlugin {
  static get id () { return 'langchain' }
  static get plugins () {
    return {
      llmobs: LangChainLLMObsPlugin,
      tracing: LangChainTracingPlugin
    }
  }
}

module.exports = LangChainPlugin
