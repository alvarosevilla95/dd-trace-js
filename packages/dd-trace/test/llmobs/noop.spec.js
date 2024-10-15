'use strict'

describe('noop', () => {
  let tracer
  let llmobs

  before(() => {
    tracer = new (require('../../../dd-trace/src/noop/proxy'))()
    llmobs = tracer.llmobs
  })

  const nonTracingOps = ['enable', 'disable', 'annotate', 'exportSpan', 'submitEvaluation', 'flush']
  for (const op of nonTracingOps) {
    it(`using "${op}" should not throw`, () => {
      llmobs[op]()
    })
  }

  it('using "active" returns a span', () => {
    let span
    expect(() => { span = llmobs.active() }).does.not.throw()
    expect(() => span.setTag('foo', 'bar')).does.not.throw()
  })

  describe('startSpan', () => {
    it('should not throw', () => {
      expect(() => llmobs.startSpan({})).does.not.throw
    })

    it('should return an object with a finish method', () => {
      const span = llmobs.startSpan({})
      expect(() => span.finish()).does.not.throw
    })
  })

  describe('trace', () => {
    it('should not throw with just a span', () => {
      const res = llmobs.trace({}, (span) => {
        expect(() => span.setTag('foo', 'bar')).does.not.throw
        return 1
      })

      expect(res).to.equal(1)
    })

    it('should not throw with a span and a callback', async () => {
      const prom = llmobs.trace({}, (span, cb) => {
        expect(() => span.setTag('foo', 'bar')).does.not.throw
        expect(() => cb()).does.not.throw
        return Promise.resolve(5)
      })

      expect(await prom).to.equal(5)
    })
  })

  describe('wrap', () => {
    it('should not throw with just a span', () => {
      function fn () {
        return 1
      }

      const wrapped = llmobs.wrap({}, fn)
      expect(wrapped()).to.equal(1)
    })

    it('should not throw with a span and a callback', async () => {
      function fn () {
        return Promise.resolve(5)
      }
      const wrapped = llmobs.wrap({}, fn)
      expect(await wrapped()).to.equal(5)
    })
  })
})
