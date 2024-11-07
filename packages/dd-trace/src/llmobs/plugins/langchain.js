'use strict'

const LLMObsPlugin = require('./base')

class LangChainLLMObsPlugin extends LLMObsPlugin {
  static get prefix () {
    return 'tracing:apm:langchain:invoke'
  }

  getLLMObsSpanRegisterOptions (ctx) {}

  setLLMObsTags (ctx) {}
}

module.exports = LangChainLLMObsPlugin
