'use strict'

const dc = require('diagnostics_channel')
const { storage } = require('../../../datadog-core')
const { TracingChannel } = require('../../../datadog-instrumentations/src/helpers/instrument')

class Subscription {
  constructor (event, handler) {
    this._channel = dc.channel(event)
    this._handler = (message, name) => {
      const store = storage.getStore()
      if (!store || !store.noop) {
        handler(message, name)
      }
    }
  }

  enable () {
    this._channel.subscribe(this._handler)
  }

  disable () {
    this._channel.unsubscribe(this._handler)
  }
}

class TracingSubscription {
  constructor (plugin) {
    this.plugin = plugin
    // We do the initialization in a separate function so that public class
    // fields can be used for the `prefix` value.
  }

  init () {
    const events = this.events || ['start', 'end', 'asyncEnd', 'error']
    this._channel = new TracingChannel(this.prefix)
    this._handlers = {}
    for (const name of events) {
      if (!this[name]) continue
      switch (name) {
        case 'start':
          this._handlers[name] = (ctx) => {
            const store = storage.getStore()
            if (store && store.noop) return
            const span = this.start(ctx, store)
            if (!span) {
              throw new TypeError(`${this.constructor.name}#start() must return a span`)
            }
            ctx.span = span
            ctx.parentStore = store
            this.plugin.enter(span, store)
          }
          break
        case 'end':
          this._handlers[name] = (ctx) => {
            const store = storage.getStore()
            if (store && store.noop) return
            this.end(ctx, store)
            this.plugin.exit(ctx)
          }
          break
        case 'asyncEnd':
          this._handlers[name] = (ctx) => {
            const store = storage.getStore()
            if (store && store.noop) return
            this.asyncEnd(ctx, store)
            // plugin.exit(ctx)
          }
          break
        default:
          this._handlers[name] = (ctx) => {
            const store = storage.getStore()
            if (store && store.noop) return
            this[name](ctx, store)
          }
      }
    }
    return this
  }

  end () {
    // This stub means we always have an implicit end event handler when a prefix is used.
  }

  asyncEnd () {
    // This stub means we always have an implicit asyncEnd event handler when a prefix is used.
  }

  error ({ span, error }) {
    span.setTag('error', error)
  }

  enable () {
    this._channel.subscribe(this._handlers)
  }

  disable () {
    this._channel.unsubscribe(this._handlers)
  }
}

class Plugin {
  constructor (tracer) {
    this._subscriptions = []
    this._enabled = false
    this._loadedTracingSubscriptions = false
    this._tracer = tracer
  }

  get tracer () {
    return this._tracer._tracer
  }

  enter (span, store) {
    store = store || storage.getStore()
    storage.enterWith({ ...store, span })
  }

  exit (ctx) {
    storage.enterWith(ctx.parentStore)
  }

  /** Prevents creation of spans here and for all async descendants. */
  skip () {
    // TODO make this work with the parent chain
    storage.enterWith({ noop: true })
  }

  addSub (channelName, handler) {
    this._subscriptions.push(new Subscription(channelName, handler))
  }

  addError (error) {
    const store = storage.getStore()

    if (!store || !store.span) return

    if (!store.span._spanContext._tags['error']) {
      store.span.setTag('error', error || 1)
    }
  }

  configure (config) {
    if (!this._loadedTracingSubscriptions) {
      // We have to do this bit outside the constructor because otherwise we
      // won't have access to this property if it's defined as a class field.
      // We might as well do it here, the first time it's configured, since
      // p0lugins are unusable unless enabled through `configure()`.
      if (this.tracingSubscriptions) {
        for (const Sub of this.tracingSubscriptions) {
          this._subscriptions.push(new Sub(this).init())
        }
      }
      this._loadedTracingSubscriptions = true
    }

    if (typeof config === 'boolean') {
      config = { enabled: config }
    }
    this.config = config
    if (config.enabled && !this._enabled) {
      this._enabled = true
      this._subscriptions.forEach(sub => sub.enable())
    } else if (!config.enabled && this._enabled) {
      this._enabled = false
      this._subscriptions.forEach(sub => sub.disable())
    }
  }
}

Plugin.TracingSubscription = TracingSubscription
module.exports = Plugin.Plugin = Plugin
