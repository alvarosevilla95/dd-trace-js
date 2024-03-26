import { createHook } from 'import-in-the-middle/hook.js'
import * as moduleList from './packages/datadog-instrumentations/src/helpers/dependency-list.js'

const { load, resolve, getFormat, getSource } = createHook(import.meta, moduleList)

export { load, resolve, getFormat, getSource }
