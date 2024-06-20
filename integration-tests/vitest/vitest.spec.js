'use strict'

const { exec } = require('child_process')

const getPort = require('get-port')
const { assert } = require('chai')

const {
  createSandbox,
  getCiVisAgentlessConfig
} = require('../helpers')
const { FakeCiVisIntake } = require('../ci-visibility-intake')
const {
  TEST_STATUS,
  TEST_TYPE
} = require('../../packages/dd-trace/src/plugins/util/test')

// tested with 1.6.0
const versions = ['latest']

versions.forEach((version) => {
  describe(`vitest@${version}`, () => {
    let sandbox, cwd, receiver, childProcess

    before(async function () {
      sandbox = await createSandbox([`vitest@${version}`], true)
      // debugger
      cwd = sandbox.folder
    })

    after(async () => {
      await sandbox.remove()
    })

    beforeEach(async function () {
      const port = await getPort()
      receiver = await new FakeCiVisIntake(port).start()
    })

    afterEach(async () => {
      childProcess.kill()
      await receiver.stop()
    })

    it('can run and report tests', (done) => {
      receiver.gatherPayloadsMaxTimeout(({ url }) => url === '/api/v2/citestcycle', payloads => {
        debugger
        const events = payloads.flatMap(({ payload }) => payload.events)

        const testSessionEvent = events.find(event => event.type === 'test_session_end')
        const testModuleEvent = events.find(event => event.type === 'test_module_end')
        const testSuiteEvents = events.filter(event => event.type === 'test_suite_end')
        const testEvents = events.filter(event => event.type === 'test')

        assert.include(testSessionEvent.content.resource, 'test_session.vitest run')
        assert.equal(testSessionEvent.content.meta[TEST_STATUS], 'fail')
        assert.include(testModuleEvent.content.resource, 'test_module.vitest run')
        assert.equal(testModuleEvent.content.meta[TEST_STATUS], 'fail')
        assert.equal(testSessionEvent.content.meta[TEST_TYPE], 'test')
        assert.equal(testModuleEvent.content.meta[TEST_TYPE], 'test')

        const passedSuite = testSuiteEvents.find(
          suite => suite.content.resource === 'test_suite.ci-visibility/vitest-tests/test-visibility-passed-suite.mjs'
        )
        assert.equal(passedSuite.content.meta[TEST_STATUS], 'pass')

        const failedSuite = testSuiteEvents.find(
          suite => suite.content.resource === 'test_suite.ci-visibility/vitest-tests/test-visibility-failed-suite.mjs'
        )
        assert.equal(failedSuite.content.meta[TEST_STATUS], 'fail')

        const failedTest = testSuiteEvents.find(
          ({ content: { resource } }) =>
            resource === 'ci-visibility/vitest-tests/test-visibility-failed-suite.mjs.can report failed test'
        )

        assert.equal(failedTest.content.meta[TEST_STATUS], 'fail')

        const passedTests = testEvents.filter(testEvent => testEvent.content.meta[TEST_STATUS] === 'pass')

        assert.includeMembers(passedTests.map(test => test.content.resource), [
          'ci-visibility/vitest-tests/test-visibility-failed-suite.mjs.can report more',
          'ci-visibility/vitest-tests/test-visibility-failed-suite.mjs.can report passed test',
          'ci-visibility/vitest-tests/test-visibility-passed-suite.mjs.can report passed test',
          'ci-visibility/vitest-tests/test-visibility-passed-suite.mjs.can report more'
        ])

        // TODO: just check pass
        assert.includeMembers(testEvents.map(test => test.content.meta[TEST_STATUS]), [
          'pass',
          'pass',
          'pass',
          'pass',
          'pass',
          'pass',
          'pass',
          'fail'
        ])
      }, 25000).then(() => done()).catch(done)

      childProcess = exec(
        './node_modules/.bin/vitest run',
        {
          cwd,
          env: {
            ...getCiVisAgentlessConfig(receiver.port),
            // maybe only in node@20
            NODE_OPTIONS: '--import dd-trace/register.js -r dd-trace/ci/init' // ESM requires more stuff
          },
          stdio: 'pipe'
        }
      )

      childProcess.stdout.pipe(process.stdout)
      childProcess.stderr.pipe(process.stderr)
    })
  })
})
