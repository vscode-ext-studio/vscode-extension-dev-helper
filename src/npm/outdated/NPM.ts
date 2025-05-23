import { exec } from 'child_process'
import { prerelease } from 'semver'
import { workspace } from 'vscode'
import { Cache } from './Cache'
import { PackageInfo } from './PackageInfo'
import { getCacheLifetime } from './Settings'
import { cacheEnabled, fetchLite } from './Utils'

type PackagesVersions = Map<string, Cache<Promise<string[] | null>>>

interface NPMRegistryPackage {
  versions?: Record<string, unknown>
}

// The `npm view` cache.
const packagesCache: PackagesVersions = new Map()

// Get all package versions through `npm view` command.
export const getPackageVersions = async (
  name: string
): Promise<string[] | null> => {
  // If the package query is in the cache (even in the process of being executed), return it.
  // This ensures that we will not have duplicate execution process while it is within lifetime.
  if (cacheEnabled()) {
    const cachePackages = packagesCache.get(name)

    if (cachePackages?.isValid(getCacheLifetime())) {
      return cachePackages.value
    }
  }

  // We'll use Registry NPM to get the versions directly from the source.
  // This avoids loading processes via `npm view`.
  // The process is cached if it is triggered quickly, within lifetime.
  const execPromise = new Promise<string[] | null>((resolve) =>
    fetchLite<NPMRegistryPackage>({
      url: `https://registry.npmjs.org/${name}`,
    }).then((data) => {
      const versions = data?.versions
      if (versions) {
        const availableVersions = Object.keys(data.versions)
          .filter((key) => !(versions[key] as any).deprecated)
        return resolve(availableVersions)
      }

      // Uses `npm view` as a fallback.
      // This usually happens when the package needs authentication.
      // In this case, we'll let `npm` handle it directly.
      return exec(`npm view --json ${name} versions`, (error, stdout) => {
        if (!error) {
          try {
            return resolve(JSON.parse(stdout))
          } catch (e) {
            /* empty */
          }
        }

        return resolve(null)
      })
    })
  )

  packagesCache.set(name, new Cache(execPromise))

  return execPromise
}

interface NPMListResponse {
  dependencies?: Record<string, { version: string }>
}

export let packagesInstalledCache:
  | Cache<Promise<PackagesInstalled | undefined>>
  | undefined

export type PackagesInstalled = Record<string, string | undefined>

// Returns packages installed by the user and their respective versions.
export const getPackagesInstalled = (): Promise<
  PackagesInstalled | undefined
> => {
  if (cacheEnabled() && packagesInstalledCache?.isValid(60 * 60 * 1000)) {
    return packagesInstalledCache.value
  }

  const execPromise = new Promise<PackagesInstalled | undefined>((resolve) => {
    const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath

    return exec('npm ls --json --depth=0', { cwd }, (_error, stdout) => {
      if (stdout) {
        try {
          const execResult = JSON.parse(stdout) as NPMListResponse

          if (execResult.dependencies) {
            // The `npm ls` command returns a lot of information.
            // We only need the name of the installed package and its version.
            const packageEntries = Object.entries(execResult.dependencies).map(
              ([packageName, packageInfo]) => [packageName, packageInfo.version]
            )

            return resolve(Object.fromEntries(packageEntries))
          }
        } catch (e) {
          /* empty */
        }
      }

      return resolve(undefined)
    })
  })

  packagesInstalledCache = new Cache(execPromise)

  return execPromise
}

export interface PackageAdvisory {
  cvss: { score: number }
  severity: string
  title: string
  url: string
  vulnerable_versions: string
}

export type PackagesAdvisories = Map<string, PackageAdvisory[]>

const packagesAdvisoriesCache = new Map<string, Cache<PackageAdvisory[]>>()
