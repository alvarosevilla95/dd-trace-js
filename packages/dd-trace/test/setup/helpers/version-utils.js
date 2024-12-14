'use strict'

const { execSync } = require('child_process')
const semver = require('semver')

const versions = {}

function getAllVersions (name) {
  // TODO caching this per process is probably sufficient for now, but to handle
  // the case where a package is published between process that run one after the
  // other, we should probably cache this in a file or something.
  if (!versions[name]) {
    versions[name] = JSON.parse(execSync('npm show ' + name + ' versions --json').toString())
  }
  return versions[name]
}

function getAllVersionsMatching (name, ranges) {
  return getAllVersions(name).filter(version => ranges.some(range => semver.satisfies(version, range)))
}

function rangesTestVersion (name, ranges, version) {
  for (const range of ranges) {
    const matches = getAllVersionsMatching(name, [range])
    if (matches[0] === version) {
      return true
    }
    if (matches[matches.length - 1] === version) {
      return true
    }
  }
  return false
}

// In addition to version ranges inputted, we also want to ensure that
// versions at the beggining and end of any major version covered by
// existing ranges are individually tested.
function getIdeallyTestedVersionRanges (name, ranges) {
  const result = ranges.slice()
  const allVersionsMatching = getAllVersionsMatching(name, ranges)
  for (let i = 0; i < allVersionsMatching.length; i++) {
    const version = allVersionsMatching[i]
    if (i !== 0 && version.endsWith('.0.0')) {
      if (!rangesTestVersion(name, ranges, version)) {
        result.push(version)
      }
      if (allVersionsMatching[i - 1] && !rangesTestVersion(name, ranges, allVersionsMatching[i - 1])) {
        result.push(allVersionsMatching[i - 1])
      }
    }
  }
  return result
}

function getIdeallyTestedVersions (name, ranges) {
  ranges = (process.env.PACKAGE_VERSION_RANGE
    ? [process.env.PACKAGE_VERSION_RANGE]
    : ranges || [])
    .filter(range => !process.env.RANGE || semver.subset(range, process.env.RANGE))
  // TODO sub `ranges` for `getIdeallyTestedVersionRanges(name, ranges)` below
  // once we're ready to use it
  return ranges.reduce((acc, range) => {
    const matches = getAllVersionsMatching(name, [range])
    if (range !== '*') {
      acc.push({ range, version: matches[0] })
    }
    acc.push({ range, version: matches[matches.length - 1] })
    return acc
  }, [])
}

module.exports = {
  getAllVersions,
  getAllVersionsMatching,
  getIdeallyTestedVersionRanges,
  getIdeallyTestedVersions
}
