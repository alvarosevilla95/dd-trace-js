'use strict'

const log = require('../../../log')
const { SPAN_KIND } = require('../../constants/tags')
const LLMObsTagger = require('../../tagger')
const LLMObsPlugin = require('../base')

const pluginManager = require('../../../../../..')._pluginManager

const ANTHROPIC_PROVIDER_NAME = 'anthropic'
const BEDROCK_PROVIDER_NAME = 'amazon_bedrock'
const OPENAI_PROVIDER_NAME = 'openai'

const SUPPORTED_INTEGRATIONS = ['openai']
const LLM_SPAN_TYPES = ['llm', 'chat_model', 'embedding']
const LLM = 'llm'
const WORKFLOW = 'workflow'
const SUPPORTED_OPERATIONS = ['llm', 'chat_model', 'embedding', 'chain']

const ROLE_MAPPINGS = {
  human: 'user',
  ai: 'assistant',
  system: 'system'
}

class LangChainLLMObsPlugin extends LLMObsPlugin {
  static get prefix () {
    return 'tracing:apm:langchain:invoke'
  }

  getLLMObsSpanRegisterOptions (ctx) {
    const span = ctx.currentStore?.span
    const tags = span?.context()._tags || {}

    const modelProvider = tags['langchain.request.provider'] // could be undefined
    const modelName = tags['langchain.request.model'] // could be undefined
    const kind = this.getKind(ctx.type, modelProvider)
    const name = tags['resource.name']

    return {
      modelProvider,
      modelName,
      kind,
      name
    }
  }

  setLLMObsTags (ctx) {
    const span = ctx.currentStore?.span
    const type = ctx.type // langchain operation type

    if (!SUPPORTED_OPERATIONS.includes(type)) {
      log.warn(`Unsupported LangChain operation type: ${type}`)
      return
    }

    const provider = span?.context()._tags['langchain.request.provider']
    const integrationName = this.getIntegrationName(type, provider)
    this._setMetadata(span, provider)

    const inputs = ctx.args?.[0]
    const results = ctx.result
    const options = ctx.args?.[1]

    switch (type) {
      case 'chain':
        this._setMetaTagsFromChain(span, inputs, results)
        break
      case 'chat_model':
        this._setMetaTagsFromChatModel(span, inputs, results, options, integrationName)
        break
      case 'llm':
        break
      case 'embedding':
        break
    }
  }

  _setMetadata (span, provider) {
    if (!provider) return

    const metadata = {}

    const temperature =
      span?.context()._tags[`langchain.request.${provider}.parameters.temperature`] ||
      span?.context()._tags[`langchain.request.${provider}.parameters.model_kwargs.temperature`]

    const maxTokens =
      span?.context()._tags[`langchain.request.${provider}.parameters.max_tokens`] ||
      span?.context()._tags[`langchain.request.${provider}.parameters.maxTokens`] ||
      span?.context()._tags[`langchain.request.${provider}.parameters.model_kwargs.max_tokens`]

    if (temperature) {
      metadata.temperature = parseFloat(temperature)
    }

    if (maxTokens) {
      metadata.maxTokens = parseInt(maxTokens)
    }

    this._tagger.tagMetadata(span, metadata)
  }

  _setMetaTagsFromChain (span, inputs, results) {
    let input, output
    if (inputs) {
      input = this.formatIO(inputs)
    }

    if (!results || this.spanHasError(span)) {
      output = ''
    } else {
      output = this.formatIO(results)
    }

    // chain spans will always be workflows
    this._tagger.tagTextIO(span, input, output)
  }

  _setMetaTagsFromChatModel (span, inputs, results, options, integration) {
    if (integration === 'openai' && options?.response_format) {
      // langchain-openai will call a beta client if "response_format" is passed in on the options object
      // we do not trace these calls, so this should be an llm span
      this._tagger.changeKind(span, 'llm')
    }
    const spanKind = LLMObsTagger.getSpanKind(span)
    const isWorkflow = spanKind === 'workflow'
    const tag = (isWorkflow ? this._tagger.tagTextIO : this._tagger.tagLLMIO).bind(this._tagger)

    const inputMessages = []
    if (!Array.isArray(inputs)) inputs = [inputs]

    for (const messageSet of inputs) {
      for (const message of messageSet) {
        const content = message.content || ''
        const role = this.getRole(message)
        inputMessages.push({ content, role })
      }
    }

    if (this.spanHasError(span)) {
      tag(span, inputMessages, [{ content: '' }])
      return
    }

    // something
    const outputMessages = []
    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0

    if (!isWorkflow) {
      const tokens = this.checkTokenUsageChatOrLLMResult(results)
      inputTokens = tokens.inputTokens
      outputTokens = tokens.outputTokens
      totalTokens = tokens.totalTokens
    }

    for (const messageSet of results.generations) {
      for (const chatCompletion of messageSet) {
        const chatCompletionMessage = chatCompletion.message
        // something
      }
    }
  }

  checkTokenUsageChatOrLLMResult (results) {
    return {}
  }

  formatIO (messages) {
    if (messages.constructor.name === 'Object') { // plain JSON
      const formatted = {}
      for (const [key, value] of Object.entries(messages)) {
        formatted[key] = this.formatIO(value)
      }
    } else if (Array.isArray(messages)) {
      return messages.map(message => this.formatIO(message))
    } else { // either a BaseMesage type or a string
      return this.getContentFromMessage(messages)
    }
  }

  getContentFromMessage (message) {
    if (typeof message === 'string') {
      return message
    } else {
      try {
        const messageContent = {}
        messageContent.content = message.content || ''

        const role = this.getRole(message)
        if (role) messageContent.role = role

        return messageContent
      } catch {
        return JSON.stringify(message)
      }
    }
  }

  getKind (type, provider) {
    if (LLM_SPAN_TYPES.includes(type)) {
      const llmobsIntegration = this.getIntegrationName(type, provider)

      if (!this.isLLMIntegrationEnabled(llmobsIntegration)) {
        return LLM
      }
    }

    return WORKFLOW
  }

  getIntegrationName (type, provider) {
    if (provider.startsWith(BEDROCK_PROVIDER_NAME)) {
      return 'bedrock'
    } else if (provider.startsWith(OPENAI_PROVIDER_NAME)) {
      return 'openai'
    } else if (type === 'chat_model' && provider.startsWith(ANTHROPIC_PROVIDER_NAME)) {
      return 'anthropic'
    }

    return 'custom'
  }

  isLLMIntegrationEnabled (integration) {
    return SUPPORTED_INTEGRATIONS.includes(integration) && pluginManager?._pluginsByName[integration]?.llmobs?._enabled
  }

  getRole (message) {
    if (message.role) return ROLE_MAPPINGS[message.role] || message.role

    const type = (
      (typeof message.getType === 'function' && message.getType()) ||
      (typeof message._getType === 'function' && message._getType())
    )

    return ROLE_MAPPINGS[type] || type
  }
}

module.exports = LangChainLLMObsPlugin
