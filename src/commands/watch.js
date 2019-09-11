const path = require('path')
const chokidar = require('chokidar')

const logger = require('../util/logger')
const buildDependencyChain = require('../util/buildDependencyChain')
const getPackagesInfo = require('../util/getPackagesInfo')

/*
 * Watch for changes in each of the packages in this project
 */
async function watch(args) {
  try {
    const packageInfo = await getPackagesInfo()
    createWatcher(packageInfo, args)
  } catch (error) {
    logger.error(`There was a problem watching the project: ${error}`)
  }
}

async function createWatcher(packagesInfo, args) {
  let globs = changeExtensionsToGlobs(args.ext)

  let logText = globs
    ? `Watching ${JSON.stringify(globs)} from the following packages:`
    : 'Watching the following packages:'
  logger.logArr(logText, packagesInfo.map(pkg => pkg.name), 'green')

  let packagesPaths = packagesInfo.map(pkg => pkg.location)
  let globbedPaths = addFileGlobToPath(globs, packagesPaths)

  // prettier-ignore
  let watcher = chokidar.watch(globbedPaths, {
    ignored: [
      /lib|dist|build|bld/, // Ignore build output
      /node_modules/,       // Ignore node_modules
      /(^|[\/\\])\..+$/,    // Ignore dot files
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: true, // Helps minimizing thrashing of watch events
  })

  async function _buildDependencyChain(changedFilePath) {
    await buildDependencyChain({
      path: changedFilePath,
      script: args.script,
      command: args.execute,
    })
  }

  // Add event listeners
  return watcher
    .on('add', async path => {
      logger.blue(`File ${path} was added`)
      await _buildDependencyChain(path)
    })
    .on('change', async path => {
      logger.blue(`File ${path} was changed`)
      await _buildDependencyChain(path)
    })
    .on('unlink', async path => {
      logger.blue(`File ${path} was removed`)
      await _buildDependencyChain(path)
    })
}

/**
 * Change strings from extension format to
 * glob format (*.txt).
 * @param {Array[string]} extensions
 */
function changeExtensionsToGlobs(extensions) {
  if (!extensions) return null

  // Handle the case where only one extension was passed
  if (typeof extensions === 'string') {
    extensions = [extensions]
  }

  return extensions.map(ext => {
    if (ext.startsWith('*.')) return ext
    if (ext.startsWith('.')) return '*' + ext
    return '*.' + ext
  })
}

function addFileGlobToPath(globs, paths) {
  if (!globs || !globs.length) return paths

  let globbedPaths = []

  for (let filepath of paths) {
    for (let glob of globs) {
      globbedPaths.push(path.join(filepath, glob))
    }
  }

  return globbedPaths
}

module.exports = watch
