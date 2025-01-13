const BaseLLMObsPlugin = require('./base')
const { storage } = require('../../../../datadog-core')
const llmobsStore = storage('llmobs')

class BedrockLLMObsPlugin extends BaseLLMObsPlugin {
  constructor () {
    super(...arguments)

    this.addSub('apm:aws:request:complete:bedrock runtime', ({ response }) => {
      const operation = response.request.operation
      if (operation !== 'invokeModel') {
        return
      }
      const request = response.request
      const span = storage.getStore()?.span
      this.setLLMObsTags({ request, span, response })
    })
  }

  setLLMObsTags ({ request, span, response }) {
    const parent = llmobsStore.getStore()?.span
    // called register for context management
    this._tagger.registerLLMObsSpan(span, {
      parent,
      modelName: '',
      modelProvider: '',
      kind: 'llm',
      name: 'invokeModel'
    })

    this._tagger.tagLLMIO(/* something here */)
    this._tagger.tagMetadata(span, {
      // some metadata
    })
    this._tagger.tagMetrics(span, {
      // some metrics
    })
  }
}

module.exports = BedrockLLMObsPlugin
