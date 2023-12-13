/* eslint-disable max-len */
'use strict'

const semver = require('semver')
const agent = require('../../dd-trace/test/plugins/agent')
const { setup } = require('./spec_helpers')
const { rawExpectedSchema } = require('./sns-naming')
const { ENTRY_PARENT_HASH, getHeadersSize, DataStreamsProcessor } = require('../../dd-trace/src/datastreams/processor')
const { computePathwayHash } = require('../../dd-trace/src/datastreams/pathway')
const DataStreamsContext = require('../../dd-trace/src/data_streams_context')
const snsPlugin = require('../src/services/sns')

const expectedProducerHash = computePathwayHash(
  'test',
  'tester',
  ['direction:out', 'topic:TestTopicDSM', 'type:sns'],
  ENTRY_PARENT_HASH
)
const expectedConsumerHash = computePathwayHash(
  'test',
  'tester',
  ['direction:in', 'topic:TestQueueDSM', 'type:sqs'],
  expectedProducerHash
)

describe('Sns', () => {
  setup()

  withVersions('aws-sdk', ['aws-sdk', '@aws-sdk/smithy-client'], (version, moduleName) => {
    let sns
    let sqs
    let subParams
    let receiveParams
    let TopicArn
    let QueueArn
    let QueueUrl
    let parentId
    let spanId
    let tracer

    const snsClientName = moduleName === '@aws-sdk/smithy-client' ? '@aws-sdk/client-sns' : 'aws-sdk'
    const sqsClientName = moduleName === '@aws-sdk/smithy-client' ? '@aws-sdk/client-sqs' : 'aws-sdk'

    const assertPropagation = done => {
      agent.use(traces => {
        const span = traces[0][0]

        if (span.resource.startsWith('publish')) {
          spanId = span.span_id.toString()
        } else if (span.name === 'aws.response') {
          parentId = span.parent_id.toString()
        }

        expect(parentId).to.not.equal('0')
        expect(parentId).to.equal(spanId)
      }).then(done, done)
    }

    function createResources (queueName, topicName, cb) {
      const { SNS } = require(`../../../versions/${snsClientName}@${version}`).get()
      const { SQS } = require(`../../../versions/${sqsClientName}@${version}`).get()

      sns = new SNS({ endpoint: 'http://127.0.0.1:4566', region: 'us-east-1' })
      sqs = new SQS({ endpoint: 'http://127.0.0.1:4566', region: 'us-east-1' })

      sns.createTopic({ Name: topicName }, (err, data) => {
        if (err) return cb(err)

        TopicArn = data.TopicArn

        sqs.createQueue({ QueueName: queueName }, (err, data) => {
          if (err) return cb(err)

          QueueUrl = data.QueueUrl

          sqs.getQueueAttributes({ QueueUrl, AttributeNames: ['All'] }, (err, data) => {
            if (err) return cb(err)

            QueueArn = data.Attributes.QueueArn

            subParams = {
              Protocol: 'sqs',
              Endpoint: QueueArn,
              TopicArn
            }

            receiveParams = {
              QueueUrl,
              MessageAttributeNames: ['.*'],
              WaitTimeSeconds: 1
            }

            cb()
          })
        })
      })
    }

    describe('no configuration', () => {
      before(() => {
        parentId = '0'
        spanId = '0'

        return agent.load('aws-sdk', { sns: { dsmEnabled: false } }, { dsmEnabled: true })
      })

      before(done => {
        process.env.DD_DATA_STREAMS_ENABLED = 'true'
        tracer = require('../../dd-trace')
        tracer.use('aws-sdk', { sns: { dsmEnabled: false } })

        createResources('TestQueue', 'TestTopic', done)
      })

      after(done => {
        sns.deleteTopic({ TopicArn }, done)
      })

      after(done => {
        sqs.deleteQueue({ QueueUrl }, done)
      })

      after(() => {
        return agent.close({ ritmReset: false })
      })

      withPeerService(
        () => tracer,
        'aws-sdk',
        (done) => sns.publish({
          TopicArn,
          Message: 'message 1'
        }, (err) => err && done()),
        'TestTopic', 'topicname')

      withNamingSchema(
        (done) => sns.publish({
          TopicArn,
          Message: 'message 1'
        }, (err) => err && done()),
        rawExpectedSchema.producer,
        {
          desc: 'producer'
        }
      )

      withNamingSchema(
        (done) => sns.getTopicAttributes({
          TopicArn
        }, (err) => err && done(err)),
        rawExpectedSchema.client,
        {
          desc: 'client'
        }
      )

      it('injects trace context to SNS publish', done => {
        assertPropagation(done)

        sns.subscribe(subParams, (err, data) => {
          if (err) return done(err)

          sqs.receiveMessage(receiveParams, e => e && done(e))
          sns.publish({ TopicArn, Message: 'message 1' }, (e) => {
            if (e) done(e)
          })
        })
      })

      // There is a bug in 3.x (but not 3.0.0) that will be fixed in 3.261
      // https://github.com/aws/aws-sdk-js-v3/issues/2861
      if (!semver.intersects(version, '<3 || >3.0.0')) {
        it('injects trace context to SNS publishBatch', done => {
          assertPropagation(done)

          sns.subscribe(subParams, (err, data) => {
            if (err) return done(err)

            sqs.receiveMessage(receiveParams, e => e && done(e))
            sns.publishBatch({
              TopicArn,
              PublishBatchRequestEntries: [
                { Id: '1', Message: 'message 1' },
                { Id: '2', Message: 'message 2' }
              ]
            }, e => e && done(e))
          })
        })
      }

      // TODO: Figure out why this fails only in 3.0.0
      if (version !== '3.0.0') {
        it('skips injecting trace context to SNS if message attributes are full', done => {
          sns.subscribe(subParams, (err, data) => {
            if (err) return done(err)

            sqs.receiveMessage(receiveParams, (err, data) => {
              if (err) return done(err)

              try {
                expect(data.Messages[0].Body).to.not.include('datadog')
                done()
              } catch (e) {
                done(e)
              }
            })

            sns.publish({
              TopicArn,
              Message: 'message 1',
              MessageAttributes: {
                keyOne: { DataType: 'String', StringValue: 'keyOne' },
                keyTwo: { DataType: 'String', StringValue: 'keyTwo' },
                keyThree: { DataType: 'String', StringValue: 'keyThree' },
                keyFour: { DataType: 'String', StringValue: 'keyFour' },
                keyFive: { DataType: 'String', StringValue: 'keyFive' },
                keySix: { DataType: 'String', StringValue: 'keySix' },
                keySeven: { DataType: 'String', StringValue: 'keySeven' },
                keyEight: { DataType: 'String', StringValue: 'keyEight' },
                keyNine: { DataType: 'String', StringValue: 'keyNine' },
                keyTen: { DataType: 'String', StringValue: 'keyTen' }
              }
            }, e => e && done(e))
          })
        })
      }

      it('generates tags for proper publish calls', done => {
        agent.use(traces => {
          const span = traces[0][0]

          expect(span.resource).to.equal(`publish ${TopicArn}`)
          expect(span.meta).to.include({
            'aws.sns.topic_arn': TopicArn,
            'topicname': 'TestTopic',
            'aws_service': 'SNS',
            'region': 'us-east-1'
          })
        }).then(done, done)

        sns.publish({ TopicArn, Message: 'message 1' }, e => e && done(e))
      })
    })

    describe('Data Streams Monitoring', () => {
      before(() => {
        return agent.load('aws-sdk', { sns: { dsmEnabled: true }, sqs: { dsmEnabled: true } }, { dsmEnabled: true })
      })

      before(done => {
        process.env.DD_DATA_STREAMS_ENABLED = 'true'
        tracer = require('../../dd-trace')
        tracer.use('aws-sdk', { sns: { dsmEnabled: true }, sqs: { dsmEnabled: true } })

        createResources('TestQueueDSM', 'TestTopicDSM', done)
      })

      after(done => {
        sns.deleteTopic({ TopicArn }, done)
      })

      after(done => {
        sqs.deleteQueue({ QueueUrl }, done)
      })

      after(() => {
        return agent.close({ ritmReset: false })
      })

      it('injects DSM trace context to SNS publish', done => {
        let producerHashCreated = false
        let consumerHashCreated = false

        if (DataStreamsContext.setDataStreamsContext.isSinonProxy) {
          DataStreamsContext.setDataStreamsContext.restore()
        }
        const setDataStreamsContextSpy = sinon.spy(DataStreamsContext, 'setDataStreamsContext')

        sns.subscribe(subParams, (err, data) => {
          if (err) return done(err)

          sqs.receiveMessage(
            receiveParams,
            (err, res) => {
              if (err) return done(err)

              setDataStreamsContextSpy.args.forEach(functionCall => {
                if (functionCall[0].hash === expectedConsumerHash) {
                  consumerHashCreated = true
                } else if (functionCall[0].hash === expectedProducerHash) {
                  producerHashCreated = true
                }
              })

              expect(consumerHashCreated).to.equal(true)
              expect(producerHashCreated).to.equal(true)
              setDataStreamsContextSpy.restore()
              done()
            })
          sns.publish(
            { TopicArn, Message: 'message DSM' },
            (err) => {
              if (err) return done(err)
            })
        })
      })

      it('sets a message payload size when DSM is enabled', done => {
        if (DataStreamsProcessor.prototype.recordCheckpoint.isSinonProxy) {
          DataStreamsProcessor.prototype.recordCheckpoint.restore()
        }
        const recordCheckpointSpy = sinon.spy(DataStreamsProcessor.prototype, 'recordCheckpoint')

        if (snsPlugin.prototype._injectMessageAttributes.isSinonProxy) {
          snsPlugin.prototype._injectMessageAttributes.restore()
        }
        const injectMessageSpy = sinon.spy(snsPlugin.prototype, '_injectMessageAttributes')

        sns.subscribe(subParams, (err, data) => {
          if (err) return done(err)

          sns.publish(
            { TopicArn, Message: 'message DSM' },
            (err) => {
              if (err) return done(err)

              const params = injectMessageSpy.args[0][1]
              // decode the raw buffer to JSON string
              params.MessageAttributes._datadog.BinaryValue = JSON.stringify(
                JSON.parse(Buffer.from(params.MessageAttributes._datadog.BinaryValue, 'base64'))
              )
              const payloadSize = getHeadersSize(params)

              expect(recordCheckpointSpy.args[0][0].hasOwnProperty('payloadSize'))
              expect(recordCheckpointSpy.args[0][0].payloadSize).to.equal(payloadSize)
              injectMessageSpy.restore()
              recordCheckpointSpy.restore()
              done()
            })
        })
      })
    })
  })
})
