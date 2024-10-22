'use strict'

const TracingPlugin = require('../../plugins/tracing')
const LLMObsTagger = require('../tagger')

class LLMObsPlugin extends TracingPlugin {
  constructor (...args) {
    super(...args)

    this._tagger = new LLMObsTagger(this._tracerConfig)
  }

  configure (config) {
    // we do not want to enable any LLMObs plugins if it is disabled on the tracer
    const llmobsEnabled = this._tracerConfig.llmobs.enabled
    if (llmobsEnabled === false) {
      config = typeof config === 'boolean' ? false : { ...config, enabled: false } // override to false
    }
    super.configure(config)
  }
}

module.exports = LLMObsPlugin
