/* eslint-disable max-len */
'use strict'

const agent = require('../../dd-trace/test/plugins/agent')
const { setup } = require('./spec_helpers')
const helpers = require('./kinesis_helpers')
const { rawExpectedSchema } = require('./kinesis-naming')
const { ENTRY_PARENT_HASH } = require('../../dd-trace/src/datastreams/processor')
const { computePathwayHash } = require('../../dd-trace/src/datastreams/pathway')
const DataStreamsContext = require('../../dd-trace/src/data_streams_context')

const expectedProducerHash = computePathwayHash(
  'test',
  'tester',
  ['direction:out', 'topic:MyStream', 'type:kinesis'],
  ENTRY_PARENT_HASH
)

describe('Kinesis', () => {
  setup()

  withVersions('aws-sdk', ['aws-sdk', '@aws-sdk/smithy-client'], (version, moduleName) => {
    let AWS
    let kinesis
    let tracer

    const streamName = 'MyStream'
    const kinesisClientName = moduleName === '@aws-sdk/smithy-client' ? '@aws-sdk/client-kinesis' : 'aws-sdk'

    before(() => {
      process.env.DD_DATA_STREAMS_ENABLED = true
      return agent.load('aws-sdk')
    })

    before(function (done) {
      this.timeout(0)
      AWS = require(`../../../versions/${kinesisClientName}@${version}`).get()

      const params = {
        endpoint: 'http://127.0.0.1:4566',
        region: 'us-east-1'
      }

      if (moduleName === '@aws-sdk/smithy-client') {
        const { NodeHttpHandler } = require(`../../../versions/@aws-sdk/node-http-handler@${version}`).get()

        params.requestHandler = new NodeHttpHandler()
      }

      kinesis = new AWS.Kinesis(params)
      kinesis.createStream({
        StreamName: streamName,
        ShardCount: 1
      }, (err, res) => {
        if (err) return done(err)

        helpers.waitForActiveStream(this, kinesis, done)
      })
    })

    after(done => {
      kinesis.deleteStream({
        StreamName: streamName
      }, (err, res) => {
        if (err) return done(err)

        helpers.waitForDeletedStream(kinesis, done)
      })
    })

    withNamingSchema(
      (done) => kinesis.describeStream({
        StreamName: streamName
      }, (err) => err && done(err)),
      rawExpectedSchema.outbound
    )

    it('injects trace context to Kinesis putRecord', done => {
      helpers.putTestRecord(kinesis, helpers.dataBuffer, (err, data) => {
        if (err) return done(err)

        helpers.getTestData(kinesis, data, (err, data) => {
          if (err) return done(err)

          expect(data).to.have.property('_datadog')
          expect(data._datadog).to.have.property('x-datadog-trace-id')

          done()
        })
      })
    })

    it('handles already b64 encoded data', done => {
      helpers.putTestRecord(kinesis, helpers.dataBuffer.toString('base64'), (err, data) => {
        if (err) return done(err)

        helpers.getTestData(kinesis, data, (err, data) => {
          if (err) return done(err)

          expect(data).to.have.property('_datadog')
          expect(data._datadog).to.have.property('x-datadog-trace-id')

          done()
        })
      })
    })

    it('skips injecting trace context to Kinesis if message is full', done => {
      const dataBuffer = Buffer.from(JSON.stringify({
        myData: Array(1048576 - 100).join('a')
      }))

      helpers.putTestRecord(kinesis, dataBuffer, (err, data) => {
        if (err) return done(err)

        helpers.getTestData(kinesis, data, (err, data) => {
          if (err) return done(err)

          expect(data).to.not.have.property('_datadog')

          done()
        })
      })
    })

    it('generates tags for proper input', done => {
      agent.use(traces => {
        const span = traces[0][0]
        expect(span.meta).to.include({
          'streamname': streamName,
          'aws_service': 'Kinesis',
          'region': 'us-east-1'
        })
        expect(span.resource).to.equal(`putRecord ${streamName}`)
        expect(span.meta).to.have.property('streamname', streamName)
      }).then(done, done)

      helpers.putTestRecord(kinesis, helpers.dataBuffer, e => e && done(e))
    })

    describe('Disabled', () => {
      before(() => {
        process.env.DD_TRACE_AWS_SDK_KINESIS_ENABLED = 'false'
      })

      after(() => {
        delete process.env.DD_TRACE_AWS_SDK_KINESIS_ENABLED
      })

      it('skip injects trace context to Kinesis putRecord when disabled', done => {
        helpers.putTestRecord(kinesis, helpers.dataBuffer, (err, data) => {
          if (err) return done(err)

          helpers.getTestData(kinesis, data, (err, data) => {
            if (err) return done(err)

            expect(data).not.to.have.property('_datadog')

            done()
          })
        })
      })
    })

    describe('DSM Context Propagation', () => {
      before(() => {
        tracer = require('../../dd-trace')
        tracer.init({ dsmEnabled: true })
        tracer.use('aws-sdk', { kinesis: { dsmEnabled: true } })
        return agent.load('aws-sdk', { kinesis: { dsmEnabled: true } })
      })

      it('injects DSM trace context to Kinesis putRecord', done => {
        if (DataStreamsContext.setDataStreamsContext.isSinonProxy) {
          DataStreamsContext.setDataStreamsContext.restore()
        }
        const setDataStreamsContextSpy = sinon.spy(DataStreamsContext, 'setDataStreamsContext')

        console.log(tracer._pluginManager._tracerConfig)

        helpers.putTestRecord(kinesis, helpers.dataBuffer, (err, data) => {
          if (err) return done(err)

          expect(
            setDataStreamsContextSpy.args[0][0].hash
          ).to.equal(expectedProducerHash)

          setDataStreamsContextSpy.restore()
          done()
        })
      })
    })
  })
})
